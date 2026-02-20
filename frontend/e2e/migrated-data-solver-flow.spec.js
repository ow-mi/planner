import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (char === ',' && !inQuotes) {
            cells.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    cells.push(current);
    return cells;
}

test('upload migrated CSV, configure resources, create run, execute solver', async ({ page }) => {
    const sampleFile = path.resolve(__dirname, '../../sample_data/migrated_data.csv');
    const csvContent = fs.readFileSync(sampleFile, 'utf-8').trim();
    const csvLines = csvContent.split(/\r?\n/);
    const headers = parseCsvLine(csvLines[0]);
    const records = csvLines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const record = {};
        headers.forEach((header, idx) => {
            record[header] = values[idx] ?? '';
        });
        return record;
    });

    let executePayload = null;
    let statusCalls = 0;

    await page.route('http://localhost:8000/api/solver/execute', async (route) => {
        const request = route.request();
        executePayload = request.postDataJSON();
        await route.fulfill({
            status: 202,
            contentType: 'application/json',
            body: JSON.stringify({
                execution_id: 'exec-e2e-1',
                status: 'PENDING',
                queue_position: 0,
                message: 'Solver execution queued successfully'
            })
        });
    });

    await page.route('http://localhost:8000/api/v1/files/upload', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                data: {
                    file_id: 'upload-1',
                    filename: 'migrated_data.csv',
                    file_type: 'spreadsheet',
                    extension: '.csv',
                    size_bytes: csvContent.length,
                    parsed_data: {
                        type: 'spreadsheet',
                        columns: headers,
                        data: records
                    }
                }
            })
        });
    });

    await page.route('http://localhost:8000/api/solver/status/exec-e2e-1', async (route) => {
        statusCalls += 1;
        const status = statusCalls >= 2 ? 'COMPLETED' : 'RUNNING';
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                execution_id: 'exec-e2e-1',
                status,
                progress_percentage: status === 'COMPLETED' ? 100 : 35,
                elapsed_time_seconds: status === 'COMPLETED' ? 2.2 : 0.8,
                current_phase: status === 'COMPLETED' ? 'Completed' : 'Running solver'
            })
        });
    });

    await page.route('http://localhost:8000/api/solver/results/exec-e2e-1', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                execution_id: 'exec-e2e-1',
                status: 'FEASIBLE',
                makespan: 12,
                test_schedule: [],
                resource_utilization: {},
                output_files: {
                    'tests_schedule.csv': 'test_id,project_leg_id\\n'
                },
                output_root: '/tmp',
                written_output_paths: {},
                solver_stats: {
                    solve_time: 2.2,
                    objective_value: 100
                }
            })
        });
    });

    // SSE endpoint can fail; solver store falls back to polling.
    await page.route('http://localhost:8000/api/solver/execute/exec-e2e-1/stream**', async (route) => {
        await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'stream unavailable for e2e mock' })
        });
    });

    await page.goto('/index.html');

    await page.locator('#tab-data').click();
    await page.setInputFiles('#file-upload-input', sampleFile);
    await expect(page.locator('.uploaded-file-item .file-name', { hasText: 'migrated_data.csv' })).toBeVisible();

    await page.locator('#tab-configuration').click();
    await page.waitForTimeout(250);
    await page.evaluate(() => {
        const config = window.Alpine.store('config');
        config.addFteResource('alice', 'Alice');
        config.addFteResource('bob', 'Bob');
        config.addEquipmentResource('rig_1', 'Rig 1');
        config.addEquipmentResource('rig_2', 'Rig 2');
        config.addAliasGroup('team_alpha', ['alice', 'bob']);
        config.addEquipmentAliasGroup('lab_rigs', ['rig_1', 'rig_2']);
        config.addDefaultResource('fte', 'team_alpha');
        config.addDefaultResource('equipment', 'lab_rigs');
    });

    await page.locator('#tab-solver').click();
    await page.getByRole('button', { name: /Add/i }).click();
    await page.getByRole('button', { name: /^Create$/i }).click();
    await page.locator('button:visible', { hasText: 'Run Scenario' }).first().click();

    await expect
        .poll(() => executePayload !== null, { timeout: 30000 })
        .toBeTruthy();

    expect(executePayload).toBeTruthy();
    expect(executePayload.input_data).toBeTruthy();
    expect(executePayload.input_data.tables).toBeTruthy();

    const tableKeys = Object.keys(executePayload.input_data.tables).sort();
    expect(tableKeys).toEqual(['equipment', 'fte', 'legs', 'test_duts', 'tests']);

    const firstTestRow = executePayload.input_data.tables.tests.rows[0];
    expect(firstTestRow[7]).toContain('fte_alice');
    expect(firstTestRow[7]).toContain('fte_bob');
    expect(firstTestRow[8]).toContain('setup_rig_1');
    expect(firstTestRow[8]).toContain('setup_rig_2');

    await expect(page.getByText('No input data found. Please import a folder first.')).toHaveCount(0);
});
