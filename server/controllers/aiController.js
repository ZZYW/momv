import axios from "axios";
import db from '../db.js';

export const askLLM = async (req, res) => {
    const {
        message,
        playerID,
        blockUUID,
        contextRefs,
        blockType,
        // Extract these properties from the request
        optionCount,
        sentenceCount,
        lexiconCategory
    } = req.body;

    // Build enhanced prompt with context from previous choices
    let enhancedPrompt = message;

    // Add block-specific instructions based on type and properties
    if (blockType === 'dynamic-option' && optionCount) {
        enhancedPrompt += `\n\nPlease generate ${optionCount} distinct options.`;
    } else if (blockType === 'dynamic-text' && sentenceCount) {
        enhancedPrompt += `\n\nPlease generate a response of approximately ${sentenceCount} sentences.`;
    } else if (blockType === 'dynamic-word' && lexiconCategory) {
        enhancedPrompt += `\n\nPlease generate a single ${lexiconCategory}.`;
    }


    if (contextRefs && contextRefs.length > 0) {
        await db.read();
        let contextInfo = [];

        for (const contextRef of contextRefs) {
            // Extract the block ID and includeAll flag
            const blockId = contextRef.value;
            const includeAll = contextRef.includeAll === true;

            if (!blockId) continue; // Skip if no valid block ID

            const players = db.data.players || {};

            if (includeAll) {
                // Include choices from all players for this block
                for (const playerId in players) {
                    const playerChoices = players[playerId].choices || {};
                    if (playerChoices[blockId]) {
                        const choice = playerChoices[blockId];
                        contextInfo.push({
                            playerId,
                            blockId,
                            availableOptions: choice.availableOptions,
                            chosenIndex: choice.chosenIndex,
                            chosenText: choice.chosenText
                        });
                    }
                }
            } else {
                // Only include the current player's choice
                if (players[playerID] && players[playerID].choices && players[playerID].choices[blockId]) {
                    const choice = players[playerID].choices[blockId];
                    contextInfo.push({
                        playerId: playerID,
                        blockId,
                        availableOptions: choice.availableOptions,
                        chosenIndex: choice.chosenIndex,
                        chosenText: choice.chosenText
                    });
                }
            }
        }

        // Add context information to the prompt
        if (contextInfo.length > 0) {
            enhancedPrompt += "\n\n--- PLAYER CHOICE CONTEXT ---\n";

            if (contextInfo.length === 1) {
                const ctx = contextInfo[0];
                enhancedPrompt += `When presented with choices: ${ctx.availableOptions.join(", ")}, the player chose "${ctx.chosenText}" (option ${ctx.chosenIndex + 1}).\n`;
            } else {
                enhancedPrompt += "Multiple player choices:\n";
                contextInfo.forEach((ctx, index) => {
                    enhancedPrompt += `Player ${index + 1}: When presented with choices: ${ctx.availableOptions.join(", ")}, chose "${ctx.chosenText}" (option ${ctx.chosenIndex + 1}).\n`;
                });
            }

            enhancedPrompt += "--- END CONTEXT ---\n\nPlease consider this context in your response.";
        }
    }

    console.log(`sending message to llm:`)
    console.log(enhancedPrompt)

    try {
        const apiKey = process.env.DASHSCOPE_API_KEY;

        const response = await axios.post(
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
            {
                model: "qwen-turbo",
                messages: [
                    { role: "system", content: "You are a great, nuanced story writer" },
                    { role: "user", content: enhancedPrompt }
                ]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                }
            }
        );

        const reply =
            response.data?.choices &&
            response.data.choices[0].message?.content ||
            "No reply received";
        res.json({ reply });
    } catch (error) {
        console.error("Error calling AI API:", error.message);
        res.json({ reply: "Simulated response: I am the AI, but an error occurred." });
    }
};