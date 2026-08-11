# How stories get into Scout

This pipeline never really stops. Its whole job is to turn raw RSS into searchable vectors so your questions have something fresh to land on.

---

## Walkthrough

```
RSS Feed (BBC, Reuters, NYT ...)
        │
        │  feedparser.parse(url)
        ▼
┌───────────────────────┐
│   RSS Ingestion       │  about every 5 minutes
│   Service             │  hits all 16 feeds in parallel
└───────┬───────────────┘
        │
        │  For each entry:
        │  1. Skip if that URL is already in Postgres  ← no doubles
        │  2. Strip HTML from title + body
        │  3. Parse published_at
        │
        │  XADD raw-news * data <json>
        ▼
┌───────────────────────┐
│   Redis Stream        │  buffer / queue
│   (raw-news)          │  capped around 20,000 messages
└───────┬───────────────┘
        │
        │  XREADGROUP (consumer group "embedding-workers")
        ▼
┌───────────────────────┐
│   Embedding Worker    │  grabs up to 5 messages at a time
└───────┬───────────────┘
        │
        │  POST huggingface → BAAI/bge-small-en-v1.5
        │  body: { "inputs": "<title> <content>" }
        ▼
┌───────────────────────┐
│  HuggingFace API      │  hands back a 384-float vector
└───────┬───────────────┘
        │
        │  INSERT INTO articles (..., embedding)
        │  ON CONFLICT (url) DO UPDATE   ← safe if we see it twice
        ▼
┌───────────────────────┐
│  PostgreSQL           │  story is ready to search
│  (articles table)     │
└───────────────────────┘
```

---

## Things worth knowing

**We dedupe twice.** Before publishing, the poller checks `SELECT 1 FROM articles WHERE url = $1` — if it’s already there, the story never hits the queue. On write, `ON CONFLICT (url) DO UPDATE` catches anything that slipped through so the table stays clean.

**RSS is messy.** Summaries often come wrapped in HTML. BeautifulSoup peels that off before we embed, so the model sees plain words.

**What we embed.** Title and body get glued together (`"<title> <content>"`) and trimmed to 1,024 characters. That’s usually enough signal without burning tokens.

**Flaky APIs happen.** The embedding call retries up to four times with backoff (roughly 2s → 30s) before we abandon a message.

**Redis doesn’t grow forever.** The stream is capped near 20,000 entries (`MAXLEN ~20000`). Oldest messages get trimmed so memory stays bounded.

---

## Where the code lives

| File | Job |
|------|-----|
| `backend/ingestion/rss_poller.py` | Polls feeds, pushes to Redis |
| `backend/ingestion/feeds.py` | The 16 feed URLs and outlet names |
| `backend/worker/embedding_worker.py` | Consumes the stream, embeds, stores |
| `init-db/01_schema.sql` | Tables and indexes |
