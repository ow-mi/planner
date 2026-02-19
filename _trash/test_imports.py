#!/usr/bin/env python3
"""
Quick test to verify all planner_v4 modules can be imported.
"""

import sys
import os

# Add planner_v4 to path
sys.path.insert(0, os.path.join(os.getcwd(), 'planner_v4'))

try:
    import planner_v4
    print('PASS: Main package imports successfully')

    from planner_v4 import config
    print('PASS: Config module imports successfully')

    from planner_v4 import reports
    print('PASS: Reports module imports successfully')

    from planner_v4 import utils
    print('PASS: Utils module imports successfully')

    print('SUCCESS: All modules import successfully!')
except ImportError as e:
    print(f'FAILED: Import error: {e}')
    import traceback
    traceback.print_exc()
