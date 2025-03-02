import db from '../db.js';
import { generateCodename, getPlayerIdFromCodename, hasCompletedStation1 } from '../utils/codenameGenerator.js';

// Generate a codename for a player completing Station 1
export const assignCodename = async (req, res) => {
    console.log("assignCodename endpoint called with body:", req.body);
    const { playerId } = req.body;
    
    if (!playerId) {
        console.log("Missing playerId in request");
        return res.status(400).json({ error: "Missing required field: playerId" });
    }
    
    await db.read();
    
    // Ensure player entry exists
    if (!db.data.players[playerId]) {
        db.data.players[playerId] = { choices: {}, completedStations: [] };
    }
    
    // Check if player already has a codename
    if (db.data.players[playerId].codename) {
        return res.json({ 
            status: "success", 
            codename: db.data.players[playerId].codename,
            alreadyAssigned: true
        });
    }
    
    // Generate a new codename
    const codename = await generateCodename(db);
    
    // Record the codename and mark Station 1 as completed
    db.data.players[playerId].codename = codename;
    if (!db.data.players[playerId].completedStations) {
        db.data.players[playerId].completedStations = [];
    }
    if (!db.data.players[playerId].completedStations.includes('station1')) {
        db.data.players[playerId].completedStations.push('station1');
    }
    
    await db.write();
    
    res.json({ 
        status: "success", 
        codename,
        alreadyAssigned: false
    });
};

// Validate a codename for Station 2 access
export const validateCodename = async (req, res) => {
    console.log("validateCodename called with body:", req.body);
    const { codename } = req.body;
    
    if (!codename) {
        console.log("Missing codename in request");
        return res.status(400).json({ error: "Missing required field: codename" });
    }
    
    await db.read();
    console.log("Current database players:", Object.keys(db.data.players));
    console.log("Current database codenames:", db.data.codenames);
    
    // Find the player ID associated with this codename
    const playerId = await getPlayerIdFromCodename(db, codename);
    console.log("Found playerId:", playerId);
    
    if (!playerId) {
        console.log("Codename not found in any player records");
        return res.status(200).json({ 
            status: "error", 
            valid: false,
            message: "Codename not found"
        });
    }
    
    // Check if the player has completed Station 1
    const completedStation1 = await hasCompletedStation1(db, playerId);
    console.log("Player completed Station 1:", completedStation1);
    
    if (!completedStation1) {
        console.log("Player has not completed Station 1");
        return res.status(200).json({ 
            status: "error", 
            valid: false,
            message: "Station 1 not completed"
        });
    }
    
    console.log("Validation successful for player:", playerId);
    res.json({ 
        status: "success", 
        valid: true,
        playerId: playerId // Explicitly naming parameter to ensure it's included
    });
};