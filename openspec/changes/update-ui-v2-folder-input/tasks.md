## 1. Specification
- [x] 1.1 Confirm scope alignment with `refactor-ui-v2` and record this as a deliberate breaking change
- [x] 1.2 Replace upload-centric intake language with folder-based direct I/O requirements in `ui-v2` delta
- [x] 1.3 Add explicit removal/deprecation requirement for browser upload intake and browser download output flow

## 2. UI and API Behavior Definition
- [x] 2.1 Specify folder selection behavior, validation, and session state expectations in UI scenarios
- [x] 2.2 Specify backend contract: read CSV/JSON from selected folder and write outputs to the same base location
- [x] 2.3 Specify user-visible output behavior after direct file writes (paths/status, no browser download prompts)

## 3. Validation
- [x] 3.1 Run `openspec validate update-ui-v2-folder-input --strict`
- [x] 3.2 Resolve any strict-mode formatting or scenario validation errors
