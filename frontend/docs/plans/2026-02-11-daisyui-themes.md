# DaisyUI Themes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `skill:superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Integrate DaisyUI CSS framework with 30+ built-in themes and create an Alpine.js-powered theme switcher with persistence

**Architecture:** DaisyUI provides CSS variables via CDN, Alpine.js store manages theme state and persistence, theme selector dropdown in header allows switching, theme preference saved to localStorage and restored on page load

**Tech Stack:** DaisyUI 4.x (CDN), Alpine.js 3.x (existing), Tailwind CSS 3.x (CDN for DaisyUI compatibility), HTMX 2.x (existing)

---

## Prerequisites

Before starting, ensure you understand:
- DaisyUI themes use `data-theme` attribute on `<html>` element
- Your current theme system uses CSS custom properties (compatible!)
- Alpine.js stores are defined in `src/js/stores/` directory
- DaisyUI requires Tailwind CSS as a peer dependency

---

### Task 1: Add DaisyUI and Tailwind CSS to index.html

**Files:**
- Modify: `index.html:50-54` (CSS section)

**Step 1: Add Tailwind and DaisyUI CDN links**

Add these lines in the `<head>` after line 51 (after the favicon link):

```html
<!-- Tailwind CSS (required for DaisyUI) -->
<script src="https://cdn.tailwindcss.com"></script>
<!-- DaisyUI Theme CSS -->
<link href="https://cdn.jsdelivr.net/npm/daisyui@4.10.1/dist/full.min.css" rel="stylesheet" type="text/css" />
```

**Step 2: Configure Tailwind to work with DaisyUI**

Add this script block right after the DaisyUI link (before closing `</head>`):

```html
<!-- Tailwind Configuration for DaisyUI -->
<script>
    tailwind.config = {
        theme: {
            extend: {},
        },
        plugins: [daisyui],
        daisyui: {
            themes: true, // Enable all themes
            darkTheme: "dark",
            base: true,
            styled: true,
            utils: true,
            prefix: "",
            logs: true,
        },
    };
</script>
```

**Step 3: Verify file structure**

Run: `head -60 index.html`
Expected: See Tailwind script, DaisyUI link, and configuration script in the `<head>`

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add DaisyUI and Tailwind CSS via CDN"
```

---

### Task 2: Create Theme Store

**Files:**
- Create: `src/js/stores/themeStore.js`

**Step 1: Create theme store file**

```javascript
/**
 * Theme Store - Alpine.js Store for DaisyUI Theme Management
 *
 * Manages theme switching, persistence, and provides theme metadata
 */

// Storage key for theme persistence
const THEME_STORAGE_KEY = 'ui_v2_exp__theme__current';

// Available DaisyUI themes with display names
const AVAILABLE_THEMES = [
    { id: 'light', name: 'Light', category: 'basic' },
    { id: 'dark', name: 'Dark', category: 'basic' },
    { id: 'cupcake', name: 'Cupcake', category: 'fun' },
    { id: 'bumblebee', name: 'Bumblebee', category: 'fun' },
    { id: 'emerald', name: 'Emerald', category: 'professional' },
    { id: 'corporate', name: 'Corporate', category: 'professional' },
    { id: 'synthwave', name: 'Synthwave', category: 'colorful' },
    { id: 'retro', name: 'Retro', category: 'colorful' },
    { id: 'cyberpunk', name: 'Cyberpunk', category: 'colorful' },
    { id: 'valentine', name: 'Valentine', category: 'fun' },
    { id: 'halloween', name: 'Halloween', category: 'seasonal' },
    { id: 'garden', name: 'Garden', category: 'nature' },
    { id: 'forest', name: 'Forest', category: 'nature' },
    { id: 'aqua', name: 'Aqua', category: 'nature' },
    { id: 'lofi', name: 'Lo-Fi', category: 'minimal' },
    { id: 'pastel', name: 'Pastel', category: 'minimal' },
    { id: 'fantasy', name: 'Fantasy', category: 'fun' },
    { id: 'wireframe', name: 'Wireframe', category: 'minimal' },
    { id: 'black', name: 'Black', category: 'basic' },
    { id: 'luxury', name: 'Luxury', category: 'professional' },
    { id: 'dracula', name: 'Dracula', category: 'colorful' },
    { id: 'cmyk', name: 'CMYK', category: 'colorful' },
    { id: 'autumn', name: 'Autumn', category: 'seasonal' },
    { id: 'business', name: 'Business', category: 'professional' },
    { id: 'acid', name: 'Acid', category: 'colorful' },
    { id: 'lemonade', name: 'Lemonade', category: 'nature' },
    { id: 'night', name: 'Night', category: 'basic' },
    { id: 'coffee', name: 'Coffee', category: 'nature' },
    { id: 'winter', name: 'Winter', category: 'seasonal' },
    { id: 'dim', name: 'Dim', category: 'basic' },
    { id: 'nord', name: 'Nord', category: 'professional' },
    { id: 'sunset', name: 'Sunset', category: 'colorful' }
];

// Theme categories for grouping in UI
const THEME_CATEGORIES = {
    basic: 'Basic',
    professional: 'Professional',
    colorful: 'Colorful',
    nature: 'Nature',
    minimal: 'Minimal',
    fun: 'Fun',
    seasonal: 'Seasonal'
};

document.addEventListener('alpine:init', () => {
    Alpine.store('theme', {
        // State
        currentTheme: 'light',
        isInitialized: false,
        
        // Constants
        availableThemes: AVAILABLE_THEMES,
        categories: THEME_CATEGORIES,
        storageKey: THEME_STORAGE_KEY,
        
        // Initialize theme from localStorage or default
        init() {
            if (this.isInitialized) {
                console.log('[ThemeStore] Already initialized, skipping');
                return;
            }
            
            console.log('[ThemeStore] Initializing...');
            
            // Load saved theme or default to 'light'
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            const themeToApply = savedTheme && this.isValidTheme(savedTheme) 
                ? savedTheme 
                : 'light';
            
            this.applyTheme(themeToApply, false);
            this.isInitialized = true;
            
            console.log(`[ThemeStore] Initialized with theme: ${themeToApply}`);
        },
        
        // Check if theme is valid
        isValidTheme(themeId) {
            return AVAILABLE_THEMES.some(t => t.id === themeId);
        },
        
        // Apply theme to document
        applyTheme(themeId, saveToStorage = true) {
            if (!this.isValidTheme(themeId)) {
                console.warn(`[ThemeStore] Invalid theme: ${themeId}, using 'light'`);
                themeId = 'light';
            }
            
            // Apply theme to HTML element
            document.documentElement.setAttribute('data-theme', themeId);
            this.currentTheme = themeId;
            
            // Save to localStorage if requested
            if (saveToStorage) {
                localStorage.setItem(THEME_STORAGE_KEY, themeId);
                console.log(`[ThemeStore] Theme saved: ${themeId}`);
            }
            
            // Dispatch custom event for other components
            window.dispatchEvent(new CustomEvent('theme-changed', { 
                detail: { theme: themeId } 
            }));
            
            console.log(`[ThemeStore] Theme applied: ${themeId}`);
        },
        
        // Get current theme object
        getCurrentTheme() {
            return AVAILABLE_THEMES.find(t => t.id === this.currentTheme) || AVAILABLE_THEMES[0];
        },
        
        // Get themes by category
        getThemesByCategory(category) {
            return AVAILABLE_THEMES.filter(t => t.category === category);
        },
        
        // Get all theme IDs (for dropdown)
        getThemeIds() {
            return AVAILABLE_THEMES.map(t => t.id);
        },
        
        // Get theme display name
        getThemeName(themeId) {
            const theme = AVAILABLE_THEMES.find(t => t.id === themeId);
            return theme ? theme.name : themeId;
        },
        
        // Toggle between light and dark (quick toggle)
        toggleLightDark() {
            const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
            this.applyTheme(newTheme);
        },
        
        // Get next theme in rotation
        getNextTheme() {
            const currentIndex = AVAILABLE_THEMES.findIndex(t => t.id === this.currentTheme);
            const nextIndex = (currentIndex + 1) % AVAILABLE_THEMES.length;
            return AVAILABLE_THEMES[nextIndex].id;
        },
        
        // Rotate to next theme
        rotateTheme() {
            this.applyTheme(this.getNextTheme());
        },
        
        // Reset to default theme
        resetToDefault() {
            this.applyTheme('light');
        }
    });
    
    // Auto-initialize the store
    Alpine.store('theme').init();
});

// Export for testing (if using module system)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AVAILABLE_THEMES,
        THEME_CATEGORIES,
        THEME_STORAGE_KEY
    };
}
```

**Step 2: Verify file was created**

Run: `ls -la src/js/stores/themeStore.js`
Expected: File exists with correct size (~5KB)

**Step 3: Commit**

```bash
git add src/js/stores/themeStore.js
git commit -m "feat: create Alpine.js theme store with DaisyUI theme management"
```

---

### Task 3: Add Theme Store to index.html

**Files:**
- Modify: `index.html:82-86` (stores section)

**Step 1: Add themeStore.js to loaded stores**

After line 86 (after `visualizationStore.js`), add:

```html
<script src="src/js/stores/themeStore.js"></script>
```

**Step 2: Verify stores are loaded**

Run: `grep -n "stores" index.html`
Expected: See themeStore.js in the list with other stores

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: load theme store in index.html"
```

---

### Task 4: Update CSS to Work with DaisyUI

**Files:**
- Modify: `src/styles/base.css:1-30` (:root section)

**Step 1: Preserve custom properties but make them DaisyUI-compatible**

DaisyUI uses its own CSS variables. We need to ensure our custom properties don't conflict. Update the `:root` section to use DaisyUI's variables where possible:

Replace the first 84 lines of `base.css` with:

```css
/* Base CSS for the application */
/* DaisyUI themes handle most color variables automatically */
/* We define additional app-specific variables here */

:root {
    /* App-specific custom properties - these work alongside DaisyUI */
    --shadow-color: rgba(15, 23, 42, 0.08);
    --theme-toggle-bg: oklch(var(--b1));
    --theme-toggle-border: oklch(var(--b3));
    --theme-toggle-hover: oklch(var(--b2));
    
    /* DaisyUI will override these with theme-specific values */
    --primary-color: oklch(var(--p));
    --secondary-color: oklch(var(--s));
    --success-color: oklch(var(--su));
    --danger-color: oklch(var(--er));
    --warning-color: oklch(var(--wa));
    --info-color: oklch(var(--in));
    
    --bg-primary: oklch(var(--b1));
    --bg-secondary: oklch(var(--b2));
    --bg-surface: oklch(var(--b1));
    --bg-elevated: oklch(var(--b2));
    --input-bg: oklch(var(--b1));
    
    --border-color: oklch(var(--b3));
    --text-color: oklch(var(--bc));
    --text-light: oklch(var(--bc) / 0.7);
    --text-strong: oklch(var(--bc));
    --button-text-color: oklch(var(--pc));
}

/* Override DaisyUI base styles to match our design */
html {
    /* Ensure smooth transitions */
    transition: background-color 0.3s ease, color 0.3s ease;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background-color: var(--bg-primary);
    color: var(--text-color);
    margin: 0;
    padding: 0;
    min-height: 100vh;
    min-height: 100dvh;
    overflow: auto;
    /* Smooth theme transitions */
    transition: background-color 0.3s ease, color 0.3s ease;
}
```

**Step 2: Test DaisyUI is applying themes**

Open `index.html` in browser and run in console:
```javascript
document.documentElement.setAttribute('data-theme', 'cyberpunk');
```
Expected: Page colors change to cyberpunk theme (neon pink/cyan)

**Step 3: Commit**

```bash
git add src/styles/base.css
git commit -m "refactor: update base.css to work with DaisyUI themes"
```

---

### Task 5: Create Theme Toggle Component

**Files:**
- Create: `src/js/components/themeToggleComponent.js`

**Step 1: Create the theme toggle component**

```javascript
/**
 * Theme Toggle Component
 * 
 * Alpine.js component for theme selection UI
 * Provides dropdown selector with theme categories
 */

document.addEventListener('alpine:init', () => {
    Alpine.component('themeToggle', () => ({
        isOpen: false,
        searchQuery: '',
        
        init() {
            // Close dropdown when clicking outside
            this.$el.addEventListener('click-away', () => {
                this.isOpen = false;
            });
        },
        
        // Get filtered themes based on search
        get filteredThemes() {
            if (!this.searchQuery) {
                return this.$store.theme.availableThemes;
            }
            const query = this.searchQuery.toLowerCase();
            return this.$store.theme.availableThemes.filter(t => 
                t.name.toLowerCase().includes(query) || 
                t.category.toLowerCase().includes(query)
            );
        },
        
        // Get themes grouped by category
        get groupedThemes() {
            const grouped = {};
            this.filteredThemes.forEach(theme => {
                if (!grouped[theme.category]) {
                    grouped[theme.category] = [];
                }
                grouped[theme.category].push(theme);
            });
            return grouped;
        },
        
        // Get category display name
        getCategoryName(category) {
            return this.$store.theme.categories[category] || category;
        },
        
        // Select a theme
        selectTheme(themeId) {
            this.$store.theme.applyTheme(themeId);
            this.isOpen = false;
            this.searchQuery = '';
        },
        
        // Quick toggle between light/dark
        quickToggle() {
            this.$store.theme.toggleLightDark();
        },
        
        // Check if theme is active
        isActive(themeId) {
            return this.$store.theme.currentTheme === themeId;
        }
    }));
});
```

**Step 2: Verify file created**

Run: `ls -la src/js/components/themeToggleComponent.js`
Expected: File exists

**Step 3: Commit**

```bash
git add src/js/components/themeToggleComponent.js
git commit -m "feat: create theme toggle Alpine component"
```

---

### Task 6: Add Theme Toggle to index.html Header

**Files:**
- Modify: `index.html:56-59` (app-header section)

**Step 1: Add component script and theme toggle UI**

After line 37 (after `configEditorComponent.js`), add:
```html
<script src="src/js/components/themeToggleComponent.js"></script>
```

Then modify the app-header section (around line 56-59):

Replace:
```html
<div class="app-header">
    <h1 style="margin: 0;">Priority Configuration Editor v2</h1>
</div>
```

With:
```html
<div class="app-header">
    <h1 style="margin: 0;">Priority Configuration Editor v2</h1>
    
    <!-- Theme Toggle Dropdown -->
    <div x-data="themeToggle()" x-component="themeToggle" class="theme-toggle-container" style="margin-left: auto;">
        <div class="dropdown dropdown-end">
            <label tabindex="0" class="btn btn-ghost btn-circle" @click="isOpen = !isOpen" title="Change theme">
                <!-- Theme Icon -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
            </label>
            
            <!-- Dropdown Menu -->
            <div x-show="isOpen" 
                 @click.away="isOpen = false"
                 x-transition:enter="transition ease-out duration-200"
                 x-transition:enter-start="opacity-0 scale-95"
                 x-transition:enter-end="opacity-100 scale-100"
                 x-transition:leave="transition ease-in duration-100"
                 x-transition:leave-start="opacity-100 scale-100"
                 x-transition:leave-end="opacity-0 scale-95"
                 tabindex="0" 
                 class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-64 mt-4"
                 style="max-height: 400px; overflow-y: auto;">
                
                <!-- Search -->
                <div class="px-2 py-2">
                    <input type="text" 
                           x-model="searchQuery"
                           placeholder="Search themes..." 
                           class="input input-bordered input-sm w-full"
                           @click.stop>
                </div>
                
                <!-- Theme Categories -->
                <template x-for="(themes, category) in groupedThemes" :key="category">
                    <div>
                        <div class="px-2 py-1 text-xs font-semibold text-base-content/60 uppercase" x-text="getCategoryName(category)"></div>
                        <template x-for="theme in themes" :key="theme.id">
                            <button @click="selectTheme(theme.id)" 
                                    class="w-full text-left px-4 py-2 hover:bg-base-200 flex items-center justify-between"
                                    :class="{ 'bg-primary text-primary-content': isActive(theme.id) }">
                                <span x-text="theme.name"></span>
                                <span x-show="isActive(theme.id)" class="text-xs">✓</span>
                            </button>
                        </template>
                    </div>
                </template>
                
                <div x-show="filteredThemes.length === 0" class="px-4 py-2 text-sm text-base-content/60">
                    No themes found
                </div>
            </div>
        </div>
    </div>
</div>
```

**Step 2: Add component script reference**

Make sure the component script is loaded. After line 37 (where other components are loaded), verify you have:
```html
<script src="src/js/components/themeToggleComponent.js"></script>
```

**Step 3: Test the theme toggle**

Open `index.html` in browser:
1. Click the paintbrush icon in header
2. Dropdown should appear with theme categories
3. Select "Cyberpunk" - page should change colors
4. Refresh page - selected theme should persist

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add theme toggle dropdown to header"
```

---

### Task 7: Add Theme Persistence on App Load

**Files:**
- Modify: `src/js/core/app.js` (add theme initialization)

**Step 1: Read existing app.js**

Run: `cat src/js/core/app.js`

**Step 2: Add theme initialization to app**

At the beginning of the `app()` function (after `return {`), add:

```javascript
// Theme initialization is handled by themeStore.js
// which runs on alpine:init event
// This ensures theme is applied before UI renders
```

Or if there's an init function, ensure it calls:
```javascript
// Ensure theme store is initialized
if (Alpine.store('theme') && !Alpine.store('theme').isInitialized) {
    Alpine.store('theme').init();
}
```

**Step 3: Commit**

```bash
git add src/js/core/app.js
git commit -m "feat: ensure theme persistence on app initialization"
```

---

### Task 8: Test All Themes

**Files:**
- Manual testing in browser

**Step 1: Test each theme category**

Open `index.html` and test:
1. Light theme - should be clean white
2. Dark theme - should be dark gray/black
3. Cyberpunk - neon pink/cyan accents
4. Forest - green tones
5. Retro - 80s aesthetic
6. Business - professional blue/gray

**Step 2: Verify persistence**
1. Select "Sunset" theme
2. Open browser console: `localStorage.getItem('ui_v2_exp__theme__current')`
3. Expected: "sunset"
4. Refresh page - theme should still be Sunset
5. Clear localStorage and refresh - should default to "light"

**Step 3: Verify Alpine store access**

In browser console:
```javascript
// Check current theme
Alpine.store('theme').currentTheme

// Get all themes
Alpine.store('theme').availableThemes

// Change theme
Alpine.store('theme').applyTheme('dracula')
```

**Step 4: Commit test results**

```bash
git add .
git commit -m "test: verify DaisyUI theme integration"
```

---

### Task 9: Add Theme Documentation

**Files:**
- Create: `docs/THEMES.md`

**Step 1: Create theme documentation**

```markdown
# DaisyUI Themes

This application uses [DaisyUI](https://daisyui.com/) for theming, providing 32 built-in themes that can be switched at runtime.

## Available Themes

### Basic
- **Light** - Clean white theme (default)
- **Dark** - Dark mode for low-light environments
- **Black** - Pure black OLED-friendly theme
- **Night** - Deep blue dark theme
- **Dim** - Subtle dark theme

### Professional
- **Corporate** - Business-appropriate blue/gray
- **Business** - Professional appearance
- **Emerald** - Fresh green professional
- **Luxury** - Premium gold/brown
- **Nord** - Arctic-inspired professional

### Colorful
- **Cyberpunk** - Neon pink and cyan
- **Synthwave** - Retro-futuristic purple
- **Dracula** - Popular code editor theme
- **Retro** - 80s-inspired orange/brown
- **CMYK** - Print-inspired cyan/magenta/yellow
- **Acid** - High-contrast green/purple
- **Sunset** - Warm orange/pink gradient feel

### Nature
- **Forest** - Calming green tones
- **Garden** - Fresh plant-inspired
- **Aqua** - Ocean blue theme
- **Lemonade** - Bright citrus yellow
- **Coffee** - Warm brown coffee tones

### Minimal
- **Lo-Fi** - Reduced contrast, easy on eyes
- **Pastel** - Soft pastel colors
- **Wireframe** - Monochrome design mode

### Fun
- **Cupcake** - Pastel pink/blue
- **Bumblebee** - Yellow/black playful
- **Valentine** - Pink/red romantic
- **Fantasy** - Purple magical theme

### Seasonal
- **Halloween** - Orange/purple spooky
- **Autumn** - Fall colors
- **Winter** - Cool blue/white

## How to Change Themes

### Using the UI
1. Click the paintbrush icon in the top-right corner
2. Browse themes by category
3. Click any theme to apply immediately
4. Theme preference is saved automatically

### Using JavaScript
```javascript
// Access the theme store
Alpine.store('theme').applyTheme('cyberpunk');

// Toggle between light and dark
Alpine.store('theme').toggleLightDark();

// Get current theme
const current = Alpine.store('theme').currentTheme;

// Rotate through all themes
Alpine.store('theme').rotateTheme();
```

## Theme Implementation

Themes are implemented using:
- **DaisyUI CSS** - Provides theme variables via `data-theme` attribute
- **Alpine.js Store** - Manages theme state and persistence
- **localStorage** - Saves user preference across sessions

The theme system automatically:
- Applies theme on page load from localStorage
- Updates CSS custom properties for compatibility
- Dispatches `theme-changed` event for reactive components
- Falls back to "light" theme if saved theme is invalid

## Custom Themes

To add a custom theme, edit `src/js/stores/themeStore.js`:

1. Add theme to `AVAILABLE_THEMES` array:
```javascript
{ id: 'mytheme', name: 'My Theme', category: 'custom' }
```

2. Add category to `THEME_CATEGORIES` if new:
```javascript
custom: 'Custom'
```

3. Create CSS in `src/styles/themes.css`:
```css
html[data-theme="mytheme"] {
    --primary-color: #your-color;
    /* ... other variables */
}
```

4. If using DaisyUI, configure Tailwind:
```javascript
daisyui: {
    themes: [
        // ... built-in themes
        {
            mytheme: {
                primary: '#your-color',
                // ... other colors
            }
        }
    ]
}
```

## Browser Support

Themes work in all modern browsers that support:
- CSS Custom Properties (variables)
- Alpine.js 3.x
- ES6 JavaScript

## Troubleshooting

### Theme not persisting?
- Check browser localStorage is enabled
- Verify no errors in browser console
- Try clearing localStorage: `localStorage.clear()`

### Theme not applying?
- Ensure DaisyUI CSS is loaded (check Network tab)
- Verify `data-theme` attribute on `<html>` element
- Check for JavaScript errors

### Want to disable themes?
- Remove DaisyUI CSS link from `index.html`
- Remove theme toggle component
- Remove theme store script
- Revert to original CSS variables in `base.css`
```

**Step 2: Commit documentation**

```bash
git add docs/THEMES.md
git commit -m "docs: add DaisyUI theme documentation"
```

---

## Summary

After completing all tasks:

1. ✅ DaisyUI and Tailwind CSS loaded via CDN
2. ✅ Theme store manages 32 built-in themes
3. ✅ Theme toggle UI in header with categories
4. ✅ Theme persistence via localStorage
5. ✅ Documentation for users and developers

**Test Command:**
```bash
# Start local server and open in browser
python -m http.server 8080
# Open http://localhost:8080
```

**Expected Result:**
- Paintbrush icon visible in header
- Click opens theme dropdown
- All 32 themes available and switchable
- Theme persists after refresh
- No console errors
