#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
DEPS_DIR="$FRONTEND_DIR/deps"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_step() {
  echo ""
  echo -e "${YELLOW}$1${NC}"
}

fail() {
  echo -e "${RED}Error: $1${NC}"
  exit 1
}

require_cmd() {
  local cmd="$1"
  local hint="${2:-}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Missing required command: $cmd${hint:+ ($hint)}"
  fi
}

echo "==================================="
echo "PV Planner - Installation Script"
echo "==================================="

auto_python=""
if command -v python3 >/dev/null 2>&1; then
  auto_python="python3"
elif command -v python >/dev/null 2>&1; then
  auto_python="python"
else
  fail "Python is not installed. Install Python 3.8+ from https://python.org"
fi

log_step "[1/6] Checking prerequisites..."
require_cmd "$auto_python"
require_cmd node "Install Node.js LTS from https://nodejs.org"
require_cmd npm "Node package manager"
require_cmd curl

echo -e "${GREEN}OK${NC} Prerequisites found"

log_step "[2/6] Creating virtual environment..."
cd "$PROJECT_ROOT"
if [ -d ".venv" ] && [ ! -f ".venv/bin/activate" ]; then
  echo "Existing .venv is not Unix-compatible in this environment. Recreating..."
  rm -rf .venv
fi

if [ ! -d ".venv" ]; then
  "$auto_python" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

echo -e "${GREEN}OK${NC} Virtual environment ready"

log_step "[3/6] Installing Python dependencies..."
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
if [ -f solver/requirements.txt ]; then
  python -m pip install -r solver/requirements.txt
fi

echo -e "${GREEN}OK${NC} Python dependencies installed"

log_step "[4/6] Installing Node dependencies..."
cd "$FRONTEND_DIR"
if [ ! -f package.json ]; then
  cat > package.json <<'JSONEOF'
{
  "name": "planner-redesign-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "serve": "npx serve . -l 5173",
    "test": "NODE_OPTIONS=--experimental-vm-modules jest"
  },
  "dependencies": {
    "@codemirror/autocomplete": "^6.18.6",
    "@codemirror/commands": "^6.8.1",
    "@codemirror/lang-javascript": "^6.2.4",
    "@codemirror/language": "^6.11.3",
    "@codemirror/lint": "^6.9.1",
    "@codemirror/search": "^6.5.11",
    "@codemirror/state": "^6.5.2",
    "@codemirror/theme-one-dark": "^6.1.3",
    "@codemirror/view": "^6.38.6",
    "@lezer/common": "^1.3.0",
    "@lezer/highlight": "^1.2.3",
    "@lezer/javascript": "^1.5.4",
    "@lezer/lr": "^1.4.3",
    "crelt": "^1.0.6",
    "style-mod": "^4.1.2",
    "w3c-keyname": "^2.2.8"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "serve": "^14.2.4"
  }
}
JSONEOF
fi

npm install

echo -e "${GREEN}OK${NC} Node dependencies installed"

log_step "[5/6] Downloading browser dependencies for offline use..."
mkdir -p "$DEPS_DIR"

curl -fsSL "https://unpkg.com/htmx.org@2.0.0/dist/htmx.min.js" -o "$DEPS_DIR/htmx.min.js"
curl -fsSL "https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js" -o "$DEPS_DIR/alpinejs.min.js"
curl -fsSL "https://d3js.org/d3.v7.min.js" -o "$DEPS_DIR/d3.v7.min.js"
curl -fsSL "https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js" -o "$DEPS_DIR/papaparse.min.js"
curl -fsSL "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" -o "$DEPS_DIR/jszip.min.js"
curl -fsSL "https://cdn.tailwindcss.com" -o "$DEPS_DIR/tailwindcss.js"
curl -fsSL "https://cdn.jsdelivr.net/npm/daisyui@4.10.1/dist/full.min.css" -o "$DEPS_DIR/daisyui.css"

echo -e "${GREEN}OK${NC} Browser dependencies downloaded"

log_step "[6/6] Creating offline frontend index..."
cd "$FRONTEND_DIR"

if [ ! -f index-online.html ]; then
  cp index.html index-online.html
fi

SOURCE_HTML="index-online.html"
TARGET_HTML="index.html"
cp "$SOURCE_HTML" "$TARGET_HTML"

sed -i \
  -e 's|https://unpkg.com/htmx.org@2.0.0|./deps/htmx.min.js|g' \
  -e 's|https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js|./deps/alpinejs.min.js|g' \
  -e 's|https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js|./deps/jszip.min.js|g' \
  -e 's|https://d3js.org/d3.v7.min.js|./deps/d3.v7.min.js|g' \
  -e 's|https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js|./deps/papaparse.min.js|g' \
  -e 's|https://cdn.tailwindcss.com|./deps/tailwindcss.js|g' \
  -e 's|https://cdn.jsdelivr.net/npm/daisyui@4.10.1/dist/full.min.css|./deps/daisyui.css|g' \
  -e 's|https://esm.sh/@codemirror/view@6.26.0?external=\*|./node_modules/@codemirror/view/dist/index.js|g' \
  -e 's|https://esm.sh/@codemirror/state@6.4.0?external=\*|./node_modules/@codemirror/state/dist/index.js|g' \
  -e 's|https://esm.sh/@codemirror/language@6.10.0?external=\*|./node_modules/@codemirror/language/dist/index.js|g' \
  -e 's|https://esm.sh/@codemirror/commands@6.5.0?external=\*|./node_modules/@codemirror/commands/dist/index.js|g' \
  -e 's|https://esm.sh/@codemirror/search@6.5.5?external=\*|./node_modules/@codemirror/search/dist/index.js|g' \
  -e 's|https://esm.sh/@codemirror/autocomplete@6.11.0?external=\*|./node_modules/@codemirror/autocomplete/dist/index.js|g' \
  -e 's|https://esm.sh/@codemirror/lint@6.4.0?external=\*|./node_modules/@codemirror/lint/dist/index.js|g' \
  -e 's|https://esm.sh/@codemirror/lang-javascript@6.2.2?external=\*|./node_modules/@codemirror/lang-javascript/dist/index.js|g' \
  -e 's|https://esm.sh/@codemirror/theme-one-dark@6.1.2?external=\*|./node_modules/@codemirror/theme-one-dark/dist/index.js|g' \
  -e 's|https://esm.sh/@lezer/common@1.2.1?external=\*|./node_modules/@lezer/common/dist/index.js|g' \
  -e 's|https://esm.sh/@lezer/highlight@1.2.0?external=\*|./node_modules/@lezer/highlight/dist/index.js|g' \
  -e 's|https://esm.sh/@lezer/lr@1.4.0?external=\*|./node_modules/@lezer/lr/dist/index.js|g' \
  -e 's|https://esm.sh/@lezer/javascript@1.4.13?external=\*|./node_modules/@lezer/javascript/dist/index.js|g' \
  -e 's|https://esm.sh/@marijn/find-cluster-break@1.0.2?external=\*|./node_modules/@marijn/find-cluster-break/src/index.js|g' \
  -e 's|https://esm.sh/style-mod@4.1.2?external=\*|./node_modules/style-mod/src/style-mod.js|g' \
  -e 's|https://esm.sh/w3c-keyname@2.2.8?external=\*|./node_modules/w3c-keyname/index.js|g' \
  -e 's|https://esm.sh/crelt@1.0.6?external=\*|./node_modules/crelt/index.js|g' \
  "$TARGET_HTML"

if ! grep -q '"@marijn/find-cluster-break"' "$TARGET_HTML"; then
  sed -i '/"@lezer\/javascript":/a\            "@marijn/find-cluster-break": "./node_modules/@marijn/find-cluster-break/src/index.js",' "$TARGET_HTML"
fi

echo -e "${GREEN}OK${NC} Offline index generated at frontend/index.html"

cd "$PROJECT_ROOT"
echo ""
echo "==================================="
echo -e "${GREEN}Installation complete${NC}"
echo "==================================="
echo "Start the app with: ./start.sh"
echo ""
