"""Spreadsheet discovery and validation routes."""

from fastapi import APIRouter, HTTPException, status

from backend.src.api.models.requests import (
    SpreadsheetDiscoveryRequest,
    SpreadsheetValidationRequest,
)
from backend.src.api.models.responses import (
    SpreadsheetDiscoveryResponse,
    SpreadsheetValidationResponse,
)
from backend.src.services.spreadsheet_service import spreadsheet_service

router = APIRouter()


@router.get(
    "/spreadsheets/discover",
    response_model=SpreadsheetDiscoveryResponse,
    status_code=status.HTTP_200_OK,
)
async def discover_spreadsheets(request: SpreadsheetDiscoveryRequest):
    """
    Discover available spreadsheet files from configured paths and uploaded sessions.
    Returns CSV/XLSX/XLS files with stable identifiers and metadata.
    """
    try:
        spreadsheets = spreadsheet_service.discover_spreadsheets(request)
        return SpreadsheetDiscoveryResponse(
            spreadsheets=spreadsheets,
            total_count=len(spreadsheets),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.post(
    "/spreadsheets/validate",
    response_model=SpreadsheetValidationResponse,
    status_code=status.HTTP_200_OK,
)
async def validate_spreadsheet(request: SpreadsheetValidationRequest):
    """
    Validate a selected spreadsheet against required schema.
    Returns header validation, row-level errors, and extracted entities.
    """
    try:
        result = spreadsheet_service.validate_spreadsheet(request)
        return SpreadsheetValidationResponse(
            validation=result,
            spreadsheet_id=request.spreadsheet_id,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
