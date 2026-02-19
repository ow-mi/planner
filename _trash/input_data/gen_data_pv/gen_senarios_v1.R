library(tidyverse)
library(jsonlite)
library(magrittr)  # For pipe operator (%>%)
library(rlang)     # For sym function
source("gen_senarios_functions.R")

df_test <- read_csv("data_test.csv")
df_leg <- read_csv("data_legs.csv")

# Configuration
projects <- c("mwcu_b10", "mwcu_a7")
# projects <- c("mwcu_b10")

dur_dic <- c(
  "PT" = 2, "Leak" = 3, "P-02-L" = 5, "K-11" = 5, "P-04" = 14, "K-01" = 3.5,
  "K-04" = 7, "P-03" = 28, "K-02" = 14, "K-05" = 35, "P-03-L" = 28, "P-03-E" = 28,
  "K-06" = 14, "K-09" = 17.5, "K-03" = 3.5, "P-02" = 5, "M-05" = 7, "M-04" = 14,
  "HV S" = 14, "M-03" = 14, "K-10" = 5, "K-12" = 21, "P-02-E" = 28, "L-03" = 25,
  "VDA" = 8, "Leakage" = 7, "M-07" = 28, "C-01" = 21, "K-14" = 25, "L-02" = 25,
  "NA" = 0, "T-Saf" = 28
)

years <- 2025:2032
holidays <- c("2025-W52", "2026-W01", "2026-W33", "2026-W34", "2026-W35", "2026-W52", 
              "2027-W01", "2027-W33", "2027-W34", "2027-W35", "2027-W52", "2028-W01", 
              "2028-W33", "2028-W34", "2028-W35", "2028-W52")

# Helper function to filter data based on project and leg criteria
# @param df: data frame to filter (must contain project_id and either leg_number or leg_num columns)
# @param project_filter: vector of project IDs to include, or NULL for all
# @param leg_filter: vector of leg numbers to include, or NULL for all
filter_data <- function(df, project_filter = NULL, leg_filter = NULL) {
  result <- df
  
  if (!is.null(project_filter)) {
    result <- result %>% filter(!!sym("project_id") %in% project_filter)
  }
  
  if (!is.null(leg_filter)) {
    # Check which leg column exists in the data frame
    if ("leg_number" %in% names(result)) {
      result <- result %>% filter(!!sym("leg_number") %in% leg_filter)
    } else if ("leg_num" %in% names(result)) {
      result <- result %>% filter(!!sym("leg_num") %in% leg_filter)
    } else {
      # If neither leg column exists, skip leg filtering
      warning("No leg column found in data frame, skipping leg filtering")
    }
  }
  
  return(result)
}

# Generate base data
df_legs <- map_dfr(projects, ~ process_legs(df_leg, .x))
df_tests <- map_dfr(projects, ~ process_tests(df_test, .x, dur_dic)) 


# Create proper test_duts data based on actual test_ids
df_duts <- df_tests %>%
  select(test_id) %>%
  distinct() %>%
  mutate(dut_id = 1)

filtering_legs <- c(3, "3a", "3b", 4, "4a", "4b", 5, "5a", "5b", 6, 2, "2a", "2b", 7)
# filtering_legs <- c(3, 4, 5, 6, 2)
filtering_projects <- projects

# Scenarios with filtering options
scenarios <- list(
  list(
    name = "senario_2b_fte_4_project_mw", 
    equipment = paste0("setup_sofia_", 1:4),
    fte = paste0("fte_sofia_", 1:4),
    fte_assigned = "*",
    project_filter = c("mwcu_b10", "mwcu_a7"),
    leg_filter = filtering_legs
  ),
  list(
    name = "senario_3b_fte_8_sofia_hengelo_project_mw", 
    equipment = c(paste0("setup_sofia_", 1:4), paste0("setup_hengelo_", 1:4)),
    fte = c(paste0("fte_sofia_", 1:4), paste0("fte_hengelo_", 1:4)),
    fte_assigned = "*",
    project_filter = c("mwcu_b10", "mwcu_a7"),
    leg_filter = filtering_legs
  ),
  list(
    name = "senario_4b_fte_4_hengelo_project_mw", 
    equipment = paste0("setup_hengelo_", 1:6),
    fte = paste0("fte_hengelo_", 1:4),
    fte_assigned = "fte_hengelo",
    project_filter = c("mwcu_b10", "mwcu_a7"),
    leg_filter = filtering_legs
  ),
  list(
    name = "senario_5b_fte_8_hengelo_project_mw", 
    equipment = c(paste0("setup_sofia_", 1:8), paste0("setup_sofia_large"), paste0("setup_hengelo_", 1:4)),
    fte = c(paste0("fte_sofia_", 1:4), paste0("fte_hengelo_", 1:4)),
    fte_assigned = "*",
    project_filter = c("mwcu_b10", "mwcu_a7"),
    leg_filter = filtering_legs
  ),
  list(
    name = "senario_6b_fte_12_hengelo_project_mw", 
    equipment = c(paste0("setup_sofia_", 1:8), paste0("setup_sofia_large"), paste0("setup_hengelo_", 1:4)),
    fte = c(paste0("fte_sofia_", 1:8), paste0("fte_hengelo_", 1:4)),
    fte_assigned = "*",
    project_filter = c("mwcu_b10", "mwcu_a7"),
    leg_filter = filtering_legs
  )
)

# Generate all scenarios
walk(scenarios, function(scenario) {
  out_folder <- paste0("../gen3_pv/", scenario$name)
  # Clean the output folder before generating new files

  if (dir.exists(out_folder)) {
    unlink(out_folder, recursive = TRUE)
  }
  dir.create(out_folder, recursive = TRUE)
  
  # Apply filters to legs and tests
  filtered_legs <- filter_data(
    df_legs, 
    scenario$project_filter, 
    scenario$leg_filter
    )
  filtered_tests <- filter_data(
    df_tests,
    scenario$project_filter,
    scenario$leg_filter
  ) %>%
    # Ensure consistent type before duplicating
    mutate(leg_num = as.character(leg_num))

  # Duplicate legs 3 and 4 into 3a/3b and 4a/4b for DCC projects
  base_data <- filtered_tests %>%
    mutate(to_duplicate = (grepl("^dcc", project_id) & leg_num %in% c("3", "4")))

  dcc_a <- base_data %>%
    filter(to_duplicate) %>%
    mutate(
      leg_num = ifelse(leg_num == "3", "3a", "4a"),
      project_leg_id = paste0(project_id, "_", leg_num),
      test_id = paste0(project_id, "_", leg_num, "_", test)
    ) %>%
    mutate(leg_num = as.character(leg_num)) %>%
    select(all_of(names(base_data)))

  dcc_b <- base_data %>%
    filter(to_duplicate) %>%
    mutate(
      leg_num = ifelse(leg_num == "3", "3b", "4b"),
      project_leg_id = paste0(project_id, "_", leg_num),
      test_id = paste0(project_id, "_", leg_num, "_", test)
    ) %>%
    mutate(leg_num = as.character(leg_num)) %>%
    select(all_of(names(base_data)))

  filtered_tests <- base_data %>%
    filter(!to_duplicate) %>%
    bind_rows(dcc_a) %>%
    bind_rows(dcc_b) %>%
    select(-to_duplicate)

  # DCC-specific rule: duplicate leg 5 and 5a; remove 5b
  dcc_subset <- filtered_tests %>% filter(grepl("^dcc", project_id))
  non_dcc_subset <- filtered_tests %>% filter(!grepl("^dcc", project_id))

  dcc_without_5b <- dcc_subset %>% filter(leg_num != "5b")
  dcc_5_dups <- dcc_without_5b %>%
    filter(leg_num %in% c("5", "5a")) %>%
    mutate(test_id = paste0(test_id, "_dup"))

  filtered_tests <- bind_rows(non_dcc_subset, dcc_without_5b, dcc_5_dups)

  
  # Write filtered legs
  write_csv(filtered_legs, paste0(out_folder, "/data_legs.csv"))
  
  # Write tests with FTE assignment if specified
  test_data <- if (!is.null(scenario$fte_assigned)) {
    filtered_tests %>% mutate(fte_assigned = scenario$fte_assigned)
  } else {
    filtered_tests
  }
  write_csv(test_data, paste0(out_folder, "/data_test.csv"))
  
  # Write equipment and FTE availability
  write_csv(create_availability(scenario$equipment, "equipment_id", years, holidays), 
            paste0(out_folder, "/data_equipment.csv"))
  write_csv(create_availability(scenario$fte, "fte_id", years, holidays), 
            paste0(out_folder, "/data_fte.csv"))
  
  # Filter DUTs based on remaining test_ids after filtering
  filtered_duts <- df_duts %>% filter(test_id %in% filtered_tests$test_id)
  write_csv(filtered_duts, paste0(out_folder, "/data_test_duts.csv"))
  
  # Write priority config
  write_json(list(
    # priority_mode = "makespan_minimize", 
    priority_mode = "leg_priority", 
    description = "Finish testing program as quickly as possible - minimizes total project duration"),
            paste0(out_folder, "/priority_config.json"), pretty = TRUE)    
})



### Post processing
files <- c(
  "../gen3_pv/senario_3b_fte_8_sofia_hengelo_project_mw/data_test.csv",
  "../gen3_pv/senario_5b_fte_8_hengelo_project_mw/data_test.csv",
  "../gen3_pv/senario_6b_fte_12_hengelo_project_mw/data_test.csv"
)

walk(files, function(file) {
  df <- read_csv(file)

  df <- df %>%
    mutate(
      fte_assigned = if_else(project_id == "mwcu_b10", "fte_hengelo", fte_assigned),
      fte_assigned = if_else(project_id == "mwcu_a7", "fte_sofia", fte_assigned),
      equipment_assigned = if_else(project_id == "mwcu_b10", "setup_hengelo", equipment_assigned),
      equipment_assigned = if_else(project_id == "mwcu_a7", "setup_sofia", equipment_assigned)
    )
  
  # Only apply the following mutations if the df contains project_id == "dcc_21a"
  if (any(df$project_id == "dcc_21a")) {
    df <- df %>%
      mutate(
        fte_assigned = if_else(project_id == "dcc_21a", "fte_sofia", fte_assigned),
        equipment_assigned = if_else(project_id == "dcc_21a", "setup_sofia", equipment_assigned),
        equipment_assigned = if_else(project_id == "dcc_21a" & leg_num == "3a", "setup_sofia_large", equipment_assigned)
      ) |> filter(leg_num != "3b")
  } else {
    df <- df %>%
      mutate(
        equipment_assigned = if_else(project_id == "mwcu_a7" & leg_num == "2a", "setup_sofia_large", equipment_assigned)
      ) |> filter(!(project_id == "mwcu_a7" & leg_num == "2b" & sequence_index <= max(sequence_index[test == "M-04" & leg_num == "2b" & project_id == "mwcu_a7"])))
  }
  
  # Always apply these mutations
  
  write_csv(df, file)
})