/**
 * Simplified promptCrafter with only the necessary types
 * The goal is to hydrate the writer's content (replace {get ...} placeholders)
 * and append response format instructions including the JSON Schema.
 */

import { interpretDynamicBlock } from './dynamicBlockInterpreter.ts';

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

    // Step 2: Append appropriate response format instructions based on options
    let responseFormatInstructions = "\n\n请以JSON格式回复，包含两个字段：\n";
    responseFormatInstructions += "1. \"reasoning\"：你的创作思路和考虑\n";

    if (options.generateOptions) {
      responseFormatInstructions += "2. \"deliverable\"：一个选项数组，如[\"选项1\", \"选项2\", \"选项3\"]\n";
      responseFormatInstructions += "\nJSON Schema:\n";
      responseFormatInstructions += `{"$schema":"http://json-schema.org/draft-04/schema#","type":"object","properties":{"reasoning":{"type":"string"},"deliverable":{"type":"array","items":{}}},"required":["reasoning","deliverable"]}`;
    } else {
      responseFormatInstructions += "2. \"deliverable\"：生成的文本内容\n";
      responseFormatInstructions += "\nJSON Schema:\n";
      responseFormatInstructions += `{"$schema":"http://json-schema.org/draft-04/schema#","type":"object","properties":{"reasoning":{"type":"string"},"deliverable":{"type":"string"}},"required":["reasoning","deliverable"]}`;
    }

    return hydratedMessage + responseFormatInstructions;
  } catch (error) {
    console.error('Error in craftPrompt:', error);
    console.error('hydration failed');
    console.error('raw message:\n' + rawMessage);

    return '?';
  }
};