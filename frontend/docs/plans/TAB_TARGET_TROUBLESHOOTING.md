# Tab Target Troubleshooting

When you see this warning:

`[app] updateTabVisibility missing target element ...`

it usually means tab config points to a DOM ID that does not exist in the active entrypoint (`index.html`).

## Quick fix checklist

1. Verify the container ID exists in `index.html`.
2. Ensure `src/js/core/tabLoader.js` uses the same selector in both:
   - `TAB_CONFIG[tab].target`
   - `TAB_TARGETS[tab]`
3. If a tab button has `aria-controls`, make it match the same container ID.
4. Reload and confirm logs no longer show missing target warnings.

## Why this happens

This app has multiple historical templates/files. If one file uses `#solver-tab-container` and another uses `#solver-controls-container`, runtime tab visibility will fail even if content loads correctly for other tabs.

## Prevention

- Treat `TAB_CONFIG` and `TAB_TARGETS` as the source of truth.
- Keep one canonical container ID per tab in `index.html`.
- After renaming any container ID, update:
  - `index.html`
  - `src/js/core/tabLoader.js`
  - `src/components/tabs.html` (`aria-controls`)
