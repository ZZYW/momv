import db from '../db.js';
import logger from '../utils/logger.js';

export const getData = async (req, res) => {
    try {
        await db.read();
        if (!db.data) {
            logger.error("Database read returned null or undefined data");
            return res.status(500).json({ 
                error: "Database error", 
                message: "Could not retrieve database data" 
            });
        }
        logger.info("getData: Successfully retrieved database data");
        res.json(db.data);
    } catch (error) {
        logger.error("Error in getData:", error);
        res.status(500).json({ 
            error: "Database error", 
            message: "Failed to read database" 
        });
    }
};

export const postData = async (req, res) => {
    try {
        if (!req.body) {
            logger.warn("postData: Received empty request body");
            return res.status(400).json({
                error: "Invalid request",
                message: "Request body cannot be empty"
            });
        }
        
        // Validate the data structure matches expected format
        const isValidStructure = 
            req.body.hasOwnProperty('players') && 
            req.body.hasOwnProperty('blocks');
            
        if (!isValidStructure) {
            logger.warn("postData: Received invalid data structure");
            return res.status(400).json({
                error: "Invalid data structure",
                message: "Data must include 'players' and 'blocks' properties"
            });
        }
        
        // Backup existing data before overwriting
        const previousData = { ...db.data };
        
        // Update the database
        db.data = req.body;
        
        try {
            await db.write();
            logger.info("postData: Successfully wrote data to database");
            res.json({ status: "success" });
        } catch (writeError) {
            // Restore previous data if write fails
            db.data = previousData;
            logger.error("Error writing to database:", writeError);
            res.status(500).json({ 
                error: "Database write error", 
                message: "Failed to save data to database" 
            });
        }
    } catch (error) {
        logger.error("Error in postData:", error);
        res.status(500).json({ 
            error: "Server error", 
            message: "An unexpected error occurred" 
        });
    }
};
