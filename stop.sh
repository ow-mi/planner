#!/bin/bash
#
# Stop Planner Redesign - Frontend + Backend
# Usage: ./stop.sh
#

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping Planner Redesign services...${NC}"
echo ""

# Find and kill Python HTTP server processes (frontend)
FRONTEND_PIDS=$(pgrep -f "python.*http.server.*3000" 2>/dev/null)
if [ -n "$FRONTEND_PIDS" ]; then
    echo -e "${YELLOW}Stopping Frontend server(s)...${NC}"
    echo "$FRONTEND_PIDS" | xargs kill -TERM 2>/dev/null
    sleep 1
    echo -e "${GREEN}✓ Frontend stopped${NC}"
else
    echo -e "${YELLOW}No Frontend processes found${NC}"
fi

# Find and kill Uvicorn processes (backend)
BACKEND_PIDS=$(pgrep -f "uvicorn.*main:app" 2>/dev/null)
if [ -n "$BACKEND_PIDS" ]; then
    echo -e "${YELLOW}Stopping Backend server(s)...${NC}"
    echo "$BACKEND_PIDS" | xargs kill -TERM 2>/dev/null
    sleep 1
    echo -e "${GREEN}✓ Backend stopped${NC}"
else
    echo -e "${YELLOW}No Backend processes found${NC}"
fi

echo ""
echo -e "${GREEN}All services stopped.${NC}"
