from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import tempfile
import os
from typing import List, Dict, Any
import uuid

from optimization import OptimizationEngine
from models import (
    OptimizationRequest,
    OptimizationResponse,
    ValidationResult,
    FileUploadResponse
)

app = FastAPI(title="Planning Test Optimization API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for sessions (in production, use database)
sessions = {}

@app.get("/")
async def root():
    return {"message": "Planning Test Optimization API", "version": "1.0.0"}

@app.post("/api/upload", response_model=FileUploadResponse)
async def upload_files(
    test_file: UploadFile = File(...),
    equipment_file: UploadFile = File(...),
    fte_file: UploadFile = File(...),
    legs_file: UploadFile = File(...),
    test_duts_file: UploadFile = File(...),
    priority_config: UploadFile = File(...)
):
    """Upload CSV files and configuration for optimization"""
    try:
        # Create session
        session_id = str(uuid.uuid4())
        
        # Read and validate files
        files_data = {}
        for file, name in [
            (test_file, "data_test"),
            (equipment_file, "data_equipment"),
            (fte_file, "data_fte"),
            (legs_file, "data_legs"),
            (test_duts_file, "data_test_duts")
        ]:
            content = await file.read()
            df = pd.read_csv(pd.compat.StringIO(content.decode('utf-8')))
            files_data[name] = df.to_dict('records')
        
        # Read priority config
        config_content = await priority_config.read()
        priority_config_data = json.loads(config_content.decode('utf-8'))
        
        # Store in session
        sessions[session_id] = {
            'files': files_data,
            'config': priority_config_data,
            'created_at': datetime.now(),
            'results': None
        }
        
        return FileUploadResponse(
            session_id=session_id,
            message="Files uploaded successfully",
            file_stats={
                "tests": len(files_data["data_test"]),
                "equipment": len(files_data["data_equipment"]),
                "fte": len(files_data["data_fte"]),
                "legs": len(files_data["data_legs"]),
                "test_duts": len(files_data["data_test_duts"])
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing files: {str(e)}")

@app.post("/api/optimize", response_model=OptimizationResponse)
async def run_optimization(request: OptimizationRequest):
    """Run optimization with the provided data"""
    try:
        session_data = sessions.get(request.session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Create optimization engine
        engine = OptimizationEngine(
            test_data=session_data['files']['data_test'],
            equipment_data=session_data['files']['data_equipment'],
            fte_data=session_data['files']['data_fte'],
            legs_data=session_data['files']['data_legs'],
            test_duts_data=session_data['files']['data_test_duts'],
            priority_config=session_data['config']
        )
        
        # Run optimization
        results = engine.optimize()
        
        # Store results in session
        session_data['results'] = results
        session_data['optimized_at'] = datetime.now()
        
        return OptimizationResponse(
            success=True,
            message="Optimization completed successfully",
            makespan=results['makespan'],
            tests_scheduled=len(results['tests_schedule']),
            optimization_time=results['optimization_time']
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

@app.get("/api/results/{result_type}")
async def get_results(session_id: str, result_type: str):
    """Download optimization results as CSV"""
    session_data = sessions.get(session_id)
    if not session_data or not session_data['results']:
        raise HTTPException(status_code=404, detail="Results not found")
    
    results = session_data['results']
    
    if result_type == "tests_schedule":
        df = pd.DataFrame(results['tests_schedule'])
    elif result_type == "equipment_usage":
        df = pd.DataFrame(results['equipment_usage'])
    elif result_type == "fte_usage":
        df = pd.DataFrame(results['fte_usage'])
    elif result_type == "concurrency_timeseries":
        df = pd.DataFrame(results['concurrency_timeseries'])
    else:
        raise HTTPException(status_code=400, detail="Invalid result type")
    
    # Create temporary file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp:
        df.to_csv(tmp.name, index=False)
        tmp_path = tmp.name
    
    return FileResponse(
        tmp_path,
        media_type='text/csv',
        filename=f"{result_type}.csv"
    )

@app.get("/api/status")
async def get_status(session_id: str):
    """Get optimization status for a session"""
    session_data = sessions.get(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_id": session_id,
        "created_at": session_data['created_at'],
        "has_results": session_data['results'] is not None,
        "optimized_at": session_data.get('optimized_at'),
        "file_stats": {
            "tests": len(session_data['files']['data_test']),
            "equipment": len(session_data['files']['data_equipment']),
            "fte": len(session_data['files']['data_fte']),
            "legs": len(session_data['files']['data_legs']),
            "test_duts": len(session_data['files']['data_test_duts'])
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)