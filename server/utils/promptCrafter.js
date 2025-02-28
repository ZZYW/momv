import db from '../db.js';

/**
 * Prompt templates for different block types.
 * These templates provide the structure for AI prompts and can be easily modified.
 */
export const PROMPT_TEMPLATES = {
    "dynamic-option": `You are a creative storyteller. Please generate {optionCount} distinct and compelling options for a story choice. 
These options should be interesting, diverse, and appropriate for the context.`,

    "dynamic-text": `You are a creative storyteller. Please generate a passage of approximately {sentenceCount} sentences.
The text should be vivid, engaging, and should fit naturally within the story context.`,

    "dynamic-word": `You are a creative storyteller. Please generate a single {lexiconCategory} that fits the story context.
The word should be expressive, evocative, and relevant to the narrative situation.`
};

/**
 * JSON response format templates
 */
export const FORMAT_TEMPLATES = {
    "dynamic-option": `{"thinking_process": "your reasoning process here...", "final_printed_text": ["option1", "option2", ...]}`,
    "dynamic-text": `{"thinking_process": "your reasoning process here...", "final_printed_text": "passage text"}`,
    "dynamic-word": `{"thinking_process": "your reasoning process here...", "final_printed_text": "word"}`
};

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

    // Get the appropriate template and replace the placeholders
    if (blockType === "dynamic-option" && optionCount) {
        baseInstruction = PROMPT_TEMPLATES[blockType].replace('{optionCount}', String(optionCount));
    } else if (blockType === "dynamic-text" && sentenceCount) {
        baseInstruction = PROMPT_TEMPLATES[blockType].replace('{sentenceCount}', String(sentenceCount));
    } else if (blockType === "dynamic-word" && lexiconCategory) {
        baseInstruction = PROMPT_TEMPLATES[blockType].replace('{lexiconCategory}', lexiconCategory);
    }

    // Add the JSON format instruction
    const formatPrefix = "\n\n请一定要以JSON格式回复。请使用中文！请严格遵循以下格式:\n\n";
    const returnFormat = FORMAT_TEMPLATES[blockType] ? `${formatPrefix}${FORMAT_TEMPLATES[blockType]}` : "";

    return baseInstruction + returnFormat;
};

/**
 * Retrieve context information in a human-friendly format.
 * @param {Array} contextRefs - References to context blocks
 * @param {string} currentPlayerID - Current player's ID
 * @returns {Promise<Array>} - Context information
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
 * Context formatting template
 */
export const CONTEXT_TEMPLATE = {
    prefix: "\n\n上下文信息:\n",
    itemWithChoice: `上下文 {index}: 玩家从多个选项中选择了 "{chosenText}"{optionsInfo}`,
    optionsPrefix: "\n可选项: ",
    noChoice: `上下文 {index}: 无选择记录`
};

/**
 * Formats context information into a readable string
 * @param {Array} contextInfo - Array of context objects
 * @returns {string} - Formatted context string
 */
export const formatContextString = (contextInfo) => {
    if (!contextInfo || contextInfo.length === 0) return "";

    return CONTEXT_TEMPLATE.prefix + contextInfo.map((ctx, index) => {
        if (ctx.chosenText) {
            let optionsInfo = "";
            if (ctx.availableOptions && Array.isArray(ctx.availableOptions)) {
                optionsInfo = CONTEXT_TEMPLATE.optionsPrefix + ctx.availableOptions.join(", ");
            }
            return CONTEXT_TEMPLATE.itemWithChoice
                .replace('{index}', String(index + 1))
                .replace('{chosenText}', ctx.chosenText)
                .replace('{optionsInfo}', optionsInfo);
        }
        return CONTEXT_TEMPLATE.noChoice.replace('{index}', String(index + 1));
    }).join("\n");
};

/**
 * Full prompt structure template
 */
export const FULL_PROMPT_TEMPLATE = `{message}
{contextString}

{instructions}`;

/**
 * Crafts a complete prompt for the AI using message, context and instructions
 * @param {string} message - The main message/prompt
 * @param {string} contextString - Formatted context string
 * @param {string} instructions - Block-specific instructions
 * @returns {string} - Complete prompt for the AI
 */
export const craftPrompt = (message, contextString, instructions) => {
    return FULL_PROMPT_TEMPLATE
        .replace('{message}', message || "")
        .replace('{contextString}', contextString)
        .replace('{instructions}', instructions);
};