import { getBlockInstructions, fetchContextInfo, formatContextString, craftPrompt } from '../utils/promptCrafter.js';
import { sendPromptToLLM } from '../utils/aiCommunicator.js';

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
        lexiconCategory
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
        
        // Step 3: Craft complete prompt
        const prompt = craftPrompt(message, contextString, instructions);
        
        // Step 4: Send to LLM and get response
        const finalContent = await sendPromptToLLM(prompt, blockType);
        
        // Step 5: Return processed result to client
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