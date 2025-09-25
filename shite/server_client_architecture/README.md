# Server-Client Architecture for Planning Test Program

## Overview

This project implements a modern server-client architecture for the Planning Test Program, providing:

- **Python Backend Server**: OR-Tools optimization engine with REST API
- **Web Frontend Client**: React-based interface with D3.js visualizations
- **Real-time Data Flow**: Interactive CSV editing and optimization results

## Architecture

```
┌─────────────────┐    REST API     ┌─────────────────┐
│   Web Client    │ ◄─────────────► │   Python Server │
│  (React + D3)   │    JSON/CSV     │ (OR-Tools + API)│
└─────────────────┘                 └─────────────────┘
       │                                    │
       ▼                                    ▼
┌─────────────────┐                 ┌─────────────────┐
│  Browser-based  │                 │  Optimization   │
│  CSV Editor     │                 │  Engine         │
└─────────────────┘                 └─────────────────┘
```

## Data Flow

1. **Start Tool**: User launches the web application
2. **Upload Data**: CSV files are uploaded through the browser interface
3. **Edit CSV**: In-browser table editor for data manipulation
4. **Run Optimization**: Data sent to server, OR-Tools solver applied
5. **Return Results**: Optimized schedule and resource usage data returned as CSV
6. **Visualization**: D3.js renders interactive charts and Gantt diagrams

## Project Structure

```
server_client_architecture/
├── README.md                 # This file
├── docs/                     # Design documentation
│   ├── architecture.md       # System architecture details
│   ├── api-spec.md          # REST API specification
│   └── data-flow.md         # Detailed data flow diagrams
├── server/                   # Python backend
│   ├── app.py               # FastAPI application
│   ├── optimization.py      # OR-Tools solver implementation
│   ├── models.py            # Data models and schemas
│   ├── requirements.txt     # Python dependencies
│   └── data/                # Sample data and configurations
└── client/                   # React frontend
    ├── package.json         # Node.js dependencies
    ├── src/
    │   ├── components/      # React components
    │   ├── services/       # API client services
    │   ├── utils/          # Data processing utilities
    │   └── visualizations/ # D3.js chart components
    └── public/             # Static assets
```

## Key Features

### Server (Backend)
- **FastAPI** for high-performance REST API
- **OR-Tools** for constraint optimization
- **Pandas** for data processing and validation
- **Automatic validation** of input data
- **Multiple optimization strategies** (makespan, deadlines, equal priority)

### Client (Frontend)
- **React** with modern hooks and state management
- **D3.js** for interactive visualizations:
  - Gantt charts for tests, equipment, and FTE
  - Resource utilization charts
  - Concurrency timeline charts
- **In-browser CSV editor** with table interface
- **Real-time updates** and progress indicators
- **Responsive design** for desktop and mobile

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 16+
- OR-Tools (Python package)

### Installation

1. **Server Setup**:
   ```bash
   cd server
   pip install -r requirements.txt
   uvicorn app:app --reload
   ```

2. **Client Setup**:
   ```bash
   cd client
   npm install
   npm start
   ```

### Usage

1. Open the web application in your browser
2. Upload CSV files (tests, equipment, FTE, legs, test DUTs)
3. Edit data directly in the browser tables
4. Configure optimization priorities and constraints
5. Run the optimization and view results
6. Explore interactive visualizations

## API Endpoints

- `POST /api/upload` - Upload CSV files
- `POST /api/optimize` - Run optimization with current data
- `GET /api/results/{type}` - Download optimized results (CSV)
- `GET /api/status` - Check optimization status
- `POST /api/validate` - Validate input data before optimization

## Data Formats

### Input Files (CSV):
- `data_test.csv` - Test definitions and durations
- `data_equipment.csv` - Equipment availability and capabilities
- `data_fte.csv` - FTE resource availability
- `data_legs.csv` - Project legs and sequences
- `data_test_duts.csv` - Test-DUT relationships
- `priority_config.json` - Optimization priorities and constraints

### Output Files (CSV):
- `tests_schedule.csv` - Optimized test schedule
- `equipment_usage.csv` - Equipment utilization timeline
- `fte_usage.csv` - FTE utilization timeline
- `concurrency_timeseries.csv` - Capacity vs utilization over time
- `validation_report.csv` - Data validation results

## Development

### Adding New Optimization Strategies
1. Extend the `OptimizationEngine` class in `server/optimization.py`
2. Add new priority configuration options
3. Update API endpoints to support new strategies

### Creating New Visualizations
1. Add D3.js component in `client/src/visualizations/`
2. Integrate with React state management
3. Add to the navigation and UI

### Extending Data Models
1. Update Pydantic models in `server/models.py`
2. Modify data validation rules
3. Update frontend interfaces accordingly

## Performance Considerations

- **Large datasets**: The optimization can handle hundreds of tests and resources
- **Caching**: Results are cached to avoid recomputation
- **Progress reporting**: Long-running optimizations provide status updates
- **Memory management**: Efficient data structures for large constraint problems

## Troubleshooting

### Common Issues
- **CORS errors**: Ensure server and client are on same origin or configure CORS
- **OR-Tools installation**: Follow official installation guide for your platform
- **Data validation failures**: Check CSV formats and required columns
- **Optimization timeouts**: Consider simplifying constraints for very large problems

### Debugging
- Enable debug logging on the server
- Use browser developer tools for client debugging
- Check API responses and error messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with appropriate tests
4. Submit a pull request with documentation updates

## License

This project is built on top of the existing Planning Test Program and maintains the same licensing terms.

## Support

For issues and questions:
- Check the documentation in `/docs/`
- Review existing implementation in the main planning program
- Create GitHub issues for bugs and feature requests