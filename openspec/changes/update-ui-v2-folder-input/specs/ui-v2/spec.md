## MODIFIED Requirements

### Requirement: CSV File Intake and Management
The system SHALL use a folder-based intake workflow where `ui_v2_exp` captures a user-selected base folder and backend services read CSV/JSON inputs directly from that location.

#### Scenario: Select base folder for direct intake
- **WHEN** a user opens Input Data for a new session
- **THEN** the UI SHALL require selecting a base folder path instead of uploading files through the browser
- **AND** the selected folder path SHALL be stored as the active session input/output root

#### Scenario: Backend reads files directly from selected folder
- **WHEN** the user confirms folder selection
- **THEN** the backend SHALL discover and read supported CSV/JSON inputs from that folder
- **AND** the UI SHALL display discovered files and parse status from backend results

### Requirement: Output Viewer and Downloads
The Output Data and Save flows SHALL use direct file persistence in the selected base folder and SHALL not rely on browser download prompts.

#### Scenario: Outputs are written to base folder
- **WHEN** solver results or generated artifacts are produced
- **THEN** backend services SHALL write output files under the selected folder base location
- **AND** the UI SHALL show written file paths and completion status

#### Scenario: No browser download dependency
- **WHEN** a user reviews available outputs
- **THEN** the UI SHALL present output location metadata and open-folder guidance
- **AND** output access SHALL not require single-file or ZIP browser download actions

## ADDED Requirements

### Requirement: Folder Path Validation and Error Feedback
The system SHALL validate selected folder paths before processing and provide actionable recovery feedback.

#### Scenario: Invalid or inaccessible folder
- **WHEN** the selected folder does not exist or cannot be read/written by backend services
- **THEN** the system SHALL block processing
- **AND** the UI SHALL present a clear error message describing how to choose a valid folder

#### Scenario: Missing required inputs in valid folder
- **WHEN** a folder is accessible but required CSV/JSON inputs are missing
- **THEN** the system SHALL report which expected files were not found
- **AND** the UI SHALL keep the user on the folder selection/intake workflow until resolved

## REMOVED Requirements

### Requirement: Browser Upload-Based Intake and Download Retrieval
**Reason**: This change intentionally removes browser-managed upload and download mechanics to standardize on backend direct file I/O from a selected folder.
**Migration**: Existing workflows must switch to selecting a folder path in UI; backend reads CSV/JSON from that folder and saves outputs under the same base location.

#### Scenario: Upload controls and download buttons are deprecated
- **WHEN** a user opens Input Data, Configuration import, Output Data, or Save actions in `ui_v2_exp`
- **THEN** browser file upload controls (picker/drag-drop) and browser download triggers SHALL be absent
- **AND** users SHALL be directed to folder selection and in-place file output behavior
