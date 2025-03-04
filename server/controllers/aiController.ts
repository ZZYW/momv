import {
    craftPrompt,
    BlockType,
} from '../utils/promptCrafter.js';
import { sendPromptToLLM } from '../utils/aiCommunicator.js';
import db from '../db.js';
import { Request, Response } from 'express';
import { Player, DynamicContent } from '../db.js';

/**
 * Request body for AI request
 */
interface AskLLMRequestBody {
    message: string;
    playerID: string;
    blockType: BlockType;
    blockId: string;
    storyId?: string;
    generateOptions?: boolean;
}

/**
 * Preview prompt request body
 */
interface PreviewPromptRequestBody extends AskLLMRequestBody { }

// We don't need these functions anymore since we're using the interpretDynamicBlock
// function in promptCrafter to handle all placeholder replacements

/**
 * Controller to handle AI generation requests
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const askLLM = async (req: Request, res: Response): Promise<void> => {
    const {
        message,
        playerID,
        blockType,
        blockId,
        storyId = "1", // Default to story1 if not specified
        generateOptions = false
    } = req.body as AskLLMRequestBody;

    try {
        // Note: We no longer need to get passage context separately
        // since it can be retrieved directly through the dynamic placeholders
        // if needed in the prompt

        // Step 2 & 3: Craft prompt - this now handles hydration of placeholders internally
        console.log('Crafting prompt with potential placeholders...');
        const prompt = await craftPrompt(
            message,
            { generateOptions },
            playerID,
            blockId,
            storyId
        );

        // Step 5: Send to LLM and get response
        const llmResponse = await sendPromptToLLM(prompt, blockType, { generateOptions });

        // The LLM response should already be processed
        // The placeholders are hydrated before sending to AI, so no need to process response
        let finalContent = llmResponse;
        console.log('Response received from LLM');

        // Step 7: Record dynamic block content in database
        await db.read();
        // Ensure db structure exists
        if (!db.data.players[playerID]) {
            db.data.players[playerID] = { choices: {}, dynamicContent: {} } as Player;
        } else if (!db.data.players[playerID].dynamicContent) {
            db.data.players[playerID].dynamicContent = {};
        }

        // Store the dynamic content with its metadata
        const dynamicContent: DynamicContent = {
            blockType,
            content: finalContent,
            timestamp: new Date().toISOString()
        };
        db.data.players[playerID].dynamicContent[blockId] = dynamicContent;

        await db.write();

        // Step 8: Return processed result to client
        res.json(finalContent);
    } catch (error: any) {
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

/**
 * Controller to preview the prompt that will be sent to the AI
 * This helps writers understand how their templates will look when composed
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const previewAIPrompt = async (req: Request, res: Response): Promise<void> => {
    const {
        message,
        playerID,
        blockType,
        blockId,
        storyId = "1", // Default to story1 if not specified
        generateOptions = false
    } = req.body as PreviewPromptRequestBody;

    try {
        // Note: We no longer need to get passage context separately
        // since it can be retrieved directly through the dynamic placeholders
        // if needed in the prompt

        // Step 2 & 3: Generate preview using the enhanced craftPrompt function
        // which now handles hydration of placeholders internally
        console.log('Generating preview with potential placeholders...');
        const promptPreview = await craftPrompt(
            message,
            { generateOptions },
            playerID,
            blockId,
            storyId
        );

        // Step 4: Return the preview
        res.json({
            preview: promptPreview,
            message: '这是将发送给AI的提示预览，供创作者参考'
        });
    } catch (error: any) {
        console.error("Error generating prompt preview:", error.message);
        console.error("Stack trace:", error.stack);

        // Return error information to the client
        res.status(500).json({
            error: "Preview Generation Error",
            message: error.message
        });
    }
};