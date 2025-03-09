# Mountain of Many Voices (众鸣山)

An interactive AI-powered narrative platform for generating branching Chinese stories with thermal printer output.

## Setup and Deployment

### Prerequisites
- Node.js v14+
- pnpm (recommended) or npm
- DashScope API key
- USB Thermal printer

### Installation
```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your DashScope API key and printer IP
```

### Environment Configuration
```
DASHSCOPE_API_KEY=your_dashscope_api_key  # Required
PORT=3001                                 # Optional, defaults to 3001
CENTRAL_BACKEND_URL=http://main-server:3001  # Optional, for multi-station setup
```

### Running
```bash
# Development mode (includes editor and control panel)
pnpm run dev

# Production mode (station interfaces only)
pnpm run prod
```

## System Architecture

### Components
- **Server**: Express.js backend with API, story handling, and printer control
- **Stations**: Two independent story terminals (station1, station2)
- **Editor**: Web interface for creating interactive stories
- **AI Engine**: Connects to DashScope API (Alibaba Cloud) using Qwen-Max model
- **Database**: LowDB (JSON-based) for story state and user choices
- **Printer**: USB thermal printer integration via node-escpos

### Access Points
- Story Station 1: http://localhost:3001/station1
- Story Station 2: http://localhost:3001/station2
- Story Editor: http://localhost:3001/editor/station1 (dev mode only)
- Control Panel: http://localhost:3001/cp (dev mode only)

### Multi-Station Deployment
For installations with multiple physical stations:

1. Set up one server as the central backend
2. Configure additional stations with `CENTRAL_BACKEND_URL` pointing to main server
3. Each station maintains its own printer connection

The thermal printer outputs story segments based on user interactions, creating physical artifacts of the narrative experience.