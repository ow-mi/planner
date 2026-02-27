#!/bin/bash
#
# Stop Planner Redesign - Frontend + Backend
# Usage: ./stop.sh [frontend-port] [backend-port]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

FRONTEND_PORT="${1:-3000}"
BACKEND_PORT="${2:-8000}"
STATE_PATH="$SCRIPT_DIR/.run/state.json"

info() { printf '[INFO] %s\n' "$1"; }
ok() { printf '[OK]   %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }

stop_pid() {
    local pid="$1"
    local name="$2"
    if [ -z "$pid" ]; then
        return 1
    fi
    if kill -0 "$pid" >/dev/null 2>&1; then
        info "Stopping $name (PID $pid)..."
        kill "$pid" >/dev/null 2>&1 || true
        sleep 0.5
        if kill -0 "$pid" >/dev/null 2>&1; then
            kill -9 "$pid" >/dev/null 2>&1 || true
        fi
        ok "$name stopped."
        return 0
    fi
    return 1
}

port_pids() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
        return
    fi
    if command -v ss >/dev/null 2>&1; then
        ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p {print $NF}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' || true
        return
    fi
    netstat -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p {print $7}' | cut -d/ -f1 || true
}

stop_by_port() {
    local port="$1"
    local name="$2"
    local killed=1
    local pids
    pids="$(port_pids "$port" | sort -u)"
    if [ -n "$pids" ]; then
        while IFS= read -r pid; do
            [ -n "$pid" ] || continue
            if stop_pid "$pid" "$name (port $port)"; then
                killed=0
            fi
        done <<< "$pids"
    fi
    return $killed
}

info "Stopping Planner services..."

frontend_stopped=1
backend_stopped=1

if [ -f "$STATE_PATH" ]; then
    if command -v python3 >/dev/null 2>&1; then
        state_json="$(python3 -c "import json,sys;print(json.dumps(json.load(open('$STATE_PATH'))))" 2>/dev/null || true)"
    elif command -v python >/dev/null 2>&1; then
        state_json="$(python -c "import json,sys;print(json.dumps(json.load(open('$STATE_PATH'))))" 2>/dev/null || true)"
    else
        state_json=""
    fi

    if [ -n "${state_json:-}" ]; then
        if command -v python3 >/dev/null 2>&1; then
            FRONTEND_PID="$(python3 -c "import json; s=json.load(open('$STATE_PATH')); print(s.get('frontend_host_pid',''))" 2>/dev/null || true)"
            BACKEND_PID="$(python3 -c "import json; s=json.load(open('$STATE_PATH')); print(s.get('backend_host_pid',''))" 2>/dev/null || true)"
            FRONTEND_PORT="$(python3 -c "import json; s=json.load(open('$STATE_PATH')); print(s.get('frontend_port',$FRONTEND_PORT))" 2>/dev/null || echo "$FRONTEND_PORT")"
            BACKEND_PORT="$(python3 -c "import json; s=json.load(open('$STATE_PATH')); print(s.get('backend_port',$BACKEND_PORT))" 2>/dev/null || echo "$BACKEND_PORT")"
        elif command -v python >/dev/null 2>&1; then
            FRONTEND_PID="$(python -c "import json; s=json.load(open('$STATE_PATH')); print(s.get('frontend_host_pid',''))" 2>/dev/null || true)"
            BACKEND_PID="$(python -c "import json; s=json.load(open('$STATE_PATH')); print(s.get('backend_host_pid',''))" 2>/dev/null || true)"
            FRONTEND_PORT="$(python -c "import json; s=json.load(open('$STATE_PATH')); print(s.get('frontend_port',$FRONTEND_PORT))" 2>/dev/null || echo "$FRONTEND_PORT")"
            BACKEND_PORT="$(python -c "import json; s=json.load(open('$STATE_PATH')); print(s.get('backend_port',$BACKEND_PORT))" 2>/dev/null || echo "$BACKEND_PORT")"
        fi

        if stop_pid "${FRONTEND_PID:-}" "Frontend"; then
            frontend_stopped=0
        fi
        if stop_pid "${BACKEND_PID:-}" "Backend"; then
            backend_stopped=0
        fi
    else
        warn "Could not parse $STATE_PATH; falling back to port-based stop."
    fi
fi

if [ "$frontend_stopped" -ne 0 ]; then
    if stop_by_port "$FRONTEND_PORT" "Frontend"; then
        frontend_stopped=0
    else
        warn "No frontend listener found on port $FRONTEND_PORT."
    fi
fi

if [ "$backend_stopped" -ne 0 ]; then
    if stop_by_port "$BACKEND_PORT" "Backend"; then
        backend_stopped=0
    else
        warn "No backend listener found on port $BACKEND_PORT."
    fi
fi

rm -f "$STATE_PATH"
ok "Stop routine completed."
