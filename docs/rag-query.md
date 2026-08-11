# How your question becomes a briefing

This path runs whenever you hit **Ask Scout**. We dig up the most relevant recent articles and hand them to an LLM so the answer is grounded in what’s actually on the wire.

That’s RAG — **Retrieval-Augmented Generation**. The model doesn’t invent from memory alone; it gets real article text as context, which is why Scout can talk about stories that broke this morning.

---

## Walkthrough

```
You type a question and click Ask Scout
        │
        │  POST /api/query
        │  { "question": "...", "hours_back": 24 }
        ▼
┌────────────────────────┐
│  FastAPI /api/query    │
└────────┬───────────────┘
         │
         │  Embed the question with the same model
         │  POST huggingface → BAAI/bge-small-en-v1.5
         │  → 384-dim query vector
         ▼
┌────────────────────────┐
│  Vector Search         │
│  (PostgreSQL)          │
└────────┬───────────────┘
         │
         │  Pull the 8 best matches from the last ~48 hours,
         │  ranked by:
         │
         │  score = cosine_similarity × recency_boost
         │
         │  recency_boost:
         │    published < 24h ago  →  ×1.4   ← favor breaking news
         │    published 24–48h ago →  ×1.0
         │    older                →  ×0.6
         │
         │  So a perfect match from two days ago doesn’t
         │  automatically beat a decent match from this morning.
         ▼
┌────────────────────────┐
│  Context Assembly      │
└────────┬───────────────┘
         │
         │  Each hit becomes a short block:
         │
         │  [1] BBC News — 2026-07-16 09:30 UTC
         │  Title: ...
         │  URL: ...
         │  Content: (first 800 chars)
         │
         │  Those blocks plus your question go into the prompt.
         ▼
┌────────────────────────┐
│  LLM (Llama-3.3-70B)   │
│  via HuggingFace router │
└────────┬───────────────┘
         │
         │  System instructions boil down to:
         │   - Stick to the context we gave you
         │   - Cite outlet + title
         │   - Say so if the context isn’t enough
         │
         │  Tokens stream back over SSE
         ▼
┌────────────────────────┐
│  React (QueryInterface)│
└────────────────────────┘
         │
         Each chunk paints as it arrives —
         the brief looks like it’s typing itself.
```

---

## Why we weight for freshness

Plain vector search only cares about meaning. For news, a near-perfect match from three days ago is usually less useful than a pretty-good match from this morning.

The recency multiplier nudges ranking toward what’s new without throwing relevance out the window. An old but very on-point piece can still win if nothing recent fits.

---

## Roughly what the model sees

```
System:
  You are an executive intelligence briefing assistant. Answer
  based strictly on the provided news context. Always cite sources.
  If context is insufficient, say so.

User:
  Question: What is happening with Ukraine's defence ministry?

  NEWS CONTEXT:

  [1] Financial Times — 2026-07-16 09:44 UTC
  Title: Zelenskyy's government plunged into turmoil by defence minister's firing
  URL: https://ft.com/...
  Content: Ukraine's President Volodymyr Zelenskyy has dismissed...

  [2] New York Times — 2026-07-16 09:44 UTC
  Title: Ukraine's Ousted Defense Minister Attacks the Military's Old Guard
  ...
```

---

## Where the code lives

| File | Job |
|------|-----|
| `backend/app/routers/query.py` | Takes the request, streams SSE |
| `backend/app/services/rag.py` | Embeds, searches, calls the LLM |
| `backend/app/services/embeddings.py` | Shared embedding helper |
| `frontend/src/components/QueryInterface.jsx` | Sends the ask, paints the stream |
| `frontend/src/api.js` | `streamQuery()` reads SSE |
