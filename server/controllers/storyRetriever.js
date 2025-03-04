/**
 * Handles story-related functions including retrieval, compilation, and player-specific data.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for story data to avoid repeated file reads
const storyCache = {
  1: null,
  2: null
};

/**
 * Loads story data from JSON files
 * 
 * @param {number|string} storyId - Which story to load (1, 2, or 0 for both)
 * @returns {Promise<Object|Array>} Story data object or array of merged stories
 */
async function loadStoryData(storyId) {
  // Convert storyId to number if it's a string
  const storyIdNum = typeof storyId === 'string' ? parseInt(storyId, 10) : storyId;
  
  // Check cache first
  if (storyIdNum !== 0 && storyCache[storyIdNum]) {
    return storyCache[storyIdNum];
  }

  try {
    // Define story file paths using proper path resolution
    // Using path.join with __dirname for reliability relative to file location
    const story1Path = path.join(__dirname, '..', 'sites', 'station1', 'input', 'story.json');
    const story2Path = path.join(__dirname, '..', 'sites', 'station2', 'input', 'story.json');
    
    if (storyIdNum === 1 || storyIdNum === 0) {
      if (!storyCache[1]) {
        const story1Data = await fs.readFile(story1Path, 'utf8');
        storyCache[1] = JSON.parse(story1Data);
      }
    }
    
    if (storyIdNum === 2 || storyIdNum === 0) {
      if (!storyCache[2]) {
        const story2Data = await fs.readFile(story2Path, 'utf8');
        storyCache[2] = JSON.parse(story2Data);
      }
    }
    
    // Return the appropriate story data
    if (storyIdNum === 0) {
      // Merge story blocks for both stories
      return {
        blocks: [...storyCache[1].blocks, ...storyCache[2].blocks]
      };
    } else {
      return storyCache[storyIdNum];
    }
  } catch (error) {
    console.error(`Error loading story data (ID: ${storyId}):`, error);
    return { blocks: [] };
  }
}

/**
 * Get story blocks up to a specific block, optionally filtered by player and block type
 * 
 * @param {string|null} playerId - The unique identifier for a player
 * @param {string|null} blockId - The unique block identifier to retrieve up to
 * @param {number} storyId - Which story to retrieve (1, 2, or 0 for both)
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
    // Load the appropriate story data
    const storyData = await loadStoryData(storyId);
    
    if (!storyData || !storyData.blocks || storyData.blocks.length === 0) {
      return [];
    }
    
    let blocks = [...storyData.blocks];
    
    // Filter blocks up to the specified blockId
    if (blockId) {
      const blockIndex = blocks.findIndex(block => block.id === blockId);
      if (blockIndex !== -1) {
        blocks = blocks.slice(0, blockIndex + 1);
      }
    }
    
    // Filter by block type if specified
    if (blockType) {
      blocks = blocks.filter(block => block.type === blockType);
    }
    
    // Apply player-specific data if playerId is provided
    if (playerId) {
      await db.read();
      
      // Ensure the players object exists in the database
      if (db.data && db.data.players && db.data.players[playerId]) {
        const playerChoices = db.data.players[playerId].choices || {};
        
        // Enhance blocks with player-specific data
        blocks = blocks.map(block => {
          const enhancedBlock = { ...block };
          
          // If the player has made a choice for this block, include it
          if (playerChoices[block.id]) {
            enhancedBlock.playerChoice = {
              chosenIndex: playerChoices[block.id].chosenIndex,
              chosenText: playerChoices[block.id].chosenText
            };
          }
          
          return enhancedBlock;
        });
      }
    }
    
    return blocks;
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
    // Try to find the block in both stories
    const allStoryData = await loadStoryData(0);
    const block = allStoryData.blocks.find(b => b.id === blockId);
    
    if (!block) {
      return null;
    }
    
    const result = { ...block };
    
    // Include player-specific choices if playerId is provided
    if (playerId) {
      await db.read();
      
      if (db.data && db.data.players && db.data.players[playerId] && 
          db.data.players[playerId].choices && db.data.players[playerId].choices[blockId]) {
        result.playerChoice = {
          chosenIndex: db.data.players[playerId].choices[blockId].chosenIndex,
          chosenText: db.data.players[playerId].choices[blockId].chosenText
        };
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error in getBlockData:', error);
    return null;
  }
}

/**
 * Compiles story text for a specific player
 *
 * @param {string} playerId - the player's unique ID
 * @param {number} storyId - the story to compile (1, 2, or 0 for both)
 * @param {string|null} blockId - if provided, compile story up to this block
 * @return {Promise<string>} a single or multi-paragraph string of compiled story text
 */
async function compileStoryForPlayer(playerId, storyId, blockId = null) {
  try {
    // Get all relevant blocks
    const blocks = await getStoryBeforeBlockByPlayer(playerId, blockId, storyId);
    
    if (!blocks || blocks.length === 0) {
      return "";
    }
    
    // Process blocks into a coherent text narrative
    let compiledText = "";
    
    for (const block of blocks) {
      // For scene headers, add a line break and the title
      if (block.type === "scene-header") {
        if (compiledText) {
          compiledText += "\n\n";
        }
        compiledText += block.titleName + "\n";
        continue;
      }
      
      // For plain text blocks, just add the text
      if (block.type === "plain") {
        compiledText += block.text;
        continue;
      }
      
      // For static choice blocks, add the player's choice with annotation
      if (block.type === "static") {
        if (block.playerChoice) {
          // Add the chosen option with parentheses annotation showing available options
          const chosenText = block.options[block.playerChoice.chosenIndex];
          compiledText += `<${chosenText}> (choices given: ${block.options.join(', ')})`;
        } else {
          // If no choice was made, show all options in brackets
          compiledText += `<choice not made> (options: ${block.options.join(', ')})`;
        }
        continue;
      }
      
      // For dynamic-text blocks, get the generated content from the database
      if (block.type === "dynamic-text") {
        // Check if this player has this block in their choices (where dynamic content would be stored)
        await db.read();
        
        if (db.data && db.data.players && playerId && db.data.players[playerId] && 
            db.data.players[playerId].choices && db.data.players[playerId].choices[block.id]) {
          
          const dynamicContent = db.data.players[playerId].choices[block.id].generatedContent;
          
          if (dynamicContent) {
            compiledText += dynamicContent;
          } else {
            compiledText += `<dynamic content not found for block ${block.id.substring(0, 8)}...>`;
          }
        } else {
          // If no dynamic content found, provide a descriptive placeholder
          compiledText += `<dynamic content not generated>`;
        }
        continue;
      }
      
      // For dynamic-option blocks, handle similarly to dynamic-text
      if (block.type === "dynamic-option") {
        await db.read();
        
        if (db.data && db.data.players && playerId && db.data.players[playerId] && 
            db.data.players[playerId].choices && db.data.players[playerId].choices[block.id]) {
          
          const choice = db.data.players[playerId].choices[block.id];
          const options = choice.availableOptions;
          const chosenText = choice.chosenText;
          
          if (chosenText && options) {
            compiledText += `<${chosenText}> (dynamic choices: ${options.join(', ')})`;
          } else {
            compiledText += `<dynamic choice not found for block ${block.id.substring(0, 8)}...>`;
          }
        } else {
          compiledText += `<dynamic choice not made>`;
        }
        continue;
      }
    }
    
    return compiledText;
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
    const allStoryData = await loadStoryData(0);
    const block = allStoryData.blocks.find(b => b.id === blockId);
    
    if (!block || !block.options) {
      return `Block ${blockId} not found or does not have options.`;
    }
    
    // Count how many players chose each option
    const choiceCounts = {};
    let totalChoices = 0;
    
    // Initialize counts for all options
    block.options.forEach((option, index) => {
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
    const storyData = await loadStoryData(storyId);
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