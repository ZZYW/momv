import express from "express";
import { getData, postData } from "../controllers/dataController.js";
import { recordChoice } from "../controllers/choiceController.js";
import { askLLM, previewAIPrompt } from "../controllers/aiController.js";
import { assignCodename, validateCodename, saveCodename } from "../controllers/codenameController.js";
import { printText } from "../controllers/printerController.js";
import { getBlockData } from "../controllers/storyRetriever.ts";
import { generateBox } from "../controllers/asciiBoxController.js";
import db from "../db.js";

const router = express.Router();

// Data endpoints
router.get("/data", getData);
router.post("/data", postData);

// Choice endpoint
router.post("/record-choice", recordChoice);

// AI endpoints
router.post("/generate-dynamic", askLLM);
router.post("/preview-prompt", previewAIPrompt);

// Printer endpoint
router.post("/print", (req, res) => {
    console.log("Received print request:", req.body);
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: "Missing text parameter" });
    }

    printText(text);
    res.json({ success: true });
});

// Codename endpoints
router.post("/assign-codename", (req, res) => {
    console.log("Received assignCodename request:", req.body);
    return assignCodename(req, res);
});

router.post("/validate-codename", (req, res) => {
    console.log("Received validateCodename request:", req.body);
    return validateCodename(req, res);
});

router.post("/save-codename", (req, res) => {
    console.log("Received saveCodename request:", req.body);
    return saveCodename(req, res);
});

// Get a player's answer for a specific question
router.get("/get-player-answer", async (req, res) => {
    const { playerId, questionId } = req.query;
    
    if (!playerId || !questionId) {
        return res.status(400).json({ error: "Missing required parameters: playerId and questionId" });
    }
    
    try {
        const blockData = await getBlockData(questionId, playerId);
        
        if (blockData && blockData.playerChoice && blockData.playerChoice.chosenText) {
            return res.json({ answer: blockData.playerChoice.chosenText });
        } else {
            return res.json({ answer: "" });
        }
    } catch (error) {
        console.error("Error retrieving player answer:", error);
        return res.status(500).json({ error: "Failed to retrieve answer" });
    }
});

// Get all of a player's selections for client-side storage
router.get("/get-player-selections", async (req, res) => {
    const { playerId } = req.query;
    
    if (!playerId) {
        return res.status(400).json({ error: "Missing required parameter: playerId" });
    }
    
    try {
        await db.read();
        
        if (!db.data || !db.data.players || !db.data.players[playerId] || !db.data.players[playerId].choices) {
            return res.status(404).json({});
        }
        
        // Format player choices for client-side storage
        const playerChoices = db.data.players[playerId].choices;
        const formattedChoices = {};
        
        // Convert from DB format to the format expected by the client
        Object.entries(playerChoices).forEach(([blockId, choiceData]) => {
            formattedChoices[blockId] = {
                chosenIndex: choiceData.chosenIndex,
                chosenText: choiceData.chosenText,
                availableOptions: choiceData.availableOptions || []
            };
        });
        
        return res.json(formattedChoices);
    } catch (error) {
        console.error("Error retrieving player selections:", error);
        return res.status(500).json({ error: "Failed to retrieve player selections" });
    }
});

// Get a player's codename
router.get("/get-player-codename", async (req, res) => {
    const { playerId } = req.query;
    
    if (!playerId) {
        return res.status(400).json({ error: "Missing required parameter: playerId" });
    }
    
    try {
        await db.read();
        
        if (!db.data || !db.data.players || !db.data.players[playerId]) {
            return res.json({ codename: "" });
        }
        
        const codename = db.data.players[playerId].codename || "";
        return res.json({ codename });
    } catch (error) {
        console.error("Error retrieving player codename:", error);
        return res.status(500).json({ error: "Failed to retrieve player codename" });
    }
});

// ASCII Box endpoint
router.post("/ascii-box", generateBox);

export default router;