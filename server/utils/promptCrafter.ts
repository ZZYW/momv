/**
 * Simplified promptCrafter with only the necessary types
 * The goal is to hydrate the writer's content (replace {get ...} placeholders)
 * and append response format instructions including the JSON Schema.
 */

import { interpretDynamicBlock } from './dynamicBlockInterpreter.js';
import logger from './logger.js';

/**
 * Block types supported by the application
 */
export type BlockType = 'dynamic';

/**
 * Flag to indicate if the dynamic block should generate options
 */
export interface DynamicBlockOptions {
  generateOptions?: boolean;
}


/**
 * Formats the writer's prompt with required response format instructions
 * @param {string} rawMessage - The writer's prompt with potential placeholders to resolve
 * @param {DynamicBlockOptions} options - Options for the dynamic block
 * @param {string} playerId - The player ID for hydrating dynamic placeholders
 * @param {string} blockId - The current block ID being processed
 * @param {string} storyId - The story ID being processed
 * @returns {Promise<string>} - The complete prompt to send to the AI
 */
export const craftPrompt = async (
  rawMessage: string,
  options: DynamicBlockOptions = {},
  playerId: string = 'unknown',
  blockId: string = '',
  storyId: string = '1'
): Promise<string> => {
  try {
    console.log('craftPrompt: Starting to hydrate message placeholders');

    // Step 1: Hydrate the message by replacing {get ...} placeholders
    let hydratedMessage = rawMessage || "";

    if (typeof rawMessage === 'string' && rawMessage.includes('{get')) {
      console.debug('craftPrompt: Dynamic placeholders detected, processing...');
      console.debug(`craftPrompt: Using playerId=${playerId}, blockId=${blockId}, storyId=${storyId}`);
      hydratedMessage = await interpretDynamicBlock(rawMessage, {
        playerId,
        blockId,
        storyId
      });
      console.log('craftPrompt: Hydration complete');
    }

    // Step 2: Append strict response format instructions
    let responseFormatInstructions = `

  你必须严格按照以下JSON格式回复。其他格式都不被接受：
  1. "reasoning"：(必填) 你的创作思路和考虑`;

    if (options.generateOptions) {
      responseFormatInstructions += `
  2. "deliverable"：(必填) 一个包含3-5个选项的数组，格式如["选项1", "选项2", "选项3"]

  严格遵守此JSON Schema:
  {"$schema":"http://json-schema.org/draft-04/schema#","type":"object","properties":{"reasoning":{"type":"string","minLength":1},"deliverable":{"type":"array","items":{"type":"string"},"minItems":3,"maxItems":5}},"required":["reasoning","deliverable"],"additionalProperties":false}`;
    } else {
      responseFormatInstructions += `
  2. "deliverable"：(必填) 生成的文本内容，不得为空

  严格遵守此JSON Schema:
  {"$schema":"http://json-schema.org/draft-04/schema#","type":"object","properties":{"reasoning":{"type":"string","minLength":1},"deliverable":{"type":"string","minLength":1}},"required":["reasoning","deliverable"],"additionalProperties":false}`;
    }

    responseFormatInstructions += "\n注意：回复必须是可以被JSON.parse()直接解析的格式。";

    return hydratedMessage + responseFormatInstructions;
  } catch (error) {
    logger.error('Error in craftPrompt:', error);
    logger.error('hydration failed');
    logger.error('raw message:\n' + rawMessage);

    return '?';
  }
};