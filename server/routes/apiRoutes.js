import express from "express";
import { getData, postData } from "../controllers/dataController.js";
import { recordChoice } from "../controllers/choiceController.js";
import { askLLM, previewAIPrompt } from "../controllers/aiController.js";
import { assignCodename, validateCodename, saveCodename } from "../controllers/codenameController.js";
import { printText } from "../controllers/printerController.js";

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

export default router;