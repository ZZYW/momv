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

/**
 * Prompt templates for different block types with XML tags.
 * These templates provide the structure for AI prompts and can be easily modified.
 */
export const PROMPT_TEMPLATES = {
  "dynamic-option": getTemplate('dynamic-option'),
  "dynamic-text": getTemplate('dynamic-text'),
  "dynamic-word": getTemplate('dynamic-word')
};

/**
 * JSON response format templates with XML instruction tags
 */
export const FORMAT_TEMPLATES = {
  "dynamic-option": getTemplate('format-dynamic-option'),
  "dynamic-text": getTemplate('format-dynamic-text'),
  "dynamic-word": getTemplate('format-dynamic-word')
};

/**
 * Context formatting template with XML tags
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
 * Full prompt structure template with XML tags
 */
export const FULL_PROMPT_TEMPLATE = getTemplate('full-prompt');

/**
 * Extended prompt structure template with passage context and XML tags
 */
export const EXTENDED_PROMPT_TEMPLATE = getTemplate('extended-prompt');

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