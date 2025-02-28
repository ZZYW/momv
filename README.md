# @ Mountain of Many Voices 众鸣山 @ official code repo

This repository contains a multi-service project for creating, editing, and playing interactive stories with dynamic AI-driven content:

- A **Backend Server**: A Node.js Express server providing AI integration and data persistence (`server/index.js`).
- **Station 1**: A web application for playing compiled stories.
- **Station 2**: A secondary interface with basic AI interaction functionality.
- An **Editor**: A visual block-based authoring tool for creating interactive narratives.


## Prerequisites

- [Node.js](https://nodejs.org/) (v14+ recommended)
- [pnpm](https://pnpm.io/) (preferred package manager)
- For Windows users: [Git Bash](https://gitforwindows.org/) (required for running the start script)

## Installation

1. **Clone the repository:**

   ```bash
   git clone <repository_url>
   cd momv
   ```

2. **Start the application:**

   **For macOS/Linux users:**
   ```bash
   ./start.sh
   ```

   **For Windows users:**
   ```bash
   # Open Git Bash and navigate to the project directory
   cd path/to/momv
   
   # Run the start script
   ./start.sh
   ```

   This script will:
   - Check for required dependencies and install them if needed
   - Start the backend server on port **3001**
   - Start Station 1 on port **8764**
   - Start Station 2 on port **8765**
   - Start the Editor on port **8766**
   - Open all interfaces in your default browser

## Manual Setup (Windows & macOS/Linux)

If you prefer not to use the start script, you can set up and run each component manually:

### For Windows Users

1. **Install dependencies:**

   ```bash
   # Install pnpm (if not already installed)
   npm install -g pnpm

   # Install http-server globally
   pnpm add -g http-server
   
   # Install backend dependencies
   cd server
   pnpm install
   cd ..
   ```

2. **Start the backend server:**

   ```bash
   # Set the API key (required for AI functionality)
   # In Command Prompt:
   set DASHSCOPE_API_KEY=your-api-key-here
   
   # OR in PowerShell:
   $env:DASHSCOPE_API_KEY="your-api-key-here"
   
   # Start the server
   node server/index.js
   ```

3. **In separate terminal windows, start each frontend service:**

   ```bash
   # Start Editor
   http-server editor -p 8766

   # Start Station 1
   http-server station1 -p 8764
   
   # Start Station 2
   http-server station2 -p 8765
   ```

4. **Manually open the following URLs in your browser:**
   - Editor: http://localhost:8766
   - Station 1: http://localhost:8764
   - Station 2: http://localhost:8765

### For macOS/Linux Users

1. **Install dependencies:**

   ```bash
   # Install pnpm (if not already installed)
   npm install -g pnpm

   # Install http-server globally
   pnpm add -g http-server
   
   # Install backend dependencies
   cd server
   pnpm install
   cd ..
   ```

2. **Start the backend server:**

   ```bash
   # Set the API key (required for AI functionality)
   export DASHSCOPE_API_KEY=your-api-key-here
   
   # Start the server
   node server/index.js
   ```

3. **In separate terminal windows, start each frontend service:**

   ```bash
   # Start Station 1
   http-server station1 -p 8764
   
   # Start Station 2
   http-server station2 -p 8765
   
   # Start Editor
   http-server editor -p 8766
   ```

4. **Manually open the following URLs in your browser:**
   - Editor: http://localhost:8766
   - Station 1: http://localhost:8764
   - Station 2: http://localhost:8765

Note: When starting services manually, you'll need to ensure that all required environment variables are set in each terminal session.

## Environment Variables

- **DASHSCOPE_API_KEY**:  
  Required for AI functionality. Set this variable before starting the server:

  ```bash
  export DASHSCOPE_API_KEY=your-api-key-here
  ```


## Usage

1. **Creating a Story**:
   - Open the Editor at http://localhost:8766
   - Add blocks to create your narrative
   - Use dynamic blocks to incorporate AI-generated content

2. **Testing Your Story**:
   - Click the [Play] button in the editor
   - A new window will open with your compiled story

3. **Exporting**:
   - Stuff inside of Editor is saved automatically but if you want to transfer your story to a different browser or machine. then...
   - Use the "Export Project as JSON" button to save your work

## Troubleshooting

### Windows-Specific Issues

- **Script Won't Run**: If you see "Permission denied" or the script won't run, make sure you're using Git Bash (not Command Prompt or PowerShell) and the script has execute permissions:
  ```bash
  chmod +x start.sh
  ```

- **Environment Variable Not Working**: If AI functionality isn't working on Windows, make sure the environment variable is set correctly:
  ```
  # In Command Prompt
  set DASHSCOPE_API_KEY=your-api-key-here
  
  # In PowerShell
  $env:DASHSCOPE_API_KEY="your-api-key-here"
  
  # In Git Bash
  export DASHSCOPE_API_KEY=your-api-key-here
  ```

- **Path Issues**: Windows uses backslashes for paths, but the application expects forward slashes. When manually navigating directories, use forward slashes (/) in Git Bash.

### General Issues

- **Port Conflicts**: If any services fail to start, check if the ports are already in use. You can find and kill the processes using these ports:
  ```bash
  # Windows (in Command Prompt)
  netstat -ano | findstr :3001
  taskkill /PID <PID> /F
  
  # macOS/Linux
  lsof -i :3001
  kill -9 <PID>
  ```

- **Missing API Key**: If AI functionality isn't working, ensure the DASHSCOPE_API_KEY environment variable is set.

- **Dependency Issues**: If you see "command not found" errors, make sure Node.js, pnpm, and http-server are properly installed:
  ```bash
  node --version
  pnpm --version
  http-server --version
  ```

## Development Notes

- The backend server stores data in a `data.json` file in the server directory.
- All services are started using the http-server package for static file serving.
- The editor uses localStorage for autosaving your project.