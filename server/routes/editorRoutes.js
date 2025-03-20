import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { compilePlayable } from "../controllers/compileController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.dirname(__dirname);
const rootDir = path.dirname(serverDir);
const clientDir = path.join(rootDir, "client");

const router = express.Router();

// Serve two editor front ends—one for station1 and one for station2
router.use("/editor/station1", express.static(path.join(clientDir, "src/sites", "editor")));
router.use("/editor/station2", express.static(path.join(clientDir, "src/sites", "editor")));

// Editor API routes (parameterized by station)
// The compile-playable route is used exclusively by the editor.
router.post("/editor/compile-playable/:station", (req, res) => {
    const { station } = req.params;
    if (!["station1", "station2"].includes(station)) {
        return res.status(400).send("Invalid station specified");
    }
    // Optionally, pass station info to compilePlayable if needed.
    compilePlayable(req, res);
});

// Save story JSON locally in the corresponding station's input folder.
router.post("/editor/save-story-json/:station", (req, res) => {
    const { station } = req.params;
    if (!["station1", "station2"].includes(station)) {
        return res.status(400).send("Invalid station specified");
    }
    const { blocks } = req.body;
    if (!blocks || !Array.isArray(blocks)) {
        return res.status(400).send("Missing or invalid blocks data");
    }
    const dirPath = path.join(clientDir, "src/sites", station, "input");
    console.log(`Saving the file into ${dirPath}`);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    // Generate a filename using the current epoch timestamp.
    const filePath = path.join(dirPath, `story.json`);
    fs.writeFile(filePath, JSON.stringify({ blocks }, null, 2), (err) => {
        if (err) {
            logger.error("Error writing story JSON file:", err);
            return res.status(500).send("Error saving story");
        }
        res.json({ success: true, filePath });
    });
});

// Control Panel (only in dev mode)
router.use("/cp", express.static(path.join(clientDir, "src/sites", "cp")));

export default router;