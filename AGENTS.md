<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

--- 

<!-- br-agent-instructions-v1 -->

## Beads Workflow Integration

This project uses [beads_rust](https://github.com/Dicklesworthstone/beads_rust) (`br`/`bd`) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View ready issues (unblocked, not deferred)
br ready              # or: bd ready

# List and search
br list --status=open # All open issues
br show <id>          # Full issue details with dependencies
br search "keyword"   # Full-text search

# Create and update
br create --title="..." --description="..." --type=task --priority=2
br update <id> --status=in_progress
br close <id> --reason="Completed"
br close <id1> <id2>  # Close multiple issues at once

# Sync with git
br sync --flush-only  # Export DB to JSONL
br sync --status      # Check sync status
```

### Workflow Pattern

1. **Start**: Run `br ready` to find actionable work
2. **Claim**: Use `br update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `br close <id>`
5. **Sync**: Always run `br sync --flush-only` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `br ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers 0-4, not words)
- **Types**: task, bug, feature, epic, chore, docs, question
- **Blocking**: `br dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
br sync --flush-only    # Export beads changes to JSONL
git commit -m "..."     # Commit everything
git push                # Push to remote
```

### Best Practices

- Check `br ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `br create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always sync before ending session

<!-- end-br-agent-instructions -->

---

## Build, Test, and Lint Commands

### JavaScript/Frontend
```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific test file
npm test -- validation.test.js

# Run tests in watch mode
npm run test:watch

# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Python (Solver)
```bash
# Run solver tests
cd solver && python -m pytest

# Run specific test file
cd solver && python -m pytest tests/test_file.py

# Run specific test function
cd solver && python -m pytest tests/test_file.py::test_function

# Run solver
cd solver && python main.py --input-folder ../input_data/gen3_pv/scenario_1

# Lint with ruff (if installed)
cd solver && ruff check .
```

---

## Code Style Guidelines

### JavaScript (ES6+)

**Imports:** Use ES6 modules with explicit paths. Group: third-party first, then local.

**Naming:**
- `camelCase` for variables, functions, methods
- `PascalCase` for classes and components
- `UPPER_SNAKE_CASE` for constants

**Functions:** Use arrow functions for callbacks. Include JSDoc for exported functions.

**Error Handling:** Use try/catch for async operations. Return structured error objects.

### Python

**Imports:** Use absolute imports. Group: stdlib, third-party, local modules.

**Naming:**
- `snake_case` for variables, functions, modules
- `PascalCase` for classes
- `UPPER_SNAKE_CASE` for constants

**Docstrings:** Use Google-style with Args, Returns, Raises sections.

**Error Handling:** Use specific exception types. Log before raising.

### Component Patterns (Alpine.js)

Use reactive data patterns. Communicate via `$dispatch` for events.

### Testing

- JS: Jest with `describe`/`test` blocks. Name files `<module>.test.js`
- Python: pytest with descriptive names. Use fixtures for shared data.

---

## Technology Stack

- **Frontend:** JavaScript ES6+, Alpine.js 3.x, D3.js v7, CodeMirror 6, React 18
- **Backend/Solver:** Python 3.8+, Google OR-Tools, pandas, FastAPI
- **Build:** Vite, Jest, Tailwind CSS
- **State:** Browser localStorage, Alpine.js reactive data

---

## Cursor Rules (from .cursor/rules/specify-rules.mdc)

### Active Technologies
- JavaScript (ES6+), Alpine.js 3.x + Alpine.js (Core), CodeMirror 6 (Editor), D3.js v7 (Visualization)
- Browser LocalStorage for persisting user code edits
- PapaParse 5.3.2 for CSV parsing
- Python 3.8+ (for backend API), JavaScript/ES6+ (for Alpine.js UI)
- FastAPI (backend API), planner_v4 (Python solver module), pandas (data processing)

### Commands
```bash
cd src; pytest; ruff check .
```

### Code Style
Follow standard conventions for Python 3.8+ and JavaScript/ES6+.

### Project Structure
```
backend/
frontend/
tests/
```

### Alpine.js Component Examples

**Basic Component:**
```html
<div x-data="{ count: 0, items: [] }" x-init="fetchData()">
  <button x-on:click="count++">Count: <span x-text="count"></span></button>
</div>
```

**D3.js Integration:**
```html
<div x-data="{ chartData: [], width: 800, height: 400 }"
     x-init="$nextTick(() => initializeChart())"
     x-effect="updateChart()">
  <svg x-ref="chart" :width="width" :height="height"></svg>
</div>
```

**Event-Driven Communication:**
```html
<div x-data="{ selectedItem: null }">
  <button x-on:click="$dispatch('item-selected', { id: 123 })">Select</button>
</div>
<div x-data="{ activeItem: null }" x-on:item-selected.window="activeItem = $event.detail">
  <span x-text="activeItem?.id"></span>
</div>
```
