#!/bin/bash
#
# Start Planner Redesign - Frontend + Backend
# Usage: ./start.sh [frontend-port] [backend-port]
# Default: Frontend on 3000, Backend on 8000
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

FRONTEND_PORT="${1:-3000}"
BACKEND_PORT="${2:-8000}"

RUN_DIR="$SCRIPT_DIR/.run"
LOG_DIR="$SCRIPT_DIR/.runlogs"
STATE_PATH="$RUN_DIR/state.json"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_LOG="$LOG_DIR/backend.log"

mkdir -p "$RUN_DIR" "$LOG_DIR"

info() { printf '[INFO] %s\n' "$1"; }
ok() { printf '[OK]   %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
err() { printf '[ERR]  %s\n' "$1" >&2; }

get_python() {
    if [ -x "$SCRIPT_DIR/.venv/bin/python" ]; then
        printf '%s\n' "$SCRIPT_DIR/.venv/bin/python"
        return
    fi
    if command -v python3 >/dev/null 2>&1; then
        printf 'python3\n'
        return
    fi
    if command -v python >/dev/null 2>&1; then
        printf 'python\n'
        return
    fi
    err "Python is not installed or not in PATH."
    exit 1
}

port_in_use() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1
        return $?
    fi
    if command -v ss >/dev/null 2>&1; then
        ss -ltn 2>/dev/null | grep -q ":$port "
        return $?
    fi
    netstat -tuln 2>/dev/null | grep -q ":$port "
}

wait_port() {
    local port="$1"
    local retries="${2:-50}"
    local i=0
    while [ "$i" -lt "$retries" ]; do
        if port_in_use "$port"; then
            return 0
        fi
        i=$((i + 1))
        sleep 0.5
    done
    return 1
}

wait_http() {
    local url="$1"
    local retries="${2:-50}"
    local i=0
    while [ "$i" -lt "$retries" ]; do
        if command -v curl >/dev/null 2>&1; then
            if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
                return 0
            fi
        else
            if "$PYTHON_CMD" -c "import urllib.request; urllib.request.urlopen('$url', timeout=3)" >/dev/null 2>&1; then
                return 0
            fi
        fi
        i=$((i + 1))
        sleep 0.6
    done
    return 1
}

PYTHON_CMD="$(get_python)"
info "Python command: $PYTHON_CMD"

if port_in_use "$FRONTEND_PORT"; then
    err "Frontend port $FRONTEND_PORT is already in use."
    exit 1
fi
if port_in_use "$BACKEND_PORT"; then
    err "Backend port $BACKEND_PORT is already in use."
    exit 1
fi

if ! "$PYTHON_CMD" -c "import uvicorn" >/dev/null 2>&1; then
    warn "uvicorn not found; installing backend requirements."
    "$PYTHON_CMD" -m pip install -r backend/requirements.txt
fi

info "Starting frontend on port $FRONTEND_PORT..."
(
    cd "$SCRIPT_DIR/frontend"
    "$PYTHON_CMD" -m http.server "$FRONTEND_PORT"
) >>"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

if ! wait_port "$FRONTEND_PORT" 40; then
    err "Frontend did not open port $FRONTEND_PORT. See $FRONTEND_LOG"
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
    exit 1
fi
ok "Frontend is listening on port $FRONTEND_PORT (PID $FRONTEND_PID)."

info "Starting backend on port $BACKEND_PORT..."
(
    cd "$SCRIPT_DIR"
    "$PYTHON_CMD" -m uvicorn backend.src.api.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload --reload-dir backend/src
) >>"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

if ! wait_port "$BACKEND_PORT" 60; then
    err "Backend did not open port $BACKEND_PORT. See $BACKEND_LOG"
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
    exit 1
fi

if ! wait_http "http://localhost:$BACKEND_PORT/api/health" 60; then
    err "Backend health check failed. See $BACKEND_LOG"
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
    exit 1
fi
ok "Backend is healthy on port $BACKEND_PORT (PID $BACKEND_PID)."

cat > "$STATE_PATH" <<EOF
{
  "started_at": "$(date '+%Y-%m-%dT%H:%M:%S')",
  "frontend_port": $FRONTEND_PORT,
  "backend_port": $BACKEND_PORT,
  "frontend_host_pid": $FRONTEND_PID,
  "backend_host_pid": $BACKEND_PID,
  "frontend_log": "$FRONTEND_LOG",
  "backend_log": "$BACKEND_LOG",
  "mode": "headless"
}
EOF

echo ""
ok "All services started."
echo "Frontend:    http://localhost:$FRONTEND_PORT"
echo "Backend API: http://localhost:$BACKEND_PORT"
echo "API Docs:    http://localhost:$BACKEND_PORT/docs"
echo "Health:      http://localhost:$BACKEND_PORT/api/health"
echo ""
echo "Logs:"
echo "  Frontend: $FRONTEND_LOG"
echo "  Backend:  $BACKEND_LOG"
echo ""
echo "Stop services with:"
echo "  ./stop.sh"
