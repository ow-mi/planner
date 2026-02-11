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
