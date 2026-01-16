# Example script demonstrating holiday handling options
library(tidyverse)
source("gen_senarios_functions.R")

# Sample data
equipment_ids <- c("setup_1", "setup_2")
fte_ids <- c("fte_1", "fte_2")
years <- 2025:2026
holidays <- c("2025-W52", "2026-W01", "2026-W33", "2026-W34", "2026-W35")

cat("=== Basic Holiday Handling ===\n")
basic_equipment <- create_availability(equipment_ids, "equipment_id", years, holidays)
print(basic_equipment)

cat("\n=== Advanced Holiday Handling (with buffer) ===\n")
advanced_equipment <- create_availability_with_holidays(
  equipment_ids, "equipment_id", years, holidays, 
  holiday_buffer_weeks = 1,  # Add 1 week buffer around each holiday
  min_period_weeks = 2       # Only keep periods that are at least 2 weeks long
)
print(advanced_equipment)

cat("\n=== No Holidays (baseline) ===\n")
no_holidays <- create_availability(equipment_ids, "equipment_id", years, NULL)
print(no_holidays)

# Function to visualize availability periods
visualize_availability <- function(availability_df, title) {
  cat(paste0("\n=== ", title, " ===\n"))
  availability_df |>
    group_by(equipment_id) |>
    summarise(
      periods = n(),
      total_weeks = sum(week_difference(available_start_week_iso, available_end_week_iso)),
      .groups = "drop"
    ) |>
    print()
}

visualize_availability(basic_equipment, "Basic Holiday Handling")
visualize_availability(advanced_equipment, "Advanced Holiday Handling")
visualize_availability(no_holidays, "No Holidays")


