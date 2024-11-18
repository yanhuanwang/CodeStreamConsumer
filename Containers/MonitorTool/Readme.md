# MonitorTool ReadMe

## Overview

MonitorTool is a Python-based monitoring application that utilizes Flask and MongoDB to provide data visualization and track the processing of clone detection metrics. The tool periodically samples data from a database, computes metrics such as processing times and counts of different elements, and visualizes them through a web interface.

## Features
- **Health Check**: The `/health` endpoint verifies that the service is running correctly.
- **Data Sampling**: Regularly collects information from the database and stores it for analysis.
- **Metrics Visualization**: Provides visualizations of trends and statistics through the `/visualize` endpoint.
- **System Information**: Displays information about the system environment via the `/system-info` endpoint.

## Dependencies

- Python 3.9-slim
- Flask: A web framework to manage API routes and serve HTML templates.
- PyMongo: Used to connect to and interact with MongoDB.
- Matplotlib & NumPy: Used to create visualizations of metrics.
- System Utilities: `curl`, `procps`, `libatlas-base-dev`, `gfortran` are needed for monitoring and numerical operations.

## Setup Instructions

1. **Clone the Repository**:
   ```bash
   git clone git@github.com:yanhuanwang/CodeStreamConsumer.git
   cd MonitorTool
   ```

2. **Docker Setup**:
   You can build and run the MonitorTool using Docker Compose. Here is an example Dockerfile setup for the project:

   ```dockerfile
   FROM python:3.9-slim

   WORKDIR /app
   COPY . .

   # Install required packages
   RUN apt-get update && apt-get install -y \
       curl \
       procps \
       libatlas-base-dev \
       gfortran \
       && rm -rf /var/lib/apt/lists/*

   RUN pip install Flask pymongo matplotlib numpy

   # Set environment variable for MongoDB
   ENV DBHOST="mongodb://dbstorage:27017"

   CMD ["python", "app.py"]
   ```

3. **Environment Configuration**:
   - The application requires a MongoDB instance to work. The connection to MongoDB is defined via the environment variable `DBHOST`, which defaults to `mongodb://localhost:27017`.

4. **Run the Application**:
   - To run the application locally:
     ```bash
     python app.py
     ```
   - To run the application using Docker:
     ```bash
     docker build -t monitortool .
     docker run -p 5000:5000 monitortool
     ```
   - Alternatively, use Docker Compose to orchestrate multiple services, such as the monitoring tool and MongoDB.

## Endpoints

- `/` : Returns the index page.
- `/data` : Samples and returns the current metrics from MongoDB.
- `/historical-data` : Returns all historical data collected from the database.
- `/health` : Provides a simple health check endpoint to verify service availability.
- `/system-info` : Returns system information such as the version of `curl` and running processes.
- `/visualize` : Generates visualizations of the metrics, including processing time trends and other statistics.

## Visualization Metrics

- **Files vs Processing Time**: Measures how processing time changes with the number of files.
- **Chunks vs Processing Time**: Tracks the impact of chunks on processing time.
- **Candidates vs Processing Time**: Shows trends in processing time based on candidate clones.
- **Clones vs Processing Time**: Measures the effect of clones on processing time.
- **Clones Size vs Processing Time**: Displays trends for the size of clones versus processing time.
- **Chunks per File vs Processing Time**: Highlights the relationship between chunks per file and the time taken.
- **Time to Generate Chunks**: Visualization of how long it takes to generate chunks.
- **Time to Generate Clone Candidates**: Shows the time required to generate clone candidates.
- **Time to Expand Clone Candidates**: Displays how much time is taken to expand clone candidates.

## Background Monitoring

The application starts a background thread (`monitor_data`) that runs every 60 seconds to sample metrics from the database. This helps in continuously gathering metrics for historical analysis and visualization.

## Contribution

If you would like to contribute to this project, please fork the repository and submit a pull request. Make sure your code adheres to standard Python practices and is well-documented.

## License

This project is licensed under the MIT License.

## Contact

If you have any questions or suggestions, feel free to reach out or open an issue on GitHub.

## Acknowledgements

This project is inspired by the need for effective monitoring of data processing tasks, providing clear insights into trends and performance.