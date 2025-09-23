import argparse
import os
import logging
from planner import main

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the planning system")
    parser.add_argument(
        "--input-folder", 
        "-i", 
        type=str, 
        default="input_data",
        help="Path to the input data folder (default: input_data)"
    )
    parser.add_argument(
        "--debug-level",
        "-d",
        type=str,
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        default="INFO",
        help="Debug level (default: INFO)"
    )
    parser.add_argument(
        "--no-log-file",
        action="store_true",
        help="Disable logging to file"
    )
    
    args = parser.parse_args()
    
    # Validate that the input folder exists
    if not os.path.exists(args.input_folder):
        print(f"Error: Input folder '{args.input_folder}' does not exist.")
        exit(1)
    
    # Run the planner with debug options
    main(
        input_folder=args.input_folder,
        debug_level=args.debug_level,
        log_to_file=not args.no_log_file
    )

