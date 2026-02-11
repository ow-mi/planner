/**
 * Tab Loader - Centralized Tab Loading Logic
 *
 * Handles tab navigation, content loading via HTMX, and tab visibility management
 */

// Centralized tab configuration
const TAB_CONFIG = {
    'data': { url: 'src/components/tabs.html', target: '#tabs-container' },
    'configuration': { url: 'src/components/config-editor.html', target: '#config-editor-container' },
    'solver': { url: 'src/components/solver-tab.html', target: '#solver-controls-container' },
    'visualizer': { url: 'src/components/visualizer.html', target: '#visualizer-container' },
    'output_data': { url: 'src/components/output-viewer.html', target: '#output-viewer-container' }
};

// Tab target mapping for visibility updates
const TAB_TARGETS = {
    'configuration': '#config-editor-container',
    'solver': '#solver-controls-container',
    'visualizer': '#visualizer-container',
    'output_data': '#output-viewer-container'
};

// Valid tab names
const VALID_TABS = Object.keys(TAB_CONFIG);

/**
 * Load tab content via HTMX
 * @param {string} tabName - The name of the tab to load
 * @param {Object} htmx - HTMX instance
 * @returns {boolean} True if tab was loaded, false otherwise
 */
function loadTab(tabName, htmx) {
    const config = TAB_CONFIG[tabName];
    if (!config || !htmx) {
        return false;
    }

    const targetElement = document.querySelector(config.target);
    if (!targetElement) {
        return false;
    }

    // Skip if already loaded
    if (targetElement.getAttribute('data-loaded') === 'true') {
        return true;
    }

    // Avoid duplicate in-flight requests
    if (targetElement.getAttribute('data-loading') === 'true') {
        return true;
    }

    targetElement.setAttribute('data-loading', 'true');

    const onAfterSwap = (event) => {
        if (event?.detail?.target !== targetElement) {
            return;
        }
        targetElement.setAttribute('data-loaded', 'true');
        targetElement.removeAttribute('data-loading');
        document.body.removeEventListener('htmx:afterSwap', onAfterSwap);
        document.body.removeEventListener('htmx:responseError', onResponseError);
    };

    const onResponseError = (event) => {
        if (event?.detail?.target !== targetElement) {
            return;
        }
        targetElement.removeAttribute('data-loading');
        document.body.removeEventListener('htmx:afterSwap', onAfterSwap);
        document.body.removeEventListener('htmx:responseError', onResponseError);
    };

    document.body.addEventListener('htmx:afterSwap', onAfterSwap);
    document.body.addEventListener('htmx:responseError', onResponseError);

    htmx.ajax('GET', config.url, {
        target: config.target,
        swap: 'innerHTML'
    });
    return true;
}

/**
 * Update tab visibility
 * @param {string} tabName - The name of the tab to show
 * @param {Object} targets - Tab target mapping
 */
function updateTabVisibility(tabName, targets = TAB_TARGETS) {
    document.querySelectorAll('.tab-content').forEach((element) => {
        element.classList.remove('active');
    });

    const activeTarget = targets[tabName];
    if (!activeTarget) {
        return;
    }

    const activeElement = document.querySelector(activeTarget);
    if (activeElement) {
        activeElement.classList.add('active');
    }
}

/**
 * Get valid tab names
 * @returns {string[]} Array of valid tab names
 */
function getValidTabs() {
    return [...VALID_TABS];
}

/**
  * Get tab name from hash
  * @param {string} hash - Window location hash (e.g., '#data')
  * @returns {string} Tab name or 'data' as default
  */
function getTabFromHash(hash) {
    const hashTab = (hash || window.location.hash).replace('#', '').trim();
    return VALID_TABS.includes(hashTab) ? hashTab : 'data';
}

/**
 * Set hash for tab navigation
 * @param {string} tabName - The tab name to set in hash
 */
function setHashForTab(tabName) {
    if (!VALID_TABS.includes(tabName)) {
        return;
    }

    const nextHash = `#${tabName}`;
    if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
    }
}

/**
 * Handle tab navigation (left/right/home/end)
 * @param {string} direction - Navigation direction ('left', 'right', 'home', 'end')
 * @param {string} currentTab - Current tab name
 * @returns {string} New tab name
 */
function handleTabNavigation(direction, currentTab) {
    const tabs = VALID_TABS;

    // DOM-AWARE: Find current tab by checking which button has tabindex="0"
    const tabButtons = document.querySelectorAll('.tab');
    let currentIndex = -1;

    tabButtons.forEach((btn, idx) => {
        if (btn.getAttribute('tabindex') === '0') {
            currentIndex = idx;
        }
    });

    // Fallback to state-based lookup if DOM method fails
    if (currentIndex === -1) {
        currentIndex = tabs.indexOf(currentTab);
    }

    if (currentIndex === -1) {
        console.warn('handleTabNavigation: Could not determine current tab');
        return currentTab;
    }

    let newIndex = currentIndex;

    switch (direction) {
        case 'left':
            newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
            break;
        case 'right':
            newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
            break;
        case 'home':
            newIndex = 0;
            break;
        case 'end':
            newIndex = tabs.length - 1;
            break;
        default:
            return currentTab;
    }

    return tabs[newIndex];
}

// Expose to global scope for backward compatibility
window.TAB_CONFIG = TAB_CONFIG;
window.TAB_TARGETS = TAB_TARGETS;
window.VALID_TABS = VALID_TABS;
window.loadTab = loadTab;
window.updateTabVisibility = updateTabVisibility;
window.getValidTabs = getValidTabs;
window.getTabFromHash = getTabFromHash;
window.setHashForTab = setHashForTab;
window.handleTabNavigation = handleTabNavigation;
