# ui_v2_exp Playwright Smoke Report

- Timestamp: 20260211_122017
- Base URL: http://localhost:4174/index.html
- Data Dir: /home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan

## Reset Browser Session
```bash
playwright-cli close-all
```
```text
```

## Open App
```bash
playwright-cli open --browser=chromium http://localhost:4174/index.html
```
```text
### Browser `default` opened with pid 32326.
- default:
  - browser-type: chromium
  - user-data-dir: <in-memory>
  - headed: false
---
### Ran Playwright code
```js
await page.goto('http://localhost:4174/index.html');
```
### Page
- Page URL: http://localhost:4174/index.html
- Page Title: Priority Configuration Editor v2
### Snapshot
- [Snapshot](.playwright-cli/page-2026-02-11T11-20-19-220Z.yml)
```

## Baseline Snapshot
```bash
playwright-cli snapshot
```
```text
### Page
- Page URL: http://localhost:4174/index.html
- Page Title: Priority Configuration Editor v2
### Snapshot
- [Snapshot](.playwright-cli/page-2026-02-11T11-20-19-296Z.yml)
```

## Keyboard Nav Test
```bash
playwright-cli click e8 && playwright-cli press ArrowRight && playwright-cli eval "location.hash" && playwright-cli snapshot
```
```text
### Ran Playwright code
```js
await page.getByRole('tab', { name: 'Edit Data' }).click();
```
### Page
- Page URL: http://localhost:4174/index.html#edit_data
- Page Title: Priority Configuration Editor v2
### Snapshot
- [Snapshot](.playwright-cli/page-2026-02-11T11-20-21-437Z.yml)
### Ran Playwright code
```js
// Press ArrowRight
await page.keyboard.press('ArrowRight');
```
### Page
- Page URL: http://localhost:4174/index.html#batch
- Page Title: Priority Configuration Editor v2
### Result
"#batch"
### Ran Playwright code
```js
await page.evaluate('() => (location.hash)');
```
### Page
- Page URL: http://localhost:4174/index.html#batch
- Page Title: Priority Configuration Editor v2
### Snapshot
- [Snapshot](.playwright-cli/page-2026-02-11T11-20-22-741Z.yml)
```

## Upload All CSV Fixtures
```bash
playwright-cli run-code "async page => { await page.locator('input[type=file]').first().setInputFiles(['/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan/data_equipment.csv','/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan/data_fte.csv','/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan/data_legs.csv','/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan/data_test.csv','/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan/data_test_duts.csv']); await page.waitForTimeout(400); }"
```
```text
### Ran Playwright code
```js
await (async page => { await page.locator('input[type=file]').first().setInputFiles(['/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan/data_equipment.csv','/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan/data_fte.csv','/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan/data_legs.csv','/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan/data_test.csv','/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan/data_test_duts.csv']); await page.waitForTimeout(400); })(page);
```
```

## Storage After Upload
```bash
playwright-cli localstorage-get uploadedFiles && playwright-cli localstorage-get parsedCsvData
```
```text
### Result
localStorage key 'uploadedFiles' not found
### Ran Playwright code
```js
await page.evaluate(() => localStorage.getItem('uploadedFiles'));
```
### Result
parsedCsvData={"data_equipment.csv":{"headers":["equipment_id","available_start_week_iso","available_end_week_iso"],"rows":[["setup_sofia_1","2025-W02","2032-W51"],["setup_sofia_2","2025-W02","2032-W51"],["setup_sofia_3","2025-W02","2032-W51"],["setup_sofia_4","2025-W02","2032-W51"],["setup_hengelo_1","2025-W02","2032-W51"],["setup_hengelo_2","2025-W02","2032-W51"],["setup_hengelo_3","2025-W02","2032-W51"],["setup_hengelo_4","2025-W02","2032-W51"]]},"data_fte.csv":{"headers":["fte_id","available_start_week_iso","available_end_week_iso"],"rows":[["fte_hengelo_1","2025-W01","2025-W36"],["fte_hengelo_1","2025-W38","2025-W40"],["fte_hengelo_1","2025-W42","2025-W51"],["fte_hengelo_1","2026-W01","2026-W31"],["fte_hengelo_1","2026-W33","2027-W02"],["fte_hengelo_1","2027-W04","2027-W14"],["fte_hengelo_1","2027-W16","2027-W31"],["fte_hengelo_1","2027-W33","2027-W37"],["fte_hengelo_1","2027-W39","2027-W43"],["fte_hengelo_1","2027-W45","2028-W24"],["fte_hengelo_1","2028-W26","2028-W29"],["fte_hengelo_1","2028-W31","2028-W32"],["fte_hengelo_1","2028-W34","2028-W37"],["fte_hengelo_1","2028-W39","2029-W23"],["fte_hengelo_1","2029-W25","2031-W12"],["fte_hengelo_1","2031-W14","2031-W18"],["fte_hengelo_1","2031-W20","2031-W30"],["fte_hengelo_1","2031-W32","2031-W36"],["fte_hengelo_1","2031-W38","2031-W46"],["fte_hengelo_1","2031-W48","2032-W53"],["fte_hengelo_2","2025-W01","2025-W28"],["fte_hengelo_2","2025-W30","2026-W31"],["fte_hengelo_2","2026-W33","2026-W35"],["fte_hengelo_2","2026-W37","2027-W07"],["fte_hengelo_2","2027-W09","2027-W20"],["fte_hengelo_2","2027-W22","2027-W33"],["fte_hengelo_2","2027-W35","2028-W09"],["fte_hengelo_2","2028-W11","2028-W37"],["fte_hengelo_2","2028-W39","2029-W27"],["fte_hengelo_2","2029-W29","2030-W12"],["fte_hengelo_2","2030-W14","2030-W24"],["fte_hengelo_2","2030-W26","2030-W50"],["fte_hengelo_2","2030-W52","2031-W12"],["fte_hengelo_2","2031-W14","2031-W14"],["fte_hengelo_2","2031-W16","2031-W37"],["fte_hengelo_2","2031-W39","2031-W39"],["fte_hengelo_2","2031-W41","2032-W08"],["fte_hengelo_2","2032-W10","2032-W28"],["fte_hengelo_2","2032-W30","2032-W32"],["fte_hengelo_2","2032-W34","2032-W53"],["fte_sofia_1","2025-W01","2025-W12"],["fte_sofia_1","2025-W14","2025-W15"],["fte_sofia_1","2025-W18","2025-W44"],["fte_sofia_1","2025-W46","2025-W47"],["fte_sofia_1","2025-W49","2025-W52"],["fte_sofia_1","2026-W02","2026-W05"],["fte_sofia_1","2026-W07","2026-W19"],["fte_sofia_1","2026-W21","2027-W06"],["fte_sofia_1","2027-W08","2027-W09"],["fte_sofia_1","2027-W11","2027-W20"],["fte_sofia_1","2027-W22","2027-W35"],["fte_sofia_1","2027-W37","2029-W07"],["fte_sofia_1","2029-W09","2030-W18"],["fte_sofia_1","2030-W20","2030-W41"],["fte_sofia_1","2030-W43","2031-W14"],["fte_sofia_1","2031-W16","2031-W33"],["fte_sofia_1","2031-W35","2032-W12"],["fte_sofia_1","2032-W14","2032-W14"],["fte_sofia_1","2032-W16","2032-W53"],["fte_sofia_2","2025-W01","2025-W03"],["fte_sofia_2","2025-W05","2025-W13"],["fte_sofia_2","2025-W15","2026-W49"],["fte_sofia_2","2026-W51","2027-W07"],["fte_sofia_2","2027-W09","2027-W14"],["fte_sofia_2","2027-W16","2027-W37"],["fte_sofia_2","2027-W39","2029-W05"],["fte_sofia_2","2029-W07","2029-W20"],["fte_sofia_2","2029-W22","2029-W49"],["fte_sofia_2","2029-W51","2030-W18"],["fte_sofia_2","2030-W20","2030-W26"],["fte_sofia_2","2030-W28","2030-W40"],["fte_sofia_2","2030-W42","2030-W47"],["fte_sofia_2","2030-W49","2031-W19"],["fte_sofia_2","2031-W21","2031-W46"],["fte_sofia_2","2031-W48","2032-W01"],["fte_sofia_2","2032-W03","2032-W23"],["fte_sofia_2","2032-W25","2032-W47"],["fte_sofia_2","2032-W49","2032-W49"],["fte_sofia_2","2032-W51","2032-W53"],["fte_sofia_3","2025-W02","2025-W51"],["fte_sofia_3","2026-W02","2026-W32"],["fte_sofia_3","2026-W36","2026-W51"],["fte_sofia_3","2027-W02","2027-W32"],["fte_sofia_3","2027-W36","2027-W51"],["fte_sofia_3","2028-W02","2028-W32"],["fte_sofia_3","2028-W36","2028-W51"],["fte_sofia_3","2029-W01","2029-W52"],["fte_sofia_3","2030-W01","2030-W52"],["fte_sofia_3","2031-W01","2031-W52"],["fte_sofia_3","2032-W01","2032-W52"],["fte_sofia_4","2025-W02","2025-W51"],["fte_sofia_4","2026-W02","2026-W32"],["fte_sofia_4","2026-W36","2026-W51"],["fte_sofia_4","2027-W02","2027-W32"],["fte_sofia_4","2027-W36","2027-W51"],["fte_sofia_4","2028-W02","2028-W32"],["fte_sofia_4","2028-W36","2028-W51"],["fte_sofia_4","2029-W01","2029-W52"],["fte_sofia_4","2030-W01","2030-W52"],["fte_sofia_4","2031-W01","2031-W52"],["fte_sofia_4","2032-W01","2032-W52"],["fte_hengelo_3","2025-W02","2025-W51"],["fte_hengelo_3","2026-W02","2026-W32"],["fte_hengelo_3","2026-W36","2026-W51"],["fte_hengelo_3","2027-W02","2027-W32"],["fte_hengelo_3","2027-W36","2027-W51"],["fte_hengelo_3","2028-W02","2028-W32"],["fte_hengelo_3","2028-W36","2028-W51"],["fte_hengelo_3","2029-W01","2029-W52"],["fte_hengelo_3","2030-W01","2030-W52"],["fte_hengelo_3","2031-W01","2031-W52"],["fte_hengelo_3","2032-W01","2032-W52"],["fte_hengelo_4","2025-W02","2025-W51"],["fte_hengelo_4","2026-W02","2026-W32"],["fte_hengelo_4","2026-W36","2026-W51"],["fte_hengelo_4","2027-W02","2027-W32"],["fte_hengelo_4","2027-W36","2027-W51"],["fte_hengelo_4","2028-W02","2028-W32"],["fte_hengelo_4","2028-W36","2028-W51"],["fte_hengelo_4","2029-W01","2029-W52"],["fte_hengelo_4","2030-W01","2030-W52"],["fte_hengelo_4","2031-W01","2031-W52"],["fte_hengelo_4","2032-W01","2032-W52"]]},"data_legs.csv":{"headers":["project_id","project_name","project_leg_id","leg_number","leg_name","priority","start_iso_week"],"rows":[["mwcu_a7","mwcu_a7","mwcu_a7_6","6","Water protection","8","2026-W40"],["mwcu_a7","mwcu_a7","mwcu_a7_5.1","5.1","Sequence","7","2026-W40"],["mwcu_a7","mwcu_a7","mwcu_a7_4.1","4","Sequence","5","2026-W40"],["mwcu_a7","mwcu_a7","mwcu_a7_4.2","4","Sequence","5","2027-W02"],["mwcu_a7","mwcu_a7","mwcu_a7_5.2.1","5.2","Sequence","7","2027-W02"],["mwcu_a7","mwcu_a7","mwcu_a7_5.2.2","5.2","Sequence","7","2027-W02"],["mwcu_a7","mwcu_a7","mwcu_a7_3.1","3","Sequence","6","2027-W02"],["mwcu_a7","mwcu_a7","mwcu_a7_3.2","3","Sequence","6","2027-W22"],["mwcu_a7","mwcu_a7","mwcu_a7_2.1","2.1","Life","3","2027-W13"],["mwcu_a7","mwcu_a7","mwcu_a7_2.2","2.2","VDA","2","2027-W13"],["mwcu_a7","mwcu_a7","mwcu_a7_7.1","7","Sequence","8","2027-W02"],["mwcu_a7","mwcu_a7","mwcu_a7_7.2","7","Sequence","8","2027-W02"]]},"data_test.csv":{"headers":["project_leg_id","sequence_index","test","duration_days","fte_time_pct","fte_assigned","equipment_assigned","test_id","test_description","completion_pct","fte_required","equipment_required","force_start_week_iso","project_id","leg_num","dut_count"],"rows":[["mwcu_a7_2.1","1","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_Leak","Leak","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","2","K-01","4.2","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_K-01","High/low Temperature Storage","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","3","K-04","8.4","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_K-04","Repainting Temperature","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","4","P-03","28","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","5","K-02","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_K-02","Temperature Step","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","6","K-05","42","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_K-05","Thermal Shock","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","7","P-03-L","21","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-03-L","Parameter Test Large Limited","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","8","K-06","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_K-06","Salt Spray","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","9","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","10","K-09","21","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_K-09","Damp Heat, Cyclic","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","11","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_Leak","Leak","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","12","P-03-L","21","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-03-L","Parameter Test Large Limited","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","13","K-03","4.2","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_K-03","Low Temperature Operation","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","14","P-02","14","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-02","Parameter Test Small","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","15","M-05","8.4","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_M-05","Mechanical Shock","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","16","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","17","M-04","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_M-04","Vibration","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","18","P-03","28","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","19","HV S","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_HV S","HV Safety","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","20","M-03","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_M-03","Dust (IP6X)","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","21","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","22","K-10","6","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_K-10","Water Protection (IPX6K)","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","23","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","24","K-11","6","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_K-11","Steam Jet (IPX9K)","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","25","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","26","K-12","25.2","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_K-12","Thermal Shock Splash Water","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","27","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","28","K-02","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_K-02","Temperature Step","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","29","P-03-E","28","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-03-E","Parameter Test Large Extended","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","30","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_Leak","Leak","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","31","Rep","14","0","fte_hengelo","setup_hengelo","mwcu_a7_2.1_Rep","Physical Analysis","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.1","32","P-04","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.1_P-04","Physical Analysis","0","1","1","*","mwcu_a7","2.1","3"],["mwcu_a7_2.2","1","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_Leak","Leak","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","2","K-01","4.2","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_K-01","High/low Temperature Storage","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","3","K-04","8.4","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_K-04","Repainting Temperature","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","4","P-03","28","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","5","K-02","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_K-02","Temperature Step","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","6","K-05","42","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_K-05","Thermal Shock","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","7","P-03-L","21","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-03-L","Parameter Test Large Limited","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","8","K-06","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_K-06","Salt Spray","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","9","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","10","K-09","21","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_K-09","Damp Heat, Cyclic","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","11","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_Leak","Leak","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","12","P-03-L","21","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-03-L","Parameter Test Large Limited","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","13","K-03","4.2","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_K-03","Low Temperature Operation","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","14","P-02","14","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-02","Parameter Test Small","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","15","M-05","8.4","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_M-05","Mechanical Shock","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","16","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","17","M-04","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_M-04","Vibration","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","18","P-03","28","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","19","HV S","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_HV S","HV Safety","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","20","M-03","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_M-03","Dust (IP6X)","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","21","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","22","K-10","6","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_K-10","Water Protection (IPX6K)","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","23","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","24","K-11","6","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_K-11","Steam Jet (IPX9K)","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","25","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","26","K-12","25.2","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_K-12","Thermal Shock Splash Water","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","27","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","28","K-02","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_K-02","Temperature Step","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","29","P-03-E","28","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-03-E","Parameter Test Large Extended","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","30","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_Leak","Leak","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","31","Rep","14","0","fte_hengelo","setup_hengelo","mwcu_a7_2.2_Rep","Physical Analysis","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_2.2","32","P-04","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_2.2_P-04","Physical Analysis","0","1","1","*","mwcu_a7","2.2","3"],["mwcu_a7_3.1","1","Leak","3.6","100","fte_sofia","setup_sofia","mwcu_a7_3.1_Leak","Leak","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.1","2","K-01","4.2","100","fte_sofia","setup_sofia","mwcu_a7_3.1_K-01","High/low Temperature Storage","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.1","3","K-02","16.8","100","fte_sofia","setup_sofia","mwcu_a7_3.1_K-02","Temperature Step","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.1","4","P-03","28","100","fte_sofia","setup_sofia","mwcu_a7_3.1_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.1","5","L-03","104.4","20","fte_sofia","setup_sofia","mwcu_a7_3.1_L-03","Temperature Cycle Endurance [0% - 25%]","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.1","8","P-03","28","100","fte_sofia","setup_sofia","mwcu_a7_3.1_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.1","9","L-03","104.4","20","fte_sofia","setup_sofia","mwcu_a7_3.1_L-03","Temperature Cycle Endurance [50% - 75%]","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.1","14","K-02","16.8","100","fte_sofia","setup_sofia","mwcu_a7_3.1_K-02","Temperature Step","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.1","15","P-03-E","28","100","fte_sofia","setup_sofia","mwcu_a7_3.1_P-03-E","Extended Tests of P-03-E","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.1","16","Leak","3.6","100","fte_sofia","setup_sofia","mwcu_a7_3.1_Leak","Leak","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.1","17","Rep","14","0","fte_sofia","setup_sofia","mwcu_a7_3.1_Rep","Physical Analysis","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.1","18","P-04","16.8","100","fte_sofia","setup_sofia","mwcu_a7_3.1_P-04","Physical Analysis","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.2","1","Leak","3.6","100","fte_sofia","setup_sofia","mwcu_a7_3.2_Leak","Leak","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.2","2","K-01","4.2","100","fte_sofia","setup_sofia","mwcu_a7_3.2_K-01","High/low Temperature Storage","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.2","3","K-02","16.8","100","fte_sofia","setup_sofia","mwcu_a7_3.2_K-02","Temperature Step","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.2","4","P-03","28","100","fte_sofia","setup_sofia","mwcu_a7_3.2_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.2","5","L-03","104.4","20","fte_sofia","setup_sofia","mwcu_a7_3.2_L-03","Temperature Cycle Endurance [0% - 25%]","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.2","8","P-03","28","100","fte_sofia","setup_sofia","mwcu_a7_3.2_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.2","9","L-03","104.4","20","fte_sofia","setup_sofia","mwcu_a7_3.2_L-03","Temperature Cycle Endurance [50% - 75%]","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.2","14","K-02","16.8","100","fte_sofia","setup_sofia","mwcu_a7_3.2_K-02","Temperature Step","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.2","15","P-03-E","28","100","fte_sofia","setup_sofia","mwcu_a7_3.2_P-03-E","Extended Tests of P-03-E","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.2","16","Leak","3.6","100","fte_sofia","setup_sofia","mwcu_a7_3.2_Leak","Leak","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.2","17","Rep","14","0","fte_sofia","setup_sofia","mwcu_a7_3.2_Rep","Physical Analysis","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_3.2","18","P-04","16.8","100","fte_sofia","setup_sofia","mwcu_a7_3.2_P-04","Physical Analysis","0","1","1","*","mwcu_a7","3","3"],["mwcu_a7_4.1","1","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_4.1_Leak","Leak","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.1","2","K-01","4.2","100","fte_hengelo","setup_hengelo","mwcu_a7_4.1_K-01","High/low Temperature Storage","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.1","3","P-03","28","100","fte_hengelo","setup_hengelo","mwcu_a7_4.1_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.1","4","VDA","63","20","fte_hengelo","setup_hengelo","mwcu_a7_4.1_VDA","VDA 233-102 Corrosion","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.1","5","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_4.1_Leak","Leak","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.1","6","P-03-E","28","100","fte_hengelo","setup_hengelo","mwcu_a7_4.1_P-03-E","Parameter Test Large Extended","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.1","7","Rep","14","0","fte_hengelo","setup_hengelo","mwcu_a7_4.1_Rep","Physical Analysis","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.1","8","P-04","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_4.1_P-04","Physical Analysis","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.2","1","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_4.2_Leak","Leak","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.2","2","K-01","4.2","100","fte_hengelo","setup_hengelo","mwcu_a7_4.2_K-01","High/low Temperature Storage","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.2","3","P-03","28","100","fte_hengelo","setup_hengelo","mwcu_a7_4.2_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.2","4","VDA","63","20","fte_hengelo","setup_hengelo","mwcu_a7_4.2_VDA","VDA 233-102 Corrosion","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.2","5","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_4.2_Leak","Leak","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.2","6","P-03-E","28","100","fte_hengelo","setup_hengelo","mwcu_a7_4.2_P-03-E","Parameter Test Large Extended","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.2","7","Rep","14","0","fte_hengelo","setup_hengelo","mwcu_a7_4.2_Rep","Physical Analysis","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_4.2","8","P-04","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_4.2_P-04","Physical Analysis","0","1","1","*","mwcu_a7","4","3"],["mwcu_a7_5.1","1","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_5.1_Leak","Leak","0","1","1","*","mwcu_a7","5.1","4"],["mwcu_a7_5.1","2","K-01","4.2","100","fte_hengelo","setup_hengelo","mwcu_a7_5.1_K-01","High/low Temperature Storage","0","1","1","*","mwcu_a7","5.1","4"],["mwcu_a7_5.1","3","P-03","28","100","fte_hengelo","setup_hengelo","mwcu_a7_5.1_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","5.1","4"],["mwcu_a7_5.1","4","M-07","14","100","fte_hengelo","setup_hengelo","mwcu_a7_5.1_M-07","Pressure Change Coolant Circuit","0","1","1","*","mwcu_a7","5.1","4"],["mwcu_a7_5.1","5","P-02","14","100","fte_hengelo","setup_hengelo","mwcu_a7_5.1_P-02","Parameter Test Small","0","1","1","*","mwcu_a7","5.1","4"],["mwcu_a7_5.1","6","C-01","25.2","100","fte_hengelo","setup_hengelo","mwcu_a7_5.1_C-01","Chemicals","0","1","1","*","mwcu_a7","5.1","4"],["mwcu_a7_5.1","7","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_5.1_Leak","Leak","0","1","1","*","mwcu_a7","5.1","4"],["mwcu_a7_5.1","8","P-03-E","28","100","fte_hengelo","setup_hengelo","mwcu_a7_5.1_P-03-E","Parameter Test Large Extended","0","1","1","*","mwcu_a7","5.1","4"],["mwcu_a7_5.1","9","Rep","14","0","fte_hengelo","setup_hengelo","mwcu_a7_5.1_Rep","Physical Analysis","0","1","1","*","mwcu_a7","5.1","4"],["mwcu_a7_5.1","10","P-04","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_5.1_P-04","Physical Analysis","0","1","1","*","mwcu_a7","5.1","4"],["mwcu_a7_5.2.1","1","Leak","3.6","100","fte_sofia","setup_sofia","mwcu_a7_5.2.1_Leak","Leak","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.1","2","K-01","4.2","100","fte_sofia","setup_sofia","mwcu_a7_5.2.1_K-01","High/low Temperature Storage","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.1","3","P-03","28","100","fte_sofia","setup_sofia","mwcu_a7_5.2.1_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.1","4","K-14","30","100","fte_sofia","setup_sofia","mwcu_a7_5.2.1_K-14","Damp Heat, Steady State","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.1","5","Leak","3.6","100","fte_sofia","setup_sofia","mwcu_a7_5.2.1_Leak","Leak","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.1","6","P-03-E","28","100","fte_sofia","setup_sofia","mwcu_a7_5.2.1_P-03-E","Parameter Test Large Extended","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.1","7","Rep","14","0","fte_sofia","setup_sofia","mwcu_a7_5.2.1_Rep","Physical Analysis","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.1","8","P-04","16.8","100","fte_sofia","setup_sofia","mwcu_a7_5.2.1_P-04","Physical Analysis","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.2","1","Leak","3.6","100","fte_sofia","setup_sofia","mwcu_a7_5.2.2_Leak","Leak","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.2","2","K-01","4.2","100","fte_sofia","setup_sofia","mwcu_a7_5.2.2_K-01","High/low Temperature Storage","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.2","3","P-03","28","100","fte_sofia","setup_sofia","mwcu_a7_5.2.2_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.2","4","K-14","30","100","fte_sofia","setup_sofia","mwcu_a7_5.2.2_K-14","Damp Heat, Steady State","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.2","5","Leak","3.6","100","fte_sofia","setup_sofia","mwcu_a7_5.2.2_Leak","Leak","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.2","6","P-03-E","28","100","fte_sofia","setup_sofia","mwcu_a7_5.2.2_P-03-E","Parameter Test Large Extended","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.2","7","Rep","14","0","fte_sofia","setup_sofia","mwcu_a7_5.2.2_Rep","Physical Analysis","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_5.2.2","8","P-04","16.8","100","fte_sofia","setup_sofia","mwcu_a7_5.2.2_P-04","Physical Analysis","0","1","1","*","mwcu_a7","5.2","3"],["mwcu_a7_6","1","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_6_Leak","Leak","0","1","1","*","mwcu_a7","6","4"],["mwcu_a7_6","2","K-01","4.2","100","fte_hengelo","setup_hengelo","mwcu_a7_6_K-01","High/low Temperature Storage","0","1","1","*","mwcu_a7","6","4"],["mwcu_a7_6","3","P-03","28","100","fte_hengelo","setup_hengelo","mwcu_a7_6_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","6","4"],["mwcu_a7_6","4","K-10","6","100","fte_hengelo","setup_hengelo","mwcu_a7_6_K-10","Water Protection (IPX6K)","0","1","1","*","mwcu_a7","6","4"],["mwcu_a7_6","5","K-11","6","100","fte_hengelo","setup_hengelo","mwcu_a7_6_K-11","Steam Jet (IPX9K)","0","1","1","*","mwcu_a7","6","4"],["mwcu_a7_6","6","P-02-L","3.5","100","fte_hengelo","setup_hengelo","mwcu_a7_6_P-02-L","Parameter Test Small Limited","0","1","1","*","mwcu_a7","6","4"],["mwcu_a7_6","7","K-12","25.2","100","fte_hengelo","setup_hengelo","mwcu_a7_6_K-12","Thermal Shock Splash Water","0","1","1","*","mwcu_a7","6","4"],["mwcu_a7_6","8","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_6_Leak","Leak","0","1","1","*","mwcu_a7","6","4"],["mwcu_a7_6","9","P-03-E","28","100","fte_hengelo","setup_hengelo","mwcu_a7_6_P-03-E","Parameter Test Large Extended","0","1","1","*","mwcu_a7","6","4"],["mwcu_a7_6","10","Rep","14","0","fte_hengelo","setup_hengelo","mwcu_a7_6_Rep","Physical Analysis","0","1","1","*","mwcu_a7","6","4"],["mwcu_a7_6","11","P-04","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_6_P-04","Physical Analysis","0","1","1","*","mwcu_a7","6","4"],["mwcu_a7_7.1","1","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_7.1_Leak","Leak","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.1","2","K-01","4.2","100","fte_hengelo","setup_hengelo","mwcu_a7_7.1_K-01","High/low Temperature Storage","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.1","3","K-02","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_7.1_K-02","Temperature Step","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.1","4","P-03","28","100","fte_hengelo","setup_hengelo","mwcu_a7_7.1_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.1","5","L-02","168","20","fte_hengelo","setup_hengelo","mwcu_a7_7.1_L-02","Temperature Cycle Endurance [0% - 25%]","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.1","8","P-03","28","100","fte_hengelo","setup_hengelo","mwcu_a7_7.1_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.1","9","L-02","168","20","fte_hengelo","setup_hengelo","mwcu_a7_7.1_L-02","Temperature Cycle Endurance [50% - 75%]","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.1","13","K-02","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_7.1_K-02","Temperature Step","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.1","14","P-03-E","28","100","fte_hengelo","setup_hengelo","mwcu_a7_7.1_P-03-E","Extended Tests of P-03-E","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.1","15","Leak","3.6","100","fte_hengelo","setup_hengelo","mwcu_a7_7.1_Leak","Leak","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.1","16","Rep","14","0","fte_hengelo","setup_hengelo","mwcu_a7_7.1_Rep","Physical Analysis","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.1","17","P-04","16.8","100","fte_hengelo","setup_hengelo","mwcu_a7_7.1_P-04","Physical Analysis","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.2","1","Leak","3.6","100","fte_sofia","setup_sofia","mwcu_a7_7.2_Leak","Leak","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.2","2","K-01","4.2","100","fte_sofia","setup_sofia","mwcu_a7_7.2_K-01","High/low Temperature Storage","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.2","3","K-02","16.8","100","fte_sofia","setup_sofia","mwcu_a7_7.2_K-02","Temperature Step","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.2","4","P-03","28","100","fte_sofia","setup_sofia","mwcu_a7_7.2_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.2","5","L-02","168","20","fte_sofia","setup_sofia","mwcu_a7_7.2_L-02","Temperature Cycle Endurance [0% - 25%]","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.2","8","P-03","28","100","fte_sofia","setup_sofia","mwcu_a7_7.2_P-03","Parameter Test Large","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.2","9","L-02","168","20","fte_sofia","setup_sofia","mwcu_a7_7.2_L-02","Temperature Cycle Endurance [50% - 75%]","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.2","13","K-02","16.8","100","fte_sofia","setup_sofia","mwcu_a7_7.2_K-02","Temperature Step","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.2","14","P-03-E","28","100","fte_sofia","setup_sofia","mwcu_a7_7.2_P-03-E","Extended Tests of P-03-E","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.2","15","Leak","3.6","100","fte_sofia","setup_sofia","mwcu_a7_7.2_Leak","Leak","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.2","16","Rep","14","0","fte_sofia","setup_sofia","mwcu_a7_7.2_Rep","Physical Analysis","0","1","1","*","mwcu_a7","7","3"],["mwcu_a7_7.2","17","P-04","16.8","100","fte_sofia","setup_sofia","mwcu_a7_7.2_P-04","Physical Analysis","0","1","1","*","mwcu_a7","7","3"]]},"data_test_duts.csv":{"headers":["test_id","dut_id"],"rows":[["mwcu_b10_2.1_Leak","1"],["mwcu_b10_2.1_K-01","1"],["mwcu_b10_2.1_K-04","1"],["mwcu_b10_2.1_P-03","1"],["mwcu_b10_2.1_K-02","1"],["mwcu_b10_2.1_K-05","1"],["mwcu_b10_2.1_P-03-L","1"],["mwcu_b10_2.1_K-06","1"],["mwcu_b10_2.1_P-02-L","1"],["mwcu_b10_2.1_K-09","1"],["mwcu_b10_2.1_K-03","1"],["mwcu_b10_2.1_P-02","1"],["mwcu_b10_2.1_M-05","1"],["mwcu_b10_2.1_M-04","1"],["mwcu_b10_2.1_HV S","1"],["mwcu_b10_2.1_M-03","1"],["mwcu_b10_2.1_K-10","1"],["mwcu_b10_2.1_K-11","1"],["mwcu_b10_2.1_K-12","1"],["mwcu_b10_2.1_P-03-E","1"],["mwcu_b10_2.1_P-04","1"],["mwcu_b10_2.2_Leak","1"],["mwcu_b10_2.2_K-01","1"],["mwcu_b10_2.2_K-04","1"],["mwcu_b10_2.2_P-03","1"],["mwcu_b10_2.2_K-02","1"],["mwcu_b10_2.2_K-05","1"],["mwcu_b10_2.2_P-03-L","1"],["mwcu_b10_2.2_K-06","1"],["mwcu_b10_2.2_P-02-L","1"],["mwcu_b10_2.2_K-09","1"],["mwcu_b10_2.2_K-03","1"],["mwcu_b10_2.2_P-02","1"],["mwcu_b10_2.2_M-05","1"],["mwcu_b10_2.2_M-04","1"],["mwcu_b10_2.2_P-03-E","1"],["mwcu_b10_2.2_HV S","1"],["mwcu_b10_2.2_P-04","1"],["mwcu_b10_3_Leak","1"],["mwcu_b10_3_K-01","1"],["mwcu_b10_3_K-02","1"],["mwcu_b10_3_P-03","1"],["mwcu_b10_3_L-03","1"],["mwcu_b10_3_P-02","1"],["mwcu_b10_3_P-03-E","1"],["mwcu_b10_3_P-04","1"],["mwcu_b10_4_Leak","1"],["mwcu_b10_4_K-01","1"],["mwcu_b10_4_P-03","1"],["mwcu_b10_4_VDA","1"],["mwcu_b10_4_Leakage","1"],["mwcu_b10_4_P-03-E","1"],["mwcu_b10_4_P-04","1"],["mwcu_b10_5_Leak","1"],["mwcu_b10_5_K-01","1"],["mwcu_b10_5_P-03","1"],["mwcu_b10_5_M-07","1"],["mwcu_b10_5_P-02","1"],["mwcu_b10_5_C-01","1"],["mwcu_b10_5a_P-02-L","1"],["mwcu_b10_5a_K-14","1"],["mwcu_b10_5a_Leak","1"],["mwcu_b10_5a_P-03-E","1"],["mwcu_b10_5b_P-03-E","1"],["mwcu_b10_5b_P-04","1"],["mwcu_b10_6_Leak","1"],["mwcu_b10_6_K-01","1"],["mwcu_b10_6_P-03","1"],["mwcu_b10_6_K-10","1"],["mwcu_b10_6_K-11","1"],["mwcu_b10_6_P-02-L","1"],["mwcu_b10_6_K-12","1"],["mwcu_b10_6_P-03-E","1"],["mwcu_b10_6_P-04","1"],["mwcu_b10_7_Leak","1"],["mwcu_b10_7_K-01","1"],["mwcu_b10_7_K-02","1"],["mwcu_b10_7_P-03","1"],["mwcu_b10_7_L-02","1"],["mwcu_b10_7_P-03-E","1"],["mwcu_b10_7_P-04","1"],["mwcu_a7_2.1_Leak","1"],["mwcu_a7_2.1_K-01","1"],["mwcu_a7_2.1_K-04","1"],["mwcu_a7_2.1_P-03","1"],["mwcu_a7_2.1_K-02","1"],["mwcu_a7_2.1_K-05","1"],["mwcu_a7_2.1_P-03-L","1"],["mwcu_a7_2.1_K-06","1"],["mwcu_a7_2.1_P-02-L","1"],["mwcu_a7_2.1_K-09","1"],["mwcu_a7_2.1_K-03","1"],["mwcu_a7_2.1_P-02","1"],["mwcu_a7_2.1_M-05","1"],["mwcu_a7_2.1_M-04","1"],["mwcu_a7_2.1_HV S","1"],["mwcu_a7_2.1_M-03","1"],["mwcu_a7_2.1_K-10","1"],["mwcu_a7_2.1_K-11","1"],["mwcu_a7_2.1_K-12","1"],["mwcu_a7_2.1_P-03-E","1"],["mwcu_a7_2.1_P-04","1"],["mwcu_a7_2.2_Leak","1"],["mwcu_a7_2.2_K-01","1"],["mwcu_a7_2.2_K-04","1"],["mwcu_a7_2.2_P-03","1"],["mwcu_a7_2.2_K-02","1"],["mwcu_a7_2.2_K-05","1"],["mwcu_a7_2.2_P-03-L","1"],["mwcu_a7_2.2_K-06","1"],["mwcu_a7_2.2_P-02-L","1"],["mwcu_a7_2.2_K-09","1"],["mwcu_a7_2.2_K-03","1"],["mwcu_a7_2.2_P-02","1"],["mwcu_a7_2.2_M-05","1"],["mwcu_a7_2.2_M-04","1"],["mwcu_a7_2.2_P-03-E","1"],["mwcu_a7_2.2_HV S","1"],["mwcu_a7_2.2_P-04","1"],["mwcu_a7_3_Leak","1"],["mwcu_a7_3_K-01","1"],["mwcu_a7_3_K-02","1"],["mwcu_a7_3_P-03","1"],["mwcu_a7_3_L-03","1"],["mwcu_a7_3_P-02","1"],["mwcu_a7_3_P-03-E","1"],["mwcu_a7_3_P-04","1"],["mwcu_a7_4_Leak","1"],["mwcu_a7_4_K-01","1"],["mwcu_a7_4_P-03","1"],["mwcu_a7_4_VDA","1"],["mwcu_a7_4_Leakage","1"],["mwcu_a7_4_P-03-E","1"],["mwcu_a7_4_P-04","1"],["mwcu_a7_5_Leak","1"],["mwcu_a7_5_K-01","1"],["mwcu_a7_5_P-03","1"],["mwcu_a7_5_M-07","1"],["mwcu_a7_5_P-02","1"],["mwcu_a7_5_C-01","1"],["mwcu_a7_5a_P-02-L","1"],["mwcu_a7_5a_K-14","1"],["mwcu_a7_5a_Leak","1"],["mwcu_a7_5a_P-03-E","1"],["mwcu_a7_5b_P-03-E","1"],["mwcu_a7_5b_P-04","1"],["mwcu_a7_6_Leak","1"],["mwcu_a7_6_K-01","1"],["mwcu_a7_6_P-03","1"],["mwcu_a7_6_K-10","1"],["mwcu_a7_6_K-11","1"],["mwcu_a7_6_P-02-L","1"],["mwcu_a7_6_K-12","1"],["mwcu_a7_6_P-03-E","1"],["mwcu_a7_6_P-04","1"],["mwcu_a7_7_Leak","1"],["mwcu_a7_7_K-01","1"],["mwcu_a7_7_K-02","1"],["mwcu_a7_7_P-03","1"],["mwcu_a7_7_L-02","1"],["mwcu_a7_7_P-03-E","1"],["mwcu_a7_7_P-04","1"]]}}
### Ran Playwright code
```js
await page.evaluate(() => localStorage.getItem('parsedCsvData'));
```
```

## Edit Data State
```bash
playwright-cli click e8 && playwright-cli snapshot
```
```text
### Ran Playwright code
```js
await page.getByRole('tab', { name: 'Edit Data' }).click();
```
### Page
- Page URL: http://localhost:4174/index.html#edit_data
- Page Title: Priority Configuration Editor v2
### Snapshot
- [Snapshot](.playwright-cli/page-2026-02-11T11-20-25-533Z.yml)
### Page
- Page URL: http://localhost:4174/index.html#edit_data
- Page Title: Priority Configuration Editor v2
### Snapshot
- [Snapshot](.playwright-cli/page-2026-02-11T11-20-25-593Z.yml)
```

## Select data_equipment.csv
```bash
playwright-cli run-code "async page => { const sel = page.locator('select').first(); await sel.selectOption({ label: 'data_equipment.csv' }); await page.waitForTimeout(150); }" && playwright-cli snapshot
```
```text
### Ran Playwright code
```js
await (async page => { const sel = page.locator('select').first(); await sel.selectOption({ label: 'data_equipment.csv' }); await page.waitForTimeout(150); })(page);
```
### Page
- Page URL: http://localhost:4174/index.html#edit_data
- Page Title: Priority Configuration Editor v2
### Snapshot
- [Snapshot](.playwright-cli/page-2026-02-11T11-20-26-917Z.yml)
```

## Row Counts Baseline
```bash
playwright-cli eval "document.querySelectorAll('table tbody tr').length" && playwright-cli eval "JSON.parse(localStorage.getItem('parsedCsvData'))['data_equipment.csv'].rows.length"
```
```text
### Result
83
### Ran Playwright code
```js
await page.evaluate('() => (document.querySelectorAll(\'table tbody tr\').length)');
```
### Result
8
### Ran Playwright code
```js
await page.evaluate('() => (JSON.parse(localStorage.getItem(\'parsedCsvData\'))[\'data_equipment.csv\'].rows.length)');
```
```

## Add Row Once
```bash
playwright-cli run-code "async page => { await page.getByRole('button', { name: 'Add Row' }).click(); await page.waitForTimeout(150); }" && playwright-cli eval "document.querySelectorAll('table tbody tr').length" && playwright-cli eval "JSON.parse(localStorage.getItem('parsedCsvData'))['data_equipment.csv'].rows.length"
```
```text
### Ran Playwright code
```js
await (async page => { await page.getByRole('button', { name: 'Add Row' }).click(); await page.waitForTimeout(150); })(page);
```
### Result
86
### Ran Playwright code
```js
await page.evaluate('() => (document.querySelectorAll(\'table tbody tr\').length)');
```
### Result
11
### Ran Playwright code
```js
await page.evaluate('() => (JSON.parse(localStorage.getItem(\'parsedCsvData\'))[\'data_equipment.csv\'].rows.length)');
```
```

## Remove Selected Row Attempt
```bash
playwright-cli run-code "async page => { await page.locator('table tbody tr').first().click(); await page.waitForTimeout(100); await page.getByRole('button', { name: 'Remove Selected Row' }).click({ timeout: 1500 }); await page.waitForTimeout(100); }" && playwright-cli eval "JSON.parse(localStorage.getItem('parsedCsvData'))['data_equipment.csv'].rows.length"
```
```text
### Error
TimeoutError: locator.click: Timeout 1500ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: 'Remove Selected Row' })[22m
[2m    - locator resolved to <button disabled="disabled" class="btn btn-danger" @click="removeSelectedRow()" :disabled="selectedRowIndex === -1">Remove Selected Row</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not enabled[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not enabled[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    3 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not enabled[22m
[2m    - retrying click action[22m
[2m      - waiting 500ms[22m

### Result
11
### Ran Playwright code
```js
await page.evaluate('() => (JSON.parse(localStorage.getItem(\'parsedCsvData\'))[\'data_equipment.csv\'].rows.length)');
```
```

## Reload Persistence Check
```bash
playwright-cli reload && playwright-cli click e8 && playwright-cli run-code "async page => { const sel = page.locator('select').first(); await sel.selectOption({ label: 'data_equipment.csv' }); await page.waitForTimeout(150); }" && playwright-cli eval "document.querySelectorAll('table tbody tr').length" && playwright-cli eval "JSON.parse(localStorage.getItem('parsedCsvData'))['data_equipment.csv'].rows.length"
```
```text
### Ran Playwright code
```js
await page.reload();
```
### Page
- Page URL: http://localhost:4174/index.html#edit_data
- Page Title: Priority Configuration Editor v2
### Snapshot
- [Snapshot](.playwright-cli/page-2026-02-11T11-20-35-462Z.yml)
### Ran Playwright code
```js
await page.getByRole('tab', { name: 'Edit Data' }).click();
```
### Page
- Page URL: http://localhost:4174/index.html#edit_data
- Page Title: Priority Configuration Editor v2
### Snapshot
- [Snapshot](.playwright-cli/page-2026-02-11T11-20-36-577Z.yml)
### Ran Playwright code
```js
await (async page => { const sel = page.locator('select').first(); await sel.selectOption({ label: 'data_equipment.csv' }); await page.waitForTimeout(150); })(page);
```
### Result
11
### Ran Playwright code
```js
await page.evaluate('() => (document.querySelectorAll(\'table tbody tr\').length)');
```
### Result
11
### Ran Playwright code
```js
await page.evaluate('() => (JSON.parse(localStorage.getItem(\'parsedCsvData\'))[\'data_equipment.csv\'].rows.length)');
```
```

## JSON Upload Runtime Check
```bash
playwright-cli click e9 && playwright-cli run-code "async page => { const jsonInput = page.locator('input[type=file][accept*=\"json\"]').first(); await jsonInput.setInputFiles('/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan/priority_config.json'); await page.waitForTimeout(300); }" && playwright-cli console
```
```text
### Ran Playwright code
```js
await page.getByRole('tab', { name: 'Configuration' }).click();
```
### Page
- Page URL: http://localhost:4174/index.html#configuration
- Page Title: Priority Configuration Editor v2
### Snapshot
- [Snapshot](.playwright-cli/page-2026-02-11T11-20-42-139Z.yml)
### Ran Playwright code
```js
await (async page => { const jsonInput = page.locator('input[type=file][accept*="json"]').first(); await jsonInput.setInputFiles('/home/omv/general/planner/test_data/06_leg_4+4_start_all_in_jan/priority_config.json'); await page.waitForTimeout(300); })(page);
```
### Page
- Page URL: http://localhost:4174/index.html#configuration
- Page Title: Priority Configuration Editor v2
- Console: 0 errors, 3 warnings
### Events
- New console entries: .playwright-cli/console-2026-02-11T11-20-18-632Z.log#L1-L3
### Result
- [Console](.playwright-cli/console-2026-02-11T11-20-43-605Z.log)
```

## Close Browser
```bash
playwright-cli close
```
```text
Browser 'default' closed

```

