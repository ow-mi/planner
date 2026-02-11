#!/usr/bin/env bash
set -u

BASE_URL="${1:-http://localhost:4174/index.html}"
DATA_DIR="${2:-/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan}"
REPORT_DIR="${3:-/home/omv/general/planner/ui_v2_exp/qa_reports}"
TS="$(date +%Y%m%d_%H%M%S)"
REPORT_FILE="${REPORT_DIR}/playwright_smoke_${TS}.md"

mkdir -p "${REPORT_DIR}"

run_step() {
  local title="$1"
  local cmd="$2"
  echo "## ${title}" >>"${REPORT_FILE}"
  echo '```bash' >>"${REPORT_FILE}"
  echo "${cmd}" >>"${REPORT_FILE}"
  echo '```' >>"${REPORT_FILE}"
  echo '```text' >>"${REPORT_FILE}"
  bash -lc "${cmd}" >>"${REPORT_FILE}" 2>&1 || true
  echo '```' >>"${REPORT_FILE}"
  echo >>"${REPORT_FILE}"
}

echo "# ui_v2_exp Playwright Smoke Report" >"${REPORT_FILE}"
echo >>"${REPORT_FILE}"
echo "- Timestamp: ${TS}" >>"${REPORT_FILE}"
echo "- Base URL: ${BASE_URL}" >>"${REPORT_FILE}"
echo "- Data Dir: ${DATA_DIR}" >>"${REPORT_FILE}"
echo >>"${REPORT_FILE}"

run_step "Reset Browser Session" "playwright-cli close-all"
run_step "Open App" "playwright-cli open --browser=chromium ${BASE_URL}"
run_step "Baseline Snapshot" "playwright-cli snapshot"

run_step "Keyboard Nav Test" "playwright-cli click e8 && playwright-cli press ArrowRight && playwright-cli eval \"location.hash\" && playwright-cli snapshot"

run_step "Upload All CSV Fixtures" "playwright-cli run-code \"async page => { await page.locator('input[type=file]').first().setInputFiles(['${DATA_DIR}/data_equipment.csv','${DATA_DIR}/data_fte.csv','${DATA_DIR}/data_legs.csv','${DATA_DIR}/data_test.csv','${DATA_DIR}/data_test_duts.csv']); await page.waitForTimeout(400); }\""

run_step "Storage After Upload" "playwright-cli localstorage-get uploadedFiles && playwright-cli localstorage-get parsedCsvData"

run_step "Edit Data State" "playwright-cli click e8 && playwright-cli snapshot"

run_step "Select data_equipment.csv" "playwright-cli run-code \"async page => { const sel = page.locator('select').first(); await sel.selectOption({ label: 'data_equipment.csv' }); await page.waitForTimeout(150); }\" && playwright-cli snapshot"

run_step "Row Counts Baseline" "playwright-cli eval \"document.querySelectorAll('table tbody tr').length\" && playwright-cli eval \"JSON.parse(localStorage.getItem('parsedCsvData'))['data_equipment.csv'].rows.length\""

run_step "Add Row Once" "playwright-cli run-code \"async page => { await page.getByRole('button', { name: 'Add Row' }).click(); await page.waitForTimeout(150); }\" && playwright-cli eval \"document.querySelectorAll('table tbody tr').length\" && playwright-cli eval \"JSON.parse(localStorage.getItem('parsedCsvData'))['data_equipment.csv'].rows.length\""

run_step "Remove Selected Row Attempt" "playwright-cli run-code \"async page => { await page.locator('table tbody tr').first().click(); await page.waitForTimeout(100); await page.getByRole('button', { name: 'Remove Selected Row' }).click({ timeout: 1500 }); await page.waitForTimeout(100); }\" && playwright-cli eval \"JSON.parse(localStorage.getItem('parsedCsvData'))['data_equipment.csv'].rows.length\""

run_step "Reload Persistence Check" "playwright-cli reload && playwright-cli click e8 && playwright-cli run-code \"async page => { const sel = page.locator('select').first(); await sel.selectOption({ label: 'data_equipment.csv' }); await page.waitForTimeout(150); }\" && playwright-cli eval \"document.querySelectorAll('table tbody tr').length\" && playwright-cli eval \"JSON.parse(localStorage.getItem('parsedCsvData'))['data_equipment.csv'].rows.length\""

run_step "JSON Upload Runtime Check" "playwright-cli click e9 && playwright-cli run-code \"async page => { const jsonInput = page.locator('input[type=file][accept*=\\\"json\\\"]').first(); await jsonInput.setInputFiles('${DATA_DIR}/priority_config.json'); await page.waitForTimeout(300); }\" && playwright-cli console"

run_step "Close Browser" "playwright-cli close"

echo "Report written to: ${REPORT_FILE}"
