## 1. Specification Completion
- [ ] 1.1 Confirm API lifecycle for run sessions (`create`, `upload inputs`, `solve`, `status`, `results`)
- [ ] 1.2 Confirm canonical week/date normalization behavior for ingest and persistence
- [ ] 1.3 Confirm batch scenario schema and override precedence rules

## 2. Backend Contract Planning
- [ ] 2.1 Define request and response models for run sessions and batch execution
- [ ] 2.2 Define run-folder naming and artifact layout contract
- [ ] 2.3 Define error contract for invalid schema, invalid week format, and conflicting overrides

## 3. Planner Integration Planning
- [ ] 3.1 Define pre-solver normalization and override application stage
- [ ] 3.2 Define required snapshots (`input_original`, `input_effective`, `settings_used`)
- [ ] 3.3 Define required outputs (`csv reports`, `plot.html`, `plot.png`, `batch summary`)

## 4. UI v2 Planning
- [ ] 4.1 Define Batch tab behavior in `ui_v2_exp` for scenario authoring and validation
- [ ] 4.2 Define submission flow for baseline + batch config to backend
- [ ] 4.3 Define results matrix and per-scenario artifact access behavior

## 5. Readiness Gates
- [ ] 5.1 Validate with `openspec validate add-run-sessions-batch-scenarios --strict`
- [ ] 5.2 Review proposal with stakeholders before implementation
- [ ] 5.3 Start implementation only after explicit proposal approval
