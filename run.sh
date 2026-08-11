#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Cleanup on exit ──────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  echo "==> Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "==> Stopped."
}
trap cleanup EXIT INT TERM

# ── Python path ───────────────────────────────────────────────────────────────
PYTHON="$ROOT/.venv/bin/python"
export PYTHONPATH="$ROOT/backend"
set -a; source "$ROOT/.env"; set +a

# ── Backend API ───────────────────────────────────────────────────────────────
echo "==> Starting FastAPI backend on :8000 ..."
"$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  --app-dir "$ROOT/backend" --reload \
  > "$ROOT/logs/backend.log" 2>&1 &
PIDS+=($!)

sleep 1

# ── RSS Ingestion service ─────────────────────────────────────────────────────
echo "==> Starting RSS ingestion service ..."
(cd "$ROOT/backend" && "$PYTHON" -m ingestion.rss_poller) \
  > "$ROOT/logs/ingestion.log" 2>&1 &
PIDS+=($!)

# ── Embedding worker ──────────────────────────────────────────────────────────
echo "==> Starting embedding worker ..."
(cd "$ROOT/backend" && "$PYTHON" -m worker.embedding_worker) \
  > "$ROOT/logs/worker.log" 2>&1 &
PIDS+=($!)

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "==> Installing frontend deps and starting Vite on :5173 ..."
(cd "$ROOT/frontend" && npm install --silent && npm run dev) \
  > "$ROOT/logs/frontend.log" 2>&1 &
PIDS+=($!)

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Scout UI   →  http://localhost:5173         ║"
echo "║  API        →  http://localhost:8000/health  ║"
echo "║  Logs       →  ./logs/                       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# ── Tail all logs to stdout ───────────────────────────────────────────────────
sleep 2
tail -f "$ROOT/logs/"*.log &
PIDS+=($!)

wait
