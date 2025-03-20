import express from "express";
import { getData, postData } from "../controllers/dataController.js";
import { recordChoice } from "../controllers/choiceController.js";
import { askLLM, previewAIPrompt } from "../controllers/aiController.js";
import { assignCodename, validateCodename, saveCodename } from "../controllers/codenameController.js";
import { printText } from "../controllers/printerController.js";
import { getBlockData } from "../controllers/storyRetriever.ts";
import { generateBox } from "../controllers/asciiBoxController.js";
import { drawFulu } from "../controllers/taoist.ts";
import db from "../db.js";
import logger from '../utils/logger.js';

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
    logger.info("Received print request");
    const { text } = req.body;

    if (!text) {
        logger.warn("Print request missing text parameter");
        return res.status(400).json({ error: "Missing text parameter" });
    }

    try {
        const printResult = printText(text);
        if (printResult === false) {
            // The printer function handled the error and returned false
            return res.status(200).json({ 
                success: false, 
                message: "Print operation failed but was handled gracefully" 
            });
        }
        logger.info("Print request processed successfully");
        return res.status(200).json({ success: true });
    } catch (error) {
        logger.error("Unexpected error in print endpoint:", error);
        return res.status(500).json({ 
            success: false, 
            error: "Print operation failed with an unexpected error" 
        });
    }
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
        logger.error("Error retrieving player answer:", error);
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
        try {
            await db.read();
        } catch (dbReadError) {
            logger.error("Database read error:", dbReadError);
            return res.status(500).json({ error: "Database read error", message: "Failed to read player data" });
        }
        
        if (!db.data) {
            logger.error("Database data is null or undefined");
            return res.status(500).json({ error: "Database corruption", message: "Database appears to be corrupted" });
        }
        
        if (!db.data.players || !db.data.players[playerId] || !db.data.players[playerId].choices) {
            // Not necessarily an error - could be a new player
            logger.info(`No choices found for player: ${playerId}`);
            return res.status(200).json({});
        }
        
        try {
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
        } catch (formattingError) {
            logger.error("Error formatting player choices:", formattingError);
            return res.status(500).json({ error: "Data processing error", message: "Failed to process player choices" });
        }
    } catch (error) {
        logger.error("Error retrieving player selections:", error);
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
        try {
            await db.read();
        } catch (dbReadError) {
            logger.error("Database read error in get-player-codename:", dbReadError);
            return res.status(500).json({ error: "Database read error", message: "Failed to read player data" });
        }
        
        if (!db.data) {
            logger.error("Database data is null or undefined in get-player-codename");
            return res.status(500).json({ error: "Database corruption", message: "Database appears to be corrupted" });
        }
        
        if (!db.data.players || !db.data.players[playerId]) {
            logger.info(`No codename found for player: ${playerId}`);
            return res.json({ codename: "" });
        }
        
        const codename = db.data.players[playerId].codename || "";
        return res.json({ codename });
    } catch (error) {
        logger.error("Error retrieving player codename:", error);
        return res.status(500).json({ error: "Failed to retrieve player codename" });
    }
});

// ASCII Box endpoint
router.post("/ascii-box", generateBox);

// Fulu endpoint
router.post("/draw-fulu", async (req, res) => {
    console.log("Received draw-fulu request:", req.body);
    const { playerId } = req.body;
    
    if (!playerId) {
        return res.status(400).json({ error: "Missing required parameter: playerId" });
    }
    
    try {
        const fuluText = await drawFulu(playerId);
        return res.json({ success: true, fuluText });
    } catch (error) {
        logger.error("Error generating Fulu:", error);
        return res.status(500).json({ error: "Failed to generate Fulu", message: error.message });
    }
});

// Configuration endpoint for client-side routing
router.get("/server-config", (req, res) => {
    // Check if CENTRAL_BACKEND_URL is defined in environment
    const central_backend_url = process.env.CENTRAL_BACKEND_URL;
    
    // Return a configuration object for the client
    res.json({
        apiServerUrl: central_backend_url || req.protocol + '://' + req.get('host'),
        hasCentralBackend: !!central_backend_url
    });
});

export default router;