#!/bin/bash
#
# Start Planner Redesign - Frontend + Backend
# Usage: ./start.sh [frontend-port] [backend-port]
# Default: Frontend on 3000, Backend on 8000
#

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Parse ports
FRONTEND_PORT="${1:-3000}"
BACKEND_PORT="${2:-8000}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Planner Redesign Startup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Frontend:${NC} http://localhost:$FRONTEND_PORT"
echo -e "${GREEN}Backend:${NC}  http://localhost:$BACKEND_PORT"
echo ""

# Check if ports are already in use
check_port() {
    local port=$1
    local name=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo -e "${RED}Error: Port $port is already in use. $name may already be running.${NC}"
        return 1
    fi
    return 0
}

# Check Python availability
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        echo -e "${RED}Error: Python is not installed or not in PATH${NC}"
        exit 1
    fi
}

# Cleanup function to kill background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo -e "${GREEN}✓ Frontend stopped${NC}"
    fi
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo -e "${GREEN}✓ Backend stopped${NC}"
    fi
    exit 0
}

# Set trap to cleanup on CTRL+C
trap cleanup SIGINT SIGTERM

# Check prerequisites
check_python

# Check ports
check_port $FRONTEND_PORT "Frontend" || exit 1
check_port $BACKEND_PORT "Backend" || exit 1

echo -e "${YELLOW}Starting services...${NC}"
echo ""

# Start Frontend (Python HTTP server)
echo -e "${BLUE}Starting Frontend on port $FRONTEND_PORT...${NC}"
cd frontend
$PYTHON_CMD -m http.server $FRONTEND_PORT &
FRONTEND_PID=$!
cd ..

# Wait a moment to ensure frontend started
sleep 1
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}Error: Frontend failed to start${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Frontend running (PID: $FRONTEND_PID)${NC}"
echo ""

# Start Backend (Uvicorn)
echo -e "${BLUE}Starting Backend on port $BACKEND_PORT...${NC}"

# Set PYTHONPATH so imports work correctly (backend is inside project root)
export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

# Check if virtual environment exists and activate it
if [ -d "$SCRIPT_DIR/.venv" ]; then
    source "$SCRIPT_DIR/.venv/bin/activate"
    echo -e "${GREEN}✓ Activated virtual environment${NC}"
fi

# Check for uvicorn
if ! $PYTHON_CMD -c "import uvicorn" 2>/dev/null; then
    echo -e "${YELLOW}Warning: Uvicorn not found. Installing dependencies...${NC}"
    pip install -r backend/requirements.txt
fi

# Run uvicorn from project root with correct PYTHONPATH
$PYTHON_CMD -m uvicorn backend.src.api.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload \
    --reload-dir backend/src &
BACKEND_PID=$!

# Wait a moment to ensure backend started
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Error: Backend failed to start${NC}"
    kill $FRONTEND_PID 2>/dev/null
    exit 1
fi
echo -e "${GREEN}✓ Backend running (PID: $BACKEND_PID)${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  All services started successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Frontend:${NC} http://localhost:$FRONTEND_PORT"
echo -e "${BLUE}Backend API:${NC} http://localhost:$BACKEND_PORT"
echo -e "${BLUE}API Docs:${NC} http://localhost:$BACKEND_PORT/docs"
echo ""
echo -e "${YELLOW}Press CTRL+C to stop all services${NC}"
echo ""

# Wait for both processes
wait
