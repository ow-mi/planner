# Change: Replace browser uploads with folder-based direct input/output in ui_v2_exp

## Why
The current `ui_v2_exp` workflow depends on browser-managed file uploads and download prompts, which adds friction and duplicates file handling logic already owned by the backend runtime. The UI must switch to a folder-first model where users select a base directory and processing happens directly against on-disk CSV/JSON inputs with outputs written back to the same location.

## What Changes
- **BREAKING** Remove browser file upload and drag-and-drop intake from Input Data and Configuration flows in `ui_v2_exp`.
- **BREAKING** Remove browser download-based output retrieval in favor of direct file writes by the backend.
- Add a folder selection workflow in the UI that sets an input/output base path for the active session.
- Require backend endpoints used by `ui_v2_exp` to read CSV/JSON directly from the selected folder and persist generated artifacts in that same base location.
- Update `ui-v2` requirements to explicitly deprecate upload-based intake and define folder-based direct I/O behavior.

## Impact
- Affected specs: `ui-v2` (delta under `openspec/changes/update-ui-v2-folder-input/specs/ui-v2/spec.md`)
- Affected code: `ui_v2_exp` input/config/output components and backend file I/O endpoints used by those views
- Breaking change scope: users must provide a folder path; browser upload/download behavior is intentionally removed with no compatibility fallback
