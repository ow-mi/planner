import csv
import os

file_path = 'input_data/gen3_pv/senario_3b_fte_8_sofia_hengelo_project_mw_copy_5_noB/data_test.csv'

# Mapping logic
# key: test_name, value: { 'low': duration (1|2), 'high': duration (3|4) }
mapping = {
    'P-03':   {'low': 21,   'high': 28},
    'P-03-E': {'low': 21,   'high': 28},
    'P-03-L': {'low': 14,   'high': 21},
    'P-02-L': {'low': 3.5,  'high': 3.5},
    'P-02':   {'low': 10.5, 'high': 14}
}

rows = []
with open(file_path, 'r', newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        test_name = row['test']
        try:
            dut_count = float(row['dut_count'])
            dut_count_int = int(dut_count)
        except (ValueError, TypeError):
            rows.append(row)
            continue
            
        if test_name in mapping:
            new_duration = None
            if dut_count_int in [1, 2]:
                new_duration = mapping[test_name]['low']
            elif dut_count_int in [3, 4]:
                new_duration = mapping[test_name]['high']
            
            if new_duration is not None:
                row['duration_days'] = str(new_duration)
                print(f"Updated {test_name} (dut_count={dut_count_int}) to {new_duration}")
        
        rows.append(row)

with open('data_test_updated.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print("File written to data_test_updated.csv")

