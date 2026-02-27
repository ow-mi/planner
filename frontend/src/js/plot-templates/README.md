# Plot Templates Mirror

These files mirror the source templates in `/plot_templates` at the repository root.

Why this exists:
- The frontend dev server serves files from `frontend/` and cannot reliably fetch parent directories.
- The runtime loader (`src/js/plot-templates-loader.js`) reads templates from `frontend/plot_templates/`.

When updating templates:
1. Edit files in `/plot_templates`.
2. Copy updated files into `frontend/plot_templates/`.
