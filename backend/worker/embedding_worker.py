"""
Reads raw articles from a Redis Stream (consumer group), generates embeddings
via HuggingFace, and upserts the vectorised article into PostgreSQL.
"""
import asyncio
import json
import logging
from datetime import datetime

import asyncpg
import httpx
import redis.asyncio as aioredis
from tenacity import retry, stop_after_attempt, wait_exponential, before_sleep_log

from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

CONSUMER_GROUP = "embedding-workers"
CONSUMER_NAME = "worker-1"


@retry(
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    before_sleep=before_sleep_log(log, logging.WARNING),
)
async def get_embedding(text: str) -> list[float]:
    url = f"{settings.embedding_base_url}/models/{settings.embedding_model}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {settings.embedding_api_key}"},
            json={"inputs": text[:1024]},
        )
        resp.raise_for_status()
        result = resp.json()
        if result and isinstance(result[0], list):
            return result[0]
        return result


async def upsert_article(pool: asyncpg.Pool, msg: dict, embedding: list[float]):
    published_at: datetime | None = None
    if msg.get("published_at"):
        try:
            published_at = datetime.fromisoformat(msg["published_at"])
        except ValueError:
            pass

    await pool.execute(
        """
        INSERT INTO articles (title, content, url, source, published_at, embedding)
        VALUES ($1, $2, $3, $4, $5, $6::vector)
        ON CONFLICT (url) DO UPDATE
            SET embedding   = EXCLUDED.embedding,
                ingested_at = NOW()
        """,
        msg["title"],
        msg["content"],
        msg["url"],
        msg["source"],
        published_at,
        json.dumps(embedding),
    )


async def process(pool: asyncpg.Pool, raw: dict):
    embed_input = f"{raw['title']} {raw['content']}"
    try:
        embedding = await get_embedding(embed_input)
        await upsert_article(pool, raw, embedding)
        log.info(f"Stored: [{raw['source']}] {raw['title'][:70]}")
    except Exception as e:
        log.error(f"Failed: '{raw.get('title', '?')}': {e}")


async def ensure_group(redis: aioredis.Redis):
    try:
        await redis.xgroup_create(settings.redis_stream, CONSUMER_GROUP, id="0", mkstream=True)
        log.info(f"Created consumer group '{CONSUMER_GROUP}'")
    except aioredis.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


async def main():
    pool = await asyncpg.create_pool(dsn=settings.asyncpg_url, min_size=2, max_size=10)
    # socket_timeout=None required for blocking XREADGROUP calls
    redis = aioredis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_timeout=None,
        socket_connect_timeout=5,
    )

    await ensure_group(redis)
    log.info("Embedding worker started — listening on Redis Stream")

    try:
        while True:
            try:
                entries = await redis.xreadgroup(
                    CONSUMER_GROUP,
                    CONSUMER_NAME,
                    {settings.redis_stream: ">"},
                    count=5,
                    block=2000,  # block up to 2s waiting for messages
                )
            except Exception as e:
                log.warning(f"Stream read error (retrying): {e}")
                await asyncio.sleep(1)
                continue

            if not entries:
                continue
            for _stream, messages in entries:
                for msg_id, fields in messages:
                    try:
                        raw = json.loads(fields["data"])
                        await process(pool, raw)
                        await redis.xack(settings.redis_stream, CONSUMER_GROUP, msg_id)
                    except Exception as e:
                        log.error(f"Message {msg_id} failed: {e}")
    finally:
        await redis.aclose()
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
