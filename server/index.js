import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { compilePlayable } from "./controllers/compileController.js";
import { getData, postData } from "./controllers/dataController.js";
import { recordChoice } from "./controllers/choiceController.js";
import { askLLM, previewAIPrompt } from "./controllers/aiController.js";
import { assignCodename, validateCodename, saveCodename } from "./controllers/codenameController.js";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";

// If defined, CENTRAL_BACKEND_URL is used for station routes.
const central_backend_url = process.env.CENTRAL_BACKEND_URL;
// Check production mode based on command line arguments.
const isProd = process.argv.includes("prod");

const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
    });
    next();
});

app.use("/assets", express.static(path.join(__dirname, "assets")));

// Make utils directory accessible for codename components
app.use("/utils", express.static(path.join(__dirname, "utils")));

// ----------------------------------------------
// Editor Routes (always local – dev mode only)
// ----------------------------------------------
if (!isProd) {
    // Serve two editor front ends—one for station1 and one for station2.
    app.use("/editor/station1", express.static(path.join(__dirname, "sites", "editor")));
    app.use("/editor/station2", express.static(path.join(__dirname, "sites", "editor")));

    // Editor API routes (parameterized by station)
    // The compile-playable route is used exclusively by the editor.
    app.post("/compile-playable/:station", (req, res) => {
        const { station } = req.params;
        if (!["station1", "station2"].includes(station)) {
            return res.status(400).send("Invalid station specified");
        }
        // Optionally, pass station info to compilePlayable if needed.
        compilePlayable(req, res);
    });

    // Save story JSON locally in the corresponding station's input folder.
    app.post("/save-story-json/:station", (req, res) => {
        const { station } = req.params;
        if (!["station1", "station2"].includes(station)) {
            return res.status(400).send("Invalid station specified");
        }
        const { blocks } = req.body;
        if (!blocks || !Array.isArray(blocks)) {
            return res.status(400).send("Missing or invalid blocks data");
        }
        const dirPath = path.join(__dirname, "sites", station, "input");
        console.log(`Saving the file into ${dirPath}`);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        // Generate a filename using the current epoch timestamp.
        const filePath = path.join(dirPath, `story.json`);
        fs.writeFile(filePath, JSON.stringify({ blocks }, null, 2), (err) => {
            if (err) {
                console.error("Error writing story JSON file:", err);
                return res.status(500).send("Error saving story");
            }
            res.json({ success: true, filePath });
        });
    });

    // Control Panel (only in dev mode)
    app.use("/cp", express.static(path.join(__dirname, "sites", "cp")));
} else {
    console.log("Production mode: Editor and Control Panel are not being served.");
}

// -------------------------------------------------
// Station Routes (used by station1 and station2)
// -------------------------------------------------
if (central_backend_url) {
    console.log(`Proxying station API routes to central backend at ${central_backend_url}`);
    app.use("/data", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
    app.use("/record-choice", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
    app.use("/generate-dynamic", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
    app.use("/assign-codename", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
    app.use("/save-codename", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
    app.use("/validate-codename", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
} else {
    app.get("/data", getData);
    app.post("/data", postData);
    app.post("/record-choice", recordChoice);
    app.post("/generate-dynamic", askLLM);
    app.post("/preview-prompt", previewAIPrompt);
    
    // Fix: Ensure codename endpoints are properly registered 
    console.log("Registering codename endpoints");
    app.post("/assign-codename", (req, res) => {
        console.log("Received assignCodename request:", req.body);
        return assignCodename(req, res);
    });
    
    app.post("/validate-codename", (req, res) => {
        console.log("Received validateCodename request:", req.body);
        return validateCodename(req, res);
    });
    
    app.post("/save-codename", (req, res) => {
        console.log("Received saveCodename request:", req.body);
        return saveCodename(req, res);
    });
}

// ---------------------------------
// Static Site Routes
// ---------------------------------

// Shared resources
app.use("/shared", express.static(path.join(__dirname, "sites", "shared")));

// Station 1: Accessible at http://localhost:3001/station1
app.use("/station1", express.static(path.join(__dirname, "sites", "station1")));

// Station 2: Accessible at http://localhost:3001/station2
app.use("/station2", express.static(path.join(__dirname, "sites", "station2")));

app.listen(PORT, () => {
    const baseUrl = `http://localhost:${PORT}`;

    // ASCII art header for the server
    console.log(`

        ░▒▓██████████████▓▒░  ░▒▓██████▓▒░ ░▒▓██████████████▓▒░ ░▒▓█▓▒░░▒▓█▓▒░ 
        ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░ 
        ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒▒▓█▓▒░  
        ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒▒▓█▓▒░  
        ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░  ░▒▓█▓▓█▓▒░   
        ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░  ░▒▓█▓▓█▓▒░   
        ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░ ░▒▓██████▓▒░ ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░   ░▒▓██▓▒░    
                                                                               
                                                                               
        
    `);

    // Welcome message with unicode support
    console.log("Welcome to MoMV 众鸣山 Server Room...\n");

    console.log(`
    +==========================================================================+
    |           AVAILABLE SITES                                                |
    +==========================================================================+
    `);

    if (!isProd) {
        console.log(`
    +--------------------------------------------------------------------------+
    | Editor Station 1:  ${baseUrl}/editor/station1  
    +--------------------------------------------------------------------------+
    | Editor Station 2:  ${baseUrl}/editor/station2  
    +--------------------------------------------------------------------------+
    | Control Panel:     ${baseUrl}/cp                
    +--------------------------------------------------------------------------+
    `);
    } else {
        console.log("- Editor routes are not available in production mode.\n");
    }

    console.log(`
    +--------------------------------------------------------------------------+
    | Station 1:         ${baseUrl}/station1          
    +--------------------------------------------------------------------------+
    | Station 2:         ${baseUrl}/station2          
    +--------------------------------------------------------------------------+
    `);

});
