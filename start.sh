#!/usr/bin/env bash

# Validate execution shell
if [ -z "$BASH_VERSION" ] && [ -z "$ZSH_VERSION" ]; then
    echo "Error: This script requires Bash or Zsh shell."
    echo "On Windows: Use Git Bash (https://gitforwindows.org)"
    exit 1
fi

# Error handling
error() {
    echo "Error: $1"
    echo "Quick fix:"
    echo "1. Install Node.js from https://nodejs.org"
    echo "2. Add Node.js to system PATH"
    exit 1
}

# Early dependency check
check_deps() {
    command -v node >/dev/null || error "Node.js not found"
    command -v npm >/dev/null || error "npm not found"
    
    if ! command -v http-server >/dev/null; then
        echo "Installing http-server..."
        npm install -g http-server || error "Install http-server failed"
    fi
}

# Initial checks
check_deps

# Configuration
STATION1_PORT=8764
STATION2_PORT=8765
export BACKEND_PORT=3001
DB_PATH="db/index.js"

# Windows path conversion
win_path() {
    if [[ "$OSTYPE" == "msys"* ]]; then
        cygpath -w "$1"
    else
        echo "$1"
    fi
}

# Server management
start_server() {
    local name=$1 dir=$2 port=$3
    echo "Starting $name on port $port"
    http-server "$(win_path "$dir")" -p "$port" --silent &
    SERVER_PIDS+=($!)
}

# Cleanup
cleanup() {
    echo "Stopping all servers..."
    for pid in "${SERVER_PIDS[@]}"; do
        kill $pid 2>/dev/null
    done
    exit 0
}

# Main execution
trap cleanup SIGINT

# Database setup
if [ -f "db/package.json" ]; then
    echo "Installing DB dependencies..."
    (cd "$(win_path "db")" && npm install) || error "DB setup failed"
fi

# Service initialization
declare -a SERVER_PIDS=()

if [ -f "$DB_PATH" ]; then
    echo "Starting DB server..."
    node "$(win_path "$DB_PATH")" &
    SERVER_PIDS+=($!)
fi

start_server "Station 1" "station1" $STATION1_PORT
start_server "Station 2" "station2" $STATION2_PORT

# Browser launch
(
    sleep 2
    if [[ "$OSTYPE" == "msys"* ]]; then
        cmd.exe /C start "http://localhost:$STATION1_PORT"
        cmd.exe /C start "http://localhost:$STATION2_PORT"
    else
        open "http://localhost:$STATION1_PORT"
        open "http://localhost:$STATION2_PORT"
    fi
) &

echo "Services running. Press Ctrl+C to stop"
wait