import json
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Article
from ..services.rag import rag_query

router = APIRouter()


class QueryRequest(BaseModel):
    question: str
    hours_back: int = 24


@router.post("/query")
async def query_news(request: QueryRequest, db: AsyncSession = Depends(get_db)):
    async def generate():
        try:
            async for chunk in rag_query(request.question, request.hours_back, db):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/articles/recent")
async def recent_articles(
    hours: int = Query(default=24, le=168),
    limit: int = Query(default=30, le=100),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(Article)
        .where(Article.published_at >= cutoff)
        .order_by(Article.published_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": str(a.id),
            "title": a.title,
            "url": a.url,
            "source": a.source,
            "published_at": a.published_at.isoformat() if a.published_at else None,
            "ingested_at": a.ingested_at.isoformat() if a.ingested_at else None,
        }
        for a in result.scalars().all()
    ]


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    total = await db.scalar(select(func.count(Article.id)))
    last_24h = await db.scalar(
        select(func.count(Article.id)).where(
            Article.published_at >= datetime.now(timezone.utc) - timedelta(hours=24)
        )
    )
    latest_ingested = await db.scalar(select(func.max(Article.ingested_at)))
    sources_result = await db.execute(
        text("SELECT source, COUNT(*) as cnt FROM articles GROUP BY source ORDER BY cnt DESC LIMIT 10")
    )
    return {
        "total_articles": total or 0,
        "articles_last_24h": last_24h or 0,
        "last_ingested": latest_ingested.isoformat() if latest_ingested else None,
        "top_sources": [{"source": r.source, "count": r.cnt} for r in sources_result],
    }
