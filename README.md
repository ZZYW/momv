# @ Mountain of Many Voices 众鸣山 @ official code repo

This repository contains a multi-service project for creating, editing, and playing interactive stories with dynamic AI-driven content:

- A **Backend Server**: A Node.js Express server providing AI integration and data persistence (`server/server.js`).
- **Station 1**: A web application for playing compiled stories.
- **Station 2**: A secondary interface with basic AI interaction functionality.
- An **Editor**: A visual block-based authoring tool for creating interactive narratives.

## Project Structure

```
./
├── start.sh           # Bash script to start all services 
├── server/
│   └── server.js      # Express server with AI/DB functionality
├── station1/
│   └── index.html     # Story player interface
├── station2/
│   └── index.html     # Secondary interface with AI interaction
├── editor/
│   ├── index.html     # Block-based story editor
│   └── playable/      # Contains compiler for playable stories
└── README.md          # This file
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v14+ recommended)
- [pnpm](https://pnpm.io/) (preferred package manager)
- Bash or Zsh shell (Git Bash for Windows users)

## Installation

1. **Clone the repository:**

   ```bash
   git clone <repository_url>
   cd momv
   ```

2. **Start the application:**

   ```bash
   ./start.sh
   ```

   This script will:
   - Check for required dependencies and install them if needed
   - Start the backend server on port **3001**
   - Start Station 1 on port **8764**
   - Start Station 2 on port **8765**
   - Start the Editor on port **8766**
   - Open all interfaces in your default browser

## If you do not want to use start.sh...

You can start each component separately using the following commands:

1. **Install dependencies first:**

   ```bash
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
   node server/server.js
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

## Features

### Editor

The block-based editor allows you to:
- Create plain narrative text blocks
- Add static options for player choices
- Create dynamic AI-generated options based on context
- Generate dynamic text and words through AI
- Organize content with scene headers
- Preview and test your story
- Export projects as JSON

### Story Player

The compiled story player supports:
- Linear narrative progression
- Player choices (static and dynamic)
- AI-generated content based on previous player choices
- A responsive, mobile-friendly interface

### Backend Server

The server provides:
- AI content generation via the Dashscope API
- Data persistence for player choices and story state
- Story compilation services
- Context tracking for dynamic content generation

## Usage

1. **Creating a Story**:
   - Open the Editor at http://localhost:8766
   - Add blocks to create your narrative
   - Use dynamic blocks to incorporate AI-generated content

2. **Testing Your Story**:
   - Click the [Play] button in the editor
   - A new window will open with your compiled story

3. **Exporting**:
   - Use the "Export Project as JSON" button to save your work

## Troubleshooting

- **Git Bash (Windows)**: If you encounter issues on Windows, ensure you're using Git Bash as specified in the error message.

- **Port Conflicts**: If any services fail to start, check if the ports are already in use.

- **Missing API Key**: If AI functionality isn't working, ensure the DASHSCOPE_API_KEY environment variable is set.

## Development Notes

- The backend server stores data in a `data.json` file in the server directory.
- All services are started using the http-server package for static file serving.
- The editor uses localStorage for autosaving your project.