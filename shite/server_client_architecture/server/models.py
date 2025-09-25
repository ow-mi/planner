from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class OptimizationRequest(BaseModel):
    """Request model for optimization endpoint"""
    session_id: str = Field(..., description="Session ID from file upload")
    strategy: str = Field("makespan", description="Optimization strategy")
    max_time: int = Field(300, description="Maximum optimization time in seconds")

class OptimizationResponse(BaseModel):
    """Response model for optimization endpoint"""
    success: bool = Field(..., description="Optimization success status")
    message: str = Field(..., description="Result message")
    makespan: Optional[int] = Field(None, description="Total project duration in hours")
    tests_scheduled: int = Field(..., description="Number of tests scheduled")
    optimization_time: float = Field(..., description="Time taken for optimization in seconds")

class FileUploadResponse(BaseModel):
    """Response model for file upload endpoint"""
    session_id: str = Field(..., description="Unique session identifier")
    message: str = Field(..., description="Upload status message")
    file_stats: Dict[str, int] = Field(..., description="Count of records in each file")

class ValidationResult(BaseModel):
    """Model for validation results"""
    valid: bool = Field(..., description="Overall validation status")
    errors: List[str] = Field([], description="List of validation errors")
    warnings: List[str] = Field([], description="List of validation warnings")

class TestData(BaseModel):
    """Model for test data"""
    test_id: str
    test_name: str
    duration_hours: int
    leg_id: str
    priority: int
    deadline: Optional[str] = None

class EquipmentData(BaseModel):
    """Model for equipment data"""
    equipment_id: str
    equipment_name: str
    capacity: int
    available_from: str
    available_to: str

class FteData(BaseModel):
    """Model for FTE data"""
    fte_id: str
    fte_name: str
    capacity: int
    available_from: str
    available_to: str

class LegData(BaseModel):
    """Model for leg data"""
    leg_id: str
    leg_name: str
    sequence: int
    depends_on: Optional[List[str]] = None

class TestDutData(BaseModel):
    """Model for test-DUT relationship data"""
    test_id: str
    dut_id: str
    equipment_required: Optional[List[str]] = None
    fte_required: Optional[List[str]] = None

class PriorityConfig(BaseModel):
    """Model for priority configuration"""
    strategy: str = Field("makespan", description="Optimization strategy")
    weights: Dict[str, float] = Field({}, description="Weight factors for different priorities")
    constraints: Dict[str, Any] = Field({}, description="Additional constraints")
    deadlines: Dict[str, str] = Field({}, description="Test-specific deadlines")

class OptimizationResult(BaseModel):
    """Model for optimization results"""
    makespan: int
    optimization_time: float
    tests_schedule: List[Dict[str, Any]]
    equipment_usage: List[Dict[str, Any]]
    fte_usage: List[Dict[str, Any]]
    concurrency_timeseries: List[Dict[str, Any]]
    validation_report: Optional[Dict[str, Any]] = None