import db from '../db.js';
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
const getTemplate = (tag) => {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
  const match = MASTER_TEMPLATE.match(regex);
  return match ? match[1].trim() : '';
};

// Shared components
const WRITER_ROLE = getTemplate('writer_role');
const LANGUAGE_REQUIREMENT = getTemplate('language_requirement');
const RESPONSE_FORMAT = getTemplate('response_format');

/**
 * Prompt templates for different block types in natural language.
 */
export const PROMPT_TEMPLATES = {
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
 * @param {Object} params - Parameter object
 * @param {string} params.blockType - Type of block (dynamic-option, dynamic-text, dynamic-word)
 * @param {number} params.optionCount - Number of options to generate
 * @param {number} params.sentenceCount - Number of sentences to generate
 * @param {string} params.lexiconCategory - Category of word to generate
 * @returns {string} - Crafted instructions in natural language
 */
export const getBlockInstructions = ({ blockType, optionCount, sentenceCount, lexiconCategory }) => {
  let template = PROMPT_TEMPLATES[blockType] || "";
  let formatTemplate = "";

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
      .replace('{word_category}', lexiconCategory)
      .replace('{writer_role}', WRITER_ROLE)
      .replace('{language_requirement}', LANGUAGE_REQUIREMENT)
      .replace('{response_format}', RESPONSE_FORMAT);
  }

  return template;
};

/**
 * Retrieve context information in a human-friendly format.
 * @param {Array} contextRefs - References to context blocks
 * @param {string} currentPlayerID - Current player's ID
 * @param {string} storyId - ID of the current story
 * @returns {Promise<Array>} - Context information
 */
export const fetchContextInfo = async (contextRefs, currentPlayerID, storyId = "1") => {
  await db.read();
  const contextInfo = [];
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

// Helper function to get story blocks - import from aiController
const getStoryBlocks = async (storyId) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
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
 * Formats context information into a readable natural language string
 * @param {Array} contextInfo - Array of context objects
 * @returns {string} - Formatted context string in natural language
 */
export const formatContextString = (contextInfo) => {
  if (!contextInfo || contextInfo.length === 0) return "";

  // Group contexts by station
  const station1Choices = contextInfo.filter(ctx => ctx.isFromStation1);
  const station2Choices = contextInfo.filter(ctx => !ctx.isFromStation1);
  
  let formattedItems = [];
  
  // Format station1 choices if any
  if (station1Choices.length > 0) {
    formattedItems.push("--- 第一站玩家选择 ---");
    
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
      } else {
        formattedItems.push(CONTEXT_TEMPLATE.noChoice.replace('{index}', String(index + 1)));
      }
    });
    
    formattedItems.push("--- 第一站玩家选择结束 ---");
  }
  
  // Format station2 choices if any
  if (station2Choices.length > 0) {
    if (station1Choices.length > 0) {
      formattedItems.push(""); // Add a blank line between station sections
    }
    
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
      } else {
        formattedItems.push(CONTEXT_TEMPLATE.noChoice.replace('{index}', String(index + 1)));
      }
    });
  }

  return CONTEXT_TEMPLATE.prefix + "\n" + formattedItems.join("\n") + "\n" + CONTEXT_TEMPLATE.suffix;
};

/**
 * Crafts a complete prompt for the AI using natural language
 * @param {string} message - The main message/prompt
 * @param {string} contextString - Formatted context string
 * @param {string} instructions - Block-specific instructions
 * @param {Object} [passageContext] - The surrounding passage context (optional)
 * @param {string} passageContext.textBeforeDynamic - All text from the story shown before this dynamic block (from all previous scenes/passages)
 * @returns {string} - Complete prompt in natural language
 */
export const craftPrompt = (message, contextString, instructions, passageContext) => {
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
 * @param {Object} params - Parameter object with all prompt components
 * @returns {string} - The complete prompt that will be sent to the LLM
 */
export const previewPrompt = ({
  blockType,
  message,
  optionCount,
  sentenceCount,
  lexiconCategory,
  contextInfo,
  passageContext
}) => {
  const instructions = getBlockInstructions({
    blockType,
    optionCount,
    sentenceCount,
    lexiconCategory
  });

  const contextString = contextInfo ? formatContextString(contextInfo) : "";

  // Ensure passageContext only has textBeforeDynamic if needed
  const cleanPassageContext = passageContext ? {
    textBeforeDynamic: passageContext.textBeforeDynamic
  } : null;

  return craftPrompt(message, contextString, instructions, cleanPassageContext);
};