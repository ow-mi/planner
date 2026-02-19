# Test Subtab Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Configuration → Test subtab with a consistent hierarchical UI pattern that clearly communicates inheritance, prevents redundant editing, and eliminates duplicate UI logic across all hierarchy levels (Projects, Leg Types, Legs, Test Types, Tests).

**Architecture:** Transform the current tab-based navigation into a unified hierarchical view using a standardized card-based layout. Each hierarchy level will display only its relevant editable fields while showing inherited values as read-only context. The inheritance chain will be visualized clearly using a breadcrumb-style indicator.

**Tech Stack:** Alpine.js for reactive UI, existing configStore.js for state management, Tailwind CSS for styling, Vanilla JavaScript ES6+ modules.

---

## Current State Analysis

The current Test subtab implementation (lines 1206-1921 in `config-editor.html`) has these issues:

1. **Inconsistent Field Patterns**: Each level uses different UI patterns:
   - Project: Simple inputs with direct x-model binding
   - Leg Types: Checkbox + input pattern with "override" indicators
   - Legs: Direct value binding without override mechanism
   - Test Types: Card-based with full field set
   - Tests: Similar to Test Types but different structure

2. **Unclear Inheritance**: No visual indication of where values come from at each level

3. **Redundant Controls**: Same resource assignment UI repeated at multiple levels with slight variations

4. **Missing "All" Level**: No root-level view showing inheritance chain summary

5. **Mixed Patterns**: Some levels use `testHierarchy`, others use `testDefaults` store paths

---

## Phase 1: Data Model Consolidation

### Task 1: Consolidate Test Configuration Data Models

**Files:**
- Modify: `frontend/src/js/stores/configStore.js:236-264`
- Test: `npm test` (existing tests should pass)

**Step 1: Create unified hierarchical data structure**

Add a new unified structure that supports all hierarchy levels consistently:

```javascript
// Add after line 264 in configStore.js
// Unified test configuration with inheritance support
testConfig: {
    // Level 0: Root defaults (global defaults)
    defaults: {
        fteResources: [],
        equipmentResources: [],
        fteTimePercentage: 100,
        equipmentTimePercentage: 100,
        isExternal: false,
        duration: 5,
        priority: 5,
        forceStartWeek: null
    },
    // Level 1: Project overrides
    projects: {},
    // Level 2: Leg Type overrides
    legTypes: {},
    // Level 3: Leg overrides
    legs: {},
    // Level 4: Test Type overrides (supports patterns)
    testTypes: {},
    // Level 5: Individual test overrides
    tests: {}
},

// Helper method to resolve inherited values
resolveTestValue(testId, field) {
    // Implementation walks hierarchy from specific to general
    // Returns { value, source, isInherited }
}
```

**Step 2: Add getter for hierarchy levels**

```javascript
// Add to configStore methods
getTestHierarchyLevels() {
    return [
        { id: 'all', label: 'All', icon: 'globe', description: 'Global defaults applied to all tests' },
        { id: 'projects', label: 'Projects', icon: 'folder', description: 'Project-level overrides' },
        { id: 'legTypes', label: 'Leg Types', icon: 'layers', description: 'Leg type-specific settings' },
        { id: 'legs', label: 'Legs', icon: 'map-pin', description: 'Individual leg overrides' },
        { id: 'testTypes', label: 'Test Types', icon: 'tag', description: 'Test type patterns' },
        { id: 'tests', label: 'Tests', icon: 'file-text', description: 'Individual test configurations' }
    ];
}
```

**Step 3: Add field configuration for each level**

```javascript
// Define which fields are editable at each hierarchy level
getEditableFields(level) {
    const fieldMap = {
        all: ['fteResources', 'equipmentResources', 'fteTimePercentage', 'equipmentTimePercentage', 'isExternal'],
        projects: ['fteResources', 'equipmentResources', 'fteTimePercentage', 'equipmentTimePercentage', 'isExternal'],
        legTypes: ['fteResources', 'equipmentResources', 'fteTimePercentage', 'equipmentTimePercentage', 'isExternal'],
        legs: ['fteResources', 'equipmentResources', 'fteTimePercentage', 'equipmentTimePercentage', 'isExternal'],
        testTypes: ['fteResources', 'equipmentResources', 'fteTimePercentage', 'equipmentTimePercentage', 'isExternal'],
        tests: ['fteResources', 'equipmentResources', 'fteTimePercentage', 'equipmentTimePercentage', 'isExternal','forceStartWeek']
    };
    return fieldMap[level] || [];
}
```

**Step 4: Commit**

```bash
git add frontend/src/js/stores/configStore.js
git commit -m "feat: add unified test configuration data model with hierarchy support"
```

---

## Phase 2: Create Standardized UI Components

### Task 2: Create Reusable Test Configuration Card Component

**Files:**
- Create: `frontend/src/js/components/testConfigCard.js`
- Modify: `frontend/src/components/config-editor.html:1206-1921`

**Step 1: Create the reusable card component**

```javascript
// frontend/src/js/components/testConfigCard.js

/**
 * Test Configuration Card Component
 * Standardized UI for hierarchical test configuration
 */

function createTestConfigCard(level, configId, configData, inheritedData) {
    const levelConfig = {
        all: { title: 'Global Defaults', icon: 'globe', color: 'primary' },
        projects: { title: 'Project', icon: 'folder', color: 'blue' },
        legTypes: { title: 'Leg Type', icon: 'layers', color: 'purple' },
        legs: { title: 'Leg', icon: 'map-pin', color: 'green' },
        testTypes: { title: 'Test Type', icon: 'tag', color: 'orange' },
        tests: { title: 'Test', icon: 'file-text', color: 'red' }
    };

    const meta = levelConfig[level];
    
    return {
        level,
        configId,
        configData,
        inheritedData,
        meta,
        
        // Check if field should be shown at this level
        isFieldVisible(field) {
            const editableFields = this.$store.config.getEditableFields(level);
            return editableFields.includes(field);
        },
        
        // Check if field has an override
        hasOverride(field) {
            return configData?.overrides?.[field] === true || 
                   (configData?.[field] !== undefined && configData?.[field] !== null);
        },
        
        // Get effective value (own or inherited)
        getEffectiveValue(field) {
            if (this.hasOverride(field)) {
                return configData[field];
            }
            return inheritedData?.[field];
        },
        
        // Toggle override for a field
        toggleOverride(field) {
            const newOverrides = { ...(configData.overrides || {}) };
            newOverrides[field] = !newOverrides[field];
            
            // Update via store method
            this.$store.config.updateTestConfigOverride(level, configId, field, newOverrides[field]);
        },
        
        // Update field value
        updateValue(field, value) {
            this.$store.config.updateTestConfigValue(level, configId, field, value);
        }
    };
}

export { createTestConfigCard };
```

**Step 2: Add store methods for the new data model**

Add to `configStore.js` after existing test hierarchy methods (around line 900):

```javascript
// New unified test configuration methods

updateTestConfigOverride(level, configId, field, isOverridden) {
    if (!this.testConfig[level]) {
        this.testConfig[level] = {};
    }
    if (!this.testConfig[level][configId]) {
        this.testConfig[level][configId] = {};
    }
    if (!this.testConfig[level][configId].overrides) {
        this.testConfig[level][configId].overrides = {};
    }
    
    this.testConfig[level][configId].overrides[field] = isOverridden;
    
    // If removing override, clear the value
    if (!isOverridden) {
        delete this.testConfig[level][configId][field];
    }
    
    this.saveToLocalStorage();
},

updateTestConfigValue(level, configId, field, value) {
    if (!this.testConfig[level]) {
        this.testConfig[level] = {};
    }
    if (!this.testConfig[level][configId]) {
        this.testConfig[level][configId] = {};
    }
    
    this.testConfig[level][configId][field] = value;
    
    // Mark as overridden when value is set
    if (!this.testConfig[level][configId].overrides) {
        this.testConfig[level][configId].overrides = {};
    }
    this.testConfig[level][configId].overrides[field] = true;
    
    this.saveToLocalStorage();
},

getInheritedValue(level, configId, field) {
    // Walk up hierarchy to find inherited value
    const hierarchyOrder = ['tests', 'testTypes', 'legs', 'legTypes', 'projects', 'defaults'];
    const levelIndex = hierarchyOrder.indexOf(level);
    
    for (let i = levelIndex + 1; i < hierarchyOrder.length; i++) {
        const parentLevel = hierarchyOrder[i];
        const parentConfig = this.testConfig[parentLevel];
        
        if (parentConfig) {
            // For 'defaults' level, return directly
            if (parentLevel === 'defaults') {
                return parentConfig[field];
            }
            
            // For other levels, check if there's a matching parent
            // This would need logic based on the configId structure
            const parentId = this.getParentId(level, configId);
            if (parentId && parentConfig[parentId]?.[field] !== undefined) {
                return parentConfig[parentId][field];
            }
        }
    }
    
    return this.testConfig.defaults[field];
}
```

**Step 3: Commit**

```bash
git add frontend/src/js/components/testConfigCard.js frontend/src/js/stores/configStore.js
git commit -m "feat: add unified test config card component and store methods"
```

---

## Phase 3: HTML Template Redesign

### Task 3: Create New Hierarchical Test Subtab Layout

**Files:**
- Create: `frontend/src/components/test-config-section.html` (new file)
- Modify: `frontend/src/components/config-editor.html:1206-1921`

**Step 1: Create the new test configuration section template**

Create `frontend/src/components/test-config-section.html`:

```html
<!-- Test Configuration Section - Hierarchical Redesign -->
<div x-show="activeSubtab === 'test'" class="config-section" id="section-test">
    <div class="section-header">
        <h3>Test Configuration</h3>
        <p style="margin: 0; font-size: 0.875rem; color: var(--text-light);">
            Configure test settings across hierarchy levels. More specific levels override more general ones.
        </p>
    </div>

    <div class="test-container" x-data="{
        activeHierarchyLevel: 'all',
        selectedProject: null,
        selectedLegType: null,
        selectedLeg: null,
        selectedTestType: null,
        selectedTest: null
    }">
        <!-- Inheritance Chain Visualizer -->
        <div class="inheritance-chain" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-secondary); border-radius: 0.5rem;">
            <h4 style="margin: 0 0 0.75rem 0; font-size: 0.875rem; font-weight: 600;">Inheritance Chain</h4>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <template x-for="(level, index) in $store.config.getTestHierarchyLevels()" :key="level.id">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <button 
                            type="button"
                            @click="activeHierarchyLevel = level.id"
                            :style="activeHierarchyLevel === level.id 
                                ? 'padding: 0.375rem 0.75rem; background: var(--primary-color); color: white; border: none; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; cursor: pointer;' 
                                : 'padding: 0.375rem 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 0.25rem; font-size: 0.75rem; cursor: pointer;'"
                            :title="level.description"
                            x-text="level.label">
                        </button>
                        <span x-show="index < $store.config.getTestHierarchyLevels().length - 1" style="color: var(--text-light);">→</span>
                    </div>
                </template>
            </div>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--text-light);"
               x-text="$store.config.getTestHierarchyLevels().find(l => l.id === activeHierarchyLevel)?.description">
            </p>
        </div>

        <!-- Level Navigation Tabs -->
        <div class="hierarchy-level-nav" style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; gap: 0.5rem;">
                <template x-for="level in $store.config.getTestHierarchyLevels()" :key="level.id">
                    <button 
                        type="button"
                        @click="activeHierarchyLevel = level.id"
                        :class="{ 'active': activeHierarchyLevel === level.id }"
                        style="padding: 0.75rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; font-size: 0.875rem; cursor: pointer;"
                        :style="activeHierarchyLevel === level.id 
                            ? 'border-bottom-color: var(--primary-color); color: var(--primary-color); font-weight: 500;' 
                            : 'color: var(--text-light);'">
                        <span x-text="level.label"></span>
                    </button>
                </template>
            </div>
        </div>

        <!-- Level Content -->
        <div class="hierarchy-level-content">
            <!-- ALL Level (Global Defaults) -->
            <div x-show="activeHierarchyLevel === 'all'" class="level-content">
                <div class="config-card" style="border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem; background: var(--bg-primary);">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
                        <span style="font-size: 1.25rem;">🌍</span>
                        <h4 style="margin: 0; font-size: 1rem; font-weight: 600;">Global Default Settings</h4>
                        <span style="font-size: 0.75rem; padding: 0.25rem 0.5rem; background: var(--primary-color-10); color: var(--primary-color); border-radius: 0.25rem;">Default</span>
                    </div>
                    
                    <p style="margin: 0 0 1.5rem 0; font-size: 0.875rem; color: var(--text-light);">
                        These settings apply to all tests unless overridden at a more specific level.
                    </p>

                    <!-- Standard Field Grid -->
                    <div class="config-fields-grid" style="display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
                        
                        <!-- FTE Resources (Multi-select) -->
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.875rem;">
                                FTE Resources
                            </label>
                            <div class="resource-selector"
                                 x-data="{ open: false }"
                                 @click.away="open = false">
                                <!-- Selected Resources Display -->
                                <div style="display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 0.5rem; min-height: 32px;">
                                    <template x-for="fte in $store.config.testConfig.defaults.fteResources || []" :key="fte">
                                        <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: var(--primary-color); color: white; border-radius: 0.25rem; font-size: 0.75rem;">
                                            <span x-text="fte"></span>
                                            <button @click.prevent="$store.config.removeDefaultResource('fte', fte)" style="background: none; border: none; color: white; cursor: pointer; padding: 0; font-size: 0.875rem;">×</button>
                                        </span>
                                    </template>
                                    <span x-show="!($store.config.testConfig.defaults.fteResources?.length)" style="font-size: 0.875rem; color: var(--text-muted); font-style: italic;">No FTE resources assigned</span>
                                </div>
                                <!-- Dropdown Trigger -->
                                <div @click="open = !open" 
                                     style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: var(--bg-primary);">
                                    <span style="color: var(--text-muted); font-size: 0.875rem;">Add FTE resource...</span>
                                    <span>▼</span>
                                </div>
                                <!-- Dropdown Menu -->
                                <div x-show="open" 
                                     style="position: absolute; left: 0; right: 0; margin-top: 0.25rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 0.25rem; max-height: 200px; overflow-y: auto; z-index: 100; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                    <template x-for="option in $store.config.getFteOptions()" :key="option.id">
                                        <div @click="$store.config.addDefaultResource('fte', option.id); open = false"
                                             style="padding: 0.5rem 0.75rem; cursor: pointer; font-size: 0.875rem;"
                                             :style="($store.config.testConfig.defaults.fteResources || []).includes(option.id) ? 'background: var(--primary-color-10);' : ''">
                                            <span x-text="option.name"></span>
                                            <span x-show="option.type === 'alias'" style="font-size: 0.7rem; margin-left: 0.5rem; color: var(--text-light);">(alias)</span>
                                        </div>
                                    </template>
                                </div>
                            </div>
                        </div>

                        <!-- Equipment Resources (Multi-select) -->
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.875rem;">
                                Equipment Resources
                            </label>
                            <!-- Similar structure to FTE -->
                        </div>

                        <!-- FTE Time Percentage -->
                        <div class="form-group">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <label style="font-weight: 500; font-size: 0.875rem;">FTE Time Allocation</label>
                                <span style="font-size: 0.875rem; font-weight: 600; color: var(--primary-color);" 
                                      x-text="$store.config.testConfig.defaults.fteTimePercentage + '%'"></span>
                            </div>
                            <input type="range" min="0" max="100" step="5"
                                   x-model.number="$store.config.testConfig.defaults.fteTimePercentage"
                                   @change="$store.config.updateTestConfigValue('defaults', null, 'fteTimePercentage', $store.config.testConfig.defaults.fteTimePercentage)"
                                   style="width: 100%; height: 0.5rem; padding: 0;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-light); margin-top: 0.25rem;">
                                <span>0%</span>
                                <span>50%</span>
                                <span>100%</span>
                            </div>
                        </div>

                        <!-- Equipment Time Percentage -->
                        <div class="form-group">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <label style="font-weight: 500; font-size: 0.875rem;">Equipment Time Allocation</label>
                                <span style="font-size: 0.875rem; font-weight: 600; color: var(--primary-color);" 
                                      x-text="$store.config.testConfig.defaults.equipmentTimePercentage + '%'"></span>
                            </div>
                            <input type="range" min="0" max="100" step="5"
                                   x-model.number="$store.config.testConfig.defaults.equipmentTimePercentage"
                                   @change="$store.config.updateTestConfigValue('defaults', null, 'equipmentTimePercentage', $store.config.testConfig.defaults.equipmentTimePercentage)"
                                   style="width: 100%; height: 0.5rem; padding: 0;">
                        </div>

                        <!-- External Test Flag -->
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.875rem;">
                                <input type="checkbox" 
                                       x-model="$store.config.testConfig.defaults.isExternal"
                                       @change="$store.config.updateTestConfigValue('defaults', null, 'isExternal', $store.config.testConfig.defaults.isExternal)">
                                <span>External Test (no FTE/equipment required)</span>
                            </label>
                            <p style="margin: 0.25rem 0 0 1.5rem; font-size: 0.75rem; color: var(--text-light);">
                                Tests run externally without consuming internal resources
                            </p>
                        </div>

                        <!-- Test Duration -->
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.875rem;">
                                Default Test Duration (days)
                            </label>
                            <input type="number" min="1" max="365"
                                   x-model.number="$store.config.testConfig.defaults.duration"
                                   @change="$store.config.updateTestConfigValue('defaults', null, 'duration', $store.config.testConfig.defaults.duration)"
                                   class="form-control"
                                   style="width: 100%;">
                        </div>

                        <!-- Priority -->
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.875rem;">
                                Default Priority
                            </label>
                            <input type="number" min="1" max="10"
                                   x-model.number="$store.config.testConfig.defaults.priority"
                                   @change="$store.config.updateTestConfigValue('defaults', null, 'priority', $store.config.testConfig.defaults.priority)"
                                   class="form-control"
                                   style="width: 100%;">
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: var(--text-light);">1 = highest, 10 = lowest</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- PROJECTS Level -->
            <div x-show="activeHierarchyLevel === 'projects'" class="level-content">
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Select Project</label>
                    <select x-model="selectedProject" class="form-control" style="width: auto; min-width: 200px;">
                        <option value="">Choose a project...</option>
                        <template x-for="project in $store.csvData?.projects || []" :key="project">
                            <option :value="project" x-text="project"></option>
                        </template>
                    </select>
                </div>

                <template x-if="selectedProject">
                    <div class="config-card override-card" 
                         style="border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem; background: var(--bg-primary);"
                         :style="Object.keys($store.config.testConfig.projects[selectedProject] || {}).length > 0 ? 'border-left: 4px solid var(--warning-color);' : ''">
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                            <span style="font-size: 1.25rem;">📁</span>
                            <h4 style="margin: 0; font-size: 1rem; font-weight: 600;" x-text="selectedProject"></h4>
                            <span x-show="Object.keys($store.config.testConfig.projects[selectedProject] || {}).length > 0" 
                                  style="font-size: 0.75rem; padding: 0.25rem 0.5rem; background: var(--warning-color-10); color: var(--warning-color); border-radius: 0.25rem;">
                                Override Active
                            </span>
                        </div>

                        <!-- Show Inherited Values -->
                        <div class="inherited-values" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-secondary); border-radius: 0.25rem;">
                            <h5 style="margin: 0 0 0.5rem 0; font-size: 0.8rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.05em;">Inherited from Global</h5>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; font-size: 0.8rem;">
                                <div><span style="color: var(--text-light);">FTE:</span> <span x-text="$store.config.testConfig.defaults.fteResources?.join(', ') || 'None'"></span></div>
                                <div><span style="color: var(--text-light);">Equipment:</span> <span x-text="$store.config.testConfig.defaults.equipmentResources?.join(', ') || 'None'"></span></div>
                                <div><span style="color: var(--text-light);">FTE Time:</span> <span x-text="$store.config.testConfig.defaults.fteTimePercentage + '%'"></span></div>
                                <div><span style="color: var(--text-light);">External:</span> <span x-text="$store.config.testConfig.defaults.isExternal ? 'Yes' : 'No'"></span></div>
                            </div>
                        </div>

                        <!-- Override Fields (Projects only get resources and external flag) -->
                        <div class="override-fields" style="display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
                            
                            <!-- FTE Resources Override -->
                            <div class="form-group">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <input type="checkbox"
                                           :checked="$store.config.testConfig.projects[selectedProject]?.overrides?.fteResources"
                                           @change="$store.config.toggleProjectOverride(selectedProject, 'fteResources', $event.target.checked)">
                                    <label style="font-weight: 500; margin: 0;">Override FTE Resources</label>
                                </div>
                                <div x-show="$store.config.testConfig.projects[selectedProject]?.overrides?.fteResources">
                                    <!-- Multi-select for FTE resources -->
                                </div>
                            </div>

                            <!-- Similar pattern for Equipment and External -->
                        </div>
                    </div>
                </template>

                <template x-if="!selectedProject">
                    <div style="text-align: center; padding: 3rem; color: var(--text-light); background: var(--bg-secondary); border-radius: 0.5rem;">
                        <p style="margin: 0;">Select a project to configure project-specific overrides</p>
                    </div>
                </template>
            </div>

            <!-- LEG TYPES Level -->
            <div x-show="activeHierarchyLevel === 'legTypes'" class="level-content">
                <!-- Similar structure to Projects -->
            </div>

            <!-- LEGS Level -->
            <div x-show="activeHierarchyLevel === 'legs'" class="level-content">
                <!-- Similar structure with leg selector -->
            </div>

            <!-- TEST TYPES Level -->
            <div x-show="activeHierarchyLevel === 'testTypes'" class="level-content">
                <!-- Similar structure with pattern support -->
            </div>

            <!-- TESTS Level -->
            <div x-show="activeHierarchyLevel === 'tests'" class="level-content">
                <!-- Similar structure with forceStartWeek -->
            </div>
        </div>

        <!-- Configuration Summary -->
        <div class="config-summary" style="margin-top: 2rem; padding: 1rem; background: var(--bg-secondary); border-radius: 0.5rem;">
            <h4 style="margin: 0 0 1rem 0; font-size: 0.95rem;">Configuration Summary</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; font-size: 0.875rem;">
                <div>
                    <span style="color: var(--text-light);">Global:</span>
                    <span style="font-weight: 500;" x-text="Object.keys($store.config.testConfig.defaults || {}).length + ' fields set'"></span>
                </div>
                <div>
                    <span style="color: var(--text-light);">Projects:</span>
                    <span style="font-weight: 500;" x-text="Object.keys($store.config.testConfig.projects || {}).length + ' overrides'"></span>
                </div>
                <div>
                    <span style="color: var(--text-light);">Leg Types:</span>
                    <span style="font-weight: 500;" x-text="Object.keys($store.config.testConfig.legTypes || {}).length + ' overrides'"></span>
                </div>
                <div>
                    <span style="color: var(--text-light);">Legs:</span>
                    <span style="font-weight: 500;" x-text="Object.keys($store.config.testConfig.legs || {}).length + ' overrides'"></span>
                </div>
                <div>
                    <span style="color: var(--text-light);">Test Types:</span>
                    <span style="font-weight: 500;" x-text="Object.keys($store.config.testConfig.testTypes || {}).length + ' overrides'"></span>
                </div>
                <div>
                    <span style="color: var(--text-light);">Tests:</span>
                    <span style="font-weight: 500;" x-text="Object.keys($store.config.testConfig.tests || {}).length + ' overrides'"></span>
                </div>
            </div>
        </div>
    </div>
</div>
```

**Step 2: Update config-editor.html to use new template**

Replace lines 1206-1921 in `config-editor.html` with an include of the new template:

```html
<!-- Test Section - Hierarchical Test Configuration -->
<div x-include="/src/components/test-config-section.html"></div>
```

Or if using Alpine's template system, use `x-html` with a fetch:

```html
<div x-html="await fetch('/src/components/test-config-section.html').then(r => r.text())"></div>
```

**Step 3: Commit**

```bash
git add frontend/src/components/test-config-section.html frontend/src/components/config-editor.html
git commit -m "feat: redesign test subtab with hierarchical layout and inheritance visualization"
```

---

## Phase 4: CSS Styling

### Task 4: Add Consistent Styling for Test Configuration

**Files:**
- Modify: `frontend/src/styles/base.css`

**Step 1: Add test configuration styles**

Add to `base.css`:

```css
/* Test Configuration Section Styles */

.test-container {
    --test-level-all: var(--primary-color);
    --test-level-projects: #3b82f6;
    --test-level-legTypes: #8b5cf6;
    --test-level-legs: #10b981;
    --test-level-testTypes: #f59e0b;
    --test-level-tests: #ef4444;
}

.inheritance-chain {
    position: relative;
}

.hierarchy-level-nav {
    overflow-x: auto;
    scrollbar-width: thin;
}

.hierarchy-level-nav::-webkit-scrollbar {
    height: 4px;
}

.hierarchy-level-nav::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 2px;
}

.config-card {
    transition: box-shadow 0.2s ease;
}

.config-card:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.override-card {
    position: relative;
}

.override-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--warning-color);
    border-radius: 0.5rem 0 0 0.5rem;
}

.inherited-values {
    opacity: 0.8;
}

.config-fields-grid .form-group {
    margin-bottom: 0;
}

.resource-selector {
    position: relative;
}

.resource-selector select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
}

/* Level-specific accent colors */
.level-all .config-card { border-color: var(--test-level-all); }
.level-projects .config-card { border-color: var(--test-level-projects); }
.level-legTypes .config-card { border-color: var(--test-level-legTypes); }
.level-legs .config-card { border-color: var(--test-level-legs); }
.level-testTypes .config-card { border-color: var(--test-level-testTypes); }
.level-tests .config-card { border-color: var(--test-level-tests); }

/* Responsive adjustments */
@media (max-width: 768px) {
    .config-fields-grid {
        grid-template-columns: 1fr;
    }
    
    .hierarchy-level-nav button {
        padding: 0.5rem 0.75rem;
        font-size: 0.8rem;
    }
}
```

**Step 2: Commit**

```bash
git add frontend/src/styles/base.css
git commit -m "style: add test configuration section styles with hierarchy level colors"
```

---

## Phase 5: Testing

### Task 5: Add Tests for New Test Configuration

**Files:**
- Create: `frontend/src/js/stores/configStore.test.js` (if not exists)
- Create: `frontend/src/js/components/testConfigCard.test.js`

**Step 1: Add unit tests for new store methods**

```javascript
// frontend/src/js/stores/configStore.test.js

describe('Test Configuration Hierarchy', () => {
    let store;

    beforeEach(() => {
        // Initialize fresh store state
        store = {
            testConfig: {
                defaults: {
                    fteResources: ['fte_1'],
                    equipmentResources: [],
                    fteTimePercentage: 100,
                    equipmentTimePercentage: 100,
                    isExternal: false,
                    duration: 5,
                    priority: 5
                },
                projects: {},
                legTypes: {},
                legs: {},
                testTypes: {},
                tests: {}
            }
        };
    });

    describe('getEditableFields', () => {
        it('returns all fields for defaults level', () => {
            const fields = getEditableFields('all');
            expect(fields).toContain('fteResources');
            expect(fields).toContain('equipmentResources');
            expect(fields).toContain('duration');
            expect(fields).toContain('priority');
        });

        it('excludes duration and priority for projects level', () => {
            const fields = getEditableFields('projects');
            expect(fields).not.toContain('duration');
            expect(fields).not.toContain('priority');
            expect(fields).toContain('fteResources');
        });

        it('includes forceStartWeek only for tests level', () => {
            const testsFields = getEditableFields('tests');
            const projectsFields = getEditableFields('projects');
            
            expect(testsFields).toContain('forceStartWeek');
            expect(projectsFields).not.toContain('forceStartWeek');
        });
    });

    describe('updateTestConfigValue', () => {
        it('sets value and marks field as overridden', () => {
            updateTestConfigValue('projects', 'gen3_pv', 'fteResources', ['fte_2']);
            
            expect(store.testConfig.projects.gen3_pv.fteResources).toEqual(['fte_2']);
            expect(store.testConfig.projects.gen3_pv.overrides.fteResources).toBe(true);
        });
    });

    describe('getInheritedValue', () => {
        it('returns project value when walking up from leg', () => {
            store.testConfig.defaults.fteResources = ['fte_default'];
            store.testConfig.projects.gen3_pv = { fteResources: ['fte_project'] };
            
            const value = getInheritedValue('legs', 'gen3_pv__2', 'fteResources');
            expect(value).toEqual(['fte_project']);
        });

        it('falls back to defaults when no parent override', () => {
            const value = getInheritedValue('projects', 'new_project', 'fteResources');
            expect(value).toEqual(['fte_1']);
        });
    });
});
```

**Step 2: Run tests**

```bash
cd frontend
npm test -- configStore.test.js
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add frontend/src/js/stores/configStore.test.js
git commit -m "test: add unit tests for test configuration hierarchy"
```

---

## Phase 6: Migration

### Task 6: Add Data Migration from Old Structure

**Files:**
- Modify: `frontend/src/js/stores/configStore.js:630-700`

**Step 1: Add migration function for test configuration**

```javascript
// Add to configStore.js

migrateTestConfiguration(oldData) {
    const migrated = {
        defaults: { ...this.testConfig.defaults },
        projects: {},
        legTypes: {},
        legs: {},
        testTypes: {},
        tests: {}
    };

    // Migrate from testHierarchy structure
    if (oldData.testHierarchy) {
        // Migrate project defaults
        if (oldData.testHierarchy.projectDefaults) {
            Object.assign(migrated.defaults, {
                duration: oldData.testHierarchy.projectDefaults.defaultDuration,
                priority: oldData.testHierarchy.projectDefaults.defaultPriority,
                fteResources: oldData.testDefaults?.projectDefaults?.fteResources || [],
                equipmentResources: oldData.testDefaults?.projectDefaults?.equipmentResources || [],
                fteTimePercentage: oldData.testDefaults?.projectDefaults?.fteTimePercentage ?? 100,
                equipmentTimePercentage: oldData.testDefaults?.projectDefaults?.equipmentTimePercentage ?? 100,
                isExternal: oldData.testDefaults?.projectDefaults?.isExternal ?? false
            });
        }

        // Migrate leg types
        if (oldData.testHierarchy.legTypes) {
            Object.entries(oldData.testHierarchy.legTypes).forEach(([id, config]) => {
                migrated.legTypes[id] = {
                    ...config,
                    overrides: config.overrides || {}
                };
            });
        }

        // Migrate legs
        if (oldData.testHierarchy.legs) {
            Object.entries(oldData.testHierarchy.legs).forEach(([id, config]) => {
                migrated.legs[id] = config;
            });
        }

        // Migrate test types
        if (oldData.testHierarchy.testTypes) {
            Object.entries(oldData.testHierarchy.testTypes).forEach(([id, config]) => {
                migrated.testTypes[id] = config;
            });
        }

        // Migrate tests
        if (oldData.testHierarchy.tests) {
            Object.entries(oldData.testHierarchy.tests).forEach(([id, config]) => {
                migrated.tests[id] = config;
            });
        }
    }

    return migrated;
}
```

**Step 2: Update loadJsonConfiguration to use migration**

In `loadJsonConfiguration` method, add:

```javascript
// After loading JSON data
if (jsonData.testHierarchy || jsonData.testDefaults) {
    this.testConfig = this.migrateTestConfiguration(jsonData);
}
```

**Step 3: Commit**

```bash
git add frontend/src/js/stores/configStore.js
git commit -m "feat: add migration from old test configuration structure"
```

---

## Phase 7: Integration

### Task 7: Wire Up New Component and Clean Up Old Code

**Files:**
- Modify: `frontend/src/js/core/init.js` (or main entry)
- Modify: `frontend/src/components/config-editor.html`

**Step 1: Import new component**

Add to main entry point:

```javascript
// frontend/src/js/core/init.js

import { createTestConfigCard } from '../components/testConfigCard.js';

// Make available globally for Alpine
document.addEventListener('alpine:init', () => {
    Alpine.data('testConfigCard', createTestConfigCard);
});
```

**Step 2: Remove old test section HTML from config-editor.html**

Delete lines 1206-1921 (the old test section) and replace with:

```html
<!-- Test Configuration Section -->
<div x-show="activeSubtab === 'test'" x-html="testConfigHtml" x-init="testConfigHtml = await fetch('/src/components/test-config-section.html').then(r => r.text())"></div>
```

Or use the direct template approach shown in Phase 3.

**Step 3: Update store initialization**

Ensure `testConfig` is initialized in store init:

```javascript
init() {
    // ... existing init code ...
    
    // Initialize testConfig if not present
    if (!this.testConfig) {
        this.testConfig = {
            defaults: {
                fteResources: [],
                equipmentResources: [],
                fteTimePercentage: 100,
                equipmentTimePercentage: 100,
                isExternal: false,
                duration: 5,
                priority: 5,
                forceStartWeek: null
            },
            projects: {},
            legTypes: {},
            legs: {},
            testTypes: {},
            tests: {}
        };
    }
}
```

**Step 4: Commit**

```bash
git add frontend/src/js/core/init.js frontend/src/components/config-editor.html

git commit -m "feat: integrate new test configuration section and remove old implementation"
```

---

## Phase 8: Verification

### Task 8: Final Integration Testing

**Files:**
- All modified files

**Step 1: Run full test suite**

```bash
cd frontend
npm test
```

Expected: All tests pass

**Step 2: Run dev server and verify UI**

```bash
npm run dev
```

Manual verification checklist:
- [ ] All 6 hierarchy levels visible in navigation
- [ ] Inheritance chain shows correct flow (All → Projects → Leg Types → Legs → Test Types → Tests)
- [ ] Global defaults level displays all editable fields
- [ ] Projects level shows inherited values from global
- [ ] Override checkboxes work correctly
- [ ] Resource multi-select works at all levels
- [ ] Percentage sliders update correctly
- [ ] Configuration summary updates in real-time
- [ ] Data persists between tab switches

**Step 3: Build for production**

```bash
npm run build
```

Expected: Build completes without errors

**Step 4: Commit**

```bash
git add .
git commit -m "feat: complete test subtab redesign with hierarchical configuration"
```

---

## Summary

This implementation plan addresses all design requirements:

1. **Consistent UI Pattern**: All hierarchy levels use the same card-based layout with configurable fields
2. **Clear Inheritance Communication**: Visual inheritance chain shows the complete hierarchy flow
3. **Prevents Redundant Editing**: Each level only shows fields relevant to that level
4. **No Duplicate UI Logic**: Standardized components reused across all levels
5. **Distinguishes Inherited vs Overridden**: Inherited values shown in read-only section, overrides have checkboxes
6. **Consistent Visual Layout**: Same grid-based layout at every level
7. **Minimal Explanatory Text**: Tooltips and descriptions only where necessary

The plan is broken into 8 phases with clear deliverables and testing at each step. Each task is small enough to be completed in 2-5 minutes with explicit verification steps.

---

## Execution Options

**Plan complete and saved to `frontend/docs/plans/test-subtab-redesign.md`.**

Two execution options:

**1. Subagent-Driven (this session)** - Fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans skill, batch execution with checkpoints

**Which approach would you prefer?**

If subagent-driven, I will dispatch the coder subagent to implement each task in sequence, with code review between phases.
