# Mountain of Many Voices (众鸣山)

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)
- DashScope API key for AI generation features

### Setup
1. Clone the repository:

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables:
   The project uses the `dotevn` package. So, create a `.env` file in the root directory with the following:
   ```
   DASHSCOPE_API_KEY=your_dashscope_api_key # ⚠ MANDATORY
   PRINTER_IP=000.000.000.000 # ⚠ MANDATORY set the ip to the printer if you want the printing function to work
   PORT=3001 # Optional, defaults to 3001
   ```

4. Start the server:
   ```
   npm run dev    # Development mode
   npm run prod   # Production mode
   ```

5. Access the system:
   - Story Station 1: http://localhost:3001/station1
   - Story Station 2: http://localhost:3001/station2
   - Story Editor: http://localhost:3001/editor/station1 or /editor/station2 (dev mode only)
   - Control Panel: http://localhost:3001/cp (dev mode only)

## Usage

### Creating Stories
1. Open the editor at http://localhost:3001/editor/station1
2. Use the toolbar to add different types of blocks
3. Configure each block as needed, adding prompts and context references
4. Click "Save Project" to store your work locally
5. Click "Play" to preview your story

### Reading Stories
1. Access a station at http://localhost:3001/station1 or /station2
2. Read through the narrative and make choices when presented
3. Experience dynamically generated content based on your choices
4. Navigate through the story using the continue button

## Architecture
MOMV consists of several key components:

### Server
The Express.js server handles API requests, serves the web interfaces, and coordinates between the stations.

### Database
A lightweight JSON-based database (LowDB) stores user choices and story state.

### AI Generation
The platform integrates with DashScope's API (Alibaba Cloud) to generate dynamic content in Chinese, using a compatibility layer that mimics OpenAI's interface.

### Stations
Two independent stations can serve different parts of the experience, either standalone or connected to a central backend.

### Editor
A web-based authoring tool allows non-technical users to create and edit interactive stories with AI-powered elements.

## Configuration Options

### Development vs. Production
- Development mode (`npm run dev`): Includes editor and control panel
- Production mode (`npm run prod`): Only serves station interfaces

### Centralized Backend
For multi-server installations, you can connect stations to a central backend:
```
CENTRAL_BACKEND_URL=http://main-server:3001
```

This allows multiple stations to share the same story state and user data.


## AI Functionality

MOMV uses structured prompts to generate contextually appropriate narrative content:

- **Dynamic Text**: Generates narrative passages based on story context and user choices
- **Dynamic Options**: Creates meaningful choice options that fit the story
- **Dynamic Words**: Generates individual words (nouns, adjectives, adverbs) that add texture to the narrative

The AI system is specifically tuned for Chinese language generation using Qwen-Max model through DashScope API.
