import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";

// Import config
import config from "./config/config.js";
const { PORT, isProd, central_backend_url } = config;

// Import middleware
import setupGlobalMiddleware from "./middleware/globalMiddleware.js";

// Import routes
import staticRoutes from "./routes/staticRoutes.js";
import apiRoutes from "./routes/apiRoutes.js";
import storyRoutes from "./routes/storyRoutes.js";
import editorRoutes from "./routes/editorRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Set up global middleware
setupGlobalMiddleware(app);

// Set up static routes
app.use(staticRoutes);

// Handle different modes
if (!isProd) {
    // Development mode - use local routes
    app.use(editorRoutes);
    console.log("Development mode: Editor and Control Panel are being served.");
} else {
    console.log("Production mode: Editor and Control Panel are not being served.");
}

// Handle API routes
if (central_backend_url) {
    console.log(`Proxying station API routes to central backend at ${central_backend_url}`);
    app.use("/data", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
    app.use("/record-choice", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
    app.use("/generate-dynamic", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
    app.use("/assign-codename", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
    app.use("/save-codename", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
    app.use("/validate-codename", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
    app.use("/print", createProxyMiddleware({ target: central_backend_url, changeOrigin: true }));
} else {
    // Use local API routes
    app.use(apiRoutes);
    // Mount story routes under /story prefix
    app.use("/story", storyRoutes);
}

// Start the server
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