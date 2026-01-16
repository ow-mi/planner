# [PROJECT NAME] Development Guidelines

Auto-generated from all feature plans. Last updated: [DATE]

## Active Technologies

[EXTRACTED FROM ALL PLAN.MD FILES]

## Project Structure

```text
[ACTUAL STRUCTURE FROM PLANS]
```

## Commands

[ONLY COMMANDS FOR ACTIVE TECHNOLOGIES]

## Code Style

[LANGUAGE-SPECIFIC, ONLY FOR LANGUAGES IN USE]

## Recent Changes

[LAST 3 FEATURES AND WHAT THEY ADDED]

## Alpine.js Component Examples

### Basic Component Structure
```html
<div x-data="{ count: 0, items: [] }"
     x-init="fetchData()">
  <button x-on:click="count++">
    Count: <span x-text="count"></span>
  </button>
  <div x-show="items.length > 0">
    <template x-for="item in items">
      <div x-text="item.name"></div>
    </template>
  </div>
</div>
```

### D3.js Integration Pattern
```html
<div x-data="{ 
  chartData: [], 
  width: 800, 
  height: 400 
}"
     x-init="$nextTick(() => initializeChart())"
     x-effect="updateChart()">
  <svg x-ref="chart" :width="width" :height="height"></svg>
</div>
```

### Event-Driven Communication
```html
<!-- Component A -->
<div x-data="{ selectedItem: null }">
  <button x-on:click="$dispatch('item-selected', { id: 123 })">
    Select Item
  </button>
</div>

<!-- Component B -->
<div x-data="{ activeItem: null }"
     x-on:item-selected.window="activeItem = $event.detail">
  <span x-text="activeItem?.id"></span>
</div>
```

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
