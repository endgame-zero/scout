import os
from datetime import datetime, timezone, timedelta
from typing import AsyncGenerator

from openai import AsyncOpenAI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from .embeddings import embed

RAG_ARTICLE_LIMIT = int(os.environ.get("RAG_ARTICLE_LIMIT", 8))


async def search_articles(
    query_embedding: list[float],
    hours_back: int,
    db: AsyncSession,
    limit: int = 8,
) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max(hours_back, 48))

    # Inline the embedding as a float literal — it's internal model output,
    # no injection risk. This avoids SQLAlchemy misreading ::vector as a param.
    emb_literal = "[" + ",".join(f"{x:.8f}" for x in query_embedding) + "]"

    sql = text(f"""
        SELECT
            title,
            content,
            url,
            source,
            published_at,
            ROUND((1 - (embedding <=> '{emb_literal}'::vector))::numeric, 4) AS similarity,
            CASE
                WHEN published_at > NOW() - INTERVAL '24 hours' THEN 1.4
                WHEN published_at > NOW() - INTERVAL '48 hours' THEN 1.0
                ELSE 0.6
            END AS recency_boost,
            (1 - (embedding <=> '{emb_literal}'::vector)) * CASE
                WHEN published_at > NOW() - INTERVAL '24 hours' THEN 1.4
                WHEN published_at > NOW() - INTERVAL '48 hours' THEN 1.0
                ELSE 0.6
            END AS score
        FROM articles
        WHERE published_at > :cutoff
          AND embedding IS NOT NULL
        ORDER BY score DESC
        LIMIT :limit
    """)

    result = await db.execute(sql, {"cutoff": cutoff, "limit": limit})
    return [dict(row) for row in result.mappings().all()]


async def rag_query(
    question: str,
    hours_back: int,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    query_embedding = await embed(question)
    articles = await search_articles(query_embedding, hours_back, db)

    if not articles:
        yield "No recent news articles found matching your query. The database may still be building up content — check back in a few minutes."
        return

    context_parts = []
    for i, a in enumerate(articles, 1):
        pub = a["published_at"]
        pub_str = pub.strftime("%Y-%m-%d %H:%M UTC") if pub else "Unknown time"
        context_parts.append(
            f"[{i}] {a['source']} — {pub_str}\n"
            f"Title: {a['title']}\n"
            f"URL: {a['url']}\n"
            f"Content: {a['content'][:800]}"
        )

    context = "\n\n---\n\n".join(context_parts)

    system_prompt = (
        "You are an executive intelligence briefing assistant with access to breaking news "
        "from the past 24–48 hours. Answer the user's question based strictly on the provided "
        "news context. Always cite sources by mentioning the outlet name and article title. "
        "If the context is insufficient, say so explicitly. Be concise, factual, and direct."
    )

    user_prompt = (
        f"Question: {question}\n\n"
        f"NEWS CONTEXT (most relevant recent articles):\n\n{context}\n\n"
        "Provide a clear, sourced answer based on these breaking developments."
    )

    client = AsyncOpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)

    stream = await client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        stream=True,
        max_tokens=1024,
        temperature=0.3,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content

# Apply recency decay: articles older than 24h score lower in retrieval
