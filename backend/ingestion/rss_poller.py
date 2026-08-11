"""
Polls RSS feeds on a fixed interval and publishes new articles to a Redis Stream.
Deduplication is done via a URL existence check against PostgreSQL.
"""
import asyncio
import json
import logging
import time
from datetime import datetime, timezone

import asyncpg
import feedparser
import redis.asyncio as aioredis
from bs4 import BeautifulSoup

from app.config import settings
from .feeds import RSS_FEEDS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

STREAM_MAXLEN = 20_000  # cap stream size; oldest messages are trimmed


def clean_html(raw: str) -> str:
    if not raw:
        return ""
    return BeautifulSoup(raw, "lxml").get_text(separator=" ", strip=True)


def parse_published(entry) -> str:
    for attr in ("published_parsed", "updated_parsed"):
        val = getattr(entry, attr, None)
        if val:
            dt = datetime.fromtimestamp(time.mktime(val), tz=timezone.utc)
            return dt.isoformat()
    return datetime.now(timezone.utc).isoformat()


def extract_content(entry) -> str:
    for field in ("content", "summary_detail", "summary"):
        val = getattr(entry, field, None)
        if val is None:
            continue
        if isinstance(val, list) and val:
            return clean_html(val[0].get("value", ""))
        if hasattr(val, "value"):
            return clean_html(val.value)
        if isinstance(val, str):
            return clean_html(val)
    return ""


async def url_exists(pool: asyncpg.Pool, url: str) -> bool:
    row = await pool.fetchrow("SELECT 1 FROM articles WHERE url = $1", url)
    return row is not None


async def poll_feed(feed: dict, redis: aioredis.Redis, pool: asyncpg.Pool) -> int:
    url, source = feed["url"], feed["source"]
    try:
        parsed = feedparser.parse(url)
        sent = 0
        for entry in parsed.entries:
            link = getattr(entry, "link", None)
            if not link:
                continue
            if await url_exists(pool, link):
                continue

            title = clean_html(getattr(entry, "title", "Untitled"))
            content = extract_content(entry)
            if not content or len(content) < 50:
                continue

            payload = json.dumps({
                "title": title,
                "content": content[:4000],
                "url": link,
                "source": source,
                "published_at": parse_published(entry),
            })

            await redis.xadd(
                settings.redis_stream,
                {"data": payload},
                maxlen=STREAM_MAXLEN,
                approximate=True,
            )
            sent += 1

        if sent:
            log.info(f"[{source}] {sent} new article(s) published to stream")
        return sent
    except Exception as e:
        log.error(f"[{source}] Poll error: {e}")
        return 0


async def main():
    pool = await asyncpg.create_pool(dsn=settings.asyncpg_url, min_size=2, max_size=5)
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)

    log.info(f"RSS poller started — {len(RSS_FEEDS)} feeds, interval={settings.poll_interval_seconds}s")

    try:
        while True:
            tasks = [poll_feed(feed, redis, pool) for feed in RSS_FEEDS]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            total = sum(r for r in results if isinstance(r, int))
            log.info(f"Poll cycle complete — {total} new articles sent to stream")
            await asyncio.sleep(settings.poll_interval_seconds)
    finally:
        await redis.aclose()
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())

# Skip articles already stored to prevent duplicate embeddings
