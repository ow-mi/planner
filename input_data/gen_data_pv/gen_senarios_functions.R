process_legs <- function(df_leg, project_id) {
  # Take only the unique leg structure, ignoring existing project information
  df_leg |>
    distinct(leg_number, leg_name, priority, start_iso_week) |>
    # Create new entries for the specified project
    mutate(
      project_id = project_id,
      project_name = project_id,
      project_leg_id = paste0(project_id, "_", leg_number)
    ) |>
    # Keep only the necessary columns in the correct order
    select(project_id, project_name, project_leg_id, leg_number, leg_name, priority, start_iso_week)
}

create_availability <- function(ids, id_col, years, holidays = NULL) {
  # Create base availability for each year
  base_availability <- expand_grid(
    !!id_col := ids,
    year = years
  ) |>
  mutate(
    available_start_week_iso = if_else(year == min(years), "2025-W02", sprintf("%d-W01", year)),
    available_end_week_iso = sprintf("%d-W52", year)
  ) |>
  select(-year)
  
  # If no holidays provided, return base availability
  if (is.null(holidays) || length(holidays) == 0) {
    return(base_availability)
  }
  
  # Process holidays and split availability periods
  process_holidays_for_availability(base_availability, holidays, id_col)
}

process_holidays_for_availability <- function(availability_df, holidays, id_col) {
  # Convert holiday weeks to a more workable format
  holiday_weeks <- parse_holiday_weeks(holidays)
  
  # For each availability period, check if it overlaps with holidays
  map_dfr(seq_len(nrow(availability_df)), function(i) {
    row <- availability_df[i, ]
    start_week <- row$available_start_week_iso
    end_week <- row$available_end_week_iso
    
    # Find holidays that fall within this availability period
    overlapping_holidays <- holiday_weeks[
      holiday_weeks >= start_week & holiday_weeks <= end_week
    ]
    
    if (length(overlapping_holidays) == 0) {
      # No holidays in this period, return as-is
      return(row)
    } else {
      # Split the period around holidays
      split_periods <- split_availability_around_holidays(
        start_week, end_week, overlapping_holidays, row, id_col
      )
      return(split_periods)
    }
  })
}

parse_holiday_weeks <- function(holidays) {
  # Convert holiday weeks to a sortable format for comparison
  # Assumes format like "2025-W52", "2026-W01", etc.
  holidays[!is.na(holidays) & holidays != ""]
}

split_availability_around_holidays <- function(start_week, end_week, holiday_weeks, base_row, id_col) {
  # Sort holidays and create periods between them
  sorted_holidays <- sort(holiday_weeks)
  
  periods <- list()
  current_start <- start_week
  
  for (holiday in sorted_holidays) {
    # Add period before holiday (if there's a gap and it's before the holiday)
    if (current_start < holiday) {
      period_end <- get_week_before(holiday)
      # Only add if the period is valid (start < end)
      if (current_start <= period_end) {
        periods <- append(periods, list(create_period_row(
          current_start, period_end, base_row, id_col
        )))
      }
    }
    # Move to the week after the holiday
    current_start <- get_week_after(holiday)
  }
  
  # Add final period after last holiday (if there's a gap)
  if (current_start <= end_week) {
    periods <- append(periods, list(create_period_row(
      current_start, end_week, base_row, id_col
    )))
  }
  
  # If no valid periods remain, return empty tibble
  if (length(periods) == 0) {
    return(tibble())
  }
  
  # Combine all periods
  do.call(rbind, periods)
}

create_period_row <- function(start_week, end_week, base_row, id_col) {
  base_row |>
    mutate(
      available_start_week_iso = start_week,
      available_end_week_iso = end_week
    )
}

get_week_before <- function(week_str) {
  # Convert week to year-week, subtract 1, handle year boundaries
  parts <- strsplit(week_str, "-W")[[1]]
  year <- as.numeric(parts[1])
  week <- as.numeric(parts[2])
  
  if (week > 1) {
    return(sprintf("%d-W%02d", year, week - 1))
  } else {
    # Previous year, week 52
    return(sprintf("%d-W52", year - 1))
  }
}

get_week_after <- function(week_str) {
  # Convert week to year-week, add 1, handle year boundaries
  parts <- strsplit(week_str, "-W")[[1]]
  year <- as.numeric(parts[1])
  week <- as.numeric(parts[2])
  
  if (week < 52) {
    return(sprintf("%d-W%02d", year, week + 1))
  } else {
    # Next year, week 1
    return(sprintf("%d-W01", year + 1))
  }
}

# Alternative function for more flexible holiday handling
create_availability_with_holidays <- function(ids, id_col, years, holidays = NULL, 
                                            holiday_buffer_weeks = 0, 
                                            min_period_weeks = 1) {
  # Create base availability for each year
  base_availability <- expand_grid(
    !!id_col := ids,
    year = years
  ) |>
  mutate(
    available_start_week_iso = if_else(year == min(years), "2025-W02", sprintf("%d-W01", year)),
    available_end_week_iso = sprintf("%d-W52", year)
  ) |>
  select(-year)
  
  # If no holidays provided, return base availability
  if (is.null(holidays) || length(holidays) == 0) {
    return(base_availability)
  }
  
  # Process holidays with buffer and minimum period constraints
  process_holidays_advanced(base_availability, holidays, id_col, holiday_buffer_weeks, min_period_weeks)
}

process_holidays_advanced <- function(availability_df, holidays, id_col, buffer_weeks, min_period_weeks) {
  # Convert holiday weeks to a more workable format
  holiday_weeks <- parse_holiday_weeks(holidays)
  
  # Apply buffer to holidays (extend holiday periods)
  if (buffer_weeks > 0) {
    holiday_weeks <- expand_holiday_periods(holiday_weeks, buffer_weeks)
  }
  
  # For each availability period, check if it overlaps with holidays
  map_dfr(seq_len(nrow(availability_df)), function(i) {
    row <- availability_df[i, ]
    start_week <- row$available_start_week_iso
    end_week <- row$available_end_week_iso
    
    # Find holidays that fall within this availability period
    overlapping_holidays <- holiday_weeks[
      holiday_weeks >= start_week & holiday_weeks <= end_week
    ]
    
    if (length(overlapping_holidays) == 0) {
      # No holidays in this period, return as-is
      return(row)
    } else {
      # Split the period around holidays
      split_periods <- split_availability_around_holidays_advanced(
        start_week, end_week, overlapping_holidays, row, id_col, min_period_weeks
      )
      return(split_periods)
    }
  })
}

expand_holiday_periods <- function(holiday_weeks, buffer_weeks) {
  # Expand each holiday week by buffer_weeks before and after
  expanded <- c()
  for (week in holiday_weeks) {
    # Add buffer weeks before
    for (i in 1:buffer_weeks) {
      expanded <- c(expanded, get_week_before_n(week, i))
    }
    # Add the holiday week itself
    expanded <- c(expanded, week)
    # Add buffer weeks after
    for (i in 1:buffer_weeks) {
      expanded <- c(expanded, get_week_after_n(week, i))
    }
  }
  unique(expanded)
}

get_week_before_n <- function(week_str, n) {
  # Get week that is n weeks before the given week
  for (i in 1:n) {
    week_str <- get_week_before(week_str)
  }
  week_str
}

get_week_after_n <- function(week_str, n) {
  # Get week that is n weeks after the given week
  for (i in 1:n) {
    week_str <- get_week_after(week_str)
  }
  week_str
}

split_availability_around_holidays_advanced <- function(start_week, end_week, holiday_weeks, base_row, id_col, min_period_weeks) {
  # Sort holidays and create periods between them
  sorted_holidays <- sort(holiday_weeks)
  
  periods <- list()
  current_start <- start_week
  
  for (holiday in sorted_holidays) {
    # Add period before holiday (if there's a gap and it meets minimum length)
    if (current_start < holiday) {
      period_end <- get_week_before(holiday)
      # Only add if the period is valid (start <= end) and meets minimum length
      if (current_start <= period_end && week_difference(current_start, period_end) >= min_period_weeks) {
        periods <- append(periods, list(create_period_row(
          current_start, period_end, base_row, id_col
        )))
      }
    }
    # Move to the week after the holiday
    current_start <- get_week_after(holiday)
  }
  
  # Add final period after last holiday (if there's a gap and it meets minimum length)
  if (current_start <= end_week) {
    if (week_difference(current_start, end_week) >= min_period_weeks) {
      periods <- append(periods, list(create_period_row(
        current_start, end_week, base_row, id_col
      )))
    }
  }
  
  # If no valid periods remain, return empty tibble
  if (length(periods) == 0) {
    return(tibble())
  }
  
  # Combine all periods
  do.call(rbind, periods)
}

week_difference <- function(start_week, end_week) {
  # Calculate the number of weeks between two ISO week strings
  start_parts <- strsplit(start_week, "-W")[[1]]
  end_parts <- strsplit(end_week, "-W")[[1]]
  
  start_year <- as.numeric(start_parts[1])
  start_week_num <- as.numeric(start_parts[2])
  end_year <- as.numeric(end_parts[1])
  end_week_num <- as.numeric(end_parts[2])
  
  # Simple calculation: assume 52 weeks per year
  (end_year - start_year) * 52 + (end_week_num - start_week_num) + 1
}

process_tests <- function(df, project_id, duration_dict) {
  df |>
    mutate(
      project_id = project_id,
      leg_num = project_leg_id,
      project_leg_id = paste0(project_id, "_", leg_num),
      test_id = paste0(project_id, "_", leg_num, "_", test),
      equipment_assigned = "*",
      fte_time_pct = if_else(test %in% c("L-02", "L-03", "VDA"), 20, 100),
      duration_days = case_when(
        test == "NA" ~ 0,  # Handle NA tests with 0 duration
        is.na(test) ~ 0,   # Handle missing test values
        TRUE ~ duration_dict[test]
      )
    )
}