#!/bin/bash
set -e

# Function to print a header
function header() {
    echo "----------------------------------------"
    echo "$1"
    echo "----------------------------------------"
}

header "Starting the DB/AI Server (port 3000)"
# Change directory to the DB folder and start the Node.js server
(
  cd db || exit
  # Ensure DASHSCOPE_API_KEY is set in your environment, e.g.,
  # export DASHSCOPE_API_KEY=sk-xxx
  node index.js
) &
DB_PID=$!
echo "DB/AI Server started with PID: $DB_PID"

header "Starting Station 1 Server (port 8001)"
(
  cd station1 || exit
  # Using npx to run http-server on port 8001
  npx http-server -p 8001
) &
STATION1_PID=$!
echo "Station 1 Server started with PID: $STATION1_PID"

header "Starting Station 2 Server (port 8002)"
(
  cd station2 || exit
  # Using npx to run http-server on port 8002
  npx http-server -p 8002
) &
STATION2_PID=$!
echo "Station 2 Server started with PID: $STATION2_PID"

header "All Services Started"
echo "DB/AI Server   : http://localhost:3000"
echo "Station 1 (Twine App): http://localhost:8001"
echo "Station 2 (Twine App): http://localhost:8002"
echo "Press Ctrl+C to stop all servers."

# Wait for all background processes
wait