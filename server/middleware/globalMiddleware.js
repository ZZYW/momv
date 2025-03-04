import cors from "cors";
import express from "express";

const setupGlobalMiddleware = (app) => {
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
};

export default setupGlobalMiddleware;