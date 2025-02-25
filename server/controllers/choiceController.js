import db from '../db.js';
export const recordChoice = async (req, res) => {
    const { playerID, blockUUID, blockType, availableOptions, chosenIndex, chosenText, instruction, contextBlocks } = req.body;

    if (!playerID || !blockUUID || chosenIndex === undefined || !availableOptions) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    await db.read();
    // Initialize db.data if it's undefined
    if (!db.data) {
        db.data = { players: {}, blocks: [] };
    }
    // Ensure the players object exists
    if (!db.data.players) {
        db.data.players = {};
    }
    // Create player entry if it doesn't exist
    if (!db.data.players[playerID]) {
        db.data.players[playerID] = { choices: {} };
    }

    db.data.players[playerID].choices[blockUUID] = {
        blockType,
        availableOptions,
        chosenIndex,
        chosenText,
        instruction,
        contextBlocks,
        timestamp: new Date().toISOString()
    };

    await db.write();
    res.json({ status: "success", data: db.data.players[playerID].choices[blockUUID] });
};
