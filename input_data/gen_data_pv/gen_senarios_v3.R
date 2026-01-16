# Cleaned and Refactored Scenario Generator
# Removes all project-specific differences and DCC-related code

library(tidyverse)
library(jsonlite)
library(magrittr)
library(rlang)

source("gen_senarios_functions.R")

# Load data
df_test <- read_csv("data_test.csv")
df_leg <- read_csv("data_legs.csv")

# Configuration
projects <- c("mwcu_b10", "mwcu_a7")

# Duration mapping
dur_dic <- c(
  "PT" = 2, "Leak" = 3, "P-02-L" = 5, "K-11" = 5, "P-04" = 14, "K-01" = 3.5,
  "K-04" = 7, "P-03" = 28, "K-02" = 14, "K-05" = 35, "P-03-L" = 28, "P-03-E" = 28,
  "K-06" = 14, "K-09" = 17.5, "K-03" = 3.5, "P-02" = 5, "M-05" = 7, "M-04" = 14,
  "HV S" = 14, "M-03" = 14, "K-10" = 5, "K-12" = 21, "P-02-E" = 28, "L-03" = 43.5,
  "VDA" = 8, "Leakage" = 7, "M-07" = 28, "C-01" = 21, "K-14" = 25, "L-02" = 70,
  "NA" = 0, "T-Saf" = 28
)

# Time configuration
years <- 2025:2032
holidays <- c(
  "2025-W52", "2026-W01", "2026-W33", "2026-W34", "2026-W35", "2026-W52", 
  "2027-W01", "2027-W33", "2027-W34", "2027-W35", "2027-W52", "2028-W01", 
  "2028-W33", "2028-W34", "2028-W35", "2028-W52"
)

# Helper function to filter data based on project and leg criteria
filter_data <- function(df, project_filter = NULL, leg_filter = NULL) {
  result <- df
  
  if (!is.null(project_filter)) {
    result <- result %>% filter(!!sym("project_id") %in% project_filter)
  }
  
  if (!is.null(leg_filter)) {
    if ("leg_number" %in% names(result)) {
      result <- result %>% filter(!!sym("leg_number") %in% leg_filter)
    } else if ("leg_num" %in% names(result)) {
      result <- result %>% filter(!!sym("leg_num") %in% leg_filter)
    } else {
      warning("No leg column found in data frame, skipping leg filtering")
    }
  }
  
  return(result)
}

# Generate base data
generate_base_data <- function() {
  df_legs <- map_dfr(projects, ~ process_legs(df_leg, .x))
  
  df_tests <- map_dfr(projects, ~ process_tests(df_test, .x, dur_dic)) |> 
    mutate(
      duration_days = duration_days * 1.2,
      duration_days = duration_days |> round(2)
    )
  
  # Create DUTs data
  df_duts <- df_tests %>%
    select(test_id) %>%
    distinct() %>%
    mutate(dut_id = 1)
  
  return(list(legs = df_legs, tests = df_tests, duts = df_duts))
}

# Create scenario configuration
create_scenario <- function(name, equipment, fte, project_filter, leg_filter) {
  list(
    name = name,
    equipment = equipment,
    fte = fte,
    fte_assigned = "*",
    project_filter = project_filter,
    leg_filter = leg_filter
  )
}

# Generate scenario data
generate_scenario_data <- function(scenario, base_data) {
  out_folder <- paste0("../gen3_pv/", scenario$name)
  
  # Clean and create output folder
  if (dir.exists(out_folder)) {
    unlink(out_folder, recursive = TRUE)
  }
  dir.create(out_folder, recursive = TRUE)
  
  # Apply filters
  filtered_legs <- filter_data(
    base_data$legs, 
    scenario$project_filter, 
    scenario$leg_filter
  )
  
  filtered_tests <- filter_data(
    base_data$tests,
    scenario$project_filter,
    scenario$leg_filter
  ) %>%
    mutate(leg_num = as.character(leg_num))
  
  # Write output files
  write_csv(filtered_legs, paste0(out_folder, "/data_legs.csv"))
  
  test_data <- filtered_tests %>% 
    mutate(fte_assigned = scenario$fte_assigned)
  write_csv(test_data, paste0(out_folder, "/data_test.csv"))
  
  write_csv(
    create_availability(scenario$equipment, "equipment_id", years, holidays), 
    paste0(out_folder, "/data_equipment.csv")
  )
  
  write_csv(
    create_availability(scenario$fte, "fte_id", years, holidays), 
    paste0(out_folder, "/data_fte.csv")
  )
  
  filtered_duts <- base_data$duts %>% 
    filter(test_id %in% filtered_tests$test_id)
  write_csv(filtered_duts, paste0(out_folder, "/data_test_duts.csv"))
  
  # Write priority config
  write_json(
    list(
      priority_mode = "leg_priority", 
      description = "Finish testing program as quickly as possible - minimizes total project duration"
    ),
    paste0(out_folder, "/priority_config.json"), 
    pretty = TRUE
  )
}

# Main execution
main <- function() {
  # Generate base data
  base_data <- generate_base_data()
  
  # Define scenarios
  scenarios <- list(
    create_scenario(
      name = "senario_3b_fte_8_sofia_hengelo_project_mw",
      equipment = c(paste0("setup_sofia_", 1:4), paste0("setup_hengelo_", 1:4)),
      fte = c(paste0("fte_sofia_", 1:4), paste0("fte_hengelo_", 1:4)),
      project_filter = c("mwcu_b10", "mwcu_a7"),
      leg_filter = c(3, "3a", "3b", 4, "4a", "4b", 5, "5a", "5b", 6, 2.1, 2.2, 7)
    )
  )
  
  # Generate all scenarios
  walk(scenarios, ~ generate_scenario_data(.x, base_data))
}

# Run the main function
main()
