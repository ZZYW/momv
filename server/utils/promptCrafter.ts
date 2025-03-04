import db from '../db.js';
import { Player } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the template file
const templatePath = path.join(__dirname, 'templates.ejs');
const MASTER_TEMPLATE = fs.readFileSync(templatePath, 'utf8');

/**
 * Helper function to extract templates from the master template string
 */
const getTemplate = (tag: string): string => {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
  const match = MASTER_TEMPLATE.match(regex);
  return match ? match[1].trim() : '';
};

// Shared components
const WRITER_ROLE = getTemplate('writer_role');
const LANGUAGE_REQUIREMENT = getTemplate('language_requirement');
const RESPONSE_FORMAT = getTemplate('response_format');

/**
 * Block types supported by the application
 */
export type BlockType = 'dynamic-option' | 'dynamic-text' | 'dynamic-word';

/**
 * Parameters for block instructions
 */
export interface BlockInstructionsParams {
  blockType: BlockType;
  optionCount?: number;
  sentenceCount?: number;
  lexiconCategory?: string;
}

/**
 * Context information for a player's choice
 */
export interface ContextInfo {
  availableOptions?: string[];
  chosenText?: string;
  isFromStation1?: boolean;
}

/**
 * Parameters for preview prompt
 */
export interface PreviewPromptParams {
  blockType: BlockType;
  message?: string;
  optionCount?: number;
  sentenceCount?: number;
  lexiconCategory?: string;
  contextInfo?: ContextInfo[];
  passageContext?: PassageContext | null;
  storyId?: string;
}

/**
 * Reference to a context block
 */
export interface ContextRef {
  value: string;
  includeAll?: boolean;
  station1Choices?: boolean;
}

/**
 * Passage context for a dynamic block
 */
export interface PassageContext {
  textBeforeDynamic: string;
}

/**
 * Block structure from story.json
 */
export interface StoryBlock {
  id: string;
  type: string;
  text?: string;
  options?: string[];
  titleName?: string;
}

/**
 * Prompt templates for different block types in natural language.
 */
export const PROMPT_TEMPLATES: Record<BlockType, string> = {
  "dynamic-option": getTemplate('dynamic_option'),
  "dynamic-text": getTemplate('dynamic_text'),
  "dynamic-word": getTemplate('dynamic_word')
};

/**
 * Context formatting template in natural language
 */
export const CONTEXT_TEMPLATE = {
  prefix: getTemplate('context_prefix'),
  itemWithChoice: getTemplate('context_item_with_choice'),
  optionsPrefix: getTemplate('context_options_prefix'),
  optionsSuffix: getTemplate('context_options_suffix'),
  noChoice: getTemplate('context_no_choice'),
  suffix: getTemplate('context_suffix')
};

/**
 * Full prompt structure template in natural language
 */
export const FULL_PROMPT_TEMPLATE = getTemplate('full_prompt');

/**
 * Extended prompt structure template with passage context in natural language
 */
export const EXTENDED_PROMPT_TEMPLATE = getTemplate('extended_prompt');

/**
 * Creates instructions based on block type and properties in natural language format.
 * @param {BlockInstructionsParams} params - Parameter object
 * @returns {string} - Crafted instructions in natural language
 */
export const getBlockInstructions = ({ blockType, optionCount, sentenceCount, lexiconCategory }: BlockInstructionsParams): string => {
  let template = PROMPT_TEMPLATES[blockType] || "";

  // Replace placeholders with actual values based on block type
  if (blockType === "dynamic-option" && optionCount) {
    template = template
      .replace('{number_of_choices}', String(optionCount))
      .replace('{writer_role}', WRITER_ROLE)
      .replace('{language_requirement}', LANGUAGE_REQUIREMENT)
      .replace('{response_format}', RESPONSE_FORMAT);
  }
  else if (blockType === "dynamic-text" && sentenceCount) {
    template = template
      .replace('{number_of_sentences}', String(sentenceCount))
      .replace('{writer_role}', WRITER_ROLE)
      .replace('{language_requirement}', LANGUAGE_REQUIREMENT)
      .replace('{response_format}', RESPONSE_FORMAT);
  }
  else if (blockType === "dynamic-word" && lexiconCategory) {
    template = template
      .replace('{word_category}', lexiconCategory || '')
      .replace('{writer_role}', WRITER_ROLE)
      .replace('{language_requirement}', LANGUAGE_REQUIREMENT)
      .replace('{response_format}', RESPONSE_FORMAT);
  }

  return template;
};

/**
 * Retrieve context information in a human-friendly format.
 * @param {ContextRef[]} contextRefs - References to context blocks
 * @param {string} currentPlayerID - Current player's ID
 * @param {string} storyId - ID of the current story
 * @returns {Promise<ContextInfo[]>} - Context information
 */
export const fetchContextInfo = async (contextRefs: ContextRef[], currentPlayerID: string, storyId = "1"): Promise<ContextInfo[]> => {
  await db.read();
  const contextInfo: ContextInfo[] = [];
  const players = db.data.players || {};

  // For station2, automatically include all static choices from station1
  if (storyId === "2" && !contextRefs.some(ref => ref.station1Choices === false)) {
    const station1Blocks = await getStoryBlocks("1");
    const staticBlocks = station1Blocks.filter(block => block.type === 'static');
    
    for (const block of staticBlocks) {
      if (players[currentPlayerID]?.choices?.[block.id]) {
        const { availableOptions, chosenText } = players[currentPlayerID].choices[block.id];
        contextInfo.push({ 
          availableOptions, 
          chosenText,
          isFromStation1: true  // Mark these as coming from station1
        });
      }
    }
  }

  // Process explicitly referenced contexts
  for (const contextRef of contextRefs) {
    const blockId = contextRef.value;
    const includeAll = contextRef.includeAll === true;
    if (!blockId) continue;

    if (includeAll) {
      for (const playerId in players) {
        const player = players[playerId] as Player;
        const playerChoices = player.choices || {};
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

// Helper function to get story blocks - import from aiController
const getStoryBlocks = async (storyId: string | number): Promise<StoryBlock[]> => {
  try {
    const fsPromises = await import('fs/promises');
    const pathModule = await import('path');
    // Dynamically build the path based on storyId which corresponds to the station number
    const storyPath = pathModule.join(process.cwd(), 'server', 'sites', `station${storyId}`, 'input', 'story.json');
    const storyData = await fsPromises.readFile(storyPath, 'utf-8');
    const story = JSON.parse(storyData);
    return story.blocks || [];
  } catch (error) {
    console.error(`Error loading story ${storyId}:`, error);
    return [];
  }
};

/**
 * Formats context information into a readable natural language string
 * @param {ContextInfo[]} contextInfo - Array of context objects
 * @returns {string} - Formatted context string in natural language
 */
export const formatContextString = (contextInfo: ContextInfo[]): string => {
  if (!contextInfo || contextInfo.length === 0) return "";

  // Group contexts by station
  const station1Choices = contextInfo.filter(ctx => ctx.isFromStation1);
  const station2Choices = contextInfo.filter(ctx => !ctx.isFromStation1);
  
  let formattedItems: string[] = [];
  
  // Format player choices section
  formattedItems.push("--- 玩家历史选择 ---");
  formattedItems.push("");
  formattedItems.push("以下是玩家之前做出的选择。请记住，这些选择表达的是隐喻和符号意义，而非字面意思。");
  formattedItems.push("请深入解析这些选择的象征含义，但不要在你的创作中直接引用这些原始选择。");
  
  // Format station1 choices if any
  if (station1Choices.length > 0) {
    formattedItems.push("");
    formattedItems.push("第一站选择：");
    
    station1Choices.forEach((ctx, index) => {
      if (ctx.chosenText) {
        let optionsInfo = "";
        if (ctx.availableOptions && Array.isArray(ctx.availableOptions)) {
          optionsInfo = CONTEXT_TEMPLATE.optionsPrefix +
            ctx.availableOptions.join(" | ") +
            CONTEXT_TEMPLATE.optionsSuffix;
        }
        formattedItems.push(CONTEXT_TEMPLATE.itemWithChoice
          .replace('{index}', String(index + 1))
          .replace('{chosenText}', ctx.chosenText)
          .replace('{optionsInfo}', optionsInfo));
      }
    });
  }
  
  // Format station2 choices if any
  if (station2Choices.length > 0) {
    formattedItems.push("");
    formattedItems.push("第二站选择：");
    
    // Map station2 choices with proper indexing
    station2Choices.forEach((ctx, index) => {
      if (ctx.chosenText) {
        let optionsInfo = "";
        if (ctx.availableOptions && Array.isArray(ctx.availableOptions)) {
          optionsInfo = CONTEXT_TEMPLATE.optionsPrefix +
            ctx.availableOptions.join(" | ") +
            CONTEXT_TEMPLATE.optionsSuffix;
        }
        formattedItems.push(CONTEXT_TEMPLATE.itemWithChoice
          .replace('{index}', String(index + 1))
          .replace('{chosenText}', ctx.chosenText)
          .replace('{optionsInfo}', optionsInfo));
      }
    });
  }
  
  formattedItems.push("");
  formattedItems.push("--- 玩家历史选择结束 ---");

  return formattedItems.join("\n");
};

/**
 * Crafts a complete prompt for the AI using natural language
 * @param {string} message - The main message/prompt
 * @param {string} contextString - Formatted context string
 * @param {string} instructions - Block-specific instructions
 * @param {PassageContext | null} [passageContext] - The surrounding passage context (optional)
 * @returns {string} - Complete prompt in natural language
 */
export const craftPrompt = (
  message: string,
  contextString: string,
  instructions: string,
  passageContext?: PassageContext | null
): string => {
  if (passageContext && passageContext.textBeforeDynamic !== undefined) {
    return EXTENDED_PROMPT_TEMPLATE
      .replace('{message}', message || "")
      .replace('{textBeforeDynamic}', passageContext.textBeforeDynamic || "")
      .replace('{contextString}', contextString)
      .replace('{instructions}', instructions);
  }

  return FULL_PROMPT_TEMPLATE
    .replace('{message}', message || "")
    .replace('{contextString}', contextString)
    .replace('{instructions}', instructions);
};

/**
 * Preview function to see what the final composed prompt will look like
 * @param {PreviewPromptParams} params - Parameter object with all prompt components
 * @returns {string} - The complete prompt that will be sent to the LLM
 */
export const previewPrompt = ({
  blockType,
  message = "",
  optionCount,
  sentenceCount,
  lexiconCategory,
  contextInfo = [],
  passageContext,
  storyId = "1"
}: PreviewPromptParams): string => {
  const instructions = getBlockInstructions({
    blockType,
    optionCount,
    sentenceCount,
    lexiconCategory
  });

  // For station2, omit contextString since it's already in the passageContext
  let contextString = "";
  if (storyId !== "2" && contextInfo && contextInfo.length > 0) {
    contextString = formatContextString(contextInfo);
  }

  // Ensure passageContext only has textBeforeDynamic if needed
  const cleanPassageContext = passageContext ? {
    textBeforeDynamic: passageContext.textBeforeDynamic
  } : null;

  return craftPrompt(message, contextString, instructions, cleanPassageContext);
};