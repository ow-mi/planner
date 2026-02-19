# Phase 0 Priority Config Loader Comparison

## Compared Functions
- `data_loader.load_priority_config(input_folder)`
- `main.load_priority_config_from_file(config_path)`

## Functional Differences
1. **Input contract**
   - `data_loader`: accepts input folder and auto-detects `priority_config.yaml` first, then `priority_config.json`.
   - `main`: accepts explicit file path and infers parser from file extension.

2. **Return type**
   - `data_loader`: returns raw `dict` config payload.
   - `main`: returns typed `BasePriorityConfig` object via `load_priority_config_from_dict`.

3. **Error strategy**
   - `data_loader`: on parse/validation errors logs and returns `{}` fallback.
   - `main`: on parse/validation errors raises `ValueError` (hard failure).

4. **Missing file behavior**
   - `data_loader`: raises `FileNotFoundError` if neither file exists, but catches downstream errors and may return `{}`.
   - `main`: raises `FileNotFoundError` for missing file and re-raises as `ValueError` for parse/validation failures.

5. **Purpose in pipeline**
   - `data_loader`: data ingestion layer helper for loading file contents.
   - `main`: CLI/runtime helper to build an executable priority configuration object.

## Duplicate Assessment
- These are **not true duplicates**. They overlap in parsing concerns, but have intentionally different contracts, failure modes, and output types.

## Recommendation
- **NO-GO for direct consolidation** in Phase 4 without first defining a shared abstraction.
- Safe path: extract a shared parser utility that returns dict, then keep separate wrappers for:
  - data ingestion fallback semantics (`dict`), and
  - strict CLI typed semantics (`BasePriorityConfig`).
