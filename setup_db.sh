#!/usr/bin/env bash
set -e

DB=newsdb
USER=newsuser
PASS=newspass

echo "==> Setting up PostgreSQL database..."

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$USER') THEN
    CREATE ROLE $USER LOGIN PASSWORD '$PASS';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE $DB OWNER $USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB') \gexec
SQL

sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 <<SQL
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS articles (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    content      TEXT NOT NULL,
    url          VARCHAR(2048) UNIQUE NOT NULL,
    source       VARCHAR(255) NOT NULL,
    published_at TIMESTAMPTZ,
    ingested_at  TIMESTAMPTZ DEFAULT NOW(),
    embedding    vector(384)
);

CREATE INDEX IF NOT EXISTS articles_embedding_hnsw_idx
    ON articles USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS articles_published_at_idx ON articles (published_at DESC);
CREATE INDEX IF NOT EXISTS articles_ingested_at_idx  ON articles (ingested_at DESC);
CREATE INDEX IF NOT EXISTS articles_source_idx       ON articles (source);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $USER;
GRANT USAGE ON SCHEMA public TO $USER;
SQL

echo "==> Database ready."
