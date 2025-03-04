/**
 * Handles story-related functions including retrieval, compilation, and player-specific data.
 * 
 * This module follows a layered approach:
 * 1. Data loading/retrieval (loadStoryFile, getStoryBlocks)
 * 2. Block processing (enhanceBlocksWithPlayerData)
 * 3. Text assembly/formatting (renderBlock, compileStoryText)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads a single story file from disk
 * 
 * @param {number|string} storyId - The story ID (typically 1 or 2)
 * @returns {Promise<Object>} The parsed story data
 */
async function loadStoryFile(storyId) {
  try {
    const numericStoryId = typeof storyId === 'string' ? parseInt(storyId, 10) : storyId;
    const storyPath = path.join(__dirname, '..', 'sites', `station${numericStoryId}`, 'input', 'story.json');
    const storyData = await fs.readFile(storyPath, 'utf8');
    return JSON.parse(storyData);
  } catch (error) {
    console.error(`Error loading story file (ID: ${storyId}):`, error);
    return { blocks: [] };
  }
}

/**
 * Loads and combines multiple story files
 * 
 * @param {Array<number|string>} storyIds - Array of story IDs to load and combine
 * @returns {Promise<Object>} Combined story data
 */
async function loadMultipleStories(storyIds) {
  try {
    const storiesPromises = storyIds.map(id => loadStoryFile(id));
    const stories = await Promise.all(storiesPromises);
    
    // Combine all blocks from all stories
    const combinedBlocks = stories.reduce((allBlocks, story) => {
      if (story && story.blocks && Array.isArray(story.blocks)) {
        return [...allBlocks, ...story.blocks];
      }
      return allBlocks;
    }, []);
    
    return { blocks: combinedBlocks };
  } catch (error) {
    console.error(`Error loading multiple stories (IDs: ${storyIds}):`, error);
    return { blocks: [] };
  }
}

/**
 * Main function to get story data - handles single story or multiple stories
 * 
 * @param {number|string|Array} storyId - Story ID(s) to load (1, 2, or [1,2] for both)
 * @returns {Promise<Object>} Story data with blocks
 */
async function getStoryData(storyId) {
  // If storyId is an array, load multiple stories
  if (Array.isArray(storyId)) {
    return loadMultipleStories(storyId);
  }
  
  // Special case for storyId 0, which means "all stories"
  if (storyId === 0 || storyId === '0') {
    return loadMultipleStories([1, 2]);
  }
  
  // Otherwise load a single story
  return loadStoryFile(storyId);
}

/**
 * Filter blocks by criteria (block ID, type)
 * 
 * @param {Array} blocks - Array of story blocks
 * @param {Object} options - Filter options
 * @param {string} [options.blockId] - If provided, blocks up to this ID
 * @param {string} [options.blockType] - If provided, only blocks of this type
 * @returns {Array} Filtered blocks
 */
function filterBlocks(blocks, { blockId = null, blockType = null }) {
  let filteredBlocks = [...blocks];
  
  // Filter blocks up to the specified blockId
  if (blockId) {
    const blockIndex = filteredBlocks.findIndex(block => block.id === blockId);
    if (blockIndex !== -1) {
      filteredBlocks = filteredBlocks.slice(0, blockIndex + 1);
    }
  }
  
  // Filter by block type if specified
  if (blockType) {
    filteredBlocks = filteredBlocks.filter(block => block.type === blockType);
  }
  
  return filteredBlocks;
}

/**
 * Enhance blocks with player-specific data
 * 
 * @param {Array} blocks - Array of story blocks
 * @param {string} playerId - The player's ID
 * @returns {Promise<Array>} Blocks enhanced with player data
 */
async function enhanceBlocksWithPlayerData(blocks, playerId) {
  if (!playerId) return blocks;
  
  try {
    await db.read();
    
    // If no player data available, return blocks as-is
    if (!db.data || !db.data.players || !db.data.players[playerId]) {
      return blocks;
    }
    
    const playerChoices = db.data.players[playerId].choices || {};
    const playerDynamicContent = db.data.players[playerId].dynamicContent || {};
    
    // Enhance blocks with player-specific data
    return blocks.map(block => {
      const enhancedBlock = { ...block };
      
      // Add player's choice data to the block
      if (playerChoices[block.id]) {
        enhancedBlock.playerChoice = {
          chosenIndex: playerChoices[block.id].chosenIndex,
          chosenText: playerChoices[block.id].chosenText,
          availableOptions: playerChoices[block.id].availableOptions
        };
      }
      
      // Add dynamic content if available
      if (playerDynamicContent[block.id]) {
        enhancedBlock.dynamicContent = playerDynamicContent[block.id].content;
      }
      
      return enhancedBlock;
    });
  } catch (error) {
    console.error('Error enhancing blocks with player data:', error);
    return blocks; // Return original blocks on error
  }
}

/**
 * Get story blocks up to a specific block, optionally filtered by player and block type
 * 
 * @param {string|null} playerId - The unique identifier for a player
 * @param {string|null} blockId - The unique block identifier to retrieve up to
 * @param {number|string|Array} storyId - Which story to retrieve (1, 2, [1,2], or 0 for both)
 * @param {string|null} blockType - Filter by block type
 * @returns {Promise<Array>} Array of story blocks
 */
async function getStoryBeforeBlockByPlayer(
  playerId = null,
  blockId = null,
  storyId = 1,
  blockType = null
) {
  try {
    // 1. Load the appropriate story data
    const storyData = await getStoryData(storyId);
    
    if (!storyData || !storyData.blocks || storyData.blocks.length === 0) {
      return [];
    }
    
    // 2. Filter blocks based on provided criteria
    const filteredBlocks = filterBlocks(storyData.blocks, { blockId, blockType });
    
    // 3. Enhance blocks with player-specific data if needed
    const enhancedBlocks = await enhanceBlocksWithPlayerData(filteredBlocks, playerId);
    
    return enhancedBlocks;
  } catch (error) {
    console.error('Error in getStoryBeforeBlockByPlayer:', error);
    return [];
  }
}

/**
 * Retrieves a single block with all static and dynamic data
 * 
 * @param {string} blockId - The unique block identifier
 * @param {string|null} playerId - Player ID for personalized data
 * @returns {Promise<Object|null>} The story block or null if not found
 */
async function getBlockData(blockId, playerId = null) {
  try {
    // Get all story blocks (from both stories to ensure we find the block)
    const allStoryData = await getStoryData(0);
    const block = allStoryData.blocks.find(b => b.id === blockId);
    
    if (!block) {
      return null;
    }
    
    // If no player ID provided, return the block as-is
    if (!playerId) {
      return { ...block };
    }
    
    // Enhance the single block with player data
    const [enhancedBlock] = await enhanceBlocksWithPlayerData([block], playerId);
    return enhancedBlock;
  } catch (error) {
    console.error('Error in getBlockData:', error);
    return null;
  }
}

/**
 * Block renderers for different block types
 * Each renderer converts a block to text representation
 */
const blockRenderers = {
  'scene-header': (block, context) => {
    return (context.compiledText ? '\n\n' : '') + block.titleName + '\n';
  },
  
  'plain': (block) => block.text,
  
  'static': (block) => {
    if (block.playerChoice) {
      const chosenText = block.options[block.playerChoice.chosenIndex];
      return `<${chosenText}> (choices given: ${block.options.join(', ')})`;
    } else {
      return `<choice not made> (options: ${block.options.join(', ')})`;
    }
  },
  
  'dynamic-text': (block) => {
    // Get content from the dynamicContent property we set in enhanceBlocksWithPlayerData
    if (block.dynamicContent) {
      return block.dynamicContent;
    }
    
    return `<dynamic content not generated for block ${block.id.substring(0, 8)}...>`;
  },
  
  'dynamic-option': (block) => {
    // First check if we have dynamic content
    if (block.dynamicContent) {
      // If we have both dynamic content and a player choice, format with choice
      if (block.playerChoice && block.playerChoice.chosenText) {
        const options = block.playerChoice.availableOptions || [];
        return `<${block.playerChoice.chosenText}> (dynamic choices: ${options.join(', ')})`;
      }
      return block.dynamicContent;
    }
    
    // Fall back to just showing the choice if available
    if (block.playerChoice && block.playerChoice.chosenText) {
      const options = block.playerChoice.availableOptions || [];
      return `<${block.playerChoice.chosenText}> (dynamic choices: ${options.join(', ')})`;
    }
    
    return `<dynamic choice not made>`;
  },
  
  // Default renderer for any unhandled block types
  'default': (block) => `<${block.type} block: ${block.id.substring(0, 8)}...>`
};

/**
 * Render a single block as text
 * 
 * @param {Object} block - The block to render
 * @param {Object} context - Context data for rendering
 * @returns {string} Text representation of the block
 */
function renderBlock(block, context) {
  // Get the appropriate renderer for this block type, or use default
  const renderer = blockRenderers[block.type] || blockRenderers.default;
  return renderer(block, context);
}

/**
 * Compile blocks into readable text
 * 
 * @param {Array} blocks - The blocks to compile
 * @param {Object} context - Compilation context (e.g., playerId)
 * @returns {string} Compiled story text
 */
function compileStoryText(blocks, context = {}) {
  let compiledText = "";
  
  // Process each block
  for (const block of blocks) {
    // Update context with current state
    const blockContext = {
      ...context,
      compiledText
    };
    
    // Render this block and add to compiled text
    compiledText += renderBlock(block, blockContext);
  }
  
  return compiledText;
}

/**
 * Compiles story text for a specific player
 *
 * @param {string} playerId - the player's unique ID
 * @param {number|string|Array} storyId - the story to compile (1, 2, [1,2], or 0 for both)
 * @param {string|null} blockId - if provided, compile story up to this block
 * @return {Promise<string>} a single or multi-paragraph string of compiled story text
 */
async function compileStoryForPlayer(playerId, storyId, blockId = null) {
  try {
    // 1. Get all relevant blocks with player data
    const blocks = await getStoryBeforeBlockByPlayer(playerId, blockId, storyId);
    
    if (!blocks || blocks.length === 0) {
      return "";
    }
    
    // 2. Compile blocks into text
    return compileStoryText(blocks, { playerId });
  } catch (error) {
    console.error('Error in compileStoryForPlayer:', error);
    return "";
  }
}

/**
 * Compiles a summary of player choices for a specific block
 *
 * @param {string} blockId - the block in question
 * @return {Promise<string>} a text summary of how many players chose each option
 */
async function compileChoiceSummaryForBlock(blockId) {
  try {
    await db.read();
    
    if (!db.data || !db.data.players) {
      return `No data available for block ${blockId}.`;
    }
    
    // Find the block to get the available options
    const allStoryData = await getStoryData(0);
    const block = allStoryData.blocks.find(b => b.id === blockId);
    
    if (!block || !block.options) {
      return `Block ${blockId} not found or does not have options.`;
    }
    
    // Count how many players chose each option
    const choiceCounts = {};
    let totalChoices = 0;
    
    // Initialize counts for all options
    block.options.forEach((option) => {
      choiceCounts[option] = 0;
    });
    
    // Count player choices
    Object.values(db.data.players).forEach(player => {
      if (player.choices && player.choices[blockId]) {
        const choice = player.choices[blockId];
        const chosenText = choice.chosenText || block.options[choice.chosenIndex];
        
        if (chosenText) {
          choiceCounts[chosenText] = (choiceCounts[chosenText] || 0) + 1;
          totalChoices++;
        }
      }
    });
    
    // Format the summary
    let summary = `For blockId=${blockId}, total choices made so far: ${totalChoices}.\n`;
    
    Object.entries(choiceCounts)
      .filter(([_, count]) => count > 0)
      .forEach(([option, count]) => {
        summary += `- ${count} player(s) chose "${option}"\n`;
      });
    
    return summary;
  } catch (error) {
    console.error('Error in compileChoiceSummaryForBlock:', error);
    return `Error retrieving choice summary for block ${blockId}.`;
  }
}

/**
 * Get all blocks from a specific story
 * This function matches the interface used in promptCrafter.js for backward compatibility
 * 
 * @param {string|number} storyId - Which story to retrieve (1 or 2)
 * @returns {Promise<Array>} Array of story blocks
 */
async function getStoryBlocks(storyId) {
  try {
    const storyData = await getStoryData(storyId);
    return storyData.blocks || [];
  } catch (error) {
    console.error(`Error in getStoryBlocks(${storyId}):`, error);
    return [];
  }
}

export {
  getStoryBeforeBlockByPlayer,
  getBlockData,
  compileStoryForPlayer,
  compileChoiceSummaryForBlock,
  getStoryBlocks
};