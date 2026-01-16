# Priority Configuration Guide

## Overview

The `priority_config.json` file defines the optimization objectives and scheduling priorities for the Test Planner V4. This configuration controls how the solver balances competing goals such as project duration, resource utilization, and meeting deadlines.

## File Structure

The priority configuration uses the following basic structure:

```json
{
  "mode": "priority_mode_name",
  "description": "Human-readable description",
  "weights": {
    "makespan_weight": 0.0,
    "priority_weight": 0.0
  },
  "mode_specific_parameters": {
    // Parameters specific to the chosen mode
  }
}
```

## Priority Modes

The Test Planner supports 5 distinct priority modes, each designed for different scheduling scenarios:

### 1. End Date Priority Mode
**Mode:** `end_date_priority`
**Purpose:** Pure makespan minimization - minimize total project duration

**Configuration:**
```json
{
  "mode": "end_date_priority",
  "description": "Minimize total project duration. No special handling for individual legs. Pure makespan minimization.",
  "weights": {
    "makespan_weight": 1.0,
    "priority_weight": 0.0
  }
}
```

**When to Use:**
- Simple projects where only total duration matters
- Maximum throughput scenarios
- When individual leg priorities are not important

### 2. Leg Priority Mode
**Mode:** `leg_priority`
**Purpose:** Schedule higher priority legs first, lower priority legs can only start after higher priority legs complete

**Configuration:**
```json
{
  "mode": "leg_priority",
  "description": "Higher priority legs get scheduled first. Lower priority legs can only start after higher priority legs complete.",
  "weights": {
    "makespan_weight": 0.3,
    "priority_weight": 0.7
  },
  "leg_weights": {
    "leg_1": 1.0,
    "leg_2": 0.8,
    "leg_3": 0.6,
    "leg_4": 0.4,
    "leg_5": 0.2
  },
  "priority_sequence": [
    "leg_1",
    "leg_2",
    "leg_3",
    "leg_4",
    "leg_5"
  ]
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `leg_weights` | Object | Either this or `priority_sequence` | `{}` | Direct weight assignment for each leg (0.0 to 1.0) |
| `priority_sequence` | Array | Either this or `leg_weights` | `[]` | Ordered list of leg IDs by priority (first = highest priority) |

**Notes:**
- You must specify either `leg_weights` OR `priority_sequence`, not both
- If using `priority_sequence`, weights are automatically calculated (1.0, 0.83, 0.67, etc.)
- Higher weights = higher priority
- Weights are normalized to sum to 1.0

**When to Use:**
- Projects with clear priority hierarchy
- Critical path dependencies between legs
- When certain legs must complete before others can start

### 3. End Date Sticky Mode
**Mode:** `end_date_sticky`
**Purpose:** Target completion date with gap filling - meet a specific project deadline while efficiently using available resources

**Configuration:**
```json
{
  "mode": "end_date_sticky",
  "description": "Target completion date constraint. Fill resource gaps with work from other legs. Penalty for exceeding target date.",
  "weights": {
    "makespan_weight": 0.4,
    "priority_weight": 0.6
  },
  "target_completion_date": "2024-12-31",
  "penalty_per_day_late": 100.0,
  "parallel_execution_bonus": 50.0
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `target_completion_date` | String (ISO date) | Yes | None | Target project completion date (YYYY-MM-DD format) |
| `penalty_per_day_late` | Number | No | 100.0 | Penalty weight added to objective for each day past target |
| `parallel_execution_bonus` | Number | No | 50.0 | Bonus for efficient parallel execution of tests |

**Notes:**
- Date format must be ISO 8601 (YYYY-MM-DD)
- Penalty encourages meeting the target date
- Bonus encourages filling resource gaps efficiently

**When to Use:**
- Fixed project deadlines (product launches, regulatory dates)
- Projects where missing deadlines is very costly
- When you want to maximize resource utilization around a deadline

### 4. Leg End Dates Mode
**Mode:** `leg_end_dates`
**Purpose:** Each leg has individual deadlines - schedule legs in parallel while respecting their specific deadlines

**Configuration:**
```json
{
  "mode": "leg_end_dates",
  "description": "Each leg has a target completion date. Legs can be scheduled in parallel if they don't exceed their deadlines.",
  "weights": {
    "makespan_weight": 0.2,
    "priority_weight": 0.8
  },
  "leg_deadlines": {
    "leg_1": "2024-10-15",
    "leg_2": "2024-11-01",
    "leg_3": "2024-11-15",
    "leg_4": "2024-12-01",
    "leg_5": "2024-12-15"
  },
  "deadline_penalty_per_day": 200.0,
  "allow_parallel_within_deadlines": true
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `leg_deadlines` | Object | Yes | `{}` | Map of leg_id to deadline date (YYYY-MM-DD format) |
| `deadline_penalty_per_day` | Number | No | 200.0 | Penalty weight for each day a leg misses its deadline |
| `allow_parallel_within_deadlines` | Boolean | No | true | Whether to allow parallel execution when deadlines permit |

**Notes:**
- All leg deadlines must be specified
- Legs can run in parallel if their deadlines allow
- Higher penalty = stricter deadline enforcement

**When to Use:**
- Multiple independent deliverables with different deadlines
- Complex projects with staggered milestones
- When different components have different business priorities

### 5. Resource Bottleneck Mode
**Mode:** `resource_bottleneck`
**Purpose:** Balance resource utilization - identify and prioritize work that uses under-utilized resources

**Configuration:**
```json
{
  "mode": "resource_bottleneck",
  "description": "Identify bottleneck resources (high utilization). Prioritize legs that use under-utilized resources.",
  "weights": {
    "makespan_weight": 0.4,
    "priority_weight": 0.3,
    "resource_balance_weight": 0.3
  },
  "bottleneck_threshold": 0.8,
  "resource_balance_weight": 0.3,
  "utilization_target": 0.7
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `bottleneck_threshold` | Number (0-1) | No | 0.8 | Utilization threshold above which a resource is considered bottlenecked |
| `resource_balance_weight` | Number (0-1) | No | 0.3 | Weight for resource balancing in the objective function |
| `utilization_target` | Number (0-1) | No | 0.7 | Target utilization level for each resource type |

**Notes:**
- All three weights (makespan, priority, resource_balance) must sum to 1.0
- Bottleneck threshold identifies over-utilized resources
- Utilization target defines the desired resource efficiency level

**When to Use:**
- Resource-constrained environments
- Projects where resource efficiency is critical
- When trying to maximize overall system throughput

## Common Configuration Parameters

All priority modes support these base parameters:

### Weights Configuration

```json
"weights": {
  "makespan_weight": 0.5,
  "priority_weight": 0.5
}
```

| Parameter | Type | Required | Range | Description |
|-----------|------|----------|-------|-------------|
| `makespan_weight` | Number | Yes | 0.0 - 1.0 | Weight for minimizing total project duration |
| `priority_weight` | Number | Yes | 0.0 - 1.0 | Weight for priority-based scheduling |

**Important:** `makespan_weight` + `priority_weight` must equal 1.0 (or 1.0 including resource_balance_weight for bottleneck mode)

### Description Parameter

```json
"description": "Human-readable description of this configuration"
```

- Optional but recommended for documentation
- Helps identify configuration purpose in logs and reports

## Validation Rules

The system validates all configurations before execution:

### Weight Validation
- All weights must be non-negative
- Weights must sum to 1.0 (within 0.001 tolerance)
- Resource bottleneck mode requires three weights summing to 1.0

### Mode-Specific Validation
- **Leg Priority:** Must specify either `leg_weights` OR `priority_sequence`
- **End Date Sticky:** Must specify `target_completion_date`
- **Leg End Dates:** Must specify `leg_deadlines` object
- **Resource Bottleneck:** All threshold parameters must be between 0 and 1

### Date Format Validation
- All dates must use ISO 8601 format (YYYY-MM-DD)
- Dates must be valid calendar dates
- Target dates should be in the future relative to project start

## Best Practices

### 1. Start Simple
```json
{
  "mode": "end_date_priority",
  "description": "Initial configuration - pure makespan minimization"
}
```
- Begin with end_date_priority to understand baseline performance
- Add complexity only when needed

### 2. Use Clear Descriptions
```json
"description": "Q4 2024 release - critical path legs must complete by November 15"
```
- Document the business reason for each configuration
- Include relevant dates and priorities

### 3. Balance Weights Appropriately
```json
"weights": {
  "makespan_weight": 0.4,
  "priority_weight": 0.6
}
```
- Higher makespan_weight: Faster overall completion
- Higher priority_weight: Better adherence to priorities/deadlines
- Typical range: 0.3-0.7 for each

### 4. Set Realistic Deadlines
```json
"leg_deadlines": {
  "frontend_tests": "2024-11-01",
  "backend_tests": "2024-11-15",
  "integration_tests": "2024-12-01"
}
```
- Allow sufficient time between dependent activities
- Consider resource constraints when setting deadlines
- Include buffer time for unexpected delays

### 5. Monitor Resource Utilization
```json
{
  "mode": "resource_bottleneck",
  "bottleneck_threshold": 0.85,
  "utilization_target": 0.75
}
```
- Set bottleneck threshold slightly above target utilization
- Adjust based on actual resource availability
- Monitor for resource conflicts in reports

## Common Pitfalls

### 1. Over-Constrained Configurations
**Problem:** Too many hard constraints causing infeasible solutions
```json
// ❌ Too aggressive
"deadline_penalty_per_day": 1000.0,
"target_completion_date": "2024-10-01"  // Too soon
```

**Solution:**
```json
// ✅ More realistic
"deadline_penalty_per_day": 100.0,
"target_completion_date": "2024-11-15"  // Achievable
```

### 2. Conflicting Priorities
**Problem:** Multiple high-priority legs competing for same resources
```json
// ❌ All legs high priority
"leg_weights": {
  "leg_1": 1.0, "leg_2": 1.0, "leg_3": 1.0  // Conflict!
}
```

**Solution:**
```json
// ✅ Clear hierarchy
"leg_weights": {
  "leg_1": 1.0, "leg_2": 0.7, "leg_3": 0.4
}
```

### 3. Unrealistic Deadlines
**Problem:** Individual leg deadlines that don't allow for dependencies
```json
// ❌ Impossible deadlines
"leg_deadlines": {
  "leg_1": "2024-10-15",    // Depends on leg_2
  "leg_2": "2024-10-20",    // But leg_1 finishes first!
}
```

**Solution:**
```json
// ✅ Sequential deadlines
"leg_deadlines": {
  "leg_1": "2024-10-15",
  "leg_2": "2024-11-01",    // After leg_1 completes
}
```

## Configuration Examples

### Example 1: Simple Priority-Based Scheduling
```json
{
  "mode": "leg_priority",
  "description": "Development project - prioritize critical features",
  "weights": {
    "makespan_weight": 0.3,
    "priority_weight": 0.7
  },
  "priority_sequence": [
    "authentication_system",
    "user_management",
    "reporting_dashboard",
    "api_integration",
    "performance_optimization"
  ]
}
```

### Example 2: Deadline-Driven Project
```json
{
  "mode": "end_date_sticky",
  "description": "Product launch - must complete by Q4 end",
  "weights": {
    "makespan_weight": 0.2,
    "priority_weight": 0.8
  },
  "target_completion_date": "2024-12-31",
  "penalty_per_day_late": 200.0,
  "parallel_execution_bonus": 75.0
}
```

### Example 3: Resource-Constrained Environment
```json
{
  "mode": "resource_bottleneck",
  "description": "Testing lab with limited equipment - balance utilization",
  "weights": {
    "makespan_weight": 0.4,
    "priority_weight": 0.3,
    "resource_balance_weight": 0.3
  },
  "bottleneck_threshold": 0.9,
  "utilization_target": 0.8
}
```

### Example 4: Complex Multi-Deadline Project
```json
{
  "mode": "leg_end_dates",
  "description": "Platform migration - multiple component deadlines",
  "weights": {
    "makespan_weight": 0.2,
    "priority_weight": 0.8
  },
  "leg_deadlines": {
    "database_migration": "2024-10-15",
    "api_migration": "2024-11-01",
    "frontend_migration": "2024-11-15",
    "integration_testing": "2024-12-01",
    "performance_testing": "2024-12-15"
  },
  "deadline_penalty_per_day": 150.0,
  "allow_parallel_within_deadlines": true
}
```

## Template Files

The `templates/` directory contains example configurations for each mode:

- `priority_config_end_date.json` - Basic makespan minimization
- `priority_config_leg_priority.json` - Leg-based priority scheduling
- `priority_config_sticky_end_date.json` - Target date with penalties
- `priority_config_leg_end_dates.json` - Individual leg deadlines
- `priority_config_resource_bottleneck.json` - Resource balancing

Copy and modify these templates for your specific use cases.

## Troubleshooting

### Configuration Not Loading
- Verify JSON syntax is valid
- Check that all required parameters are present
- Ensure date formats use ISO 8601 (YYYY-MM-DD)
- Validate that weights sum to 1.0

### Poor Solution Quality
- Increase solver time limits if solutions seem suboptimal
- Review weight balance between makespan and priority
- Consider if deadlines are realistic given resource constraints
- Check for conflicting priorities or impossible constraints

### Resource Conflicts
- Use resource bottleneck mode to identify over-utilized resources
- Review resource availability in input data
- Consider adjusting bottleneck thresholds
- Check for equipment or FTE shortages

## Integration with Other Systems

The priority configuration integrates with:

- **Input Data:** References leg IDs from `data_legs.csv`
- **Resource Data:** Uses FTE and equipment from `data_fte.csv` and `data_equipment.csv`
- **Solver:** Feeds into CP-SAT optimization engine
- **Reporting:** Results appear in schedule reports and visualizations

Always validate your configuration against your actual input data to ensure consistency.

