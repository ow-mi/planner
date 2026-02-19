"""
API Routes for File Upload
Handles direct file uploads via multipart/form-data
"""

from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse

from backend.src.services.file_upload_service import get_file_upload_service

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(..., description="File to upload (CSV, Excel, or JSON)"),
    session_id: Optional[str] = Form(None, description="Optional session ID"),
):
    """
    Upload a file directly (drag-drop or browse).
    
    Supports:
    - CSV files (.csv)
    - Excel files (.xlsx, .xls)
    - JSON config files (.json)
    
    Max file size: 10MB
    
    Returns file metadata and parsed data including extracted entities.
    """
    try:
        service = get_file_upload_service()
        result = await service.upload_file(file, session_id)
        return JSONResponse(content={
            "success": True,
            "data": result
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/supported-types")
async def get_supported_types():
    """Get list of supported file extensions."""
    service = get_file_upload_service()
    return {
        "success": True,
        "extensions": list(service.SUPPORTED_EXTENSIONS),
        "max_size_bytes": service.MAX_FILE_SIZE
    }