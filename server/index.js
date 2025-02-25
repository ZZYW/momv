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
app.post("/compile-playable", (req, res) => {
    try {
        const placeholderOutput = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8" /><title>Playable</title></head>
      <body>
        <h1>Placeholder Playable Output</h1>
        <p>Replace with your compiled Twine-like HTML content.</p>
      </body>
      </html>
    `;
        res.send(placeholderOutput);
    } catch (error) {
        console.error("Error compiling playable version:", error);
        res.status(500).send("Internal Server Error while compiling playable version.");
    }
});

// Dynamic Processing Endpoint: Returns a placeholder JSON object.
app.post("/process-dynamic", (req, res) => {
    return res.json({ text: "Placeholder dynamic content" });
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
