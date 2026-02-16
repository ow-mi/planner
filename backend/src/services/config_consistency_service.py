"""Service for configuration consistency checking."""
import json
from typing import Dict, List, Optional

from backend.src.api.models.responses import (
    ConfigReferenceType,
    OutOfScopeReference,
    ConsistencyCheckResponse,
    ExtractedEntities,
)


class ConfigConsistencyService:
    """Service for validating JSON configuration against spreadsheet entities."""

    def check_consistency(self, request) -> ConsistencyCheckResponse:
        """
        Validate imported JSON configuration against active spreadsheet entities.
        Returns warnings for out-of-scope references that will be ignored at runtime.
        """
        # Parse the config JSON
        try:
            config = json.loads(request.config_json)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON configuration: {e}")

        # Extract entities from the config
        config_entities = self._extract_config_entities(config)

        # Get spreadsheet entities
        spreadsheet = request.spreadsheet_entities

        # Check for out-of-scope references
        warnings = []
        warnings.extend(self._check_projects(config_entities, spreadsheet))
        warnings.extend(self._check_legs(config_entities, spreadsheet))
        warnings.extend(self._check_test_types(config_entities, spreadsheet))
        warnings.extend(self._check_fte(config_entities, spreadsheet))
        warnings.extend(self._check_equipment(config_entities, spreadsheet))

        return ConsistencyCheckResponse(
            is_consistent=len(warnings) == 0,
            warnings=warnings,
        )

    def _extract_config_entities(self, config: Dict) -> Dict:
        """Extract named entities from configuration."""
        entities = {
            "projects": set(),
            "leg_types": set(),
            "leg_names": set(),
            "test_types": set(),
            "fte": set(),
            "equipment": set(),
        }

        # Extract projects from config
        if "projects" in config:
            for proj in config["projects"]:
                if isinstance(proj, dict) and "name" in proj:
                    entities["projects"].add(proj["name"])
                elif isinstance(proj, str):
                    entities["projects"].add(proj)

        # Extract leg-related entities
        if "legs" in config:
            for leg in config["legs"]:
                if isinstance(leg, dict):
                    if "leg_type" in leg:
                        entities["leg_types"].add(leg["leg_type"])
                    if "name" in leg:
                        entities["leg_names"].add(leg["name"])

        # Extract test types
        if "test_types" in config:
            for test_type in config["test_types"]:
                if isinstance(test_type, dict) and "name" in test_type:
                    entities["test_types"].add(test_type["name"])
                elif isinstance(test_type, str):
                    entities["test_types"].add(test_type)

        # Extract FTE names
        if "fte" in config:
            for fte in config["fte"]:
                if isinstance(fte, dict) and "name" in fte:
                    entities["fte"].add(fte["name"])
                elif isinstance(fte, str):
                    entities["fte"].add(fte)

        # Extract equipment names
        if "equipment" in config:
            for eq in config["equipment"]:
                if isinstance(eq, dict) and "name" in eq:
                    entities["equipment"].add(eq["name"])
                elif isinstance(eq, str):
                    entities["equipment"].add(eq)

        return entities

    def _check_projects(
        self, config: Dict, spreadsheet: ExtractedEntities
    ) -> List[OutOfScopeReference]:
        """Check for project references not in spreadsheet."""
        warnings = []
        spreadsheet_projects = set(spreadsheet.projects)

        for proj in config["projects"]:
            if proj not in spreadsheet_projects:
                warnings.append(
                    OutOfScopeReference(
                        ref_type=ConfigReferenceType.Project,
                        ref_name=proj,
                        spreadsheet_entities=spreadsheet.projects,
                    )
                )

        return warnings

    def _check_legs(
        self, config: Dict, spreadsheet: ExtractedEntities
    ) -> List[OutOfScopeReference]:
        """Check for leg references not in spreadsheet."""
        warnings = []
        spreadsheet_leg_types = set(spreadsheet.leg_types)
        spreadsheet_leg_names = set(spreadsheet.leg_names)

        for leg_type in config["leg_types"]:
            if leg_type not in spreadsheet_leg_types:
                warnings.append(
                    OutOfScopeReference(
                        ref_type=ConfigReferenceType.LegType,
                        ref_name=leg_type,
                        spreadsheet_entities=spreadsheet.leg_types,
                    )
                )

        for leg_name in config["leg_names"]:
            if leg_name not in spreadsheet_leg_names:
                warnings.append(
                    OutOfScopeReference(
                        ref_type=ConfigReferenceType.LegName,
                        ref_name=leg_name,
                        spreadsheet_entities=spreadsheet.leg_names,
                    )
                )

        return warnings

    def _check_test_types(
        self, config: Dict, spreadsheet: ExtractedEntities
    ) -> List[OutOfScopeReference]:
        """Check for test type references not in spreadsheet."""
        warnings = []
        spreadsheet_test_types = set(spreadsheet.test_types)

        for test_type in config["test_types"]:
            if test_type not in spreadsheet_test_types:
                warnings.append(
                    OutOfScopeReference(
                        ref_type=ConfigReferenceType.TestType,
                        ref_name=test_type,
                        spreadsheet_entities=spreadsheet.test_types,
                    )
                )

        return warnings

    def _check_fte(
        self, config: Dict, spreadsheet: ExtractedEntities
    ) -> List[OutOfScopeReference]:
        """Check for FTE references not in spreadsheet."""
        warnings = []
        spreadsheet_fte = set(spreadsheet.leg_names)  # FTE stored in leg_names slot

        for fte in config["fte"]:
            if fte not in spreadsheet_fte:
                warnings.append(
                    OutOfScopeReference(
                        ref_type=ConfigReferenceType.FTE,
                        ref_name=fte,
                        spreadsheet_entities=list(spreadsheet_fte),
                    )
                )

        return warnings

    def _check_equipment(
        self, config: Dict, spreadsheet: ExtractedEntities
    ) -> List[OutOfScopeReference]:
        """Check for equipment references not in spreadsheet."""
        warnings = []

        # Equipment names would be in a separate column
        # For now, we check against projects as a fallback
        spreadsheet_equipment = set(spreadsheet.computed_test_names)

        for eq in config["equipment"]:
            if eq not in spreadsheet_equipment:
                warnings.append(
                    OutOfScopeReference(
                        ref_type=ConfigReferenceType.Equipment,
                        ref_name=eq,
                        spreadsheet_entities=list(spreadsheet_equipment),
                    )
                )

        return warnings


# Global instance
config_consistency_service = ConfigConsistencyService()
