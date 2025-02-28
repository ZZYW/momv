import db from '../db.js';

/**
 * Prompt templates for different block types with XML tags.
 * These templates provide the structure for AI prompts and can be easily modified.
 */
export const PROMPT_TEMPLATES = {
    "dynamic-option": `<role>你是一位擅长隐喻，符号主义，神秘学和心理分析的当代小说家</role>
<task>请生成 {optionCount} 个不同且引人入胜的故事选项。</task>
<requirements>
  - 这些选项应该有趣、多样化，并且适合上下文
  - 每个选项应该简短明了
  - 每个选项应该代表一个不同的可能性
  - 所有选项都应该用中文表达
</requirements>`,

    "dynamic-text": `<role>你是一位擅长隐喻，符号主义，神秘学和心理分析的当代小说家</role>
<task>请生成一段大约 {sentenceCount} 个句子的文本段落。</task>
<requirements>
  - 文本应该生动、引人入胜，并且自然地融入故事上下文
  - 语言应该流畅、富有表现力
  - 叙述应该符合整体故事的风格和基调
  - 所有内容都应该用中文表达
</requirements>`,

    "dynamic-word": `<role>你是一位擅长隐喻，符号主义，神秘学和心理分析的当代小说家</role>
<task>请生成一个适合故事上下文的 {lexiconCategory}。</task>
<requirements>
  - 词语应该表达丰富、富有暗示性，并且与叙述情境相关
  - 应该选择能够增强故事氛围的词语
  - 所选词语应该是中文
</requirements>`
};

/**
 * JSON response format templates with XML instruction tags
 */
export const FORMAT_TEMPLATES = {
    "dynamic-option": `<response_format>
  请一定要以JSON格式回复。请使用中文！请严格遵循以下格式:
  {
    "thinking_process": "你的思考过程...",
    "final_printed_text": ["选项1", "选项2", ...]
  }
</response_format>`,
    "dynamic-text": `<response_format>
  请一定要以JSON格式回复。请使用中文！请严格遵循以下格式:
  {
    "thinking_process": "你的思考过程...",
    "final_printed_text": "正文内容"
  }
</response_format>`,
    "dynamic-word": `<response_format>
  请一定要以JSON格式回复。请使用中文！请严格遵循以下格式:
  {
    "thinking_process": "你的思考过程...",
    "final_printed_text": "词语"
  }
</response_format>`
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
    const returnFormat = FORMAT_TEMPLATES[blockType] || "";

    return baseInstruction + "\n\n" + returnFormat;
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
 * Context formatting template with XML tags
 */
export const CONTEXT_TEMPLATE = {
    prefix: "\n\n<player_choices>\n  <instruction>关于玩家之前的一些选择。这些选择永远不是字面的意思。它们都是隐喻与符号主义。所以请深入的去解构再重构。请记住，千万不要在你最终的写作中原封不动的出现这些选择！！！</instruction>",
    itemWithChoice: `  <choice id="{index}">
    <selected_option>{chosenText}</selected_option>{optionsInfo}
  </choice>`,
    optionsPrefix: "\n    <available_options>",
    optionsSuffix: "</available_options>",
    noChoice: `  <choice id="{index}">
    <no_selection>无选择记录</no_selection>
  </choice>`,
    suffix: "\n</player_choices>"
};

/**
 * Formats context information into a readable string with XML tags
 * @param {Array} contextInfo - Array of context objects
 * @returns {string} - Formatted context string with XML structure
 */
export const formatContextString = (contextInfo) => {
    if (!contextInfo || contextInfo.length === 0) return "";

    const formattedItems = contextInfo.map((ctx, index) => {
        if (ctx.chosenText) {
            let optionsInfo = "";
            if (ctx.availableOptions && Array.isArray(ctx.availableOptions)) {
                optionsInfo = CONTEXT_TEMPLATE.optionsPrefix +
                    ctx.availableOptions.join(", ") +
                    CONTEXT_TEMPLATE.optionsSuffix;
            }
            return CONTEXT_TEMPLATE.itemWithChoice
                .replace('{index}', String(index + 1))
                .replace('{chosenText}', ctx.chosenText)
                .replace('{optionsInfo}', optionsInfo);
        }
        return CONTEXT_TEMPLATE.noChoice.replace('{index}', String(index + 1));
    }).join("\n");

    return CONTEXT_TEMPLATE.prefix + "\n" + formattedItems + CONTEXT_TEMPLATE.suffix;
};

/**
 * Full prompt structure template with XML tags
 */
export const FULL_PROMPT_TEMPLATE = `<prompt>
  <task>{message}</task>
  {contextString}
  <instructions>{instructions}</instructions>
</prompt>`;

/**
 * Extended prompt structure template with passage context and XML tags
 */
export const EXTENDED_PROMPT_TEMPLATE = `<prompt>
  <task>{message}</task>
  
  <passage_context>
    <text_before>{textBeforeDynamic}</text_before>
    <dynamic_placeholder>[!!!!!!final_printed_text will be placed here!!!!!]</dynamic_placeholder>
    <text_after>{textAfterDynamic}</text_after>
  </passage_context>
  
  {contextString}
  
  <instructions>{instructions}</instructions>
</prompt>`;

/**
 * Crafts a complete prompt for the AI using message, context and instructions
 * @param {string} message - The main message/prompt
 * @param {string} contextString - Formatted context string
 * @param {string} instructions - Block-specific instructions
 * @param {Object} [passageContext] - The surrounding passage context (optional)
 * @param {string} passageContext.textBeforeDynamic - Text that comes before the dynamic block
 * @param {string} passageContext.textAfterDynamic - Text that comes after the dynamic block
 * @returns {string} - Complete prompt for the AI
 */
export const craftPrompt = (message, contextString, instructions, passageContext) => {
    if (passageContext && passageContext.textBeforeDynamic !== undefined) {
        return EXTENDED_PROMPT_TEMPLATE
            .replace('{message}', message || "")
            .replace('{textBeforeDynamic}', passageContext.textBeforeDynamic || "")
            .replace('{textAfterDynamic}', passageContext.textAfterDynamic || "")
            .replace('{contextString}', contextString)
            .replace('{instructions}', instructions);
    }

    return FULL_PROMPT_TEMPLATE
        .replace('{message}', message || "")
        .replace('{contextString}', contextString)
        .replace('{instructions}', instructions);
};