# Quick Start: Solver UI Integration

**Date**: 2024-12-19  
**Feature**: Solver UI Integration

## Overview

This guide helps you quickly set up and run the solver UI integration locally.

## Prerequisites

- Python 3.8+ installed
- Node.js 16+ (optional, for UI development)
- `planner_v4` Python module available
- FastAPI and required dependencies

## Backend Setup

### 1. Install Dependencies

```bash
pip install fastapi uvicorn python-multipart pydantic
```

### 2. Create Backend Structure

```bash
mkdir -p backend/src/api/routes
mkdir -p backend/src/services
mkdir -p backend/src/utils
mkdir -p backend/tests
```

### 3. Start Backend Server

```bash
cd backend
uvicorn src.api.main:app --reload --port 8000
```

Backend API will be available at `http://localhost:8000`

### 4. Verify Backend

```bash
curl http://localhost:8000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "queue_size": 0,
  "active_executions": 0,
  "version": "1.0.0"
}
```

## Frontend Setup

### 1. Update UI Configuration

Edit `ui/config_editor.html` to add API endpoint configuration:

```javascript
const API_BASE_URL = 'http://localhost:8000';
```

### 2. Add Solver Tab Content

The Solver tab should include:
- Solver parameter inputs (time limit, debug level)
- "Run Solver" button
- Progress indicator
- Status display

### 3. Add API Client

Create `ui/js/solver-api.js` with API client functions:

```javascript
async function executeSolver(csvFiles, priorityConfig, params) {
  const response = await fetch(`${API_BASE_URL}/api/solver/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      csv_files: csvFiles,
      priority_config: priorityConfig,
      ...params
    })
  });
  return await response.json();
}

async function getExecutionStatus(executionId) {
  const response = await fetch(`${API_BASE_URL}/api/solver/status/${executionId}`);
  return await response.json();
}

async function getExecutionResults(executionId) {
  const response = await fetch(`${API_BASE_URL}/api/solver/results/${executionId}`);
  return await response.json();
}
```

## Testing the Integration

### 1. Prepare Test Data

Upload CSV files in the UI's Input Data tab:
- `data_legs.csv`
- `data_test.csv`
- `data_fte.csv`
- `data_equipment.csv`
- `data_test_duts.csv`

### 2. Configure Priority Settings

In the Configuration tab, configure priority settings and copy the JSON output.

### 3. Run Solver

1. Navigate to Solver tab
2. Set time limit (e.g., 500 seconds)
3. Select debug level (e.g., INFO)
4. Click "Run Solver"
5. Monitor progress in status display
6. View results in Output Data tab when complete

### 4. Verify Results

Check that:
- Execution status transitions: PENDING → RUNNING → COMPLETED
- Progress percentage updates during execution
- Results include solution status, makespan, and output files
- Output CSV files are available for download

## API Endpoints

### Execute Solver
```bash
POST /api/solver/execute
Content-Type: application/json

{
  "csv_files": {
    "data_legs.csv": "...",
    "data_test.csv": "...",
    ...
  },
  "priority_config": { ... },
  "time_limit": 500,
  "debug_level": "INFO"
}
```

### Get Status
```bash
GET /api/solver/status/{execution_id}
```

### Get Results
```bash
GET /api/solver/results/{execution_id}
```

## Common Issues

### Backend Not Starting
- Check Python version: `python --version` (must be 3.8+)
- Verify FastAPI installation: `pip list | grep fastapi`
- Check port availability: `netstat -an | grep 8000`

### CORS Errors
- Ensure CORS middleware is configured in FastAPI
- Check browser console for CORS error details
- Verify API_BASE_URL matches backend server URL

### Solver Execution Fails
- Check backend logs for error details
- Verify CSV files have correct format and headers
- Validate priority_config JSON matches schema
- Check that planner_v4 module is importable

### Progress Not Updating
- Verify polling interval (should be 1-2 seconds)
- Check browser network tab for status requests
- Ensure execution_id is correctly tracked

## Next Steps

- Review [data-model.md](./data-model.md) for entity details
- Check [contracts/openapi.yaml](./contracts/openapi.yaml) for API specification
- See [research.md](./research.md) for technical decisions
- Read [plan.md](./plan.md) for implementation details





