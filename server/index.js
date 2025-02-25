// server/index.js
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { compilePlayable } from "./controllers/compileController.js";
import { getData, postData } from "./controllers/dataController.js";
import { recordChoice } from "./controllers/choiceController.js";
import { askLLM } from "./controllers/aiController.js";

const app = express();
const port = process.env.BACKEND_PORT || 3001;
const apiKey = process.env.DASHSCOPE_API_KEY;

if (!apiKey) {
    console.error("Missing LLM API key. Set DASHSCOPE_API_KEY in your environment variables.");
}

app.use(cors());
app.use(express.json());

// Existing Routes
app.post("/compile-playable", compilePlayable);
app.get("/", function (req, res) {
    res.send("hello world");
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