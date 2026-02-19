/**
 * Configuration Editor Component - Alpine.js Component
 * 
 * This file defines the Alpine.js component for the configuration editor.
 * It must be loaded BEFORE Alpine.js initializes to ensure x-data works correctly.
 */

 function configEditorComponent() {
     return {
         jsonImportText: '',
         weightsPercent: 50,  // 0-100% slider: 0%=fully makespan, 100%=fully priority
         activeSubtab: 'import',  // Default active subtab
         activeTestTab: 'project',
         showAddTestModal: false,
         newTestName: '',
         newTestDuration: 1,
         newTestPriority: 5,
         newTestForceWeek: '',
         legColumnControls: {
             startDeadline: '',
             endDeadline: '',
             deadlinePenalty: 0,
             compactness: 0
         },
         _outputUpdateScheduled: false,

        // Access store properties directly
        get config() {
            return this.$store.config.config;
        },

        get sectionStates() {
            return this.$store.config.sectionStates;
        },

        get sectionEnabled() {
            return this.$store.config.sectionEnabled;
        },

        get priority_config_settings() {
            return this.$store.config.priorityConfigSettings;
        },

        get dedupedProximityRules() {
            const seen = new Set();
            return (this.config.proximityRules || []).reduce((acc, rule, index) => {
                const pattern = rule?.pattern || '';
                if (!pattern || seen.has(pattern)) {
                    return acc;
                }
                seen.add(pattern);
                acc.push({ rule, index, key: `${pattern}-${index}` });
                return acc;
            }, []);
        },

        get error() {
            return this.$store.config.error;
        },

        set error(value) {
            this.$store.config.error = value;
        },

        get successMessage() {
            return this.$store.config.successMessage;
        },

        set successMessage(value) {
            this.$store.config.successMessage = value;
        },

        clearSuccessMessage() {
            if (this.successMessage) {
                this.$store.config.successMessage = '';
            }
        },

        applyJsonImportText() {
            const rawJson = String(this.jsonImportText || '').trim();
            if (!rawJson) {
                this.error = 'Please paste a JSON payload first.';
                return;
            }

            try {
                const parsed = JSON.parse(rawJson);
                // Phase 6: Validate against CSV before applying
                const validation = this.validateImport(parsed);
                this.$store.config.loadJsonConfiguration(parsed);
            } catch (error) {
                this.error = `Invalid JSON format: ${error.message}`;
            }
        },

        copyToClipboard() {
            this.$store.config.copyToClipboard();
        },

        resetToDefaults() {
            if (confirm('Are you sure you want to reset all configuration settings to defaults?')) {
                this.$store.config.resetToDefaults();
                this.syncWeightsFromConfig();
            }
        },

        init() {
            this.syncWeightsFromConfig();
            this.queueOutputUpdate(true);

            this.$watch(() => JSON.stringify(this.config), () => {
                this.syncWeightsFromConfig();
                this.queueOutputUpdate();
            });

            this.$watch(() => JSON.stringify(this.sectionEnabled), () => {
                console.log('[configEditor] sectionEnabled changed, updating output');
                this.queueOutputUpdate();
            });
        },

        syncWeightsFromConfig() {
            // Convert makespan weight (0-1) to priority percent (0-100)
            // Slider: 0% = fully makespan, 100% = fully priority
            const makespan = Number(this.config.weights?.makespanWeight) || 0;
            this.weightsPercent = Math.round((1 - makespan) * 100);
        },

        syncWeightsToConfig() {
            // Convert slider percent (0-100) to weights
            // Slider 0% = makespan 1.0, priority 0.0
            // Slider 100% = makespan 0.0, priority 1.0
            const percent = Number(this.weightsPercent);
            const priorityWeight = Number.isFinite(percent) ? percent / 100 : 0.5;
            const makespanWeight = 1 - priorityWeight;
            this.config.weights.makespanWeight = makespanWeight;
            this.config.weights.priorityWeight = priorityWeight;
        },

        queueOutputUpdate(force = false) {
            if (this._outputUpdateScheduled && !force) {
                return;
            }

            this._outputUpdateScheduled = true;
            setTimeout(() => {
                this._outputUpdateScheduled = false;
                if (this.$store && this.$store.config && this.$store.config.updateOutputSettings) {
                    console.log('[configEditor] Triggering output settings update');
                    this.$store.config.updateOutputSettings();
                }
            }, 0);
        },

        isValidWeekDeadlineFormat(value) {
            if (typeof value !== 'string') {
                return false;
            }

            const match = value.match(/^(\d{4})-W(\d{2})\.(\d)$/);
            if (!match) {
                return false;
            }

            const week = Number(match[2]);
            const day = Number(match[3]);

            if (!Number.isInteger(week) || week < 1 || week > 53) {
                return false;
            }

            if (!Number.isInteger(day) || day < 1 || day > 7) {
                return false;
            }

            return true;
        },

        getCurrentIsoWeekDate() {
            const now = new Date();
            const isoDay = now.getDay() === 0 ? 7 : now.getDay();
            const thursday = new Date(now);
            thursday.setDate(now.getDate() + (4 - isoDay));
            const isoYear = thursday.getFullYear();

            const jan1 = new Date(isoYear, 0, 1);
            const jan1IsoDay = jan1.getDay() === 0 ? 7 : jan1.getDay();
            const firstThursday = new Date(jan1);
            firstThursday.setDate(jan1.getDate() + (4 - jan1IsoDay));

            const weekNumber = Math.floor((thursday - firstThursday) / (7 * 24 * 60 * 60 * 1000)) + 1;
            return `${isoYear}-W${String(weekNumber).padStart(2, '0')}.${isoDay}`;
        },

         getDeadlineError(value, enabled) {
             if (!enabled) {
                 return '';
             }

             if (!value) {
                 return 'Required format: YYYY-WWW.N';
             }

             if (!this.isValidWeekDeadlineFormat(value)) {
                 return 'Invalid format. Use YYYY-WWW.N (e.g., 2026-W30.5)';
             }

             return '';
         },

         setActiveSubtab(tabName) {
             this.activeSubtab = tabName;
         },

         // ============================================================================
         // LEGS SUBTAB - Leg Ordering and Week Configuration
         // ============================================================================
         
         get legs() {
              const deadlines = this.$store.config.config.deadlines || [];
              // Ensure each deadline has UI state properties
              return deadlines.map((leg, index) => {
                  if (!leg._uiId) {
                      leg._uiId = 'leg-' + Date.now() + '-' + index + '-' + Math.random().toString(36).substr(2, 9);
                  }
                  // Initialize editing state if not present
                  if (typeof leg.isEditing === 'undefined') {
                      leg.isEditing = false;
                  }
                  // Initialize error states
                  if (typeof leg.startDeadlineError === 'undefined') {
                      leg.startDeadlineError = '';
                  }
                  if (typeof leg.endDeadlineError === 'undefined') {
                      leg.endDeadlineError = '';
                  }
                  if (typeof leg.deadlinePenalty !== 'number' || Number.isNaN(leg.deadlinePenalty) || leg.deadlinePenalty < 0) {
                      leg.deadlinePenalty = 0;
                  }
                  if (typeof leg.compactness !== 'number' || Number.isNaN(leg.compactness) || leg.compactness < 0) {
                      leg.compactness = 0;
                  }
                  return leg;
              });
          },

         set legs(value) {
             this.$store.config.config.deadlines = value;
             this.queueOutputUpdate();
         },

         get hasUploadedCsvData() {
             const parsedData = this.$store.files?.parsedCsvData || {};
             return Object.keys(parsedData).length > 0;
         },

         importLegsFromCsv() {
             const csvLegs = this.availableCsvLegs;
             let addedCount = 0;
             
             csvLegs.forEach(({ project, leg, branch }) => {
                 if (!this.isLegAlreadyAdded(project, leg, branch)) {
                     this.addLegFromCsvData(project, leg, branch);
                     addedCount++;
                 }
             });
             
             if (addedCount > 0) {
                 this.successMessage = `Imported ${addedCount} leg(s) from CSV`;
                 setTimeout(() => this.clearSuccessMessage(), 3000);
             }
         },

        addLegFromCsv(legId, branch, project = '') {
            const currentWeekDate = this.getCurrentIsoWeekDate();
            const newLeg = {
                _uiId: 'leg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                project: project || '',
                legId: legId,
                branch: branch || '',
                startDeadline: currentWeekDate,
                endDeadline: '',
                deadlinePenalty: 0,
                compactness: 0,
                startEnabled: true,
                endEnabled: false,
                isEditing: false,
                startDeadlineError: '',
                endDeadlineError: ''
            };
            this.$store.config.config.deadlines.push(newLeg);
             this.$store.config.updateOutputSettings();
         },

         updateLegBranch(index, value) {
             if (index >= 0 && index < this.legs.length) {
                 this.$store.config.config.deadlines[index].branch = value || '';
                 this.$store.config.updateOutputSettings();
             }
         },

         updateLegProject(index, value) {
             if (index >= 0 && index < this.legs.length) {
                 this.$store.config.config.deadlines[index].project = (value || '').trim();
                 this.$store.config.updateOutputSettings();
             }
         },

         // Drag and drop state
         draggedIndex: null,
         dragOverIndex: null,
         keyboardDragSource: null,

         /**
          * Add a new leg with default values
          */
         addLeg() {
             const newLeg = {
                 _uiId: 'leg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                 project: '',
                 legId: '',
                 branch: '',
                 startDeadline: '',
                 endDeadline: '',
                 deadlinePenalty: 0,
                 compactness: 0,
                 startEnabled: false,
                 endEnabled: true,
                 isEditing: true, // Start in edit mode for leg ID
                 startDeadlineError: '',
                 endDeadlineError: ''
             };
             this.$store.config.config.deadlines.push(newLeg);
             this.$store.config.updateOutputSettings();
             
            // Focus the new leg's ID input after render
            this.$nextTick(() => {
                const inputs = document.querySelectorAll('input[id^="legIdInput-"]');
                if (inputs.length > 0) {
                    const lastInput = inputs[inputs.length - 1];
                    lastInput.focus();
                }
            });
         },

         /**
          * Remove a leg at the specified index
          * @param {number} index - The index of the leg to remove
          */
         removeLeg(index) {
             if (index < 0 || index >= this.legs.length) {
                 return;
             }
             const legName = this.legs[index]?.legId || 'unnamed';
             if (confirm(`Are you sure you want to remove leg "${legName}"?`)) {
                 this.$store.config.config.deadlines.splice(index, 1);
                 this.$store.config.updateOutputSettings();
             }
         },

         /**
          * Reorder legs by moving from one index to another
          * @param {number} fromIndex - Source index
          * @param {number} toIndex - Target index
          */
         reorderLeg(fromIndex, toIndex) {
             if (fromIndex === toIndex) {
                 return;
             }
             if (fromIndex < 0 || fromIndex >= this.legs.length) {
                 return;
             }
             if (toIndex < 0 || toIndex >= this.legs.length) {
                 return;
             }
             
             const legs = this.$store.config.config.deadlines;
             const [movedItem] = legs.splice(fromIndex, 1);
             legs.splice(toIndex, 0, movedItem);
             
             this.$store.config.updateOutputSettings();
         },

         /**
          * Validate week format YYYY-Www.f
          * @param {string} value - The value to validate
          * @returns {boolean} - True if valid format
          */
         validateWeekFormat(value) {
             if (typeof value !== 'string' || value.trim().length === 0) {
                 return true; // Empty is valid (optional fields)
             }

             const match = value.match(/^(\d{4})-W(\d{2})\.(\d)$/);
             if (!match) {
                 return false;
             }

             const week = Number(match[2]);
             const day = Number(match[3]);

             if (!Number.isInteger(week) || week < 1 || week > 53) {
                 return false;
             }

             if (!Number.isInteger(day) || day < 1 || day > 7) {
                 return false;
             }

             return true;
         },

         // ============================================================================
         // CSV LEG IMPORT - Extract legs from uploaded CSV files
         // ============================================================================
         
         /**
          * Get available legs from CSV data
          * @returns {Array} - Array of {leg, branch} objects from CSV
          */
         get availableCsvLegs() {
             const fileStore = this.$store.files;
             if (!fileStore || !fileStore.parsedCsvData) {
                 return [];
             }
             
             const csvFiles = Object.values(fileStore.parsedCsvData);
             if (!csvFiles.length) {
                 return [];
             }

             const parseCompositeLeg = (rawLeg) => {
                 const value = String(rawLeg || '').trim();
                 if (!value || !value.includes('__')) {
                     return { project: '', leg: value, branch: '' };
                 }
                 const parts = value.split('__');
                 if (parts.length === 2) {
                     return { project: parts[0] || '', leg: parts[1] || '', branch: '' };
                 }
                 return {
                     project: parts[0] || '',
                     leg: parts[1] || '',
                     branch: parts.slice(2).join('__') || ''
                 };
             };

             const findHeaderIndex = (headers, exactNames = [], excludeNames = []) => {
                 const normalized = headers.map((h) => String(h || '').trim().toLowerCase());
                 const exactSet = new Set(exactNames.map((n) => n.toLowerCase()));
                 const excludeSet = new Set(excludeNames.map((n) => n.toLowerCase()));

                 let index = normalized.findIndex((h) => exactSet.has(h));
                 if (index >= 0) {
                     return index;
                 }

                 index = normalized.findIndex((h) => h.includes('leg') && !excludeSet.has(h));
                 return index;
             };
             
             // Get unique leg/branch combinations from all CSV files
             const legBranchMap = new Map();
             
             csvFiles.forEach(csvData => {
                 if (!csvData.rows || !Array.isArray(csvData.rows)) {
                     return;
                 }
                 
                 // Find leg column index and branch column index
                 const headers = csvData.headers || [];
                 const legColIndex = findHeaderIndex(
                     headers,
                     ['leg', 'leg_id', 'legid'],
                     ['next_leg', 'leg_type', 'type', 'test_name']
                 );
                 const projectColIndex = findHeaderIndex(headers, ['project', 'project_name'], []);
                 const branchColIndex = findHeaderIndex(headers, ['branch', 'leg_branch'], []);
                 
                  csvData.rows.forEach(row => {
                      if (!Array.isArray(row)) return;
                      
                      const csvProject = projectColIndex >= 0 ? String(row[projectColIndex] || '').trim() : '';
                      const csvLegValue = legColIndex >= 0 ? String(row[legColIndex] || '').trim() : '';
                      const csvBranch = branchColIndex >= 0 ? String(row[branchColIndex] || '').trim() : '';
                      const parsedComposite = parseCompositeLeg(csvLegValue);
                      // Use explicit null/undefined check to avoid treating empty string as falsy
                      const project = csvProject || parsedComposite.project || '';
                      const leg = parsedComposite.leg !== '' ? parsedComposite.leg : (csvLegValue || '');
                      const branch = csvBranch || parsedComposite.branch || '';
                      
                      if (leg) {
                          const key = `${project}||${leg}||${branch}`;
                          if (!legBranchMap.has(key)) {
                              legBranchMap.set(key, { project, leg, branch });
                          }
                      }
                  });
             });
             
             return Array.from(legBranchMap.values());
         },
         
         /**
          * Check if a leg/branch combination is already added
          * @param {string} leg - Leg ID
          * @param {string} branch - Branch name
          * @returns {boolean}
          */
         isLegAlreadyAdded(project, leg, branch) {
             return this.legs.some(l => 
                 (l.project || '') === (project || '') &&
                 l.legId === leg &&
                 (l.branch || '') === (branch || '')
             );
         },
         
          /**
           * Import all legs from CSV
           */
          importLegsFromCsv() {
              const csvLegs = this.availableCsvLegs;
              let addedCount = 0;
              
              csvLegs.forEach(({ project, leg, branch }) => {
                  if (!this.isLegAlreadyAdded(project, leg, branch)) {
                      this.addLegFromCsvData(project, leg, branch);
                      addedCount++;
                  }
              });
              
              if (addedCount > 0) {
                  this.successMessage = `Imported ${addedCount} leg(s) from CSV`;
                  setTimeout(() => this.clearSuccessMessage(), 3000);
              }
          },
         
         /**
          * Quick add a single leg from CSV data
          * @param {string} leg - Leg ID
          * @param {string} branch - Branch name
          */
         quickAddLegFromCsv(project, leg, branch) {
             if (this.isLegAlreadyAdded(project, leg, branch)) {
                 return;
             }
             this.addLegFromCsvData(project, leg, branch);
         },
         
         /**
           * Add a leg from CSV data
           * @param {string} legId - Leg ID from CSV
           * @param {string} branch - Branch from CSV
           */
         addLegFromCsvData(project, legId, branch) {
             const currentWeekDate = this.getCurrentIsoWeekDate();
             const newLeg = {
                 _uiId: 'leg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                 project: project || '',
                 legId: legId || '',
                 branch: branch || '',
                 startDeadline: currentWeekDate,
                 endDeadline: '',
                 deadlinePenalty: 0,
                 compactness: 0,
                 startEnabled: true,
                 endEnabled: false,
                 isEditing: false,
                 startDeadlineError: '',
                 endDeadlineError: ''
             };
              this.$store.config.config.deadlines.push(newLeg);
              this.$store.config.updateOutputSettings();
          },

         /**
          * Update leg ID and sync to store
          */
         updateLegId(index, value) {
             if (index < 0 || index >= this.legs.length) {
                 return;
             }
             this.$store.config.config.deadlines[index].legId = value.trim();
             this.$store.config.updateOutputSettings();
         },

         /**
          * Validate and update leg date field
          */
         validateAndUpdateLeg(index, field, value) {
             if (index < 0 || index >= this.legs.length) {
                 return;
             }
             
             const trimmedValue = value.trim();
             const leg = this.$store.config.config.deadlines[index];
             
             // Normalize empty values
             leg[field] = trimmedValue;
             
             // Update enabled state based on whether there's a value
             if (field === 'startDeadline') {
                 leg.startEnabled = !!trimmedValue && this.validateWeekFormat(trimmedValue);
             } else if (field === 'endDeadline') {
                 leg.endEnabled = !!trimmedValue && this.validateWeekFormat(trimmedValue);
             }
             
             // Clear error if valid or empty
             if (!trimmedValue || this.validateWeekFormat(trimmedValue)) {
                 if (field === 'startDeadline') {
                     leg.startDeadlineError = '';
                 } else if (field === 'endDeadline') {
                     leg.endDeadlineError = '';
                 }
             }
             
             this.$store.config.updateOutputSettings();
         },

         updateLegNumericField(index, field, value) {
             if (index < 0 || index >= this.legs.length) {
                 return;
             }

             const numericValue = Number(value);
             const normalizedValue = Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0;
             this.$store.config.config.deadlines[index][field] = normalizedValue;
             this.$store.config.updateOutputSettings();
         },

         applyLegColumnValue(field) {
             if (!Array.isArray(this.$store.config.config.deadlines) || this.$store.config.config.deadlines.length === 0) {
                 return;
             }

             if (field === 'startDeadline' || field === 'endDeadline') {
                 const rawValue = String(this.legColumnControls[field] || '').trim();
                 if (rawValue && !this.validateWeekFormat(rawValue)) {
                     this.error = `Invalid ${field === 'startDeadline' ? 'Start' : 'End'} format. Use YYYY-Www.f`;
                     return;
                 }

                 this.$store.config.config.deadlines.forEach((leg) => {
                     leg[field] = rawValue;
                     if (field === 'startDeadline') {
                         leg.startEnabled = !!rawValue;
                         leg.startDeadlineError = '';
                     } else {
                         leg.endEnabled = !!rawValue;
                         leg.endDeadlineError = '';
                     }
                 });
                 this.$store.config.updateOutputSettings();
                 return;
             }

             if (field === 'deadlinePenalty' || field === 'compactness') {
                 const numericValue = Number(this.legColumnControls[field]);
                 const normalizedValue = Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0;
                 this.legColumnControls[field] = normalizedValue;
                 this.$store.config.config.deadlines.forEach((leg) => {
                     leg[field] = normalizedValue;
                 });
                 this.$store.config.updateOutputSettings();
             }
         },

         // ============================================================================
         // DRAG AND DROP HANDLERS
         // ============================================================================

         dragStart(index, event) {
             this.draggedIndex = index;
             // Set drag data
             event.dataTransfer.effectAllowed = 'move';
             event.dataTransfer.setData('text/plain', String(index));
         },

         dragEnd() {
             this.draggedIndex = null;
             this.dragOverIndex = null;
         },

         dragOver(index, event) {
             if (this.draggedIndex === null || this.draggedIndex === index) {
                 return;
             }
             this.dragOverIndex = index;
             event.dataTransfer.dropEffect = 'move';
         },

         dragLeave() {
             // Optional: could clear dragOverIndex here if needed
         },

         drop(targetIndex) {
             if (this.draggedIndex === null || this.draggedIndex === targetIndex) {
                 return;
             }
             
             this.reorderLeg(this.draggedIndex, targetIndex);
             this.draggedIndex = null;
             this.dragOverIndex = null;
         },

         // ============================================================================
         // KEYBOARD ACCESSIBILITY FOR REORDERING
         // ============================================================================

         startKeyboardDrag(index) {
             if (this.keyboardDragSource === null) {
                 // Start drag
                 this.keyboardDragSource = index;
                 this.draggedIndex = index;
                 
                 // Show visual indicator
                 const rows = document.querySelectorAll('.leg-row');
                 if (rows[index]) {
                     rows[index].setAttribute('data-keyboard-drag', 'true');
                 }
             } else if (this.keyboardDragSource === index) {
                 // Cancel drag
                 this.keyboardDragSource = null;
                 this.draggedIndex = null;
             } else {
                 // Complete drag
                 this.reorderLeg(this.keyboardDragSource, index);
                 this.keyboardDragSource = null;
                 this.draggedIndex = null;
             }
         },

         moveLegUp(index) {
             if (index > 0) {
                 this.reorderLeg(index, index - 1);
             }
         },

         moveLegDown(index) {
             if (index < this.legs.length - 1) {
                 this.reorderLeg(index, index + 1);
             }
         },

         // ============================================================================
         // FTE SUBTAB - FTE Resource Availability and Alias Management
         // ============================================================================
         
         // Reactive FTE data from store
         get fte() {
             return this.$store.config.fte || { resources: [], holidays: [], aliases: {} };
         },

         set fte(value) {
             this.$store.config.fte = value;
             this.queueOutputUpdate();
         },

         get fteEnabled() {
             return this.$store.config.sectionEnabled.fteEnabled;
         },

         set fteEnabled(value) {
             this.$store.config.sectionEnabled.fteEnabled = value;
             this.$store.config.updateOutputSettings();
         },

         // Calendar year selector
         newFteName: '',
         selectedFteYear: new Date().getFullYear(),
         selectedFteId: null,
         bulkStartDate: '',
         bulkEndDate: '',
         isBulkSelectMode: false,
         
         // Alias management
         newAliasName: '',
         aliasResourceSelections: {},

         /**
          * Get list of available years for calendar (current and next 2 years)
          */
         get availableFteYears() {
             const currentYear = new Date().getFullYear();
             return [currentYear, currentYear + 1, currentYear + 2, currentYear + 3];
         },

         /**
          * Get selected FTE resource
          */
         get selectedFte() {
             if (!this.selectedFteId) return null;
             return this.fte.resources.find(r => r.id === this.selectedFteId) || null;
         },

         /**
          * Get all FTE resources
          */
         get fteResources() {
             return this.fte.resources || [];
         },

         /**
          * Get all holidays
          */
         get fteHolidays() {
             return this.fte.holidays || [];
         },

         /**
          * Get alias groups
          */
         get fteAliases() {
             return this.fte.aliases || {};
         },

         /**
          * Add a new FTE resource
          */
         addFte() {
             const id = 'fte-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
             this.$store.config.addFteResource(id, 'New FTE Resource');
             // Select the newly created FTE
             this.$nextTick(() => {
                 this.selectedFteId = id;
             });
         },

         /**
          * Add a new FTE resource from input field
          */
         addFteResource() {
             const trimmedName = String(this.newFteName || '').trim();
             if (!trimmedName) {
                 return;
             }

             const id = 'fte-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
             this.$store.config.addFteResource(id, trimmedName);
             this.newFteName = '';
             this.selectedFteId = id;
         },

         /**
          * Remove FTE resource at specified index
          * @param {number} index - The index of the FTE to remove
          */
         removeFte(index) {
             if (index < 0 || index >= this.fteResources.length) return;
             const fte = this.fteResources[index];
             if (confirm(`Are you sure you want to remove FTE "${fte.name}"?`)) {
                 // Clear selection if removing selected FTE
                 if (fte.id === this.selectedFteId) {
                     this.selectedFteId = null;
                 }
                 this.$store.config.removeFteResource(index);
             }
         },

         /**
          * Remove FTE resource by ID
          * @param {string} fteId - Resource ID
          */
         removeFteResource(fteId) {
             const index = this.fteResources.findIndex(fte => fte.id === fteId);
             if (index < 0) {
                 return;
             }
             this.removeFte(index);
         },

         /**
          * Update FTE resource name
          * @param {number} index - FTE index
          * @param {string} name - New name
          */
         updateFteName(index, name) {
             if (index < 0 || index >= this.fteResources.length) return;
             this.fteResources[index].name = name;
             this.$store.config.updateOutputSettings();
         },

         /**
          * Check if a specific date is available for an FTE resource
          * @param {number} year - Year
          * @param {string} fteId - FTE resource ID
          * @param {string} dateKey - Date in YYYY-MM-DD format
          */
         isFteDateAvailable(year, fteId, dateKey) {
             const resource = this.fteResources.find(r => r.id === fteId);
             if (!resource) return true; // Default to available
             return resource.calendar?.[year]?.[dateKey] !== false; // Default true unless explicitly false
         },

         /**
          * Toggle FTE date availability
          * @param {number} year - Year
          * @param {string} fteId - FTE resource ID
          * @param {string} dateKey - Date in YYYY-MM-DD format
          */
         toggleFteDate(year, fteId, dateKey) {
             const currentlyAvailable = this.isFteDateAvailable(year, fteId, dateKey);
             this.$store.config.updateFteCalendar(year, fteId, dateKey, !currentlyAvailable);
         },

         /**
          * Update FTE calendar for a specific date
          * @param {number} year - Year
          * @param {string} fteId - FTE resource ID
          * @param {string} dateKey - Date in YYYY-MM-DD format
          * @param {boolean} available - Whether available
          */
         updateFteCalendar(year, fteId, dateKey, available) {
             this.$store.config.updateFteCalendar(year, fteId, dateKey, available);
         },

         /**
          * Get all dates in a month for calendar display
          * @param {number} year - Year
          * @param {number} month - Month (0-11)
          */
         getMonthDays(year, month) {
             const daysInMonth = new Date(year, month + 1, 0).getDate();
             const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday, 6 = Saturday
             
             const days = [];
             const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Convert to Mon=0, Sun=6
             
             // Empty slots for days before month starts
             for (let i = 0; i < offset; i++) {
                 days.push(null);
             }
             
             // Actual days
             for (let day = 1; day <= daysInMonth; day++) {
                 days.push({
                     day: day,
                     dateKey: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                 });
             }
             
             return days;
         },

         /**
          * Check if date is within a holiday range
          * @param {string} dateKey - Date in YYYY-MM-DD format
          */
         isHoliday(dateKey) {
             return this.fteHolidays.some(h => {
                 const start = h.startDate;
                 const end = h.endDate;
                 return dateKey >= start && dateKey <= end;
             });
         },

         isCalendarHoliday(type, dateKey) {
             const holidays = type === 'equipment' ? this.equipmentHolidays : this.fteHolidays;
             return holidays.some((holiday) => dateKey >= holiday.startDate && dateKey <= holiday.endDate);
         },

         getCalendarHolidayName(type, dateKey) {
             const holidays = type === 'equipment' ? this.equipmentHolidays : this.fteHolidays;
             const holiday = holidays.find((item) => dateKey >= item.startDate && dateKey <= item.endDate);
             return holiday?.name || '';
         },

         isCalendarDateAvailable(type, year, resourceId, dateKey) {
             return type === 'equipment'
                 ? this.isEquipmentDateAvailable(year, resourceId, dateKey)
                 : this.isFteDateAvailable(year, resourceId, dateKey);
         },

         toggleCalendarDate(type, year, resourceId, dateKey) {
             if (this.isCalendarHoliday(type, dateKey)) {
                 return;
             }
             if (type === 'equipment') {
                 this.toggleEquipmentDate(year, resourceId, dateKey);
                 return;
             }
             this.toggleFteDate(year, resourceId, dateKey);
         },

         /**
          * Get holiday name for a date if applicable
          * @param {string} dateKey - Date in YYYY-MM-DD format
          */
         getHolidayName(dateKey) {
             const holiday = this.fteHolidays.find(h => {
                 return dateKey >= h.startDate && dateKey <= h.endDate;
             });
             return holiday?.name || '';
         },

         /**
          * Bulk update availability for a date range
          * @param {number} year - Year
          * @param {string} fteId - FTE resource ID
          * @param {string} startDate - Start date (YYYY-MM-DD)
          * @param {string} endDate - End date (YYYY-MM-DD)
          * @param {boolean} available - Whether available
          */
         bulkUpdateFteAvailability(year, fteId, startDate, endDate, available) {
             if (!fteId || !startDate || !endDate) return;
             
             const dateKeys = this.getDateRangeKeys(startDate, endDate);
             if (dateKeys.length === 0) return;
             
             this.$store.config.bulkUpdateFteCalendar(year, fteId, dateKeys, available);
         },

         /**
          * Get all date keys between start and end dates
          * @param {string} startDate - Start date (YYYY-MM-DD)
          * @param {string} endDate - End date (YYYY-MM-DD)
          */
         getDateRangeKeys(startDate, endDate) {
             const keys = [];
             const start = new Date(startDate);
             const end = new Date(endDate);
             
             if (isNaN(start.getTime()) || isNaN(end.getTime())) return keys;
             
             const current = new Date(start);
             while (current <= end) {
                 keys.push(current.toISOString().split('T')[0]);
                 current.setDate(current.getDate() + 1);
             }
             
             return keys;
         },

         /**
          * Apply bulk toggle
          */
         applyBulkToggle(available) {
             const year = this.selectedFteYear;
             const fteId = this.selectedFteId;
             if (!fteId || !this.bulkStartDate || !this.bulkEndDate) return;
             
             this.bulkUpdateFteAvailability(year, fteId, this.bulkStartDate, this.bulkEndDate, available);
             this.bulkStartDate = '';
             this.bulkEndDate = '';
         },

         /**
          * Add a holiday range
          * @param {string} startDate - Start date (YYYY-MM-DD)
          * @param {string} endDate - End date (YYYY-MM-DD)
          * @param {string} name - Holiday name
          */
         addHolidayRange(startDate, endDate, name) {
             this.$store.config.addHolidayRange(startDate, endDate, name);
         },

         /**
          * Remove a holiday
          * @param {number} index - Holiday index
          */
         removeHoliday(index) {
             this.$store.config.removeHoliday(index);
         },

         /**
          * Add a new alias group
          * @param {string} aliasName - Alias name
          * @param {string[]} resourceNames - Array of resource names/IDs
          */
         addAliasGroup(aliasName, resourceNames) {
             this.$store.config.addAliasGroup(aliasName, resourceNames);
         },

         /**
          * Remove an alias group
          * @param {string} aliasName - Alias name to remove
          */
         removeAliasGroup(aliasName) {
             this.$store.config.removeAliasGroup(aliasName);
         },

         /**
          * Get resources mapped to an alias
          * @param {string} aliasName - Alias name
          */
         getAliasResources(aliasName) {
             return this.fteAliases[aliasName] || [];
         },

         /**
          * Resolve FTE display name by resource ID
          * @param {string} resourceId - Stored resource ID
          * @returns {string} Human-readable resource name
          */
         getFteDisplayName(resourceId) {
             const id = String(resourceId || '').trim();
             if (!id) {
                 return '';
             }
             const resource = this.fteResources.find((item) => String(item?.id || '').trim() === id);
             return String(resource?.name || id).trim();
         },

         /**
          * Initialize alias selection for a specific alias
          * @param {string} aliasName - Alias name
          */
         initAliasSelection(aliasName) {
             if (!this.aliasResourceSelections[aliasName]) {
                 this.aliasResourceSelections[aliasName] = [];
             }
         },

         /**
          * Create new alias from form inputs
          */
         createNewAlias() {
             const name = this.newAliasName.trim();
             if (!name) return;
             
             const selectedResources = this.aliasResourceSelections[name] || [];
             if (selectedResources.length === 0) {
                 alert('Please select at least one resource for the alias');
                 return;
             }
             
             this.addAliasGroup(name, selectedResources);
             this.newAliasName = '';
             this.aliasResourceSelections[name] = [];
         },

         /**
          * Check if a resource is available on a specific date (for display)
          * @param {string} resourceId - Resource ID
          * @param {string} dateKey - Date in YYYY-MM-DD
          */
         isResourceAvailableOnDate(resourceId, dateKey) {
             const resource = this.fteResources.find(r => r.id === resourceId);
             if (!resource) return false;
             
             // Check if explicitly marked unavailable
             const year = this.selectedFteYear;
             if (resource.calendar?.[year]?.[dateKey] === false) {
                 return false;
             }
             
             // Check if it's a holiday
             if (this.isHoliday(dateKey)) {
                 return false;
             }
             
             // Default to available
             return true;
         },

         /**
          * Toggle alias resource membership
          * @param {string} aliasName - Alias name
          * @param {string} resourceId - Resource ID
          */
         toggleAliasResource(aliasName, resourceId) {
             const current = this.aliasResourceSelections[aliasName] || [];
             const index = current.indexOf(resourceId);
             
             if (index > -1) {
                 this.aliasResourceSelections[aliasName] = current.filter(id => id !== resourceId);
             } else {
                 this.aliasResourceSelections[aliasName] = [...current, resourceId];
             }
         },

         /**
          * Check if resource is selected for alias
          * @param {string} aliasName - Alias name
          * @param {string} resourceId - Resource ID
          */
         isAliasResourceSelected(aliasName, resourceId) {
             return (this.aliasResourceSelections[aliasName] || []).includes(resourceId);
         },

         // ============================================================================
         // EQUIPMENT SUBTAB - Equipment Resource Availability and Alias Management
         // ============================================================================
         
         // Reactive Equipment data from store
         get equipment() {
             return this.$store.config.equipment || { resources: [], holidays: [], aliases: {} };
         },

         set equipment(value) {
             this.$store.config.equipment = value;
             this.queueOutputUpdate();
         },

         get equipmentEnabled() {
             return this.$store.config.sectionEnabled.equipmentEnabled;
         },

         set equipmentEnabled(value) {
             this.$store.config.sectionEnabled.equipmentEnabled = value;
             this.$store.config.updateOutputSettings();
         },

         // Calendar year selector
         newEquipmentName: '',
         selectedEquipmentYear: new Date().getFullYear(),
         selectedEquipmentId: null,
         equipmentBulkStartDate: '',
         equipmentBulkEndDate: '',
         showEquipmentHolidayForm: false,
         equipmentHolidayStart: '',
         equipmentHolidayEnd: '',
         equipmentHolidayName: '',
         
         // Alias management
         newEquipmentAliasName: '',
         equipmentAliasResourceSelections: {},

         /**
          * Get list of available years for calendar (current and next 3 years)
          */
         get availableEquipmentYears() {
             const currentYear = new Date().getFullYear();
             return [currentYear, currentYear + 1, currentYear + 2, currentYear + 3];
         },

         /**
          * Get all Equipment resources
          */
         get equipmentResources() {
             return this.equipment.resources || [];
         },

         /**
          * Get all Equipment holidays
          */
         get equipmentHolidays() {
             return this.equipment.holidays || [];
         },

         /**
          * Get equipment alias groups
          */
         get equipmentAliases() {
             return this.equipment.aliases || {};
         },

         /**
          * Add a new Equipment resource
          */
         addEquipment() {
             const id = 'equipment-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
             this.$store.config.addEquipmentResource(id, 'New Equipment');
             // Select the newly created equipment
             this.$nextTick(() => {
                 this.selectedEquipmentId = id;
             });
         },

         /**
          * Add a new Equipment resource from input field
          */
         addEquipmentResource() {
             const trimmedName = String(this.newEquipmentName || '').trim();
             if (!trimmedName) {
                 return;
             }

             const id = 'equipment-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
             this.$store.config.addEquipmentResource(id, trimmedName);
             this.newEquipmentName = '';
             this.selectedEquipmentId = id;
         },

         /**
          * Remove Equipment resource at specified index
          * @param {number} index - The index of the equipment to remove
          */
         removeEquipment(index) {
             if (index < 0 || index >= this.equipmentResources.length) return;
             const equipment = this.equipmentResources[index];
             if (confirm(`Are you sure you want to remove equipment "${equipment.name}"?`)) {
                 // Clear selection if removing selected equipment
                 if (equipment.id === this.selectedEquipmentId) {
                     this.selectedEquipmentId = null;
                 }
                 this.$store.config.removeEquipmentResource(index);
             }
         },

         /**
          * Remove Equipment resource by ID
          * @param {string} equipmentId - Resource ID
          */
         removeEquipmentResource(equipmentId) {
             const index = this.equipmentResources.findIndex(eq => eq.id === equipmentId);
             if (index < 0) {
                 return;
             }
             this.removeEquipment(index);
         },

         /**
          * Update Equipment resource name
          * @param {number} index - Equipment index
          * @param {string} name - New name
          */
         updateEquipmentName(index, name) {
             if (index < 0 || index >= this.equipmentResources.length) return;
             this.equipmentResources[index].name = name;
             this.$store.config.updateOutputSettings();
         },

         /**
          * Check if a specific date is available for an Equipment resource
          * @param {number} year - Year
          * @param {string} equipmentId - Equipment resource ID
          * @param {string} dateKey - Date in YYYY-MM-DD format
          */
         isEquipmentDateAvailable(year, equipmentId, dateKey) {
             const resource = this.equipmentResources.find(r => r.id === equipmentId);
             if (!resource) return true; // Default to available
             return resource.calendar?.[year]?.[dateKey] !== false; // Default true unless explicitly false
         },

         /**
          * Toggle Equipment date availability
          * @param {number} year - Year
          * @param {string} equipmentId - Equipment resource ID
          * @param {string} dateKey - Date in YYYY-MM-DD format
          */
         toggleEquipmentDate(year, equipmentId, dateKey) {
             const currentlyAvailable = this.isEquipmentDateAvailable(year, equipmentId, dateKey);
             this.$store.config.updateEquipmentCalendar(year, equipmentId, dateKey, !currentlyAvailable);
         },

         /**
          * Check if date is within an Equipment holiday range
          * @param {string} dateKey - Date in YYYY-MM-DD format
          */
         isEquipmentHoliday(dateKey) {
             return this.equipmentHolidays.some(h => {
                 const start = h.startDate;
                 const end = h.endDate;
                 return dateKey >= start && dateKey <= end;
             });
         },

         /**
          * Get holiday name for an Equipment date if applicable
          * @param {string} dateKey - Date in YYYY-MM-DD format
          */
         getEquipmentHolidayName(dateKey) {
             const holiday = this.equipmentHolidays.find(h => {
                 return dateKey >= h.startDate && dateKey <= h.endDate;
             });
             return holiday?.name || '';
         },

         /**
          * Bulk update Equipment availability for a date range
          * @param {string} startDate - Start date (YYYY-MM-DD)
          * @param {string} endDate - End date (YYYY-MM-DD)
          * @param {boolean} available - Whether available
          */
         bulkUpdateEquipmentAvailability(year, equipmentId, startDate, endDate, available) {
             if (!equipmentId || !startDate || !endDate) return;
             
             const dateKeys = this.getDateRangeKeys(startDate, endDate);
             if (dateKeys.length === 0) return;
             
             this.$store.config.bulkUpdateEquipmentCalendar(year, equipmentId, dateKeys, available);
         },

         /**
          * Apply bulk toggle for Equipment
          */
         applyEquipmentBulkToggle(available) {
             const year = this.selectedEquipmentYear;
             const equipmentId = this.selectedEquipmentId;
             if (!equipmentId || !this.equipmentBulkStartDate || !this.equipmentBulkEndDate) return;
             
             this.bulkUpdateEquipmentAvailability(year, equipmentId, this.equipmentBulkStartDate, this.equipmentBulkEndDate, available);
             this.equipmentBulkStartDate = '';
             this.equipmentBulkEndDate = '';
         },

         /**
          * Add an Equipment holiday range
          * @param {string} startDate - Start date (YYYY-MM-DD)
          * @param {string} endDate - End date (YYYY-MM-DD)
          * @param {string} name - Holiday name
          */
         addEquipmentHolidayRange(startDate, endDate, name) {
             this.$store.config.addEquipmentHolidayRange(startDate, endDate, name);
         },

         /**
          * Remove an Equipment holiday
          * @param {number} index - Holiday index
          */
         removeEquipmentHoliday(index) {
             this.$store.config.removeEquipmentHoliday(index);
         },

         /**
          * Add a new Equipment alias group
          * @param {string} aliasName - Alias name
          * @param {string[]} resourceNames - Array of resource names/IDs
          */
         addEquipmentAliasGroup(aliasName, resourceNames) {
             this.$store.config.addEquipmentAliasGroup(aliasName, resourceNames);
         },

         /**
          * Remove an Equipment alias group
          * @param {string} aliasName - Alias name to remove
          */
         removeEquipmentAliasGroup(aliasName) {
             this.$store.config.removeEquipmentAliasGroup(aliasName);
         },

         /**
          * Create new Equipment alias from form inputs
          */
         createNewEquipmentAlias() {
             const name = this.newEquipmentAliasName.trim();
             if (!name) return;
             
             const selectedResources = this.equipmentAliasResourceSelections[name] || [];
             if (selectedResources.length === 0) {
                 alert('Please select at least one equipment for the alias');
                 return;
             }
             
             this.addEquipmentAliasGroup(name, selectedResources);
             this.newEquipmentAliasName = '';
             this.equipmentAliasResourceSelections[name] = [];
         },

         /**
          * Toggle Equipment alias resource membership
          * @param {string} aliasName - Alias name
          * @param {string} resourceId - Resource ID
          */
         toggleEquipmentAliasResource(aliasName, resourceId) {
             const current = this.equipmentAliasResourceSelections[aliasName] || [];
             const index = current.indexOf(resourceId);
             
             if (index > -1) {
                 this.equipmentAliasResourceSelections[aliasName] = current.filter(id => id !== resourceId);
             } else {
                 this.equipmentAliasResourceSelections[aliasName] = [...current, resourceId];
             }
         },

         /**
          * Check if resource is selected for Equipment alias
          * @param {string} aliasName - Alias name
          * @param {string} resourceId - Resource ID
          */
         isEquipmentAliasResourceSelected(aliasName, resourceId) {
             return (this.equipmentAliasResourceSelections[aliasName] || []).includes(resourceId);
         },

         // ================================
         // Test Configuration Methods
         // ================================

         get testEnabled() {
             return this.$store.config.sectionEnabled?.testEnabled ?? true;
         },

         set testEnabled(value) {
             this.$store.config.sectionEnabled.testEnabled = value;
             this.$store.config.updateOutputSettings();
         },

         get tests() {
             return this.$store.config.tests;
         },

         get testHierarchy() {
             return this.$store.config.testHierarchy;
         },

         /**
          * Get effective test setting (considers hierarchy)
          * @param {string} level - 'project', 'legType', 'leg', 'testType', 'test'
          * @param {string} id - ID at the level
          * @param {string} setting - Setting name
          */
         getEffectiveTestSetting(level, id, setting) {
             return this.$store.config.getEffectiveTestSetting(level, id, setting);
         },

         /**
          * Check if a setting is overridden at a specific level
          * @param {string} level - Hierarchy level
          * @param {string} id - ID
          * @param {string} setting - Setting name
          */
         isTestSettingOverridden(level, id, setting) {
             return this.$store.config.isTestSettingOverridden(level, id, setting);
         },

         /**
          * Add a test at specified level
          * @param {string} level - 'project', 'legType', 'leg', 'testType', 'test'
          * @param {Object} testData - Test configuration data
          */
         addTest(level, testData) {
             this.$store.config.addTest(level, testData);
         },

         /**
          * Remove a test at specified level
          * @param {string} level - Hierarchy level
          * @param {string} id - Test ID to remove
          */
         removeTest(level, id) {
             if (confirm(`Are you sure you want to remove this test?`)) {
                 this.$store.config.removeTest(level, id);
             }
         },

         /**
          * Update a test setting with optional override flag
          * @param {string} level - Hierarchy level
          * @param {string} id - Test ID
          * @param {string} setting - Setting name
          * @param {*} value - New value
          * @param {boolean} override - Whether to mark as override
          */
         updateTestSetting(level, id, setting, value, override = true) {
             this.$store.config.updateTestSetting(level, id, setting, value, override);
         },

         /**
          * Get inheritance chain for a test setting
          * Returns array showing where values come from
          * @param {string} level - Starting hierarchy level
          * @param {string} id - Starting ID
          * @param {string} setting - Setting name
          */
         getTestSettingInheritanceChain(level, id, setting) {
             return this.$store.config.getTestSettingInheritanceChain(level, id, setting);
         },

         /**
          * Add a leg type configuration
          * @param {string} legType - Leg type name
          * @param {Object} config - Configuration for this leg type
          */
         addLegTypeConfig(legType, config) {
             this.$store.config.addLegTypeConfig(legType, config);
         },

         /**
          * Remove leg type configuration
          * @param {string} legType - Leg type to remove
          */
         removeLegTypeConfig(legType) {
             this.$store.config.removeLegTypeConfig(legType);
         },

         /**
          * Add a test type configuration
          * @param {string} testType - Test type name
          * @param {Object} config - Configuration for this test type
          */
         addTestTypeConfig(testType, config) {
             this.$store.config.addTestTypeConfig(testType, config);
         },

         /**
          * Remove test type configuration
          * @param {string} testType - Test type to remove
          */
         removeTestTypeConfig(testType) {
             this.$store.config.removeTestTypeConfig(testType);
         },

         /**
          * Add a new individual test to hierarchy
          */
         addNewTest() {
             const name = this.newTestName?.trim();
             if (!name) return;
             
             this.$store.config.addTestToHierarchy(name, {
                 displayName: name,
                 duration: this.newTestDuration || 1,
                 priority: this.newTestPriority || 5,
                 fteResources: [],
                 equipmentResources: []
             });
             
             // Reset modal fields
             this.newTestName = '';
             this.newTestDuration = 1;
             this.newTestPriority = 5;
             this.showAddTestModal = false;
         },

         // Phase 6: CSV cross-reference validation methods
         get importWarnings() {
             const errors = this.$store.config.importValidationErrors;
             return errors?.hasValidation && errors.totalErrors > 0 ? errors : null;
         },

         clearImportWarnings() {
             this.$store.config.clearImportWarnings();
         },

         validateImport(jsonData) {
             if (!jsonData) return { warnings: [], mismatches: {}, totalErrors: 0, hasValidation: false };
             return this.$store.config.validateConfigAgainstCsv(jsonData);
         },

         // ========== Phase C: JSON File Upload ==========

         // JSON file upload state
         selectedJsonFileName: '',
         isUploadingConfig: false,

         /**
          * Trigger the JSON file input click
          */
         triggerJsonFileInput() {
             document.getElementById('json-file-input').click();
         },

         /**
          * Handle JSON file selection
          * @param {Event} event - File input change event
          */
         handleJsonFileSelect(event) {
             const file = event.target.files[0];
             if (!file) return;

             // Validate file type
             if (!file.name.toLowerCase().endsWith('.json')) {
                 this.error = 'Please select a JSON file (.json extension)';
                 return;
             }

             this.selectedJsonFileName = file.name;
             this.isUploadingConfig = true;
             this.error = '';

             // Read file content
             const reader = new FileReader();
             reader.onload = (e) => {
                 try {
                     const content = e.target.result;
                     // Validate JSON
                     JSON.parse(content);
                     
                     // Set to textarea and apply
                     this.jsonImportText = content;
                     this.applyJsonImportText();
                     
                     this.successMessage = `Successfully loaded configuration from ${file.name}`;
                 } catch (error) {
                     this.error = `Invalid JSON file: ${error.message}`;
                     this.selectedJsonFileName = '';
                 } finally {
                     this.isUploadingConfig = false;
                     // Reset input so same file can be selected again
                     event.target.value = '';
                 }
             };
             
             reader.onerror = () => {
                 this.error = 'Failed to read file';
                 this.isUploadingConfig = false;
                 this.selectedJsonFileName = '';
                 event.target.value = '';
             };
             
             reader.readAsText(file);
         }
     };
 }

if (typeof window !== 'undefined') {
    window.configEditorComponent = configEditorComponent;
}
