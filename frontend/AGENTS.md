# Frontend Agent Instructions

This is a PV Planning Presentation Tool - a vanilla JavaScript frontend using Vite, Alpine.js, and HTMX.

## Build Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Test Commands

```bash
# Run all tests
npm test

# Run a single test file
npm test -- solverStore.test.js
npm test -- apiService.test.js

# Watch mode
npm run test:watch
```

## Code Style Guidelines

### JavaScript
- **Module Type**: ES modules (type: "module" in package.json)
- **File Naming**: camelCase for files (e.g., `apiService.js`, `dataTransformers.js`)
- **Storage Keys**: Use `ui_v2_exp__<store>__<key>` format (e.g., `ui_v2_exp__solver__executionConfig`)
- **Comments**: JSDoc for classes and functions, inline comments for complex logic
- **Error Handling**: Always wrap localStorage access in try-catch blocks

### Imports
- Use ES module imports: `import { foo } from './bar.js'`
- Include `.js` extension in imports
- Group imports: external libs first, then internal modules

### Naming Conventions
- **Classes**: PascalCase (e.g., `ApiService`, `DataTransformer`)
- **Functions/Variables**: camelCase (e.g., `getSolverInputData`, `isInitialized`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Storage Keys**: snake_case with double underscore separators
- **Alpine Stores**: camelCase (e.g., `solver`, `files`, `config`)

### State Management (Alpine.js)
- Initialize stores on `alpine:init` event
- Use `this.$store` to access other stores when available
- Provide fallback to `Alpine.store()` when `$store` is unavailable
- Set `isInitialized` flag to prevent double initialization

### Error Handling
- Always set `this.error` with Error objects, not strings
- Include descriptive error messages
- Console.error with context prefix: `[storeName] description`
- Fail fast for missing dependencies

### Testing (Jest)
- Test files co-located with source: `*.test.js`
- Use `jest.resetModules()` between tests for isolation
- Mock `global.Alpine` for store tests
- Use `jsdom` environment (configured in package.json)

### CSS/Tailwind
- Use Tailwind utility classes for styling
- Custom CSS in `src/styles/` directory
- Component-specific styles in `base.css`

### Project Structure
```
frontend/src/
├── components/     # HTML component templates
├── js/
│   ├── components/ # Alpine.js component logic
│   ├── core/       # App initialization & HTMX config
│   ├── services/   # API services
│   ├── stores/     # Alpine.js stores (state management)
│   └── utils/      # Utility functions
└── styles/         # Custom CSS
```

### Key Frameworks
- **Alpine.js**: Reactive UI state management
- **HTMX**: Server interactions via HTML attributes
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS
- **Jest**: Testing framework with jsdom
