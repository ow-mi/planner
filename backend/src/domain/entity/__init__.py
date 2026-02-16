"""Domain models for entity extraction and management."""
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class EntityIndex:
    """Index of all entities across projects, legs, and tests."""
    projects: Dict[str, "ProjectEntity"] = field(default_factory=dict)
    leg_types: Dict[str, "LegTypeEntity"] = field(default_factory=dict)
    leg_names: Dict[str, "LegEntity"] = field(default_factory=dict)
    test_types: Dict[str, "TestTypeEntity"] = field(default_factory=dict)
    tests: Dict[str, "TestEntity"] = field(default_factory=dict)
    fte_resources: Dict[str, "FTEEntity"] = field(default_factory=dict)
    equipment_resources: Dict[str, "EquipmentEntity"] = field(default_factory=dict)


@dataclass
class ProjectEntity:
    """Domain entity representing a project."""
    name: str
    description: Optional[str] = None
    priority: Optional[int] = None
    legs: List[str] = field(default_factory=list)


@dataclass
class LegTypeEntity:
    """Domain entity representing a leg type."""
    name: str
    description: Optional[str] = None


@dataclass
class LegEntity:
    """Domain entity representing a leg."""
    name: str
    leg_type: str
    description: Optional[str] = None
    priority: Optional[int] = None
    fixed_date: Optional[str] = None
    branch: Optional[str] = None


@dataclass
class TestTypeEntity:
    """Domain entity representing a test type."""
    name: str
    description: Optional[str] = None
    default_duration_days: Optional[int] = None


@dataclass
class TestEntity:
    """Domain entity representing a test."""
    name: str
    test_type: str
    project: str
    leg: str
    description: Optional[str] = None
    duration_days: Optional[int] = None
    priority: Optional[int] = None
    fixed_date: Optional[str] = None
    next_leg: Optional[str] = None
    fte_required: Optional[float] = None
    equipment_required: Optional[float] = None


@dataclass
class FTEEntity:
    """Domain entity representing an FTE resource."""
    name: str
    description: Optional[str] = None
    availability_windows: List[str] = field(default_factory=list)


@dataclass
class EquipmentEntity:
    """Domain entity representing an equipment resource."""
    name: str
    description: Optional[str] = None
    availability_windows: List[str] = field(default_factory=list)


@dataclass
class ExternalReference:
    """Represents an external reference that needs validation."""
    ref_type: str
    ref_name: str
    source_config: Optional[str] = None


@dataclass
class ValidationWarning:
    """A validation warning with context."""
    message: str
    ref_type: str
    ref_name: str
    context: Optional[Dict[str, str]] = None
