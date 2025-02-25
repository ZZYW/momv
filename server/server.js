// ---------------------------
// Dependencies
// ---------------------------
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { Low, JSONFile } = require("lowdb");

// ---------------------------
// Configuration
// ---------------------------
const app = express();
const port = process.env.BACKEND_PORT || 3001;
const apiKey = process.env.DASHSCOPE_API_KEY;

if (!apiKey) {
    console.error(
        "Missing LLM API key. Set DASHSCOPE_API_KEY in your environment variables."
    );
}

// ---------------------------
// Database Initialization
// ---------------------------
const adapter = new JSONFile("./data.json");
const db = new Low(adapter);

async function initDB() {
    await db.read();
    if (!db.data) {
        db.data = {}; // Set default data if empty
        await db.write();
    }
}
initDB();

// ---------------------------
// Middleware
// ---------------------------
app.use(cors());
app.use(express.json());

// ---------------------------
// Routes
// ---------------------------

// Compilation Endpoint: Returns a placeholder HTML for compiled playable projects.
// Enhanced /compile-playable endpoint for server.js
app.post("/compile-playable", (req, res) => {
    try {
        const { blocks } = req.body;

        if (!blocks || !Array.isArray(blocks)) {
            return res.status(400).send("Missing or invalid blocks data");
        }

        // Generate a unique player ID
        const playerID = `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Basic HTML structure for the playable story
        const compiledHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Story</title>
    <style>
        body {
            font-family: serif;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            background-color: #f9f9f9;
        }
        
        .passage {
            display: none;
            padding: 20px;
            background-color: white;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        
        .passage.active {
            display: block;
        }
        
        /* Plain block styling */
        .plain {
            display: block;
            margin-bottom: 15px;
            font-size: 18px;
        }
        
        /* Static options styling */
        .static-option-container {
            margin: 15px 0;
        }
        
        .static-option {
            display: block;
            padding: 10px;
            margin: 8px 0;
            cursor: pointer;
            border: 1px solid #ccc;
            border-radius: 4px;
            transition: all 0.2s ease;
        }
        
        .static-option:hover {
            background-color: #f0f0f0;
        }
        
        .static-option.selected {
            background: #e6f7ff;
            border-color: #1890ff;
            font-weight: bold;
        }
        
        .static-option.faded {
            opacity: 0.3;
        }
        
        /* Dynamic blocks styling */
        .dynamic-container {
            margin: 15px 0;
            padding: 15px;
            border-left: 3px solid #ccc;
            background-color: #f9f9f9;
        }
        
        .dynamic-text-result {
            font-style: italic;
            font-size: 18px;
        }
        
        .dynamic-word {
            font-weight: bold;
            border-bottom: 1px dotted #666;
        }
        
        /* Navigation */
        .next-link {
            display: inline-block;
            margin-top: 20px;
            padding: 8px 16px;
            background-color: #1890ff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
            cursor: pointer;
        }
        
        .next-link:hover {
            background-color: #096dd9;
        }
        
        /* Loading indicator */
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(0,0,0,0.2);
            border-radius: 50%;
            border-top-color: #1890ff;
            animation: spin 1s ease-in-out infinite;
            margin-left: 10px;
            vertical-align: middle;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Status bar */
        #status-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 10px;
            background-color: #f8f8f8;
            border-top: 1px solid #ddd;
            font-size: 12px;
            text-align: center;
            color: #666;
        }
        
        h2 {
            margin-top: 0;
            color: #333;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
    </style>
</head>
<body>
    <div id="player-data" data-player-id="${playerID}"></div>
    <div id="passage-container">
        <!-- Passages will be dynamically created here -->
    </div>
    <div id="status-bar">Story Player ID: ${playerID}</div>
    
    <script>
        // Server URL for API calls
        const SERVER_URL = 'http://localhost:3001';
        const playerID = '${playerID}';
        
        // Store the blocks data
        const projectBlocks = ${JSON.stringify(blocks)};
        
        // Initialize passages
        let currentPassageIndex = 0;
        const passages = [];
        
        // Group blocks into passages (divided by scene-header)
        function groupBlocksIntoPassages() {
            let currentPassage = [];
            
            projectBlocks.forEach(block => {
                if (block.type === 'scene-header' && currentPassage.length > 0) {
                    passages.push(currentPassage);
                    currentPassage = [];
                }
                currentPassage.push(block);
            });
            
            // Add the last passage if it has content
            if (currentPassage.length > 0) {
                passages.push(currentPassage);
            }
        }
        
        // Render a passage
        function renderPassage(passageIndex) {
            if (passageIndex >= passages.length) return;
            
            const passageBlocks = passages[passageIndex];
            const passageContainer = document.getElementById('passage-container');
            
            // Create passage element
            const passageElement = document.createElement('div');
            passageElement.className = 'passage';
            passageElement.id = 'passage-' + passageIndex;
            
            // Process each block in the passage
            passageBlocks.forEach(block => {
                const blockElement = document.createElement('div');
                blockElement.className = 'block ' + block.type;
                blockElement.dataset.uuid = block.uuid || '';
                
                switch(block.type) {
                    case 'plain':
                        blockElement.innerHTML = \`<div class="plain">\${block.text}</div>\`;
                        // Record the narrative being shown to the player
                        if (block.text) {
                            recordContentOnPaper(block.uuid || 'plain-' + Date.now(), block.text, 'narrative');
                        }
                        break;
                        
                    case 'static':
                        if (block.options && block.options.length) {
                            const optionsHtml = block.options.map((option, index) => 
                                \`<div class="static-option" data-index="\${index}" onclick="selectOption(this, '\${block.uuid}')">\${option}</div>\`
                            ).join('');
                            blockElement.innerHTML = \`<div class="static-option-container">\${optionsHtml}</div>\`;
                        }
                        break;
                        
                    case 'dynamic-option':
                        blockElement.innerHTML = \`
                            <div class="dynamic-container">
                                <div class="loading-indicator">Loading options... <span class="loading"></span></div>
                                <div class="dynamic-options-container" data-block-uuid="\${block.uuid}"></div>
                            </div>
                        \`;
                        // We'll load dynamic content after adding to DOM
                        break;
                        
                    case 'dynamic-text':
                        blockElement.innerHTML = \`
                            <div class="dynamic-container">
                                <div class="loading-indicator">Generating text... <span class="loading"></span></div>
                                <div class="dynamic-text-container" data-block-uuid="\${block.uuid}"></div>
                            </div>
                        \`;
                        // We'll load dynamic content after adding to DOM
                        break;
                        
                    case 'dynamic-word':
                        blockElement.innerHTML = \`
                            <div class="dynamic-container">
                                <div class="loading-indicator">Generating word... <span class="loading"></span></div>
                                <div class="dynamic-word-container" data-block-uuid="\${block.uuid}"></div>
                            </div>
                        \`;
                        // We'll load dynamic content after adding to DOM
                        break;
                        
                    case 'scene-header':
                        blockElement.innerHTML = \`<h2>\${block.titleName || 'Scene ' + (passageIndex + 1)}</h2>\`;
                        break;
                }
                
                passageElement.appendChild(blockElement);
            });
            
            // Add navigation link (if not the last passage)
            if (passageIndex < passages.length - 1) {
                const navElement = document.createElement('div');
                navElement.innerHTML = \`<a href="#" class="next-link" onclick="goToNextPassage(\${passageIndex})">Continue</a>\`;
                passageElement.appendChild(navElement);
            } else {
                // This is the last passage, add a "The End" message
                const endElement = document.createElement('div');
                endElement.innerHTML = '<div style="margin-top: 30px; text-align: center; font-style: italic;">The End</div>';
                passageElement.appendChild(endElement);
            }
            
            // Add to container
            passageContainer.appendChild(passageElement);
            
            // Process dynamic blocks after adding to DOM
            loadDynamicContent(passageElement);
        }
        
        // Load dynamic content for a passage
        function loadDynamicContent(passageElement) {
            // Dynamic options
            const dynamicOptionContainers = passageElement.querySelectorAll('.dynamic-options-container');
            dynamicOptionContainers.forEach(container => {
                const blockUUID = container.dataset.blockUuid;
                const block = projectBlocks.find(b => b.uuid === blockUUID);
                
                if (block) {
                    fetchDynamicContent(block, 'dynamic-option', container);
                }
            });
            
            // Dynamic text
            const dynamicTextContainers = passageElement.querySelectorAll('.dynamic-text-container');
            dynamicTextContainers.forEach(container => {
                const blockUUID = container.dataset.blockUuid;
                const block = projectBlocks.find(b => b.uuid === blockUUID);
                
                if (block) {
                    fetchDynamicContent(block, 'dynamic-text', container);
                }
            });
            
            // Dynamic word
            const dynamicWordContainers = passageElement.querySelectorAll('.dynamic-word-container');
            dynamicWordContainers.forEach(container => {
                const blockUUID = container.dataset.blockUuid;
                const block = projectBlocks.find(b => b.uuid === blockUUID);
                
                if (block) {
                    fetchDynamicContent(block, 'dynamic-word', container);
                }
            });
        }
        
        // Fetch dynamic content from server
        function fetchDynamicContent(block, blockType, container) {
            // Find the loading indicator
            const loadingIndicator = container.parentElement.querySelector('.loading-indicator');
            
            // Build context references
            const contextRefs = (block.context || []).map(ctx => ctx.value).filter(Boolean);
            
            // Call the server
            fetch(\`\${SERVER_URL}/generate-dynamic\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    playerID,
                    blockUUID: block.uuid,
                    instruction: block.prompt,
                    contextRefs,
                    blockType
                })
            })
            .then(response => response.json())
            .then(data => {
                // Hide loading indicator
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                
                if (blockType === 'dynamic-option') {
                    // Handle dynamic options
                    const options = data.data.options || [];
                    const optionsHtml = options.map((option, index) => 
                        \`<div class="static-option" data-index="\${index}" onclick="selectDynamicOption(this, '\${block.uuid}', \${index})">\${option}</div>\`
                    ).join('');
                    container.innerHTML = optionsHtml;
                } 
                else if (blockType === 'dynamic-text') {
                    // Handle dynamic text
                    container.innerHTML = \`<div class="dynamic-text-result">\${data.data.text || ''}</div>\`;
                    // Record the text being shown to the player
                    recordContentOnPaper(block.uuid, data.data.text, 'dynamic-text');
                }
                else if (blockType === 'dynamic-word') {
                    // Handle dynamic word
                    container.innerHTML = \`<span class="dynamic-word">\${data.data.text || ''}</span>\`;
                    // Record the word being shown to the player
                    recordContentOnPaper(block.uuid, data.data.text, 'dynamic-word');
                }
            })
            .catch(error => {
                console.error('Error fetching dynamic content:', error);
                container.innerHTML = 'Error loading content';
                if (loadingIndicator) loadingIndicator.style.display = 'none';
            });
        }
        
        // Handle static option selection
        function selectOption(element, blockUUID) {
            const container = element.parentElement;
            const options = container.querySelectorAll('.static-option');
            const chosenIndex = parseInt(element.dataset.index);
            const chosenText = element.textContent;
            
            // Mark selected and fade others
            options.forEach(option => {
                option.classList.add('faded');
                option.onclick = null; // Disable further clicks
            });
            element.classList.remove('faded');
            element.classList.add('selected');
            
            // Record the choice
            fetch(\`\${SERVER_URL}/record-choice\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    playerID,
                    blockUUID,
                    blockType: 'static',
                    availableOptions: Array.from(options).map(opt => opt.textContent),
                    chosenIndex,
                    chosenText
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log('Choice recorded:', data);
                // Also record what the player sees on the page
                recordContentOnPaper(blockUUID, chosenText, 'static-option');
            })
            .catch(error => {
                console.error('Error recording choice:', error);
            });
        }
        
        // Handle dynamic option selection
        function selectDynamicOption(element, blockUUID, chosenIndex) {
            const container = element.parentElement;
            const options = container.querySelectorAll('.static-option');
            const chosenText = element.textContent;
            
            // Mark selected and fade others
            options.forEach(option => {
                option.classList.add('faded');
                option.onclick = null; // Disable further clicks
            });
            element.classList.remove('faded');
            element.classList.add('selected');
            
            // Find the block to get its context
            const block = projectBlocks.find(b => b.uuid === blockUUID);
            const contextRefs = block ? (block.context || []).map(ctx => ctx.value).filter(Boolean) : [];
            
            // Record the choice
            fetch(\`\${SERVER_URL}/record-choice\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    playerID,
                    blockUUID,
                    blockType: 'dynamic-option',
                    availableOptions: Array.from(options).map(opt => opt.textContent),
                    chosenIndex,
                    chosenText,
                    instruction: block ? block.prompt : '',
                    contextBlocks: contextRefs
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log('Dynamic choice recorded:', data);
                // Also record what the player sees on the page
                recordContentOnPaper(blockUUID, chosenText, 'dynamic-option');
            })
            .catch(error => {
                console.error('Error recording dynamic choice:', error);
            });
        }
        
        // Record content that is shown to the player
        function recordContentOnPaper(passageID, content, contentType, interactionData) {
            fetch(\`\${SERVER_URL}/record-on-paper\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    playerID,
                    passageID,
                    content,
                    contentType,
                    interactionData
                })
            })
            .then(response => response.json())
            .catch(error => {
                console.error('Error recording on-paper content:', error);
            });
        }
        
        // Navigate to next passage
        function goToNextPassage(currentIndex) {
            const current = document.getElementById('passage-' + currentIndex);
            const nextIndex = currentIndex + 1;
            let next = document.getElementById('passage-' + nextIndex);
            
            if (current) {
                current.classList.remove('active');
            }
            
            if (!next) {
                // Need to render the next passage first
                renderPassage(nextIndex);
                next = document.getElementById('passage-' + nextIndex);
            }
            
            if (next) {
                next.classList.add('active');
                currentPassageIndex = nextIndex;
                window.scrollTo(0, 0); // Scroll to top for new passage
            }
        }
        
        // Initialize the playable app
        function initPlayable() {
            groupBlocksIntoPassages();
            renderPassage(0);
            
            // Show the first passage
            const firstPassage = document.getElementById('passage-0');
            if (firstPassage) {
                firstPassage.classList.add('active');
            }
        }
        
        // Start the app
        window.onload = initPlayable;
    </script>
</body>
</html>
        `;

        res.send(compiledHTML);
    } catch (error) {
        console.error("Error compiling playable version:", error);
        res.status(500).send("Internal Server Error while compiling playable version.");
    }
});

app.post("/generate-dynamic", async (req, res) => {
    const {
        playerID,
        blockUUID,
        instruction,
        contextRefs,
        blockType
    } = req.body;

    // Basic validation
    if (!playerID || !blockUUID || !blockType || !instruction) {
        return res.status(400).json({ error: "Missing required fields for dynamic generation." });
    }

    try {
        // 1. Gather the user's context from previously chosen blocks
        await db.read();
        const playerChoices = db.data.players?.[playerID]?.choices || {};
        const relevantContext = [];

        if (Array.isArray(contextRefs)) {
            for (const refUUID of contextRefs) {
                const refChoice = playerChoices[refUUID];
                if (refChoice) {
                    relevantContext.push(refChoice);
                }
            }
        }

        // Get player's history of content seen for additional context
        const playerData = db.data.players?.[playerID] || {};
        const onPaperContent = playerData.onPaper || {};

        // Convert to array and get recent entries
        const contentHistory = Object.entries(onPaperContent)
            .map(([id, data]) => ({
                passageID: id,
                ...data
            }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5); // Most recent entries

        // 2. Construct a prompt based on block type
        let promptInstructions = `Instructions: ${instruction}\n\n`;

        if (blockType === 'dynamic-option') {
            promptInstructions += `Generate a list of options for the player based on their previous choices and the current context. Format your response as JSON with an "options" array and "thinking_reasoning" field.\n\n`;
        } else if (blockType === 'dynamic-text') {
            promptInstructions += `Generate a coherent paragraph of text based on the player's previous choices and context. Format your response as JSON with a "text" field and "thinking_reasoning" field.\n\n`;
        } else if (blockType === 'dynamic-word') {
            promptInstructions += `Generate a single word based on the context. Format your response as JSON with a "text" field containing the generated word and a "thinking_reasoning" field.\n\n`;
        }

        // Add context about player's previous choices
        let contextDescription = "Player's previous choices:\n";
        if (relevantContext.length > 0) {
            contextDescription += relevantContext.map(ctx =>
                `- Block ${ctx.blockType}: Selected "${ctx.chosenText}" from options: [${ctx.availableOptions.join(', ')}]`
            ).join('\n');
        } else {
            contextDescription += "No specific choices referenced.";
        }

        // Add recent content seen by the player
        if (contentHistory.length > 0) {
            contextDescription += "\n\nRecent content seen by the player:\n";
            contentHistory.forEach(content => {
                contextDescription += `- ${content.contentType}: "${content.content}"\n`;
            });
        }

        const llmPrompt = `
${promptInstructions}

${contextDescription}

Response format example for ${blockType}:
${blockType === 'dynamic-option' ?
                '{"thinking_reasoning": "My thought process...", "options": ["First option", "Second option", "Third option"]}' :
                '{"thinking_reasoning": "My thought process...", "text": "The generated text content here..."}'
            }
`.trim();

        // 3. Call the LLM API
        // Simulating a response in case the API key isn't available
        let parsed;
        if (!apiKey) {
            console.log("No API key available, returning simulated response");
            if (blockType === 'dynamic-option') {
                parsed = {
                    thinking_reasoning: "Simulated response - no API key available",
                    options: ["Option 1 (simulated)", "Option 2 (simulated)", "Option 3 (simulated)"]
                };
            } else {
                parsed = {
                    thinking_reasoning: "Simulated response - no API key available",
                    text: blockType === 'dynamic-word' ? "word" : "This is a simulated response because no API key was provided."
                };
            }
        } else {
            // Call the actual LLM API
            const response = await axios.post(
                "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
                {
                    model: "qwen-turbo",
                    messages: [
                        { role: "system", content: "You are a helpful assistant that generates content for an interactive story." },
                        { role: "user", content: llmPrompt }
                    ],
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                    },
                }
            );

            // Parse the LLM response
            const llmReply = response.data?.choices?.[0]?.message?.content || "{}";
            try {
                parsed = JSON.parse(llmReply);
            } catch (err) {
                console.error("Error parsing LLM reply:", err);

                // Create a default response based on block type
                if (blockType === 'dynamic-option') {
                    parsed = {
                        thinking_reasoning: "Error parsing LLM response",
                        options: ["Option 1", "Option 2", "Option 3"]
                    };
                } else {
                    parsed = {
                        thinking_reasoning: "Error parsing LLM response",
                        text: blockType === 'dynamic-word' ? "fallback" : "The system encountered an error generating this content."
                    };
                }
            }
        }

        // 4. Store generated data in the DB for this block
        if (!db.data.players) db.data.players = {};
        if (!db.data.players[playerID]) db.data.players[playerID] = { choices: {}, onPaper: {} };

        const blockEntry = db.data.players[playerID].choices[blockUUID] || {};
        blockEntry.blockType = blockType;
        blockEntry.instruction = instruction;
        blockEntry.contextBlocks = contextRefs;

        if (blockType === 'dynamic-option') {
            blockEntry.generatedOptions = parsed.options || [];
        } else {
            blockEntry.generatedText = parsed.text || "";
        }

        blockEntry.timestamp = new Date().toISOString();

        db.data.players[playerID].choices[blockUUID] = blockEntry;
        await db.write();

        // 5. Return the generated content to the client
        res.json({
            status: "success",
            data: {
                thinking_reasoning: parsed.thinking_reasoning || "",
                options: blockType === 'dynamic-option' ? (parsed.options || []) : [],
                text: blockType !== 'dynamic-option' ? (parsed.text || "") : ""
            }
        });
    } catch (error) {
        console.error("Error in dynamic generation:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// ---------------------------
// Database Endpoints
// ---------------------------

// GET /data: Retrieve stored data.
app.get("/data", async (req, res) => {
    await db.read();
    res.json(db.data);
});

// POST /data: Update stored data.
app.post("/data", async (req, res) => {
    db.data = req.body;
    await db.write();
    res.json({ status: "success" });
});


/**
 * Helper to remember a user's choice in the DB.
 */
async function rememberOption(playerID, blockUUID, blockType, availableOptions, chosenIndex, chosenText, instruction, contextBlocks) {
    await db.read();

    // Initialize player object
    if (!db.data.players) {
        db.data.players = {};
    }
    if (!db.data.players[playerID]) {
        db.data.players[playerID] = { choices: {} };
    }

    // Write choice data
    db.data.players[playerID].choices[blockUUID] = {
        blockType,
        availableOptions,
        chosenIndex,
        chosenText,
        instruction: instruction || null,
        contextBlocks: contextBlocks || [],
        timestamp: new Date().toISOString()
    };

    await db.write();
    return db.data.players[playerID].choices[blockUUID];
}

/**
 * POST /record-on-paper
 * Records the rendered content shown to the player.
 * Expects JSON body with:
 *   - playerID
 *   - passageID (or blockUUID)
 *   - content (the actual rendered text/options seen by player)
 *   - contentType (e.g., 'narrative', 'option', 'dynamic-text', etc.)
 *   - interactionData (optional - additional data about how player interacted)
 */
app.post("/record-on-paper", async (req, res) => {
    const {
        playerID,
        passageID,
        content,
        contentType,
        interactionData
    } = req.body;

    // Basic validation
    if (!playerID || !passageID || !content) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        await db.read();

        // Initialize player object if needed
        if (!db.data.players) {
            db.data.players = {};
        }
        if (!db.data.players[playerID]) {
            db.data.players[playerID] = { choices: {}, onPaper: {} };
        }
        if (!db.data.players[playerID].onPaper === undefined) {
            db.data.players[playerID].onPaper = {};
        }

        // Store the on-paper content
        db.data.players[playerID].onPaper[passageID] = {
            content,
            contentType,
            interactionData: interactionData || null,
            timestamp: new Date().toISOString()
        };

        await db.write();
        res.json({ status: "success" });
    } catch (error) {
        console.error("Error recording on-paper content:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * GET /player-context/:playerID
 * Retrieves a player's full interaction history in chronological order.
 * Useful for providing context to LLM interactions.
 */
app.get("/player-context/:playerID", async (req, res) => {
    const { playerID } = req.params;

    try {
        await db.read();

        if (!db.data.players || !db.data.players[playerID]) {
            return res.status(404).json({ error: "Player not found" });
        }

        const playerData = db.data.players[playerID];
        const onPaperContent = playerData.onPaper || {};

        // Convert to array and sort chronologically
        const contentHistory = Object.entries(onPaperContent)
            .map(([id, data]) => ({
                passageID: id,
                ...data
            }))
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        res.json({
            playerID,
            contentHistory
        });
    } catch (error) {
        console.error("Error retrieving player context:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * POST /record-choice
 * Records which option the user picked.
 * Expects JSON body with:
 *   - playerID
 *   - blockUUID
 *   - blockType (static, dynamic-option, etc.)
 *   - availableOptions (array of strings)
 *   - chosenIndex
 *   - chosenText
 *   - instruction (if this was a dynamic block)
 *   - contextBlocks (array of block UUIDs used to generate the dynamic text or options)
 */
app.post("/record-choice", async (req, res) => {
    const {
        playerID,
        blockUUID,
        blockType,
        availableOptions,
        chosenIndex,
        chosenText,
        instruction,
        contextBlocks
    } = req.body;

    // Basic validation
    if (!playerID || !blockUUID || chosenIndex === undefined || !availableOptions) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const stored = await rememberOption(
            playerID,
            blockUUID,
            blockType,
            availableOptions,
            chosenIndex,
            chosenText,
            instruction,
            contextBlocks
        );

        res.json({ status: "success", data: stored });
    } catch (error) {
        console.error("Error recording choice:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



/**
 * POST /generate-dynamic
 * Expects JSON with { playerID, blockUUID, instruction, contextRefs, blockType }
 * The server compiles a prompt using block data + user choices for referenced blocks.
 * Then it calls the LLM to generate new options or text.
 * Finally, it stores the generated data in the DB for that block.
 */
app.post("/generate-dynamic", async (req, res) => {
    const {
        playerID,
        blockUUID,
        instruction,
        contextRefs,  // e.g. an array of block UUIDs
        blockType     // e.g. "dynamic-option" or "dynamic-text"
    } = req.body;

    // Basic checks
    if (!playerID || !blockUUID || !blockType || !instruction) {
        return res.status(400).json({ error: "Missing required fields for dynamic generation." });
    }

    try {
        // 1. Gather the user’s context from previously chosen blocks.
        await db.read();
        const playerChoices = db.data.players?.[playerID]?.choices || {};
        const relevantContext = [];

        if (Array.isArray(contextRefs)) {
            for (const refUUID of contextRefs) {
                const refChoice = playerChoices[refUUID];
                if (refChoice) {
                    relevantContext.push(refChoice);
                }
            }
        }

        // 2. Construct a prompt to send to the LLM (this is a minimal example).
        const llmPrompt = `
            Instruction: ${instruction}
            User context: ${JSON.stringify(relevantContext, null, 2)}
        `.trim();

        // 3. Call the LLM
        // Here we reuse the same DashScope client or any other LLM endpoint
        const response = await axios.post(
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
            {
                model: "qwen-turbo",
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
                    { role: "user", content: llmPrompt }
                ],
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}`,
                },
            }
        );

        // 4. Parse the LLM response (example below looks for a JSON structure).
        const llmReply = response.data?.choices?.[0]?.message?.content || "{}";
        let parsed;
        try {
            parsed = JSON.parse(llmReply);
        } catch (err) {
            parsed = { thinking_reasoning: "", options: [] };
        }

        // 5. Store generated data in the DB for this block.
        if (!db.data.players) db.data.players = {};
        if (!db.data.players[playerID]) db.data.players[playerID] = { choices: {} };

        const blockEntry = db.data.players[playerID].choices[blockUUID] || {};
        blockEntry.blockType = blockType;
        blockEntry.instruction = instruction;
        blockEntry.contextBlocks = contextRefs;
        blockEntry.generatedOptions = parsed.options || []; // If it's a dynamic-option
        blockEntry.generatedText = parsed.text || "";        // If it's dynamic-text
        blockEntry.timestamp = new Date().toISOString();

        // (Optional) store the entire LLM reply for debugging
        blockEntry.llmRawResponse = llmReply;

        db.data.players[playerID].choices[blockUUID] = blockEntry;
        await db.write();

        // 6. Return the generated content to the client
        res.json({
            status: "success",
            data: {
                thinking_reasoning: parsed.thinking_reasoning,
                options: blockEntry.generatedOptions,
                text: blockEntry.generatedText
            }
        });
    } catch (error) {
        console.error("Error in dynamic generation:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


/**
 * GET /block-details/:uuid
 * Retrieves detailed information about a specific block (static or dynamic),
 * along with the user's existing choices if available.
 */
app.get("/block-details/:uuid", async (req, res) => {
    const { uuid } = req.params;
    const { playerID } = req.query;

    try {
        // Ensure the database is up to date
        await db.read();

        // Your stored blocks might come from db.data.blocks or some other place;
        // for demonstration, assume there's a top-level "blocks" array in db.data.
        const allBlocks = db.data.blocks || [];

        // Find the block in the project
        const block = allBlocks.find((b) => b.uuid === uuid);
        if (!block) {
            return res.status(404).json({ error: "Block not found." });
        }

        // Look up player choices if playerID exists
        let playerBlockData;
        if (playerID && db.data.players && db.data.players[playerID]) {
            playerBlockData = db.data.players[playerID].choices?.[uuid];
        }

        // Return both the block data (author-defined) and any stored data (user choice, dynamic generation results, etc.)
        res.json({
            block,
            playerBlockData: playerBlockData || null
        });
    } catch (error) {
        console.error("Error retrieving block details:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// ---------------------------
// AI Proxy Endpoint
// ---------------------------

// POST /ai: Forwards a message to the AI API and returns its reply.
app.post("/ai", async (req, res) => {
    const { message } = req.body;

    try {
        const response = await axios.post(
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
            {
                model: "qwen-turbo",
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
                    { role: "user", content: message },
                ],
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
            }
        );

        const reply =
            response.data?.choices &&
            response.data.choices[0].message?.content ||
            "No reply received";
        res.json({ reply });
    } catch (error) {
        console.error("Error calling AI API:", error.message);
        res.json({ reply: "Simulated response: I am the AI, but an error occurred." });
    }
});

// ---------------------------
// Server Startup
// ---------------------------
app.listen(port, () => {
    console.log(`DB/AI server running at http://localhost:${port}`);
});
