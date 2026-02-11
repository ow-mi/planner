export function app() {
    return {
        activeTab: 'data',
        isLoading: false,
        error: null,

        getValidTabs() {
            return window.VALID_TABS || ['data', 'configuration', 'solver', 'visualizer', 'output_data'];
        },

        getTabFromHash() {
            const hashTab = window.location.hash.replace('#', '').trim();
            const validTabs = this.getValidTabs();
            return validTabs.includes(hashTab) ? hashTab : 'data';
        },

        setHashForTab(tabName) {
            if (!this.getValidTabs().includes(tabName)) {
                return;
            }

            const nextHash = `#${tabName}`;
            if (window.location.hash !== nextHash) {
                window.location.hash = nextHash;
            }
        },

        initApp() {
            console.log('[app] Initializing Priority Configuration Editor v2');

            this.activeTab = this.getTabFromHash();
            console.log('[app] Initial tab from hash:', this.activeTab);

            window.addEventListener('hashchange', () => {
                const hashTab = this.getTabFromHash();
                if (hashTab !== this.activeTab) {
                    console.log('[app] hashchange ->', hashTab);
                    this.setActiveTab(hashTab);
                }
            });

            this.setupEventListeners();
            this.waitForStores();
        },

        waitForStores() {
            const maxAttempts = 50;
            let attempts = 0;

            const checkStores = () => {
                attempts++;

                const filesReady = this.$store && this.$store.files;
                const configReady = this.$store && this.$store.config;
                const solverReady = this.$store && this.$store.solver;
                const batchReady = this.$store && this.$store.batch;
                const vizReady = this.$store && this.$store.visualization;

                if (filesReady && configReady && solverReady && batchReady && vizReady) {
                    console.log('[app] All stores detected, initializing...');
                    this.initializeStores();
                } else if (attempts < maxAttempts) {
                    if (attempts % 10 === 0) {
                        console.log(`Waiting for stores... (attempt ${attempts})`);
                        if (!filesReady) console.log('  - files store not ready');
                        if (!configReady) console.log('  - config store not ready');
                        if (!solverReady) console.log('  - solver store not ready');
                        if (!batchReady) console.log('  - batch store not ready');
                        if (!vizReady) console.log('  - visualization store not ready');
                    }

                    setTimeout(checkStores, 100);
                } else {
                    const missing = [];
                    if (!filesReady) missing.push('files');
                    if (!configReady) missing.push('config');
                    if (!solverReady) missing.push('solver');
                    if (!batchReady) missing.push('batch');
                    if (!vizReady) missing.push('visualization');

                    console.error(`Timeout waiting for stores: ${missing.join(', ')} not available`);
                    this.error = `Failed to initialize: ${missing.join(', ')} stores not loaded. Please refresh the page.`;
                }
            };

            document.addEventListener('alpine:init', () => {
                this.$nextTick(() => {
                    checkStores();
                });
            }, { once: true });

            checkStores();
        },

        initializeStores() {
            try {
                this.$store.files.init();
                this.$store.config.init();
                this.$store.solver.init();
                this.$store.batch.init();
                this.$store.visualization.init();
                console.log('[app] All stores initialized successfully');

                this.$nextTick(() => {
                    // Always load tabs shell so navigation is available
                    this.loadTabContent('data');
                    console.log('[app] Initial render for tab:', this.activeTab);
                    this.updateTabVisibility(this.activeTab);
                    this.loadTabContent(this.activeTab);
                });

                this.$watch('activeTab', (newTab) => {
                    console.log('[app] activeTab watcher ->', newTab);
                    this.updateTabVisibility(newTab);
                    this.loadTabContent(newTab);
                });
            } catch (error) {
                console.error('Failed to initialize stores:', error);
                this.error = 'Failed to initialize application stores: ' + error.message;
            }
        },

        updateTabVisibility(tabName) {
            console.log('[app] updateTabVisibility', { tabName });
            Object.values(TAB_TARGETS).forEach((selector) => {
                const element = document.querySelector(selector);
                if (element) {
                    element.classList.remove('active');
                }
            });

            const activeTarget = TAB_TARGETS[tabName];
            if (!activeTarget) {
                return;
            }

            const activeElement = document.querySelector(activeTarget);
            if (activeElement) {
                activeElement.classList.add('active');
            } else {
                console.warn('[app] updateTabVisibility missing target element', { tabName, activeTarget });
            }
        },

        loadTabContent(tabName) {
            console.log('[app] loadTabContent called', { tabName });
            if (window.loadTab && window.TAB_CONFIG) {
                const loaded = window.loadTab(tabName, window.htmx);
                console.log('[app] loadTabContent via tabLoader result', { tabName, loaded });
                return loaded;
            }

            const config = window.TAB_CONFIG ? window.TAB_CONFIG[tabName] : null;
            if (!config || !window.htmx) {
                console.warn('[app] Missing config or htmx for tab load', {
                    hasConfig: !!config,
                    hasHtmx: !!window.htmx,
                    tabName
                });
                return;
            }

            const targetElement = document.querySelector(config.target);
            if (!targetElement) {
                console.warn('[app] Tab target not found', { tabName, target: config.target, url: config.url });
                return;
            }

            if (targetElement.getAttribute('data-loaded') === 'true') {
                console.log('[app] Tab already loaded, skipping request', { tabName, target: config.target });
                return;
            }

            htmx.ajax('GET', config.url, {
                target: config.target,
                swap: 'innerHTML'
            });
            console.log('[app] Requested tab content', { tabName, url: config.url, target: config.target });

            targetElement.setAttribute('data-loaded', 'true');
        },

        setupEventListeners() {
            window.addEventListener('error', (event) => {
                console.error('Global error:', {
                    message: event?.message,
                    error: event?.error,
                    filename: event?.filename,
                    lineno: event?.lineno,
                    colno: event?.colno
                });
                const errorMessage = event?.error?.message || event?.message || 'An unexpected error occurred.';
                if (!errorMessage || errorMessage === 'Script error.') {
                    return;
                }
                this.showError(`Unexpected error: ${errorMessage}`);
            });

            document.body.addEventListener('htmx:beforeRequest', (event) => {
                console.log('[htmx] beforeRequest', {
                    path: event?.detail?.pathInfo?.requestPath,
                    target: event?.detail?.target?.id || event?.detail?.target?.tagName
                });
                this.isLoading = true;
            });

            document.body.addEventListener('htmx:afterRequest', (event) => {
                console.log('[htmx] afterRequest', {
                    path: event?.detail?.pathInfo?.requestPath,
                    status: event?.detail?.xhr?.status,
                    target: event?.detail?.target?.id || event?.detail?.target?.tagName
                });
                this.isLoading = false;
            });

            document.body.addEventListener('htmx:afterSwap', (event) => {
                console.log('[htmx] afterSwap', {
                    target: event?.detail?.target?.id || event?.detail?.target?.tagName,
                    childCount: event?.detail?.target?.children?.length || 0
                });
            });

            document.body.addEventListener('htmx:responseError', (event) => {
                try {
                    const failedRequest = event.detail.failedRequest;
                    if (failedRequest && failedRequest.response) {
                        const errorData = JSON.parse(failedRequest.response);
                        this.showError(errorData.message || 'Request failed');
                    } else {
                        const xhr = event.detail.failedRequest;
                        if (xhr && xhr.status) {
                            if (xhr.status === 404) {
                                this.showError('Component not found. Please check the path.');
                            } else {
                                this.showError(`HTTP Error ${xhr.status}: ${xhr.statusText || 'Unknown error'}`);
                            }
                        } else {
                            this.showError('Request failed: Component loading error');
                        }
                    }
                } catch (e) {
                    console.error('Error handling HTMX response:', e);
                    this.showError('Request failed: ' + e.message);
                }
            });
        },

        showError(message) {
            this.error = message;
            console.error('Application error:', message);

            setTimeout(() => {
                this.error = null;
            }, 10000);
        },

        clearError() {
            this.error = null;
        },

        setActiveTab(tabName) {
            if (!this.getValidTabs().includes(tabName)) {
                console.warn('[app] setActiveTab rejected invalid tab', {
                    tabName,
                    validTabs: this.getValidTabs()
                });
                return;
            }

            console.log('[app] setActiveTab', { from: this.activeTab, to: tabName });
            this.activeTab = tabName;
            this.setHashForTab(tabName);
            this.updateTabVisibility(tabName);
        },

        handleTabNavigation(direction) {
            if (window.handleTabNavigation) {
                const newTab = window.handleTabNavigation(direction, this.activeTab);
                if (newTab && newTab !== this.activeTab) {
                    this.setActiveTab(newTab);
                }
                return;
            }

            const tabs = this.getValidTabs();
            const tabButtons = document.querySelectorAll('.tab');
            let currentIndex = -1;

            tabButtons.forEach((btn, idx) => {
                if (btn.getAttribute('tabindex') === '0') {
                    currentIndex = idx;
                }
            });

            if (currentIndex === -1) {
                currentIndex = tabs.indexOf(this.activeTab);
            }

            if (currentIndex === -1) {
                console.warn('handleTabNavigation: Could not determine current tab');
                return;
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
            }

            console.log(`handleTabNavigation: direction=${direction}, currentIndex=${currentIndex}, newIndex=${newIndex}, tab=${tabs[newIndex]}`);

            this.setActiveTab(tabs[newIndex]);
        }
    };
}

window.app = app;
