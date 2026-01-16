# Priority Modes

## A. Leg Priority 
- Higher priority legs get scheduled first
- Lower priority legs can only start after higher priority legs complete
- Objective: Minimize makespan with priority-weighted constraints

## B. End Date Priority (Your Mode 2)
Minimize total project duration
No special handling for individual legs
Pure makespan minimization

## C. End Date Sticky (Your Mode 3)
- Target completion date constraint
- Fill resource gaps with work from other legs
- Penalty for exceeding target date
- Bonus for parallel execution efficiency

## D. Leg End Dates (Your Mode 4)
- Each leg has a target completion date
- Legs can be scheduled in parallel if they don't exceed their deadlines
- Hard constraints on leg deadlines with penalties

## E. Resource Bottleneck Priority
- Identify bottleneck resources (high utilization)
- Prioritize legs that use under-utilized resources
- Balance resource utilization across the project

## F. Test Proximity Constraints
- Forces tests containing specific string patterns to run within a specified time window of their immediately preceding test
- Pattern-based matching (e.g., "p-02", "p-03")
- Each pattern-matched test must start within max_gap_days of the previous test in the sequence
- Configurable proximity windows and penalty-based enforcement
- Works with all existing priority modes as an additional constraint layer
- Soft constraints with penalties for violations

### Test Proximity Configuration
```json
{
  "mode": "leg_end_dates",
  "test_proximity_rules": {
    "patterns": ["p-02", "p-03"],
    "max_gap_days": 30,
    "proximity_penalty_per_day": 50.0,
    "enforce_sequence_order": true
  },
  "weights": {
    "makespan_weight": 0.2,
    "priority_weight": 0.8
  }
}
```

### Parameters
- `patterns`: Array of strings to match in test names/IDs/descriptions
- `max_gap_days`: Maximum allowed gap between a pattern-matched test and its immediately preceding test in the sequence
- `proximity_penalty_per_day`: Penalty cost per day that violates the max_gap constraint (i.e., penalty for being TOO FAR from preceding test)
- `enforce_sequence_order`: Whether to enforce proximity within leg sequences (currently always true)

### Behavior
For each test matching the patterns (e.g., P-02, P-03), the constraint ensures:
- P-02/P-03 test must start within `max_gap_days` of the previous test in the sequence
- This applies regardless of what the previous test is (it doesn't have to be another pattern-matched test)
- Penalty is applied for each day beyond the `max_gap_days` limit

# input

- select witch mode in the main python command -leg -end etc.
settings set in the .json file 
