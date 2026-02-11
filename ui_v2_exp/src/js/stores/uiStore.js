/**
 * UI Store - Manages global UI state
 * 
 * Centralized store for UI state that needs to be accessible across components
 * loaded via HTMX, which may not have access to parent Alpine.js component data.
 */

document.addEventListener('alpine:init', () => {
    Alpine.store('ui', {
        // Data subtab state
        activeDataSubtab: 'upload',
        
        // Set active data subtab
        setActiveDataSubtab(subtabName) {
            if (!['upload', 'edit'].includes(subtabName)) {
                console.warn(`Invalid subtab name: ${subtabName}`);
                return;
            }
            
            this.activeDataSubtab = subtabName;
            console.log(`UI Store: Active data subtab set to ${subtabName}`);
        },
        
        // Initialize the store
        init() {
            console.log('UI Store initialized');
            // Set default active subtab if not already set
            if (!this.activeDataSubtab) {
                this.activeDataSubtab = 'upload';
            }
        }
    });
    
    console.log('UI Store registered');
});