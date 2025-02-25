import express from "express";
import axios from "axios";
import cors from "cors";
import { JSONFilePreset } from 'lowdb/node';
import fs from "fs";
import path from "path";

// ---------------------------
// Configuration
// ---------------------------
const app = express();
const port = process.env.BACKEND_PORT || 3001;
const apiKey = process.env.DASHSCOPE_API_KEY;

if (!apiKey) {
    console.error("Missing LLM API key. Set DASHSCOPE_API_KEY in your environment variables.");
}

// ---------------------------
// Database Initialization
// ---------------------------
const defaultData = { players: {}, blocks: [] };
const db = await JSONFilePreset("./data.json", defaultData);

// ---------------------------
// Middleware
// ---------------------------
app.use(cors());
app.use(express.json());

// ---------------------------
// Routes
// ---------------------------
app.post("/compile-playable", (req, res) => {
    const { blocks } = req.body;

    if (!blocks || !Array.isArray(blocks)) {
        return res.status(400).send("Missing or invalid blocks data");
    }

    const templatePath = path.join("templates", "playableTemplate.html");
    fs.readFile(templatePath, "utf8", (err, template) => {
        if (err) {
            console.error("Error reading template file:", err);
            return res.status(500).send("Internal Server Error reading template");
        }
        const compiledHTML = template.replace("<!--PROJECT_BLOCKS_PLACEHOLDER-->", JSON.stringify(blocks));
        res.send(compiledHTML);
    });
});

app.get("/data", async (req, res) => {
    await db.read();
    res.json(db.data);
});

app.post("/data", async (req, res) => {
    db.data = req.body;
    await db.write();
    res.json({ status: "success" });
});

app.post("/record-choice", async (req, res) => {
    const { playerID, blockUUID, blockType, availableOptions, chosenIndex, chosenText, instruction, contextBlocks } = req.body;

    if (!playerID || !blockUUID || chosenIndex === undefined || !availableOptions) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    await db.read();
    if (!db.data.players[playerID]) db.data.players[playerID] = { choices: {} };

    db.data.players[playerID].choices[blockUUID] = {
        blockType,
        availableOptions,
        chosenIndex,
        chosenText,
        instruction,
        contextBlocks,
        timestamp: new Date().toISOString()
    };

    await db.write();
    res.json({ status: "success", data: db.data.players[playerID].choices[blockUUID] });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
