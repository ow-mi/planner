"""Domain models for configuration entities."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List


class ConfigReferenceType(Enum):
    """Types of configuration references."""
    PROJECT = "Project"
    LEG_TYPE = "LegType"
    LEG_NAME = "LegName"
    TEST_TYPE = "TestType"
    TEST_NAME = "TestName"
    FTE = "FTE"
    EQUIPMENT = "Equipment"


@dataclass
class OutOfScopeReference:
    """Represents a configuration reference that is out of scope of the active spreadsheet."""
    ref_type: ConfigReferenceType
    ref_name: str
    spreadsheet_entities: List[str]


@dataclass
class ConfigConsistencyCheckResult:
    """Result of configuration consistency checking."""
    is_consistent: bool
    warnings: List[OutOfScopeReference] = field(default_factory=list)


@dataclass
class ProjectConfig:
    """Project configuration entity."""
    name: str
    description: Optional[str] = None
    priority: Optional[int] = None


@dataclass
class LegTypeConfig:
    """Leg type configuration entity."""
    name: str
    description: Optional[str] = None


@dataclass
class LegConfig:
    """Leg configuration entity."""
    name: str
    leg_type: str
    description: Optional[str] = None
    priority: Optional[int] = None
    fixed_date: Optional[str] = None


@dataclass
class TestTypeConfig:
    """Test type configuration entity."""
    name: str
    description: Optional[str] = None
    default_duration_days: Optional[int] = None


@dataclass
class TestConfig:
    """Test configuration entity."""
    name: str
    test_type: str
    description: Optional[str] = None
    project: Optional[str] = None
    leg: Optional[str] = None
    duration_days: Optional[int] = None
    priority: Optional[int] = None
    fixed_date: Optional[str] = None
    next_leg: Optional[str] = None


@dataclass
class FTEConfig:
    """FTE (Full-Time Employee) configuration entity."""
    name: str
    description: Optional[str] = None
   availability_windows: List[str] = field(default_factory=list)


@dataclass
class EquipmentConfig:
    """Equipment configuration entity."""
    name: str
    description: Optional[str] = None
    availability_windows: List[str] = field(default_factory=list)


@dataclass
class EffectiveSettings:
    """Effective settings for a test resolved through hierarchy."""
    test_name: str
    project: Optional[str] = None
    leg_type: Optional[str] = None
    leg_name: Optional[str] = None
    test_type: Optional[str] = None
    duration_days: Optional[int] = None
    priority: Optional[int] = None
    fte_required: Optional[float] = None
    equipment_required: Optional[float] = None
