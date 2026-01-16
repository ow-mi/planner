import pandas as pd
import random
from datetime import datetime, timedelta
import io

# Your original data (with the typo fixed)
data = """fte_id,available_start_week_iso,available_end_week_iso
fte_sofia_1,2025-W02,2025-W51
fte_sofia_1,2026-W02,2026-W32
fte_sofia_1,2026-W36,2026-W51
fte_sofia_1,2027-W02,2027-W32
fte_sofia_1,2027-W36,2027-W51
fte_sofia_1,2028-W02,2028-W32
fte_sofia_1,2028-W36,2028-W51
fte_sofia_1,2029-W01,2029-W52
fte_sofia_1,2030-W01,2030-W52
fte_sofia_1,2031-W01,2031-W52
fte_sofia_1,2032-W01,2032-W52
fte_sofia_2,2025-W02,2025-W51
fte_sofia_2,2026-W02,2026-W32
fte_sofia_2,2026-W36,2026-W51
fte_sofia_2,2027-W02,2027-W32
fte_sofia_2,2027-W36,2027-W51
fte_sofia_2,2028-W02,2028-W32
fte_sofia_2,2028-W36,2028-W51
fte_sofia_2,2029-W01,2029-W52
fte_sofia_2,2030-W01,2030-W52
fte_sofia_2,2031-W01,2031-W52
fte_sofia_2,2032-W01,2032-W52
fte_sofia_3,2025-W02,2025-W51
fte_sofia_3,2026-W02,2026-W32
fte_sofia_3,2026-W36,2026-W51
fte_sofia_3,2027-W02,2027-W32
fte_sofia_3,2027-W36,2027-W51
fte_sofia_3,2028-W02,2028-W32
fte_sofia_3,2028-W36,2028-W51
fte_sofia_3,2029-W01,2029-W52
fte_sofia_3,2030-W01,2030-W52
fte_sofia_3,2031-W01,2031-W52
fte_sofia_3,2032-W01,2032-W52
fte_sofia_4,2025-W02,2025-W51
fte_sofia_4,2026-W02,2026-W32
fte_sofia_4,2026-W36,2026-W51
fte_sofia_4,2027-W02,2027-W32
fte_sofia_4,2027-W36,2027-W51
fte_sofia_4,2028-W02,2028-W32
fte_sofia_4,2028-W36,2028-W51
fte_sofia_4,2029-W01,2029-W52
fte_sofia_4,2030-W01,2030-W52
fte_sofia_4,2031-W01,2031-W52
fte_sofia_4,2032-W01,2032-W52
fte_hengelo_1,2025-W02,2025-W51
fte_hengelo_1,2026-W02,2026-W32
fte_hengelo_1,2026-W36,2026-W51
fte_hengelo_1,2027-W02,2027-W32
fte_hengelo_1,2027-W36,2027-W51
fte_hengelo_1,2028-W02,2028-W32
fte_hengelo_1,2028-W36,2028-W51
fte_hengelo_1,2029-W01,2029-W52
fte_hengelo_1,2030-W01,2030-W52
fte_hengelo_1,2031-W01,2031-W52
fte_hengelo_1,2032-W01,2032-W52
fte_hengelo_2,2025-W02,2025-W51
fte_hengelo_2,2026-W02,2026-W32
fte_hengelo_2,2026-W36,2026-W51
fte_hengelo_2,2027-W02,2027-W32
fte_hengelo_2,2027-W36,2027-W51
fte_hengelo_2,2028-W02,2028-W32
fte_hengelo_2,2028-W36,2028-W51
fte_hengelo_2,2029-W01,2029-W52
fte_hengelo_2,2030-W01,2030-W52
fte_hengelo_2,2031-W01,2031-W52
fte_hengelo_2,2032-W01,2032-W52
fte_hengelo_3,2025-W02,2025-W51
fte_hengelo_3,2026-W02,2026-W32
fte_hengelo_3,2026-W36,2026-W51
fte_hengelo_3,2027-W02,2027-W32
fte_hengelo_3,2027-W36,2027-W51
fte_hengelo_3,2028-W02,2028-W32
fte_hengelo_3,2028-W36,2028-W51
fte_hengelo_3,2029-W01,2029-W52
fte_hengelo_3,2030-W01,2030-W52
fte_hengelo_3,2031-W01,2031-W52
fte_hengelo_3,2032-W01,2032-W52
fte_hengelo_4,2025-W02,2025-W51
fte_hengelo_4,2026-W02,2026-W32
fte_hengelo_4,2026-W36,2026-W51
fte_hengelo_4,2027-W02,2027-W32
fte_hengelo_4,2027-W36,2027-W51
fte_hengelo_4,2028-W02,2028-W32
fte_hengelo_4,2028-W36,2028-W51
fte_hengelo_4,2029-W01,2029-W52
fte_hengelo_4,2030-W01,2030-W52
fte_hengelo_4,2031-W01,2031-W52
fte_hengelo_4,2032-W01,2032-W52"""

# Parse the data
df = pd.read_csv(io.StringIO(data))

def iso_week_to_date(iso_week_str):
    """Convert ISO week string (YYYY-WNN) to Monday date"""
    year, week = map(int, iso_week_str.split('-W'))
    
    # January 4th is always in week 1 of ISO calendar
    jan4 = datetime(year, 1, 4)
    # Find Monday of week 1
    week1_monday = jan4 - timedelta(days=jan4.weekday())
    # Find Monday of target week
    target_monday = week1_monday + timedelta(weeks=week-1)
    return target_monday

def date_to_iso_week(date_obj):
    """Convert datetime object to ISO week string (YYYY-WNN)"""
    iso_year, iso_week, _ = date_obj.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"

def get_weeks_in_year(year):
    """Get number of ISO weeks in a year"""
    # December 28 is always in the last week of the ISO year
    return datetime(year, 12, 28).isocalendar()[1]

# Calculate total holiday weeks for each FTE
fte_holiday_counts = {}
for fte_id in df['fte_id'].unique():
    fte_data = df[df['fte_id'] == fte_id].copy()
    total_available_weeks = 0
    
    for _, row in fte_data.iterrows():
        start_date = iso_week_to_date(row['available_start_week_iso'])
        end_date = iso_week_to_date(row['available_end_week_iso'])
        weeks_diff = (end_date - start_date).days // 7 + 1
        total_available_weeks += weeks_diff
    
    # Calculate total weeks in period (2025-2032)
    total_period_weeks = 0
    for year in range(2025, 2033):
        total_period_weeks += get_weeks_in_year(year)
    
    holiday_weeks = total_period_weeks - total_available_weeks
    fte_holiday_counts[fte_id] = holiday_weeks

print("Holiday weeks per FTE:")
for fte_id, holidays in fte_holiday_counts.items():
    print(f"{fte_id}: {holidays} holiday weeks")

# Generate all possible weeks in the period
all_weeks = []
for year in range(2025, 2033):
    weeks_in_year = get_weeks_in_year(year)
    for week in range(1, weeks_in_year + 1):
        all_weeks.append(f"{year}-W{week:02d}")

# Randomly redistribute holidays while maintaining the same count
random.seed(42)  # For reproducible results
new_schedule = []

for fte_id in df['fte_id'].unique():
    # Get current holiday count for this FTE
    holiday_count = fte_holiday_counts[fte_id]
    
    # Randomly select holiday weeks
    selected_holidays = set(random.sample(all_weeks, holiday_count))
    
    # Available weeks are all weeks minus holidays
    available_weeks = sorted([week for week in all_weeks if week not in selected_holidays])
    
    # Group consecutive weeks into periods
    if available_weeks:
        current_start = available_weeks[0]
        current_year, current_week = map(int, current_start.split('-W'))
        
        for week_str in available_weeks[1:]:
            year, week = map(int, week_str.split('-W'))
            
            # Check if consecutive (handling year boundaries)
            if (year == current_year and week == current_week + 1) or \
               (year == current_year + 1 and week == 1 and current_week == get_weeks_in_year(current_year)):
                current_week = week
                current_year = year
            else:
                # End current period and start new one
                start_date = iso_week_to_date(current_start)
                end_date = iso_week_to_date(f"{current_year}-W{current_week:02d}")
                
                new_schedule.append({
                    'fte_id': fte_id,
                    'available_start_week_iso': current_start,
                    'available_end_week_iso': date_to_iso_week(end_date)
                })
                current_start = week_str
                current_year = year
                current_week = week
        
        # Add final period
        start_date = iso_week_to_date(current_start)
        end_date = iso_week_to_date(f"{current_year}-W{current_week:02d}")
        
        new_schedule.append({
            'fte_id': fte_id,
            'available_start_week_iso': current_start,
            'available_end_week_iso': date_to_iso_week(end_date)
        })

# Create new dataframe
new_df = pd.DataFrame(new_schedule)

# Sort by FTE and start date
new_df = new_df.sort_values(['fte_id', 'available_start_week_iso'])

print(f"\nOriginal data had {len(df)} periods")
print(f"New data has {len(new_df)} periods")

# Verify that holiday counts are preserved
print("\nVerifying holiday counts:")
for fte_id in new_df['fte_id'].unique():
    fte_data = new_df[new_df['fte_id'] == fte_id]
    total_available = 0
    
    for _, row in fte_data.iterrows():
        start_date = iso_week_to_date(row['available_start_week_iso'])
        end_date = iso_week_to_date(row['available_end_week_iso'])
        weeks_diff = (end_date - start_date).days // 7 + 1
        total_available += weeks_diff
    
    total_period_weeks = sum(get_weeks_in_year(year) for year in range(2025, 2033))
    actual_holidays = total_period_weeks - total_available
    expected_holidays = fte_holiday_counts[fte_id]
    print(f"{fte_id}: Expected {expected_holidays}, Actual {actual_holidays} holiday weeks - {'✓' if actual_holidays == expected_holidays else '✗'}")

# Save to CSV format
output = new_df.to_csv(index=False)
print("\nModified CSV data with randomly distributed holidays:")
print(output)