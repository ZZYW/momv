import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Set config from environment variables
const PORT = process.env.PORT || 3001;
const isProd = process.argv.includes("prod");
const central_backend_url = process.env.CENTRAL_BACKEND_URL;

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

// Always mount the configuration endpoint for frontend routing
app.get('/server-config', (req, res) => {
    res.json({
        apiServerUrl: central_backend_url || req.protocol + '://' + req.get('host'),
        hasCentralBackend: !!central_backend_url
    });
});

// Routing management:
// In production, if a central backend URL is defined, proxy all API requests
// (excluding editor and control panel routes) to the central backend.
if (central_backend_url) {
    console.log(`Proxying non-editor API routes to central backend at ${central_backend_url}`);
    app.use((req, res, next) => {
        // Check if the route is for the editor app or control panel
        if (req.path.startsWith("/editor") || req.path.startsWith("/cp") || 
            req.path === "/server-config") {
            // Do not proxy editor-related routes or server config
            return next();
        }
        // Otherwise, proxy the request to the central backend
        return createProxyMiddleware({
            target: central_backend_url,
            changeOrigin: true,
        })(req, res, next);
    });
} else {
    // When no central backend is defined, use local API and story routes
    app.use(apiRoutes);
    app.use("/story", storyRoutes);
}

// Start the server
const server = app.listen(PORT, () => {
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

// Handle graceful shutdown
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

function gracefulShutdown() {
    console.log('\nShutting down server gracefully...');
    server.close(() => {
        console.log('Server closed successfully');
        process.exit(0);
    });
    
    // Force close after 5 seconds if server hasn't closed
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 5000);
}