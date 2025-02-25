// server/index.js
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { compilePlayable } from "./controllers/compileController.js";
import { getData, postData } from "./controllers/dataController.js";
import { recordChoice } from "./controllers/choiceController.js";
import { askLLM } from "./controllers/aiController.js";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.BACKEND_PORT || 3001;
const apiKey = process.env.DASHSCOPE_API_KEY;

if (!apiKey) {
    console.error("Missing LLM API key. Set DASHSCOPE_API_KEY in your environment variables.");
}

app.use(cors());
app.use(express.json());
// Add this near the top of your middleware section, before your routes
app.use((req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    next();
});

// Existing Routes
app.post("/compile-playable", compilePlayable);
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "static", "control-panel.html"));
});
app.get("/data", getData);
app.post("/data", postData);
app.post("/record-choice", recordChoice);
app.post("/generate-dynamic", askLLM);

// New endpoint to save story JSON
app.post("/save-story-json", (req, res) => {
    const { blocks } = req.body;
    if (!blocks || !Array.isArray(blocks)) {
        return res.status(400).send("Missing or invalid blocks data");
    }

    // Ensure directory exists
    const dirPath = path.join("station1", "input");
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write the JSON file
    const filePath = path.join(dirPath, "story1.json");
    fs.writeFile(filePath, JSON.stringify({ blocks }, null, 2), (err) => {
        if (err) {
            console.error("Error writing story JSON file:", err);
            return res.status(500).send("Error saving story");
        }
        res.json({ success: true, filePath });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});