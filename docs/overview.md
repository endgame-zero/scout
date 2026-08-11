# Scout — how the pieces talk to each other

Scout is a live news desk in software. It keeps scooping up articles from 16 outlets around the world, embeds them, and lets you ask questions in plain English about what’s breaking right now.

---

## Big picture

```
┌─────────────────────────────────────────────────────────────────┐
│                         YOUR BROWSER                            │
│                      Scout UI  :5173                            │
│          [ Ask panel ]              [ The wire ]                │
└────────────┬────────────────────────────┬───────────────────────┘
             │ POST /api/query (SSE)       │ GET /api/articles/recent
             │ GET /api/stats              │ (polls about once a minute)
             ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend :8000                       │
│   /api/query  →  embed question  →  vector search  →  LLM      │
│   /api/articles/recent  →  grab recent rows from the DB         │
│   /api/stats  →  counts + which outlets are busiest             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ read / write
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PostgreSQL + pgvector :5432                     │
│   articles: title, content, url, source,                        │
│             published_at, embedding (vector 384)                │
│   HNSW index on embedding so similarity search stays snappy     │
└──────────────────────────▲──────────────────────────────────────┘
                           │ upsert articles + embeddings
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                     Embedding Worker                             │
│   Pulls from Redis → calls HuggingFace → writes to Postgres     │
└──────────────────────────▲──────────────────────────────────────┘
                           │ new articles land here
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│               Redis Stream  (raw-news)  :6379                   │
└──────────────────────────▲──────────────────────────────────────┘
                           │ only publish if we haven’t seen the URL
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                      RSS Ingestion Service                       │
│   Checks 16 feeds about every five minutes                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dig into each flow

| If you want to know… | Read |
|----------------------|------|
| How a headline gets from an RSS feed into the database | [ingestion.md](ingestion.md) |
| How your question turns into a sourced answer | [rag-query.md](rag-query.md) |
| How the wire sidebar stays fresh | [live-feed.md](live-feed.md) |

---

## Why these tools

| Job | Pick | Why it works here |
|-----|------|-------------------|
| News sources | RSS from 16 outlets | Universal, no per-outlet API keys |
| Queue | Redis Streams | Ordered, durable, consumer groups — and Redis is already around |
| Vectors | Postgres + pgvector | One database for rows and embeddings; HNSW is plenty fast |
| Embeddings | BAAI/bge-small-en-v1.5 (384 dims) | Small, quick, solid retrieval |
| LLM | Llama-3.3-70B via HuggingFace | OpenAI-compatible without an OpenAI account |
| Backend | FastAPI | Async-native and happy to stream SSE |
| Frontend | React + Vite + Tailwind | Quick to iterate; no heavy build step in dev |
