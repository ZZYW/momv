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
 * @param {string} id - Template ID to extract
 * @returns {string} - Extracted template string
 */
const getTemplate = (id) => {
  const regex = new RegExp(`<template id="${id}">(.*?)</template>`, 's');
  const match = MASTER_TEMPLATE.match(regex);
  return match ? match[1].trim() : '';
};

// Shared components
const WRITER_ROLE = getTemplate('writer-role');
const LANGUAGE_REQUIREMENT = getTemplate('language-requirement');
const COMMON_RESPONSE_FORMAT = getTemplate('common-response-format');

/**
 * Prompt templates for different block types in natural language.
 */
export const PROMPT_TEMPLATES = {
  "dynamic-option": getTemplate('dynamic-option'),
  "dynamic-text": getTemplate('dynamic-text'),
  "dynamic-word": getTemplate('dynamic-word')
};

/**
 * JSON response format templates
 */
export const FORMAT_TEMPLATES = {
  "dynamic-option": getTemplate('format-dynamic-option'),
  "dynamic-text": getTemplate('format-dynamic-text'),
  "dynamic-word": getTemplate('format-dynamic-word')
};

/**
 * Context formatting template in natural language
 */
export const CONTEXT_TEMPLATE = {
  prefix: getTemplate('context-prefix'),
  itemWithChoice: getTemplate('context-item-with-choice'),
  optionsPrefix: getTemplate('context-options-prefix'),
  optionsSuffix: getTemplate('context-options-suffix'),
  noChoice: getTemplate('context-no-choice'),
  suffix: getTemplate('context-suffix')
};

/**
 * Full prompt structure template in natural language
 */
export const FULL_PROMPT_TEMPLATE = getTemplate('full-prompt');

/**
 * Extended prompt structure template with passage context in natural language
 */
export const EXTENDED_PROMPT_TEMPLATE = getTemplate('extended-prompt');

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
      .replace('{response_format_json_array}', FORMAT_TEMPLATES[blockType]);
  } 
  else if (blockType === "dynamic-text" && sentenceCount) {
    template = template
      .replace('{number_of_sentences}', String(sentenceCount))
      .replace('{writer_role}', WRITER_ROLE)
      .replace('{language_requirement}', LANGUAGE_REQUIREMENT)
      .replace('{response_format_json_text}', FORMAT_TEMPLATES[blockType]);
  } 
  else if (blockType === "dynamic-word" && lexiconCategory) {
    template = template
      .replace('{word_category}', lexiconCategory)
      .replace('{writer_role}', WRITER_ROLE)
      .replace('{language_requirement}', LANGUAGE_REQUIREMENT)
      .replace('{response_format_json_word}', FORMAT_TEMPLATES[blockType]);
  }

  return template;
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
 * Formats context information into a readable natural language string
 * @param {Array} contextInfo - Array of context objects
 * @returns {string} - Formatted context string in natural language
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

  return CONTEXT_TEMPLATE.prefix + "\n" + formattedItems + "\n" + CONTEXT_TEMPLATE.suffix;
};

/**
 * Crafts a complete prompt for the AI using natural language
 * @param {string} message - The main message/prompt
 * @param {string} contextString - Formatted context string
 * @param {string} instructions - Block-specific instructions
 * @param {Object} [passageContext] - The surrounding passage context (optional)
 * @param {string} passageContext.textBeforeDynamic - Text that comes before the dynamic block
 * @param {string} passageContext.textAfterDynamic - Text that comes after the dynamic block
 * @returns {string} - Complete prompt in natural language
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
  
  return craftPrompt(message, contextString, instructions, passageContext);
};