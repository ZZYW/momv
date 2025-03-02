import { getBlockInstructions, fetchContextInfo, formatContextString, craftPrompt } from '../utils/promptCrafter.js';
import { sendPromptToLLM } from '../utils/aiCommunicator.js';
import fs from 'fs/promises';
import path from 'path';
import db from '../db.js';

/**
 * Gets all blocks from a story file
 * @param {string} storyId - The ID of the story
 * @returns {Promise<Array>} - Array of story blocks
 */
export const getStoryBlocks = async (storyId) => {
    try {
        // Dynamically build the path based on storyId which corresponds to the station number
        const storyPath = path.join(process.cwd(), 'server', 'sites', `station${storyId}`, 'input', 'story.json');
        const storyData = await fs.readFile(storyPath, 'utf-8');
        const story = JSON.parse(storyData);
        return story.blocks || [];
    } catch (error) {
        console.error(`Error loading story ${storyId}:`, error);
        return [];
    }
};

/**
 * Get passage context for a dynamic block
 * @param {string} blockId - ID of the dynamic block
 * @param {string} storyId - ID of the story
 * @param {string} playerID - ID of the player (to get their choices)
 * @returns {Promise<Object>} - Passage context object with text before and after
 */
export const getPassageContext = async (blockId, storyId, playerID) => {
    const blocks = await getStoryBlocks(storyId);
    if (!blocks.length) return null;

    // Find the dynamic block
    const dynamicBlock = blocks.find(block => block.id === blockId);
    if (!dynamicBlock) return null;

    const sceneId = dynamicBlock.sceneId;

    // Get all blocks in the same scene in order
    const sceneBlocks = blocks.filter(block => block.sceneId === sceneId);

    // Find the index of our dynamic block
    const dynamicBlockIndex = sceneBlocks.findIndex(block => block.id === blockId);
    if (dynamicBlockIndex === -1) return null;

    // Read player choices to replace static blocks
    await db.read();
    const playerChoices = db.data.players?.[playerID]?.choices || {};

    // Build text before the dynamic block
    let textBeforeDynamic = '';
    for (let i = 0; i < dynamicBlockIndex; i++) {
        const block = sceneBlocks[i];
        if (block.type === 'plain') {
            textBeforeDynamic += block.text;
        } else if (block.type === 'static') {
            // Replace with player's choice if available, otherwise use first option
            const choice = playerChoices[block.id];
            const chosenText = choice ? choice.chosenText : block.options[0];
            textBeforeDynamic += chosenText;
        }
        // Skip other block types like scene-header
    }

    // Build text after the dynamic block
    let textAfterDynamic = '';
    for (let i = dynamicBlockIndex + 1; i < sceneBlocks.length; i++) {
        const block = sceneBlocks[i];
        if (block.type === 'plain') {
            textAfterDynamic += block.text;
        } else if (block.type === 'static') {
            // Replace with player's choice if available, otherwise use first option
            const choice = playerChoices[block.id];
            const chosenText = choice ? choice.chosenText : block.options[0];
            textAfterDynamic += chosenText;
        }
        // Skip other block types
    }

    return {
        textBeforeDynamic: textBeforeDynamic.trim(),
        textAfterDynamic: textAfterDynamic.trim()
    };
};

/**
 * Controller to handle AI generation requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const askLLM = async (req, res) => {
    const {
        message,
        playerID,
        contextRefs,
        blockType,
        optionCount,
        sentenceCount,
        lexiconCategory,
        blockId,
        storyId = "1" // Default to story1 if not specified
    } = req.body;

    try {
        // Step 1: Get block-specific instructions
        const instructions = getBlockInstructions({
            blockType,
            optionCount,
            sentenceCount,
            lexiconCategory
        });

        // Step 2: Get and format context information
        let contextString = "";
        if (contextRefs && contextRefs.length > 0) {
            const contextInfo = await fetchContextInfo(contextRefs, playerID);
            if (contextInfo.length > 0) {
                contextString = formatContextString(contextInfo);
            }
        }

        // Step 3: Get passage context if this is a dynamic block
        let passageContext = null;
        if (blockType.startsWith('dynamic-') && blockId) {
            passageContext = await getPassageContext(blockId, storyId, playerID);
        }

        // Step 4: Craft complete prompt
        const prompt = craftPrompt(message, contextString, instructions, passageContext);

        // Step 5: Send to LLM and get response
        const finalContent = await sendPromptToLLM(prompt, blockType);

        // Step 6: Return processed result to client
        res.json(finalContent);
    } catch (error) {
        console.error("Error in askLLM:", error.message);
        console.error("Stack trace:", error.stack);

        // Return error information to the client
        res.status(500).json({
            error: "AI API Error",
            message: error.message,
            stack: error.stack,
            details: error.response?.data || "No additional details available"
        });
    }
};