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
2. Use the toolbar to add different types of blocks:
   - **Plain Block**: Simple narrative text
   - **Static Option**: Pre-authored choices for the reader
   - **Dynamic Option**: AI-generated choices
   - **Dynamic Text**: AI-generated narrative passages
   - **Dynamic Word**: AI-generated lexical items
   - **Scene Header**: Organizes content into scenes
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

## File Structure
```
momv/
├── server/             # Server-side code
│   ├── controllers/    # API endpoint controllers
│   ├── utils/          # Utility functions and AI prompt crafting
│   └── sites/          # Web interfaces
│       ├── station1/   # Station 1 interface and story files
│       ├── station2/   # Station 2 interface 
│       ├── editor/     # Story editor interface
│       └── cp/         # Control panel for testing API endpoints
├── database.json       # LowDB database file (created automatically)
└── package.json        # Project dependencies
```

## AI Functionality

MOMV uses structured prompts to generate contextually appropriate narrative content:

- **Dynamic Text**: Generates narrative passages based on story context and user choices
- **Dynamic Options**: Creates meaningful choice options that fit the story
- **Dynamic Words**: Generates individual words (nouns, adjectives, adverbs) that add texture to the narrative

The AI system is specifically tuned for Chinese language generation using Qwen-Max model through DashScope API.

## Development

### Adding New Block Types
To extend the platform with new interactive elements:
1. Update the editor interface in `server/sites/editor/index.html`
2. Add rendering logic in station template files
3. Implement any necessary backend support in controllers

### AI Prompt Templates
The system uses natural language templates for AI generation, located in `server/utils/templates.ejs`. These templates are designed to be writer-friendly and easily customizable.

#### Key Template Features:
- **Natural Language Format**: Templates use plain language instead of technical XML tags
- **Modular Structure**: Common elements are extracted to reduce duplication
- **Descriptive Variables**: Clear variable names like `{number_of_sentences}` make templates intuitive
- **Preview Functionality**: Use the `/preview-prompt` API endpoint to see the complete prompt before sending to AI

#### Customizing Templates:
1. Open `server/utils/templates.ejs`
2. Edit the relevant section (dynamic-option, dynamic-text, dynamic-word)
3. Maintain the existing variable placeholders (e.g., `{number_of_choices}`)
4. Save your changes and restart the server
5. Use the preview functionality to test your changes

#### Template Preview Tool
The Control Panel includes a dedicated Template Preview tab that allows writers to visually test how template changes affect the final AI prompts:

1. Open the Control Panel at http://localhost:3001/cp
2. Click on the "Template Preview" tab
3. Select the block type (dynamic-option, dynamic-text, or dynamic-word)
4. Fill in the required parameters (number of choices, sentences, or word category)
5. Add a custom message
6. Click "Generate Preview" to see the exact prompt that will be sent to the AI

This feature helps writers understand and refine the prompt templates without needing to know the technical details of the API.

## Troubleshooting

- If dynamic content fails to generate, check your `DASHSCOPE_API_KEY` environment variable
- For database issues, you may need to delete the `database.json` file and restart the server
- Station issues can often be resolved by checking browser console errors