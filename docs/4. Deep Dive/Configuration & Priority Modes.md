# Deep Dive: Configuration & Priority Modes

## Overview

The solver supports multiple **priority modes** that define different optimization objectives. These modes allow users to tailor the scheduling algorithm to their specific needs, whether they prioritize meeting deadlines, optimizing resource usage, or keeping related tests close together.

## Priority Modes

### 1. Leg Priority (`leg_priority`)

**Objective**: Minimize weighted sum of leg completion times.

**Use Case**: When certain legs (groups of related tests) are more important than others and should be completed earlier.

**Configuration:**
```yaml
priority_mode: leg_priority
leg_weights:
  LEG_001: 10   # High priority leg
  LEG_002: 5    # Medium priority
  LEG_003: 1    # Low priority
```

**Mathematical Formulation:**
```
minimize Σ weight[l] * max(end[t] for t in leg[l])
```

### 2. End Date Priority (`end_date_priority`)

**Objective**: Minimize deviation from target end dates.

**Use Case**: When tests have specific target completion dates that should be met.

**Configuration:**
```yaml
priority_mode: end_date_priority
target_dates:
  TEST_001: "2024-W15"  # ISO week format
  TEST_002: "2024-W16"
penalty_weights:
  early: 0.1    # Penalty for finishing early
  late: 1.0     # Penalty for finishing late
```

**Mathematical Formulation:**
```
minimize Σ (penalty_early * max(0, target - end) + penalty_late * max(0, end - target))
```

### 3. Sticky End Date (`sticky_end_date`)

**Objective**: Schedule tests as close as possible to their deadlines.

**Use Case**: When tests should run near their deadlines (e.g., to minimize inventory holding time).

**Configuration:**
```yaml
priority_mode: sticky_end_date
stickiness:
  TEST_001:
    deadline: "2024-W20"
    weight: 1.0
  TEST_002:
    deadline: "2024-W22"
    weight: 0.5
```

**Mathematical Formulation:**
```
minimize Σ weight[t] * |end[t] - deadline[t]|
```

### 4. Resource Bottleneck (`resource_bottleneck`)

**Objective**: Maximize resource utilization and minimize idle time.

**Use Case**: When resource efficiency is critical and resources should be used to maximum capacity.

**Configuration:**
```yaml
priority_mode: resource_bottleneck
resources:
  FTE_001:
    capacity: 5
    weight: 1.0
  EQUIPMENT_A:
    capacity: 2
    weight: 0.8
```

**Mathematical Formulation:**
```
minimize Σ (idle_time[r]) where idle_time[r] = total_time - utilization[r]
```

### 5. Test Proximity (`test_proximity`)

**Objective**: Keep specified groups of tests close together in time.

**Use Case**: When related tests should run close together to reduce setup/teardown overhead.

**Configuration:**
```yaml
priority_mode: test_proximity
proximity_groups:
  - name: power_tests
    tests: [TEST_001, TEST_002, TEST_003]
    max_gap: 24  # Maximum time units between first and last
    weight: 1.0
  - name: thermal_tests
    tests: [TEST_004, TEST_005]
    max_gap: 48
    weight: 0.5
```

**Mathematical Formulation:**
```
minimize Σ weight[g] * (max(end[t] for t in group[g]) - min(start[t] for t in group[g]))
```

## Configuration File Format

### YAML Configuration

```yaml
# priority_config.yaml
priority_mode: leg_priority

# Global settings
time_limit: 300        # Solver time limit in seconds
debug_level: 1         # 0=quiet, 1=normal, 2=verbose

# Mode-specific configuration
leg_weights:
  LEG_001: 10
  LEG_002: 8
  LEG_003: 5
  LEG_004: 2

# Deadline constraints (applies to all modes)
deadlines:
  TEST_001:
    deadline: "2024-W20"
    hard: true      # Must meet deadline
  TEST_002:
    deadline: "2024-W22"
    hard: false     # Soft constraint

# Proximity rules (used by test_proximity mode)
proximity_rules:
  - tests: [TEST_001, TEST_002]
    max_gap: 24
    penalty: 100

# Penalty settings
penalty_settings:
  deadline_violation: 1000
  resource_conflict: 500
  precedence_violation: 10000
```

### JSON Configuration

```json
{
  "priority_mode": "leg_priority",
  "time_limit": 300,
  "debug_level": 1,
  "leg_weights": {
    "LEG_001": 10,
    "LEG_002": 8,
    "LEG_003": 5
  },
  "deadlines": [
    {
      "test_id": "TEST_001",
      "deadline_week": "2024-W20",
      "is_hard": true
    }
  ],
  "proximity_rules": [
    {
      "tests": ["TEST_001", "TEST_002"],
      "max_gap_hours": 24
    }
  ]
}
```

## Configuration API

### Frontend → Backend Transformation

The frontend UI captures configuration in a user-friendly format, and `apiService.js` transforms it to the backend canonical format:

```javascript
// Frontend shape (user input)
const uiConfig = {
  priorityMode: 'leg_priority',
  legWeights: {
    'LEG_001': 'high',
    'LEG_002': 'medium'
  },
  deadlines: [
    { testId: 'TEST_001', weekDate: 'W15-2024', isHard: true }
  ]
};

// Transformed to backend format
const backendConfig = ApiService.normalizeConfig(uiConfig);
// Result:
// {
//   priority_mode: 'leg_priority',
//   leg_weights: { 'LEG_001': 10, 'LEG_002': 5 },
//   deadlines: [{ test_id: 'TEST_001', deadline: '2024-W15', hard: true }]
// }
```

### Backend Validation

```python
# backend/src/services/config_validation_service.py
class ConfigValidationService:
    def validate_config(self, config: dict) -> ValidationResult:
        errors = []
        
        # Validate priority mode
        if config.get('priority_mode') not in VALID_PRIORITY_MODES:
            errors.append(f"Invalid priority mode: {config.get('priority_mode')}")
        
        # Validate deadlines
        for deadline in config.get('deadlines', []):
            if not self.validate_week_format(deadline.get('deadline')):
                errors.append(f"Invalid deadline format: {deadline}")
        
        # Validate proximity rules
        for rule in config.get('proximity_rules', []):
            if len(rule.get('tests', [])) < 2:
                errors.append("Proximity rule must have at least 2 tests")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors
        )
```

## Constraint Types

### Temporal Constraints

Define when tests can run based on time:

| Constraint | Description | Parameters |
|------------|-------------|------------|
| Release Time | Earliest start time | `release_time[t]` |
| Deadline | Latest end time | `deadline[t]`, `is_hard` |
| Duration | Fixed test length | `duration[t]` |

### Precedence Constraints

Define ordering relationships between tests:

```yaml
precedences:
  - predecessor: TEST_001
    successor: TEST_002
    lag: 0        # Optional gap between end and start
  - predecessor: TEST_002
    successor: TEST_003
    lag: 24       # 24 time units between TEST_002 end and TEST_003 start
```

### Resource Constraints

Define resource availability and capacity:

```yaml
resources:
  - id: FTE_001
    type: fte
    capacity: 5            # Can support 5 concurrent tests
    availability:
      - start: "2024-W10"
        end: "2024-W30"
  - id: EQUIPMENT_A
    type: equipment
    capacity: 1            # Single unit
    availability:
      - start: "2024-W15"
        end: "2024-W25"
```

### Proximity Constraints

Define tests that should run close together:

```yaml
proximity_rules:
  - name: setup_group_1
    tests: [TEST_001, TEST_002, TEST_003]
    max_gap: 48            # Max hours between first start and last end
    priority: high         # Optimization priority
```

## Objective Function Composition

Multiple objectives can be combined with weights:

```yaml
# Combined objective configuration
objective_weights:
  makespan: 0.3           # Minimize total project duration
  leg_priority: 0.4       # Prioritize important legs
  resource_utilization: 0.2  # Maximize resource usage
  proximity: 0.1          # Keep related tests together
```

The solver combines these into a single objective:

```python
objective = (
    w1 * makespan_objective +
    w2 * leg_priority_objective +
    w3 * resource_utilization_objective +
    w4 * proximity_objective
)
```

## Frontend Configuration Store

The `configStore.js` manages configuration state in the browser:

```javascript
Alpine.store('config', {
    priorityMode: 'leg_priority',
    legWeights: {},
    deadlines: [],
    proximityRules: [],
    penaltySettings: {
        deadlineViolation: 1000,
        resourceConflict: 500
    },
    
    // Load from localStorage
    loadFromStorage() {
        const saved = localStorage.getItem('solver_config');
        if (saved) {
            Object.assign(this, JSON.parse(saved));
        }
    },
    
    // Save to localStorage
    saveToStorage() {
        localStorage.setItem('solver_config', JSON.stringify({
            priorityMode: this.priorityMode,
            legWeights: this.legWeights,
            deadlines: this.deadlines,
            proximityRules: this.proximityRules,
            penaltySettings: this.penaltySettings
        }));
    },
    
    // Validate before solving
    validate() {
        const errors = [];
        if (!this.priorityMode) {
            errors.push('Priority mode is required');
        }
        // ... more validation
        return { isValid: errors.length === 0, errors };
    }
});
```

## Testing Configuration

```python
def test_leg_priority_mode():
    """Test leg priority mode produces expected results."""
    config = {
        'priority_mode': 'leg_priority',
        'leg_weights': {'LEG_001': 10, 'LEG_002': 1}
    }
    
    results = run_planning_pipeline(
        input_folder=test_data_path,
        output_folder=tmp_path,
        priority_config=config
    )
    
    # Verify high-priority leg finishes earlier
    leg_001_end = max(t.end for t in results if t.leg_id == 'LEG_001')
    leg_002_end = max(t.end for t in results if t.leg_id == 'LEG_002')
    
    assert leg_001_end < leg_002_end, "High priority leg should finish earlier"

def test_deadline_constraints():
    """Test deadline constraints are respected."""
    config = {
        'priority_mode': 'end_date_priority',
        'deadlines': [{'test_id': 'TEST_001', 'deadline': 100, 'hard': True}]
    }
    
    results = run_planning_pipeline(...)
    
    test_001 = next(t for t in results if t.test_id == 'TEST_001')
    assert test_001.end <= 100, "Hard deadline should be respected"
```

## Potential Improvements

1. **Multi-objective Optimization**: Pareto-optimal solutions for conflicting objectives
2. **Constraint Relaxation**: Auto-relax constraints when infeasible
3. **Sensitivity Analysis**: Report how changes affect solution
4. **Configuration Templates**: Pre-built configurations for common scenarios
5. **Learning from History**: Suggest configuration based on past successful runs