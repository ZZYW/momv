import { 
  getBlockInstructions, 
  fetchContextInfo, 
  formatContextString, 
  craftPrompt,
  previewPrompt,
  BlockType,
  ContextRef,
  PassageContext
} from '../utils/promptCrafter.js';
import { sendPromptToLLM } from '../utils/aiCommunicator.js';
import fs from 'fs/promises';
import path from 'path';
import db from '../db.js';
import { Request, Response } from 'express';
import { Player, DynamicContent } from '../db.js';

/**
 * Request body for AI request
 */
interface AskLLMRequestBody {
  message: string;
  playerID: string;
  contextRefs?: ContextRef[];
  blockType: BlockType;
  optionCount?: number;
  sentenceCount?: number;
  lexiconCategory?: string;
  blockId: string;
  storyId?: string;
}

/**
 * Preview prompt request body
 */
interface PreviewPromptRequestBody extends AskLLMRequestBody {}

/**
 * Gets all blocks from a story file
 * @param {string} storyId - The ID of the story
 * @returns {Promise<Array>} - Array of story blocks
 */
export const getStoryBlocks = async (storyId: string): Promise<any[]> => {
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
 * @returns {Promise<PassageContext | null>} - Passage context object with text before the dynamic block
 */
export const getPassageContext = async (blockId: string, storyId: string, playerID: string): Promise<PassageContext | null> => {
    const blocks = await getStoryBlocks(storyId);
    if (!blocks.length) return null;

    // Find the dynamic block
    const dynamicBlock = blocks.find(block => block.id === blockId);
    if (!dynamicBlock) return null;

    // Find the index of our dynamic block in the entire story
    const dynamicBlockIndex = blocks.findIndex(block => block.id === blockId);
    if (dynamicBlockIndex === -1) return null;

    // Read player choices to replace static blocks
    await db.read();
    const playerChoices = db.data.players?.[playerID]?.choices || {};

    // Build text before the dynamic block
    let textBeforeDynamic = '';
    
    // For station2, first include all content from station1
    if (storyId === "2") {
        const station1Blocks = await getStoryBlocks("1");
        textBeforeDynamic += '--- 第一站内容 ---\n\n';
        
        for (const block of station1Blocks) {
            if (block.type === 'plain') {
                textBeforeDynamic += block.text;
            } else if (block.type === 'static') {
                // Replace with player's choice if available, otherwise use first option
                const choice = playerChoices[block.id];
                const chosenText = choice ? choice.chosenText : block.options[0];
                
                // Include both the chosen text and the available options
                if (choice && choice.availableOptions) {
                    textBeforeDynamic += chosenText + '（可选项包括：' + choice.availableOptions.join(' | ') + '）';
                } else if (block.options && block.options.length > 0) {
                    textBeforeDynamic += chosenText + '（可选项包括：' + block.options.join(' | ') + '）';
                } else {
                    textBeforeDynamic += chosenText;
                }
            } else if (block.type === 'scene-header') {
                // Include scene headers
                textBeforeDynamic += '\n\n' + (block.titleName || '未命名场景') + '\n\n';
            } else if (block.type.startsWith('dynamic-')) {
                // Add recorded dynamic content if available
                const dynamicContent = db.data.players?.[playerID]?.dynamicContent?.[block.id];
                if (dynamicContent) {
                    if (block.type === 'dynamic-option') {
                        // For dynamic options, include the selected content
                        const choice = playerChoices[block.id];
                        if (choice && choice.chosenText) {
                            textBeforeDynamic += choice.chosenText;
                        }
                    } else if (block.type === 'dynamic-text' || block.type === 'dynamic-word') {
                        // For dynamic text/word, include the generated content
                        textBeforeDynamic += dynamicContent.content;
                    }
                }
            }
        }
        
        // Add a separator between station1 and station2 content
        textBeforeDynamic += '\n\n--- 第二站内容 ---\n\n';
    }
    
    // Now add content from the current station up to the dynamic block
    for (let i = 0; i < dynamicBlockIndex; i++) {
        const block = blocks[i];
        if (block.type === 'plain') {
            textBeforeDynamic += block.text;
        } else if (block.type === 'static') {
            // Replace with player's choice if available, otherwise use first option
            const choice = playerChoices[block.id];
            const chosenText = choice ? choice.chosenText : block.options[0];
            
            // Include both the chosen text and the available options
            if (choice && choice.availableOptions) {
                textBeforeDynamic += chosenText + '（可选项包括：' + choice.availableOptions.join(' | ') + '）';
            } else if (block.options && block.options.length > 0) {
                textBeforeDynamic += chosenText + '（可选项包括：' + block.options.join(' | ') + '）';
            } else {
                textBeforeDynamic += chosenText;
            }
        } else if (block.type === 'scene-header') {
            // Include scene headers
            textBeforeDynamic += '\n\n' + (block.titleName || '未命名场景') + '\n\n';
        } else if (block.type.startsWith('dynamic-')) {
            // Add recorded dynamic content if available
            const dynamicContent = db.data.players?.[playerID]?.dynamicContent?.[block.id];
            if (dynamicContent) {
                if (block.type === 'dynamic-option') {
                    // For dynamic options, include the selected content
                    const choice = playerChoices[block.id];
                    if (choice && choice.chosenText) {
                        textBeforeDynamic += choice.chosenText;
                    }
                } else if (block.type === 'dynamic-text' || block.type === 'dynamic-word') {
                    // For dynamic text/word, include the generated content
                    textBeforeDynamic += dynamicContent.content;
                }
            }
        }
    }

    return {
        textBeforeDynamic: textBeforeDynamic.trim()
    };
};

/**
 * Controller to handle AI generation requests
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const askLLM = async (req: Request, res: Response): Promise<void> => {
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
    } = req.body as AskLLMRequestBody;

    try {
        // Step 1: Get block-specific instructions
        const instructions = getBlockInstructions({
            blockType,
            optionCount,
            sentenceCount,
            lexiconCategory
        });

        // Step 2: Get passage context if this is a dynamic block
        let passageContext: PassageContext | null = null;
        if (blockType.startsWith('dynamic-') && blockId) {
            passageContext = await getPassageContext(blockId, storyId, playerID);
        }

        // Step 3: Craft complete prompt - omit player choices if we're in Station 2
        // as they're already included in the story context
        let contextString = "";
        if (storyId !== "2" && contextRefs && contextRefs.length > 0) {
            // Only include separate player choices section for Station 1
            const contextInfo = await fetchContextInfo(contextRefs, playerID, storyId);
            if (contextInfo.length > 0) {
                contextString = formatContextString(contextInfo);
            }
        }

        // Step 4: Craft complete prompt
        const prompt = craftPrompt(message, contextString, instructions, passageContext);

        // Step 5: Send to LLM and get response
        const finalContent = await sendPromptToLLM(prompt, blockType);

        // Step 6: Record dynamic block content in database
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

        // Step 7: Return processed result to client
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
        contextRefs,
        blockType,
        optionCount,
        sentenceCount,
        lexiconCategory,
        blockId,
        storyId = "1" // Default to story1 if not specified
    } = req.body as PreviewPromptRequestBody;

    try {
        // Step 1: Get passage context if this is a dynamic block
        let passageContext: PassageContext | null = null;
        if (blockType.startsWith('dynamic-') && blockId) {
            passageContext = await getPassageContext(blockId, storyId, playerID);
        }
        
        // Step 2: Get context information if provided - omit for Station 2
        let contextInfo: any[] = [];
        if (storyId !== "2" && contextRefs && contextRefs.length > 0) {
            contextInfo = await fetchContextInfo(contextRefs, playerID, storyId);
        }

        // Step 3: Generate preview of the prompt
        const promptPreview = previewPrompt({
            blockType,
            message,
            optionCount,
            sentenceCount,
            lexiconCategory,
            contextInfo,
            passageContext,
            storyId
        });

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