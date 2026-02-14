/**
 * Theme Toggle Component
 *
 * Alpine.js component for theme selection UI
 * Provides dropdown selector with theme categories
 */

document.addEventListener('alpine:init', () => {
    Alpine.data('themeToggle', () => ({
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
