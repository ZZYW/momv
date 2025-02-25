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
    
    # Check for pnpm instead of npm
    if ! command -v pnpm >/dev/null; then
        echo "pnpm not found. Installing pnpm..."
        npm install -g pnpm || error "Failed to install pnpm"
    fi
    
    # Check http-server, install via pnpm if missing
    if ! command -v http-server >/dev/null; then
        echo "Installing http-server..."
        pnpm add -g http-server || error "Failed to install http-server"
    fi
}

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STATION1_PORT=8764
STATION2_PORT=8765
EDITOR_PORT=8766
export BACKEND_PORT=3001
SERVER_PATH="server/index.js"
SERVER_DIR="server"

# Initial checks
check_deps

# Log with timestamp
log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

# Windows path conversion
win_path() {
    if [[ "$OSTYPE" == "msys"* ]]; then
        cygpath -w "$1"
    else
        echo "$1"
    fi
}

# Check if port is available
check_port() {
    local port=$1
    if command -v nc >/dev/null; then
        nc -z localhost $port >/dev/null 2>&1
        return $?
    elif command -v netstat >/dev/null; then
        netstat -an | grep "LISTEN" | grep -q ":$port "
        return $?
    else
        # If no tools available, assume port is free
        return 1
    fi
}

# Server management
start_server() {
    local name=$1 dir=$2 port=$3
    
    # Check if port is already in use
    if check_port $port; then
        echo -e "${YELLOW}Warning:${NC} Port $port is already in use. $name might not start correctly."
    fi
    
    log "Starting $name on port $port"
    http-server "$(win_path "$dir")" -p "$port" --silent &
    SERVER_PIDS+=($!)
}

# Cleanup
cleanup() {
    log "Stopping all servers..."
    for pid in "${SERVER_PIDS[@]}"; do
        kill $pid 2>/dev/null
    done
    
    # Remove any temporary files created during execution
    find . -name "*.tmp" -type f -delete 2>/dev/null
    
    exit 0
}

# Handle signals
trap cleanup SIGINT SIGTERM

# Find backend server file
if [ ! -f "$SERVER_PATH" ] && [ -f "$SERVER_DIR/server.js" ]; then
    SERVER_PATH="$SERVER_DIR/server.js"
    log "Using server.js as the main server file"
fi

# Database setup
if [ -f "$SERVER_DIR/package.json" ]; then
    log "Installing DB dependencies using pnpm..."
    (cd "$(win_path "$SERVER_DIR")" && pnpm install) || error "DB setup failed"
fi

# Create data.json if it doesn't exist
if [ ! -f "$SERVER_DIR/data.json" ]; then
    log "Creating empty data.json file..."
    echo "{}" > "$SERVER_DIR/data.json"
fi

# Service initialization
declare -a SERVER_PIDS=()

if [ -f "$SERVER_PATH" ]; then
    log "Starting backend server on port $BACKEND_PORT..."
    node "$(win_path "$SERVER_PATH")" &
    SERVER_PIDS+=($!)
    
    # Give the backend server time to start
    sleep 2
    
    # Check if backend started successfully
    if ! check_port $BACKEND_PORT; then
        log "Backend server started successfully"
    else
        echo -e "${YELLOW}Warning:${NC} Backend server may not have started correctly"
    fi
fi

# Start frontend servers
start_server "Station 1" "station1" $STATION1_PORT
start_server "Station 2" "station2" $STATION2_PORT
start_server "Editor" "editor" $EDITOR_PORT

# Browser launch with delay to ensure servers are ready
(
    sleep 2
    log "Opening browser windows..."
    if [[ "$OSTYPE" == "msys"* ]]; then
        # Windows
        cmd.exe /C start "http://localhost:$EDITOR_PORT"
        sleep 1
        cmd.exe /C start "http://localhost:$STATION1_PORT"
        sleep 1
        cmd.exe /C start "http://localhost:$STATION2_PORT"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        open "http://localhost:$EDITOR_PORT"
        sleep 1
        open "http://localhost:$STATION1_PORT"
        sleep 1
        open "http://localhost:$STATION2_PORT"
    else
        # Linux and others
        if command -v xdg-open >/dev/null; then
            xdg-open "http://localhost:$EDITOR_PORT"
            sleep 1
            xdg-open "http://localhost:$STATION1_PORT"
            sleep 1
            xdg-open "http://localhost:$STATION2_PORT"
        else
            echo "Please open these URLs manually:"
            echo "  Editor: http://localhost:$EDITOR_PORT"
            echo "  Station 1: http://localhost:$STATION1_PORT"
            echo "  Station 2: http://localhost:$STATION2_PORT"
        fi
    fi
) &

# Print summary
echo -e "\n${BLUE}======================================${NC}"
echo -e "${BLUE}  Interactive Story App${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "Backend server: ${GREEN}http://localhost:$BACKEND_PORT${NC}"
echo -e "Editor: ${GREEN}http://localhost:$EDITOR_PORT${NC}"
echo -e "Station 1: ${GREEN}http://localhost:$STATION1_PORT${NC}"
echo -e "Station 2: ${GREEN}http://localhost:$STATION2_PORT${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "Press ${YELLOW}Ctrl+C${NC} to stop all services\n"

wait