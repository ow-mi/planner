"""Config consistency validation routes."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend.src.services.config_validation_service import config_validation_service
from backend.src.api.models.spreadsheet_responses import ExtractedEntities

router = APIRouter()


class ConfigConsistencyRequest(BaseModel):
    """Request body for config consistency validation."""
    config: Dict[str, Any] = Field(..., description="Configuration JSON to validate")
    spreadsheet_id: str = Field(..., min_length=1, description="Spreadsheet identifier for entity lookup")
    entities: Optional[ExtractedEntities] = Field(
        None, description="Optional: entities directly provided (e.g., from frontend cache)"
    )


class EntityValidationDetail(BaseModel):
    """Detail of a missing or orphaned entity."""
    ref_type: str = Field(..., description="Type of entity")
    ref_name: str = Field(..., description="Name of the entity")
    spreadsheet_entities: List[str] = Field(..., description="Available entities in spreadsheet")


class EntityStatistics(BaseModel):
    """Statistics for an entity type."""
    in_config: int = Field(..., description="Count in config")
    in_spreadsheet: int = Field(..., description="Count in spreadsheet")
    missing: int = Field(..., description="Count missing from spreadsheet")
    orphaned: int = Field(..., description="Count orphaned in spreadsheet")


class ValidationStatistics(BaseModel):
    """Statistics by entity type."""
    projects: EntityStatistics = Field(..., description="Project statistics")
    leg_types: EntityStatistics = Field(..., description="Leg type statistics")
    leg_names: EntityStatistics = Field(..., description="Leg name statistics")
    test_types: EntityStatistics = Field(..., description="Test type statistics")
    test_names: EntityStatistics = Field(..., description="Test name statistics")
    total_missing: int = Field(..., description="Total missing entities")
    total_orphaned: int = Field(..., description="Total orphaned entities")


class ConfigConsistencyResponse(BaseModel):
    """Response for config consistency validation."""
    valid: bool = Field(..., description="Whether config is fully consistent")
    warnings: List[str] = Field(default_factory=list, description="Warning messages")
    missing_entities: List[EntityValidationDetail] = Field(default_factory=list, description="Entities in config but not in spreadsheet")
    orphaned_entities: List[EntityValidationDetail] = Field(default_factory=list, description="Entities in spreadsheet but not in config")
    statistics: ValidationStatistics = Field(..., description="Validation statistics")


def _out_of_scope_to_dict(reference) -> Dict[str, Any]:
    """Convert OutOfScopeReference to dict format for response."""
    return {
        "ref_type": reference.ref_type.value if hasattr(reference.ref_type, 'value') else str(reference.ref_type),
        "ref_name": reference.ref_name,
        "spreadsheet_entities": reference.spreadsheet_entities,
    }


@router.post(
    "/validation/config-consistency",
    response_model=ConfigConsistencyResponse,
    status_code=status.HTTP_200_OK,
    summary="Validate config consistency against spreadsheet",
    description="Validates that entities referenced in config exist in the spreadsheet and detects orphaned entities. Returns HTTP 200 with warnings for non-blocking behavior.",
)
async def validate_config_consistency(request: ConfigConsistencyRequest) -> ConfigConsistencyResponse:
    """
    POST /api/v1/validation/config-consistency
    
    Validates a configuration JSON against spreadsheet entities.
    Returns structured validation report with missing and orphaned entities.
    Always returns HTTP 200 with warnings (not errors) for non-blocking behavior.
    """
    try:
        # If entities are directly provided, use them
        if request.entities:
            spreadsheet_entities = request.entities
        else:
            # Entities should be retrieved from storage using spreadsheet_id
            # For now, return a validation error indicating entities are required
            # In production, this would fetch from a persistent store or session
            return ConfigConsistencyResponse(
                valid=False,
                warnings=["Entities must be provided directly or implement storage lookup for spreadsheet_id"],
                missing_entities=[],
                orphaned_entities=[],
                statistics=ValidationStatistics(
                    projects=EntityStatistics(in_config=0, in_spreadsheet=0, missing=0, orphaned=0),
                    leg_types=EntityStatistics(in_config=0, in_spreadsheet=0, missing=0, orphaned=0),
                    leg_names=EntityStatistics(in_config=0, in_spreadsheet=0, missing=0, orphaned=0),
                    test_types=EntityStatistics(in_config=0, in_spreadsheet=0, missing=0, orphaned=0),
                    test_names=EntityStatistics(in_config=0, in_spreadsheet=0, missing=0, orphaned=0),
                    total_missing=0,
                    total_orphaned=0,
                ),
            )

        # Run validation
        report = config_validation_service.validate_config_consistency(
            config=request.config,
            spreadsheet_entities=spreadsheet_entities,
        )

        report_dict = report.to_dict()

        # Convert statistics to model
        stats_data = report_dict.get("statistics", {})
        
        return ConfigConsistencyResponse(
            valid=report_dict.get("valid", True),
            warnings=report_dict.get("warnings", []),
            missing_entities=[
                EntityValidationDetail(**_out_of_scope_to_dict(e))
                for e in report_dict.get("missing_entities", [])
            ],
            orphaned_entities=[
                EntityValidationDetail(**_out_of_scope_to_dict(e))
                for e in report_dict.get("orphaned_entities", [])
            ],
            statistics=ValidationStatistics(
                projects=EntityStatistics(**stats_data.get("projects", {
                    "in_config": 0, "in_spreadsheet": 0, "missing": 0, "orphaned": 0
                })),
                leg_types=EntityStatistics(**stats_data.get("leg_types", {
                    "in_config": 0, "in_spreadsheet": 0, "missing": 0, "orphaned": 0
                })),
                leg_names=EntityStatistics(**stats_data.get("leg_names", {
                    "in_config": 0, "in_spreadsheet": 0, "missing": 0, "orphaned": 0
                })),
                test_types=EntityStatistics(**stats_data.get("test_types", {
                    "in_config": 0, "in_spreadsheet": 0, "missing": 0, "orphaned": 0
                })),
                test_names=EntityStatistics(**stats_data.get("test_names", {
                    "in_config": 0, "in_spreadsheet": 0, "missing": 0, "orphaned": 0
                })),
                total_missing=stats_data.get("total_missing", 0),
                total_orphaned=stats_data.get("total_orphaned", 0),
            ),
        )

    except Exception as e:
        # Always return HTTP 200 with error in warnings for non-blocking behavior
        return ConfigConsistencyResponse(
            valid=False,
            warnings=[f"Validation error: {str(e)}"],
            missing_entities=[],
            orphaned_entities=[],
            statistics=ValidationStatistics(
                projects=EntityStatistics(in_config=0, in_spreadsheet=0, missing=0, orphaned=0),
                leg_types=EntityStatistics(in_config=0, in_spreadsheet=0, missing=0, orphaned=0),
                leg_names=EntityStatistics(in_config=0, in_spreadsheet=0, missing=0, orphaned=0),
                test_types=EntityStatistics(in_config=0, in_spreadsheet=0, missing=0, orphaned=0),
                test_names=EntityStatistics(in_config=0, in_spreadsheet=0, missing=0, orphaned=0),
                total_missing=0,
                total_orphaned=0,
            ),
        )