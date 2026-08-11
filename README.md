# Scout — Ask the news what's going on

Scout listens to live RSS feeds, turns every new article into a searchable vector, and answers your questions with citations from stories that landed minutes ago — not last week's training data.

---

## What's under the hood

### Backend
| Technology | What we use it for |
|------------|--------------------|
| **Python 3.12** | Backend language |
| **FastAPI** | REST API + Server-Sent Events so answers stream token by token |
| **PostgreSQL 16** | Stores articles and their embeddings |
| **pgvector** | Similarity search inside Postgres |
| **Redis Streams** | Queue between the feed poller and the embedding worker |
| **feedparser** | Reads RSS from news outlets |
| **httpx** | Async calls out to HuggingFace |
| **SQLAlchemy (async)** | Talks to Postgres without blocking |
| **asyncpg** | Fast async Postgres driver |
| **tenacity** | Retries when an API flakes out |
| **BeautifulSoup** | Strips HTML junk from RSS bodies |

### AI / ML
| Technology | What we use it for |
|------------|--------------------|
| **BAAI/bge-small-en-v1.5** | Turns text into 384-dim vectors |
| **Llama-3.3-70B-Instruct** | Writes the answer from the articles we retrieved |
| **HuggingFace Router** | Hosts both models behind an OpenAI-style API |

### Frontend
| Technology | What we use it for |
|------------|--------------------|
| **React 18** | UI |
| **Vite** | Dev server and bundler |
| **Tailwind CSS** | Styling |
| **lucide-react** | Icons |

---

## How it fits together

```
RSS Feeds → Ingestion → Redis Stream → Embedding Worker → PostgreSQL
                                                              ↑
                                      Your question → FastAPI ┘
                                                           ↓
                                               LLM (Llama-3.3-70B)
                                                           ↓
                                              React UI (streams SSE)
```

1. The **ingestion service** checks 16 major RSS feeds about every five minutes and drops new pieces onto a Redis Stream.
2. The **embedding worker** picks those up, asks HuggingFace for a vector, and saves everything in Postgres.
3. When you ask something, **FastAPI** embeds your question, runs a time-weighted similarity search, builds a prompt from the best hits, and streams the model’s reply back to the browser.

The longer walkthroughs live in [`docs/`](docs/).

---

## What you need first

- Python 3.12
- Node.js 18+
- PostgreSQL 16 with `postgresql-16-pgvector`
- Redis 7

On Ubuntu/Debian:

```bash
sudo apt install postgresql-16 postgresql-16-pgvector redis-server
```

---

## Setup

### 1. Clone and hop in
```bash
git clone <repo-url>
cd real-time-news-streaming
```

### 2. Drop in your API keys
```bash
cp .env.example .env
```

Put your HuggingFace key in `.env`:

```
LLM_API_KEY=hf_your_key_here
EMBEDDING_API_KEY=hf_your_key_here
```

Everything else is fine for a local run.

### 3. Stand up the database
```bash
sudo bash setup_db.sh
```

That creates `newsdb`, the `newsuser` role, turns on the `vector` extension, and builds the indexes.

### 4. Install Python packages
```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
```

### 5. Install frontend packages
```bash
cd frontend && npm install && cd ..
```

---

## Running it

One command starts the whole stack:

```bash
bash run.sh
```

That launches four processes and tails their logs:

| Service | What you get |
|---------|--------------|
| FastAPI backend | API at `http://localhost:8000` |
| RSS ingestion | Polls 16 feeds every ~5 minutes |
| Embedding worker | Redis → vectors → Postgres |
| Vite dev server | Scout UI at `http://localhost:5173` |

Open **http://localhost:5173**. Logs land in `logs/`. Hit `Ctrl+C` when you’re done.

---

## API

| Method | Endpoint | Notes |
|--------|----------|-------|
| `GET` | `/health` | Is the API up? |
| `POST` | `/api/query` | Ask a question — streams SSE |
| `GET` | `/api/articles/recent` | Recent stories (`?hours=24&limit=30`) |
| `GET` | `/api/stats` | Counts and top sources |

---

## Layout of the repo

```
real-time-news-streaming/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry
│   │   ├── config.py            # Settings from .env
│   │   ├── database.py          # Async SQLAlchemy engine
│   │   ├── models.py            # Article model
│   │   ├── routers/
│   │   │   └── query.py         # Route handlers
│   │   └── services/
│   │       ├── rag.py           # Search + LLM
│   │       └── embeddings.py    # HuggingFace embeddings
│   ├── ingestion/
│   │   ├── rss_poller.py        # Polls feeds → Redis
│   │   └── feeds.py             # Feed URL list
│   └── worker/
│       └── embedding_worker.py  # Redis → vectors → DB
├── frontend/
│   └── src/
│       ├── App.jsx              # Brand + layout
│       ├── api.js               # Fetch + SSE client
│       └── components/
│           ├── QueryInterface.jsx  # Ask box + streaming brief
│           ├── LiveFeed.jsx        # The wire sidebar
│           └── NewsCard.jsx        # Single headline row
├── init-db/
│   └── 01_schema.sql
├── docs/
├── setup_db.sh
├── run.sh
└── .env
```

## Docker Compose

If you’d rather containerize everything (Docker 24+):

```bash
docker compose up --build
```

That brings up Postgres, Redis, the API, and the Vite frontend together.
