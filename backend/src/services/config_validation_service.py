"""Service for validating config consistency against spreadsheet entities."""

from typing import Any, Dict, List, Optional, Set

from backend.src.api.models.common_responses import (
    ConfigReferenceType,
    OutOfScopeReference,
)
from backend.src.api.models.spreadsheet_responses import ExtractedEntities


class ConfigValidationReport:
    """Report of config consistency validation results."""

    def __init__(self):
        self.valid: bool = True
        self.missing_entities: List[OutOfScopeReference] = []
        self.orphaned_entities: List[OutOfScopeReference] = []
        self.statistics: Dict[str, Any] = {}
        self.warnings: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        """Convert report to dictionary for API response."""
        return {
            "valid": self.valid,
            "missing_entities": [self._out_of_scope_to_dict(e) for e in self.missing_entities],
            "orphaned_entities": [self._out_of_scope_to_dict(e) for e in self.orphaned_entities],
            "statistics": self.statistics,
            "warnings": self.warnings,
        }

    @staticmethod
    def _out_of_scope_to_dict(reference: OutOfScopeReference) -> Dict[str, Any]:
        """Convert OutOfScopeReference to dict."""
        return {
            "ref_type": reference.ref_type.value,
            "ref_name": reference.ref_name,
            "spreadsheet_entities": reference.spreadsheet_entities,
        }


class ConfigValidationService:
    """Service for validating config entities against spreadsheet entities."""

    def __init__(self):
        pass

    def validate_config_structure(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate JSON config structure against schema.
        
        Args:
            config: Configuration dict to validate
            
        Returns:
            Validation result with valid flag and errors list
        """
        errors = []
        warnings = []
        
        # Check version
        version = config.get('version')
        if version != '2.0':
            warnings.append(f"Config version '{version}' may not be compatible. Expected '2.0'.")
        
        # Validate weights structure
        weights = config.get('weights', {})
        if 'makespan_weight' in weights and 'priority_weight' in weights:
            total = weights.get('makespan_weight', 0) + weights.get('priority_weight', 0)
            if abs(total - 1.0) > 0.01:
                warnings.append(f"Makespan + priority weights should sum to 1.0, got {total}")
        
        # Validate legs structure
        legs = config.get('legs', {})
        for leg_name, leg_config in legs.items():
            if not isinstance(leg_config, dict):
                errors.append(f"Leg '{leg_name}' must be an object")
                continue
            
            start_date = leg_config.get('start_date')
            if start_date and not self._is_valid_week_format(start_date):
                errors.append(f"Leg '{leg_name}' has invalid start_date format: '{start_date}'. Expected: YYYY-Www.f")
            
            end_date = leg_config.get('end_date')
            if end_date and not self._is_valid_week_format(end_date):
                errors.append(f"Leg '{leg_name}' has invalid end_date format: '{end_date}'. Expected: YYYY-Www.f")
        
        # Validate test settings
        tests = config.get('tests', {})
        for test_name, test_config in tests.items():
            if not isinstance(test_config, dict):
                errors.append(f"Test '{test_name}' must be an object")
        
        # Validate FTE structure
        fte = config.get('fte', {})
        if fte:
            resources = fte.get('resources', [])
            if not isinstance(resources, list):
                errors.append("FTE resources must be a list")
            aliases = fte.get('aliases', {})
            if not isinstance(aliases, dict):
                errors.append("FTE aliases must be an object")
        
        # Validate Equipment structure
        equipment = config.get('equipment', {})
        if equipment:
            resources = equipment.get('resources', [])
            if not isinstance(resources, list):
                errors.append("Equipment resources must be a list")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }

    def _is_valid_week_format(self, date_str: str) -> bool:
        """Check if date string is valid YYYY-Www.f format."""
        import re
        if not date_str:
            return False
        # Match pattern: 4 digits-W2 digits.optional digit
        return bool(re.match(r'^\d{4}-W\d{2}\.\d$', date_str))

    def validate_config_consistency(
        self,
        config: Dict[str, Any],
        spreadsheet_entities: ExtractedEntities,
    ) -> ConfigValidationReport:
        """
        Validate config entities against spreadsheet entities.

        Args:
            config: Configuration JSON to validate
            spreadsheet_entities: Entities extracted from the spreadsheet

        Returns:
            ConfigValidationReport with missing and orphaned entities
        """
        report = ConfigValidationReport()

        # Extract all entity references from config
        config_refs = self._extract_config_references(config)

        # Compare projects
        config_projects = set(config_refs.get("projects", []))
        sheet_projects = set(spreadsheet_entities.projects or [])
        missing_projects = config_projects - sheet_projects
        orphaned_projects = sheet_projects - config_projects

        for proj in missing_projects:
            report.missing_entities.append(
                OutOfScopeReference(
                    ref_type=ConfigReferenceType.Project,
                    ref_name=proj,
                    spreadsheet_entities=spreadsheet_entities.projects,
                )
            )
            report.warnings.append(
                f"Project '{proj}' referenced in config but not found in spreadsheet"
            )

        for proj in orphaned_projects:
            report.orphaned_entities.append(
                OutOfScopeReference(
                    ref_type=ConfigReferenceType.Project,
                    ref_name=proj,
                    spreadsheet_entities=spreadsheet_entities.projects,
                )
            )

        # Compare leg types (branches in spreadsheet)
        config_leg_types = set(config_refs.get("leg_types", []))
        sheet_leg_types = set(spreadsheet_entities.leg_types or [])
        missing_leg_types = config_leg_types - sheet_leg_types
        orphaned_leg_types = sheet_leg_types - config_leg_types

        for lt in missing_leg_types:
            report.missing_entities.append(
                OutOfScopeReference(
                    ref_type=ConfigReferenceType.LegType,
                    ref_name=lt,
                    spreadsheet_entities=spreadsheet_entities.leg_types,
                )
            )
            report.warnings.append(
                f"Leg type '{lt}' referenced in config but not found in spreadsheet"
            )

        for lt in orphaned_leg_types:
            report.orphaned_entities.append(
                OutOfScopeReference(
                    ref_type=ConfigReferenceType.LegType,
                    ref_name=lt,
                    spreadsheet_entities=spreadsheet_entities.leg_types,
                )
            )

        # Compare leg names
        config_leg_names = set(config_refs.get("leg_names", []))
        sheet_leg_names = set(spreadsheet_entities.leg_names or [])
        missing_leg_names = config_leg_names - sheet_leg_names
        orphaned_leg_names = sheet_leg_names - config_leg_names

        for ln in missing_leg_names:
            report.missing_entities.append(
                OutOfScopeReference(
                    ref_type=ConfigReferenceType.LegName,
                    ref_name=ln,
                    spreadsheet_entities=spreadsheet_entities.leg_names,
                )
            )
            report.warnings.append(
                f"Leg name '{ln}' referenced in config but not found in spreadsheet"
            )

        for ln in orphaned_leg_names:
            report.orphaned_entities.append(
                OutOfScopeReference(
                    ref_type=ConfigReferenceType.LegName,
                    ref_name=ln,
                    spreadsheet_entities=spreadsheet_entities.leg_names,
                )
            )

        # Compare test types
        config_test_types = set(config_refs.get("test_types", []))
        sheet_test_types = set(spreadsheet_entities.test_types or [])
        missing_test_types = config_test_types - sheet_test_types
        orphaned_test_types = sheet_test_types - config_test_types

        for tt in missing_test_types:
            report.missing_entities.append(
                OutOfScopeReference(
                    ref_type=ConfigReferenceType.TestType,
                    ref_name=tt,
                    spreadsheet_entities=spreadsheet_entities.test_types,
                )
            )
            report.warnings.append(
                f"Test type '{tt}' referenced in config but not found in spreadsheet"
            )

        for tt in orphaned_test_types:
            report.orphaned_entities.append(
                OutOfScopeReference(
                    ref_type=ConfigReferenceType.TestType,
                    ref_name=tt,
                    spreadsheet_entities=spreadsheet_entities.test_types,
                )
            )

        # Compare test names (computed_test_names in spreadsheet)
        config_test_names = set(config_refs.get("test_names", []))
        sheet_test_names = set(spreadsheet_entities.computed_test_names or [])
        missing_test_names = config_test_names - sheet_test_names
        orphaned_test_names = sheet_test_names - config_test_names

        for tn in missing_test_names:
            report.missing_entities.append(
                OutOfScopeReference(
                    ref_type=ConfigReferenceType.TestName,
                    ref_name=tn,
                    spreadsheet_entities=spreadsheet_entities.computed_test_names,
                )
            )
            report.warnings.append(
                f"Test name '{tn}' referenced in config but not found in spreadsheet"
            )

        for tn in orphaned_test_names:
            report.orphaned_entities.append(
                OutOfScopeReference(
                    ref_type=ConfigReferenceType.TestName,
                    ref_name=tn,
                    spreadsheet_entities=spreadsheet_entities.computed_test_names,
                )
            )

        # Set validity flag
        report.valid = len(report.missing_entities) == 0 and len(report.warnings) == 0

        # Build statistics
        report.statistics = {
            "projects": {
                "in_config": len(config_projects),
                "in_spreadsheet": len(sheet_projects),
                "missing": len(missing_projects),
                "orphaned": len(orphaned_projects),
            },
            "leg_types": {
                "in_config": len(config_leg_types),
                "in_spreadsheet": len(sheet_leg_types),
                "missing": len(missing_leg_types),
                "orphaned": len(orphaned_leg_types),
            },
            "leg_names": {
                "in_config": len(config_leg_names),
                "in_spreadsheet": len(sheet_leg_names),
                "missing": len(missing_leg_names),
                "orphaned": len(orphaned_leg_names),
            },
            "test_types": {
                "in_config": len(config_test_types),
                "in_spreadsheet": len(sheet_test_types),
                "missing": len(missing_test_types),
                "orphaned": len(orphaned_test_types),
            },
            "test_names": {
                "in_config": len(config_test_names),
                "in_spreadsheet": len(sheet_test_names),
                "missing": len(missing_test_names),
                "orphaned": len(orphaned_test_names),
            },
            "total_missing": len(report.missing_entities),
            "total_orphaned": len(report.orphaned_entities),
        }

        return report

    def _extract_config_references(self, config: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Extract all entity references from config JSON.

        Args:
            config: Configuration JSON

        Returns:
            Dictionary mapping entity types to their referenced names
        """
        refs = {
            "projects": [],
            "leg_types": [],
            "leg_names": [],
            "test_types": [],
            "test_names": [],
            "ftes": [],
            "equipment": [],
        }

        # Handle leg configuration
        if "legs" in config and isinstance(config["legs"], dict):
            for leg_name, leg_def in config["legs"].items():
                if leg_name:
                    refs["leg_names"].append(leg_name)

                # Extract leg type (branch from leg definitions)
                if isinstance(leg_def, dict):
                    if "type" in leg_def:
                        refs["leg_types"].append(leg_def["type"])
                    if "branch" in leg_def:
                        refs["leg_types"].append(leg_def["branch"])

                    # Extract tests from leg definitions
                    if "tests" in leg_def and isinstance(leg_def["tests"], list):
                        for test in leg_def["tests"]:
                            if isinstance(test, str):
                                refs["test_names"].append(test)
                            elif isinstance(test, dict):
                                if "name" in test:
                                    refs["test_names"].append(test["name"])
                                if "type" in test:
                                    refs["test_types"].append(test["type"])

        # Handle project definitions
        if "projects" in config and isinstance(config["projects"], dict):
            for proj_name in config["projects"].keys():
                if proj_name:
                    refs["projects"].append(proj_name)

            # Also extract from project definitions
            for proj_name, proj_def in config["projects"].items():
                if isinstance(proj_def, dict):
                    # Project might have required_legs, required_tests, etc.
                    if "required_legs" in proj_def and isinstance(proj_def["required_legs"], list):
                        for leg in proj_def["required_legs"]:
                            if isinstance(leg, str):
                                refs["leg_names"].append(leg)

                    if "required_tests" in proj_def and isinstance(proj_def["required_tests"], list):
                        for test in proj_def["required_tests"]:
                            if isinstance(test, str):
                                refs["test_names"].append(test)

                    if "required_lts" in proj_def and isinstance(proj_def["required_lts"], list):
                        for lt in proj_def["required_lts"]:
                            if isinstance(lt, str):
                                refs["leg_types"].append(lt)

        # Handle test definitions
        if "tests" in config and isinstance(config["tests"], dict):
            for test_name in config["tests"].keys():
                if test_name:
                    refs["test_names"].append(test_name)

            for test_name, test_def in config["tests"].items():
                if isinstance(test_def, dict):
                    if "type" in test_def:
                        refs["test_types"].append(test_def["type"])

        # Handle FTE definitions
        if "resources" in config and isinstance(config["resources"], dict):
            resources = config["resources"]
            if "fte" in resources and isinstance(resources["fte"], dict):
                for fte_name in resources["fte"].keys():
                    if fte_name:
                        refs["ftes"].append(fte_name)

            if "equipment" in resources and isinstance(resources["equipment"], dict):
                for equip_name in resources["equipment"].keys():
                    if equip_name:
                        refs["equipment"].append(equip_name)

        # Also try direct keys
        if "fte" in config and isinstance(config["fte"], dict):
            for fte_name in config["fte"].keys():
                if fte_name:
                    refs["ftes"].append(fte_name)

        if "equipment" in config and isinstance(config["equipment"], dict):
            for equip_name in config["equipment"].keys():
                if equip_name:
                    refs["equipment"].append(equip_name)

        # Remove duplicates while preserving order
        for key in refs:
            refs[key] = list(dict.fromkeys(refs[key]))

        return refs


# Global instance
config_validation_service = ConfigValidationService()