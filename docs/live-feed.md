# How the wire stays live

The wire is the column on the right in Scout. It’s a rolling list of the newest stories in the database, and it refreshes on its own so you don’t have to babysit it.

---

## Walkthrough

```
React (LiveFeed.jsx)
        │
        │  On mount: fetch right away
        │  Then: again about every 60 seconds
        │
        │  GET /api/articles/recent?hours=24&limit=30
        ▼
┌────────────────────────┐
│  FastAPI               │
│  /api/articles/recent  │
└────────┬───────────────┘
         │
         │  SELECT * FROM articles
         │  WHERE published_at >= NOW() - INTERVAL '24h'
         │  ORDER BY published_at DESC
         │  LIMIT 30
         ▼
┌────────────────────────┐
│  PostgreSQL            │
└────────┬───────────────┘
         │
         │  Returns metadata only — no embeddings needed
         │  just to paint headlines
         ▼
┌────────────────────────┐
│  LiveFeed.jsx          │  one row per article (NewsCard)
└────────────────────────┘
```

---

## What you see on each row

- **Outlet name** in the accent color so you can skim sources fast
- **Headline** that opens the original story
- **Relative time** like “4m ago” or “2h ago” (and “just now” if the clock is slightly ahead of your browser)

---

## Knobs you can turn

| Control | What it does |
|---------|--------------|
| Time window (1h / 6h / 24h / 48h) | Changes the `hours` query param and refetches immediately |
| Refresh | Pulls the latest list right now |

---

## The quiet stats under the brand

The ask panel also polls for counts so the “stories indexed” line stays honest:

```
GET /api/stats   (every 30 seconds)

You get:
  total_articles     — everything we’ve ever stored
  articles_last_24h  — published in the last day
  last_ingested      — when the newest piece landed
  top_sources        — ten busiest outlets
```

---

## Where the code lives

| File | Job |
|------|-----|
| `frontend/src/components/LiveFeed.jsx` | Polling + wire layout |
| `frontend/src/components/NewsCard.jsx` | One headline row + `timeAgo` |
| `frontend/src/App.jsx` | Brand, stats line, overall split |
| `frontend/src/api.js` | `fetchRecentArticles()` and `fetchStats()` |
| `backend/app/routers/query.py` | The `/recent` and `/stats` endpoints |
