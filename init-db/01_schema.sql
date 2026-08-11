CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS articles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    url         VARCHAR(2048) UNIQUE NOT NULL,
    source      VARCHAR(255) NOT NULL,
    published_at TIMESTAMPTZ,
    ingested_at  TIMESTAMPTZ DEFAULT NOW(),
    embedding   vector(384)
);

-- HNSW index: fast approximate nearest-neighbour, works well even with few rows
CREATE INDEX IF NOT EXISTS articles_embedding_hnsw_idx
    ON articles USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS articles_published_at_idx ON articles (published_at DESC);
CREATE INDEX IF NOT EXISTS articles_ingested_at_idx  ON articles (ingested_at DESC);
CREATE INDEX IF NOT EXISTS articles_source_idx       ON articles (source);
