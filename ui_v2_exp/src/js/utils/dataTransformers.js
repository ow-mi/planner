/**
 * Data Transformers
 * Utilities for transforming solver results and CSV data to visualization format
 */

/**
 * Transform solver results to visualization format
 * @param {Object} solutionResult - The solver results data
 * @returns {Object} Transformed data with test_schedules, equipment_usage, fte_usage, concurrency_timeseries
 */
function transformSolutionResult(solutionResult) {
    console.log('transformSolutionResult input:', solutionResult);

    // Error handling for malformed solver results
    if (!solutionResult) {
        throw new Error('Solver results data is null or undefined');
    }
    
    // Backend sends 'test_schedule' (singular) but we need 'test_schedules' (plural)
    // Handle both field names for compatibility
    const testSchedulesArray = solutionResult.test_schedules || solutionResult.test_schedule || [];
    
    if (!Array.isArray(testSchedulesArray)) {
        // If test_schedules/test_schedule is missing or not an array, return empty structure
        console.warn('Solver results missing test_schedules/test_schedule array, using empty array', solutionResult);
        return {
            test_schedules: [],
            equipment_usage: [],
            fte_usage: [],
            concurrency_timeseries: []
        };
    }
    
    // Transform SolutionResult JSON to match legacy CSV format
    // This allows templates to work with both formats
    const transformed = {
        test_schedules: testSchedulesArray.map(s => ({
            test_id: s.test_id,
            project_leg_id: s.project_leg_id,
            test_name: s.test_name,
            start_date: s.start_date ? (typeof s.start_date === 'string' ? s.start_date : s.start_date.toISOString().split('T')[0]) : null,
            start_time: s.start_date ? (typeof s.start_date === 'string' ? s.start_date.split('T')[1]?.split('.')[0] || '00:00:00' : '00:00:00') : '00:00:00',
            end_date: s.end_date ? (typeof s.end_date === 'string' ? s.end_date : s.end_date.toISOString().split('T')[0]) : null,
            end_time: s.end_date ? (typeof s.end_date === 'string' ? s.end_date.split('T')[1]?.split('.')[0] || '00:00:00' : '00:00:00') : '00:00:00',
            assigned_equipment_id: Array.isArray(s.assigned_equipment) ? s.assigned_equipment[0] : (s.assigned_equipment || ''),
            assigned_fte_id: Array.isArray(s.assigned_fte) ? s.assigned_fte[0] : (s.assigned_fte || ''),
            assigned_equipment: Array.isArray(s.assigned_equipment) ? s.assigned_equipment.join(';') : (s.assigned_equipment || ''),
            assigned_fte: Array.isArray(s.assigned_fte) ? s.assigned_fte.join(';') : (s.assigned_fte || '')
        })),
        equipment_usage: generateEquipmentUsage(solutionResult, testSchedulesArray),
        fte_usage: generateFTEUsage(solutionResult, testSchedulesArray),
        concurrency_timeseries: generateConcurrencyTimeseries(solutionResult, testSchedulesArray)
    };
    return transformed;
}

/**
 * Generate equipment usage data from solution results
 * @param {Object} solutionResult - The solver results data
 * @param {Array} testSchedulesArray - Optional array of test schedules
 * @returns {Array} Equipment usage array with equipment_id, test_id, test_name, start_date, end_date
 */
function generateEquipmentUsage(solutionResult, testSchedulesArray = null) {
    const usage = [];
    const schedules = testSchedulesArray || solutionResult.test_schedules || solutionResult.test_schedule || [];
    schedules.forEach(schedule => {
        const equipmentList = Array.isArray(schedule.assigned_equipment) ? schedule.assigned_equipment : [schedule.assigned_equipment].filter(Boolean);
        equipmentList.forEach(eqId => {
            usage.push({
                equipment_id: eqId,
                test_id: schedule.test_id,
                test_name: schedule.test_name,
                start_date: schedule.start_date ? (typeof schedule.start_date === 'string' ? schedule.start_date : schedule.start_date.toISOString().split('T')[0]) : null,
                end_date: schedule.end_date ? (typeof schedule.end_date === 'string' ? schedule.end_date : schedule.end_date.toISOString().split('T')[0]) : null
            });
        });
    });
    return usage;
}

/**
 * Generate FTE usage data from solution results
 * @param {Object} solutionResult - The solver results data
 * @param {Array} testSchedulesArray - Optional array of test schedules
 * @returns {Array} FTE usage array with fte_id, test_id, test_name, start_date, end_date
 */
function generateFTEUsage(solutionResult, testSchedulesArray = null) {
    const usage = [];
    const schedules = testSchedulesArray || solutionResult.test_schedules || solutionResult.test_schedule || [];
    schedules.forEach(schedule => {
        const fteList = Array.isArray(schedule.assigned_fte) ? schedule.assigned_fte : [schedule.assigned_fte].filter(Boolean);
        fteList.forEach(fteId => {
            usage.push({
                fte_id: fteId,
                test_id: schedule.test_id,
                test_name: schedule.test_name,
                start_date: schedule.start_date ? (typeof schedule.start_date === 'string' ? schedule.start_date : schedule.start_date.toISOString().split('T')[0]) : null,
                end_date: schedule.end_date ? (typeof schedule.end_date === 'string' ? schedule.end_date : schedule.end_date.toISOString().split('T')[0]) : null
            });
        });
    });
    return usage;
}

/**
 * Generate concurrency timeseries from solution results
 * @param {Object} solutionResult - The solver results data
 * @param {Array} testSchedulesArray - Optional array of test schedules
 * @returns {Array} Concurrency timeseries array with timestamp, active_tests, available_fte, available_equipment, capacity_min
 */
function generateConcurrencyTimeseries(solutionResult, testSchedulesArray = null) {
    // Simplified concurrency timeseries - in production this would be more sophisticated
    const timeseries = [];
    const schedules = testSchedulesArray || solutionResult.test_schedules || solutionResult.test_schedule || [];
    
    if (schedules.length === 0) return timeseries;
    
    // Get date range
    const dates = schedules.flatMap(s => [
        s.start_date ? (typeof s.start_date === 'string' ? new Date(s.start_date) : new Date(s.start_date)) : null,
        s.end_date ? (typeof s.end_date === 'string' ? new Date(s.end_date) : new Date(s.end_date)) : null
    ]).filter(Boolean);
    
    if (dates.length === 0) return timeseries;
    
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    // Generate daily timestamps
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
        const timestamp = new Date(d);
        let activeTests = 0;
        
        schedules.forEach(s => {
            const start = s.start_date ? new Date(s.start_date) : null;
            const end = s.end_date ? new Date(s.end_date) : null;
            if (start && end && timestamp >= start && timestamp < end) {
                activeTests++;
            }
        });
        
        timeseries.push({
            timestamp: timestamp.toISOString(),
            active_tests: activeTests,
            available_fte: 10, // Placeholder - would need resource data
            available_equipment: 10, // Placeholder
            capacity_min: 10 // Placeholder
        });
    }
    
    return timeseries;
}

/**
 * Transform CSV rows to visualization format
 * @param {Array} csvRows - Array of CSV row objects
 * @returns {Object} Transformed data with test_schedules, equipment_usage, fte_usage, concurrency_timeseries
 */
function transformCSVData(csvRows) {
    // Transform CSV rows to TransformedVisualizationData format
    const testSchedules = csvRows.map(row => {
        // Parse dates and validate format
        let startDate = null;
        let endDate = null;
        
        try {
            if (row.start_date) {
                const start = new Date(row.start_date);
                if (isNaN(start.getTime())) {
                    throw new Error(`Invalid start_date format: ${row.start_date}`);
                }
                startDate = start.toISOString().split('T')[0];
            }
        } catch (err) {
            throw new Error(`Date parsing error for start_date: ${err.message}`);
        }
        
        try {
            if (row.end_date) {
                const end = new Date(row.end_date);
                if (isNaN(end.getTime())) {
                    throw new Error(`Invalid end_date format: ${row.end_date}`);
                }
                endDate = end.toISOString().split('T')[0];
            }
        } catch (err) {
            throw new Error(`Date parsing error for end_date: ${err.message}`);
        }
        
        // Parse equipment and FTE lists (comma or semicolon separated)
        const parseList = (str) => {
            if (!str) return [];
            return str.split(/[,;]/).map(s => s.trim()).filter(Boolean);
        };
        
        const equipmentList = parseList(row.assigned_equipment || '');
        const fteList = parseList(row.assigned_fte || '');
        
        return {
            test_id: row.test_id || '',
            project_leg_id: row.project_leg_id || '',
            test_name: row.test_name || row.test_id || '',
            start_date: startDate,
            start_time: '00:00:00',
            end_date: endDate,
            end_time: '00:00:00',
            assigned_equipment_id: equipmentList[0] || '',
            assigned_fte_id: fteList[0] || '',
            assigned_equipment: equipmentList.join(';'),
            assigned_fte: fteList.join(';')
        };
    });
    
    // Generate equipment usage, FTE usage, and concurrency timeseries
    const equipmentUsage = [];
    const fteUsage = [];
    
    testSchedules.forEach(schedule => {
        const equipmentList = schedule.assigned_equipment ? schedule.assigned_equipment.split(';').filter(Boolean) : [];
        const fteList = schedule.assigned_fte ? schedule.assigned_fte.split(';').filter(Boolean) : [];
        
        equipmentList.forEach(eqId => {
            equipmentUsage.push({
                equipment_id: eqId,
                test_id: schedule.test_id,
                test_name: schedule.test_name,
                start_date: schedule.start_date,
                end_date: schedule.end_date
            });
        });
        
        fteList.forEach(fteId => {
            fteUsage.push({
                fte_id: fteId,
                test_id: schedule.test_id,
                test_name: schedule.test_name,
                start_date: schedule.start_date,
                end_date: schedule.end_date
            });
        });
    });
    
    // Generate concurrency timeseries
    const concurrencyTimeseries = generateConcurrencyTimeseriesFromSchedules(testSchedules);
    
    return {
        test_schedules: testSchedules,
        equipment_usage: equipmentUsage,
        fte_usage: fteUsage,
        concurrency_timeseries: concurrencyTimeseries
    };
}

/**
 * Generate concurrency timeseries from test schedules array
 * @param {Array} testSchedules - Array of test schedule objects
 * @returns {Array} Concurrency timeseries array with timestamp, active_tests, available_fte, available_equipment, capacity_min
 */
function generateConcurrencyTimeseriesFromSchedules(testSchedules) {
    const timeseries = [];
    
    if (testSchedules.length === 0) return timeseries;
    
    // Get date range
    const dates = testSchedules.flatMap(s => {
        const dates = [];
        if (s.start_date) dates.push(new Date(s.start_date));
        if (s.end_date) dates.push(new Date(s.end_date));
        return dates;
    }).filter(Boolean);
    
    if (dates.length === 0) return timeseries;
    
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    // Generate daily timestamps
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
        const timestamp = new Date(d);
        let activeTests = 0;
        
        testSchedules.forEach(s => {
            const start = s.start_date ? new Date(s.start_date) : null;
            const end = s.end_date ? new Date(s.end_date) : null;
            if (start && end && timestamp >= start && timestamp < end) {
                activeTests++;
            }
        });
        
        timeseries.push({
            timestamp: timestamp.toISOString(),
            active_tests: activeTests,
            available_fte: 10, // Placeholder
            available_equipment: 10, // Placeholder
            capacity_min: 10 // Placeholder
        });
    }
    
    return timeseries;
}

// Export for use in stores and components
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        transformSolutionResult,
        generateEquipmentUsage,
        generateFTEUsage,
        generateConcurrencyTimeseries,
        transformCSVData,
        generateConcurrencyTimeseriesFromSchedules
    };
}
