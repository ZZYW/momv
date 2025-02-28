import db from '../db.js';

/**
 * Creates instructions based on block type and properties.
 * @param {Object} params - Parameter object
 * @param {string} params.blockType - Type of block (dynamic-option, dynamic-text, dynamic-word)
 * @param {number} params.optionCount - Number of options to generate
 * @param {number} params.sentenceCount - Number of sentences to generate
 * @param {string} params.lexiconCategory - Category of word to generate
 * @returns {string} - Crafted instructions
 */
export const getBlockInstructions = ({ blockType, optionCount, sentenceCount, lexiconCategory }) => {
    let baseInstruction = "";
    
    // Create natural language instructions based on the block type
    if (blockType === "dynamic-option" && optionCount) {
        baseInstruction = `You are a creative storyteller. Please generate ${optionCount} distinct and compelling options for a story choice. 
These options should be interesting, diverse, and appropriate for the context.`;
    } else if (blockType === "dynamic-text" && sentenceCount) {
        baseInstruction = `You are a creative storyteller. Please generate a passage of approximately ${sentenceCount} sentences.
The text should be vivid, engaging, and should fit naturally within the story context.`;
    } else if (blockType === "dynamic-word" && lexiconCategory) {
        baseInstruction = `You are a creative storyteller. Please generate a single ${lexiconCategory} that fits the story context.
The word should be expressive, evocative, and relevant to the narrative situation.`;
    }
    
    // Still append expected JSON return format instruction
    let returnFormat = "";
    const formatPrefix = "\n\n请一定要以JSON格式回复。请使用中文！请严格遵循以下格式:\n\n"
    if (blockType === "dynamic-option") {
        returnFormat = `${formatPrefix}{"thinking_process": "your reasoning process here...", "final_printed_text": ["option1", "option2", ...]}`;
    } else if (blockType === "dynamic-word") {
        returnFormat = `${formatPrefix}{"thinking_process": "your reasoning process here...", "final_printed_text": "word"}`;
    } else if (blockType === "dynamic-text") {
        returnFormat = `${formatPrefix}{"thinking_process": "your reasoning process here...", "final_printed_text": "passage text"}`;
    }
    
    return baseInstruction + returnFormat;
};

/**
 * Retrieve context information in a human-friendly format.
 * @param {Array} contextRefs - References to context blocks
 * @param {string} currentPlayerID - Current player's ID
 * @returns {Array} - Context information
 */
export const fetchContextInfo = async (contextRefs, currentPlayerID) => {
    await db.read();
    const contextInfo = [];
    const players = db.data.players || {};

    for (const contextRef of contextRefs) {
        const blockId = contextRef.value;
        const includeAll = contextRef.includeAll === true;
        if (!blockId) continue;

        if (includeAll) {
            for (const playerId in players) {
                const playerChoices = players[playerId].choices || {};
                if (playerChoices[blockId]) {
                    const { availableOptions, chosenText } = playerChoices[blockId];
                    contextInfo.push({ availableOptions, chosenText });
                }
            }
        } else if (players[currentPlayerID]?.choices?.[blockId]) {
            const { availableOptions, chosenText } = players[currentPlayerID].choices[blockId];
            contextInfo.push({ availableOptions, chosenText });
        }
    }
    return contextInfo;
};

/**
 * Formats context information into a readable string
 * @param {Array} contextInfo - Array of context objects
 * @returns {string} - Formatted context string
 */
export const formatContextString = (contextInfo) => {
    if (!contextInfo || contextInfo.length === 0) return "";
    
    return "\n\n上下文信息:\n" + contextInfo.map((ctx, index) => {
        if (ctx.chosenText) {
            let optionsInfo = "";
            if (ctx.availableOptions && Array.isArray(ctx.availableOptions)) {
                optionsInfo = "\n可选项: " + ctx.availableOptions.join(", ");
            }
            return `上下文 ${index + 1}: 玩家从多个选项中选择了 "${ctx.chosenText}"${optionsInfo}`;
        }
        return `上下文 ${index + 1}: 无选择记录`;
    }).join("\n");
};

/**
 * Crafts a complete prompt for the AI using message, context and instructions
 * @param {string} message - The main message/prompt
 * @param {string} contextString - Formatted context string
 * @param {string} instructions - Block-specific instructions
 * @returns {string} - Complete prompt for the AI
 */
export const craftPrompt = (message, contextString, instructions) => {
    return `${message || ""}
${contextString}

${instructions}`;
};