## ADDED Requirements
### Requirement: Ship a self-contained Windows desktop installer
The system SHALL provide a Windows installer that installs the planner as a self-contained Electron desktop application without requiring a preinstalled system Python, Node.js, npm, or internet access at first launch.

#### Scenario: Clean Windows machine installation
- **GIVEN** a Windows machine without Python or Node.js installed
- **WHEN** the user runs the planner installer
- **THEN** the installer places all required application runtime components on disk
- **AND** the installed application can be launched successfully without downloading dependencies

#### Scenario: No PowerShell dependency for installed users
- **GIVEN** PowerShell is unavailable or restricted on the target machine
- **WHEN** the user launches the installed planner application
- **THEN** the application starts through its installed executable entrypoint
- **AND** startup does not depend on `start.bat` or a PowerShell wrapper

### Requirement: Bundle all runtime components needed for offline execution
The installer payload SHALL include all frontend assets, the Electron runtime, backend code, solver code, Python runtime components, Python dependencies, and native libraries required to launch the UI, execute the backend API, and run solver jobs while offline.

#### Scenario: Offline solver execution
- **GIVEN** the machine has no network connectivity
- **WHEN** the user launches the installed desktop app and starts a solver run
- **THEN** the application starts successfully
- **AND** the solver run completes using only locally bundled code and assets
- **AND** no runtime dependency download is required

#### Scenario: No system Python or Node installed
- **GIVEN** the target machine does not have Python, Node.js, or npm installed
- **WHEN** the user installs and launches the desktop application
- **THEN** the application still launches successfully
- **AND** the backend and renderer use only bundled runtimes

### Requirement: Lock runtime and build dependencies exactly for offline builds
The packaging workflow SHALL use exact-version locked dependency inputs for bundled Python runtime dependencies and version-pinned build tooling so installer builds are reproducible and do not depend on online dependency resolution at release time.

#### Scenario: Rebuilding the same release
- **GIVEN** a released desktop build definition
- **WHEN** the installer is rebuilt from the same locked inputs
- **THEN** the packaging workflow resolves the same dependency versions for Python runtime and build tooling
- **AND** the build does not depend on unconstrained package resolution

#### Scenario: Unlocked Python dependency manifest
- **GIVEN** a backend or solver dependency manifest used for packaging is not exact-version locked
- **WHEN** release validation runs
- **THEN** the release is rejected as non-compliant with offline packaging requirements

### Requirement: Use a writable per-user data root for mutable runtime files
The desktop application SHALL store mutable runtime files outside the installation directory in a per-user writable application data location.

Mutable runtime files include logs, temporary workspaces, checkpoints, run artifacts, exported outputs, and persisted session state.

#### Scenario: Installed under Program Files
- **GIVEN** the application is installed in a non-writable system location such as `Program Files`
- **WHEN** the user launches the application and runs the solver
- **THEN** logs, checkpoints, and output files are written to a per-user writable data directory
- **AND** the application does not require write access to the installation directory

#### Scenario: Runtime path layout is defined
- **GIVEN** the desktop application initializes its writable runtime area
- **WHEN** it prepares runtime directories
- **THEN** it creates or uses explicit subdirectories for logs, checkpoints, run outputs, temporary workspaces, and persisted state
- **AND** those paths are supplied to the bundled backend instead of relying on hardcoded working-directory or Unix-only paths

### Requirement: Support packaged frontend-to-backend communication
The desktop runtime SHALL provide a supported communication contract between the packaged renderer and the bundled backend API, including origin compatibility and runtime discovery of the backend endpoint.

#### Scenario: Renderer calls backend in packaged mode
- **GIVEN** the desktop application is launched from the installed package
- **WHEN** the renderer sends an API request
- **THEN** the request reaches the bundled backend successfully using the packaged runtime endpoint
- **AND** the backend accepts the request origin used by the desktop runtime

### Requirement: Replace script-managed startup behavior in packaged mode
The packaged desktop application SHALL replace the startup responsibilities currently provided by `start.bat` and `scripts/dev-start.ps1`, including backend process launch, health verification, failure reporting, and runtime log creation.

#### Scenario: Backend startup failure in packaged mode
- **GIVEN** the installed desktop application attempts to start its bundled backend
- **WHEN** the backend process fails to start or does not become healthy in time
- **THEN** the desktop application reports startup failure to the user
- **AND** startup logs are written to the writable application data location
- **AND** orphaned child processes are not left running

#### Scenario: Preferred backend port is unavailable
- **GIVEN** the packaged desktop application attempts to start the bundled backend on a preferred loopback port
- **WHEN** that port is already in use
- **THEN** the desktop shell resolves the conflict according to its documented port-selection policy
- **AND** the renderer is given the actual backend endpoint that was started

#### Scenario: Startup uses packaged runtime paths
- **GIVEN** the installed application is launched on a machine with conflicting or missing system `PATH` entries
- **WHEN** the desktop shell starts the bundled backend and loads the renderer
- **THEN** it resolves the backend executable, renderer assets, and required packaged libraries from the installed application resources using its documented packaged path strategy
- **AND** startup does not depend on discovering system Python, system Node.js, or a development checkout path layout

### Requirement: Use a deterministic packaged path strategy for bundled runtimes
The packaged application SHALL start using absolute or otherwise deterministic paths to its installed resources and SHALL not rely on ambient system path discovery for bundled runtimes or packaged library assets.

This includes the bundled backend executable, packaged renderer asset roots, and any packaged runtime library locations required by child processes.

#### Scenario: Conflicting system environment variables
- **GIVEN** the target machine has conflicting `PATH`, `PYTHONPATH`, or `NODE_PATH` environment variables
- **WHEN** the installed desktop application launches
- **THEN** the application still resolves its own packaged runtime components correctly
- **AND** those ambient system variables do not cause the application to load external or unintended runtimes instead of the bundled ones

### Requirement: Bundle and verify required renderer assets
The packaged application SHALL bundle the frontend runtime asset set explicitly, including the libraries currently sourced from CDN mirrors and the module files currently loaded from the frontend dependency tree, so renderer startup does not depend on a development checkout layout.

#### Scenario: Packaged renderer startup
- **GIVEN** the application is launched from the installed package
- **WHEN** the renderer loads its HTML and JavaScript assets
- **THEN** all required browser libraries and module imports resolve from packaged local assets
- **AND** no CDN, `npm install`, or unpacked development `node_modules` tree is required on the target machine

### Requirement: Bundle only required runtime configuration and curated data assets
The installer SHALL include the configuration assets required by the shipped runtime and SHALL make an explicit product decision about demo/sample datasets, while excluding test-only fixtures from the customer installer payload.

#### Scenario: Curated sample data is shipped
- **GIVEN** the product chooses to include sample or demo datasets for offline onboarding
- **WHEN** the installer is built
- **THEN** only the explicitly designated sample/demo data is bundled
- **AND** internal test fixtures and test baselines are excluded from the installer payload

### Requirement: Validate installer completeness before release
The build pipeline SHALL verify that all required runtime assets and native dependencies are present in the packaged application before a Windows installer is published.

#### Scenario: Missing native solver dependency at build time
- **GIVEN** a required runtime dependency such as an OR-Tools native library is absent from the packaged payload
- **WHEN** the packaging validation step runs
- **THEN** the build fails
- **AND** the installer is not considered releasable

#### Scenario: Build attempts to preserve install-time dependency fetching
- **GIVEN** the packaging workflow still depends on end-user `pip install`, `npm install`, or CDN downloads after installation
- **WHEN** release validation runs
- **THEN** the release is rejected as non-compliant with offline distribution requirements

#### Scenario: Unused heavy dependency is retained without verification
- **GIVEN** a heavy packaged dependency such as `matplotlib` is included in the runtime payload
- **WHEN** release validation runs
- **THEN** the build must either prove that the dependency is required by shipped runtime behavior or remove it from the packaged dependency set
