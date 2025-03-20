import cors from "cors";
import express from "express";
import logger from "../utils/logger.js";

const setupGlobalMiddleware = (app) => {
    // Global Middleware
    app.use(cors());
    app.use(express.json());
    
    // Add cache control headers
    app.use((req, res, next) => {
        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
            "Surrogate-Control": "no-store",
        });
        next();
    });
    
    // Add request logging middleware
    app.use((req, res, next) => {
        const start = Date.now();
        
        // Log when the request completes
        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.http(`${req.method} ${req.originalUrl}`, {
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip,
                userAgent: req.get('User-Agent') || 'Unknown'
            });
        });
        
        next();
    });
    
    // Add global error handler
    app.use((err, req, res, next) => {
        logger.error('Express error handler caught error', {
            error: err.message,
            stack: err.stack,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip
        });
        
        res.status(500).json({
            error: 'Server Error',
            message: err.message
        });
    });
};

export default setupGlobalMiddleware;