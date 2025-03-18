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
import { Player, PlayerChoice as DBPlayerChoice } from '../db.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * A story block from story.json
 */
export interface StoryBlock {
  id: string;
  type: string;
  text?: string;
  options?: string[];
  titleName?: string;
  playerChoice?: PlayerChoice;
  dynamicContent?: string | string[];
  prompt?: string;
  blockName?: string;
  generateOptions?: boolean;
}

/**
 * Player's choice for a block
 */
export interface PlayerChoice {
  chosenIndex?: number;
  chosenText: string;
  availableOptions?: string[];
}

/**
 * Story data structure
 */
export interface StoryData {
  blocks: StoryBlock[];
}

/**
 * Filter options for blocks
 */
export interface BlockFilterOptions {
  blockId?: string | null;
  blockType?: string | null;
}

/**
 * Context for rendering blocks
 */
export interface RenderContext {
  playerId?: string;
  compiledText?: string;
}

/**
 * Loads a single story file from disk
 * 
 * @param {number|string} storyId - The story ID (typically 1 or 2)
 * @returns {Promise<StoryData>} The parsed story data
 */
async function loadStoryFile(storyId: number | string): Promise<StoryData> {
  try {
    const numericStoryId = typeof storyId === 'string' ? parseInt(storyId, 10) : storyId;
    const rootDir = path.dirname(path.dirname(__dirname));
    const clientDir = path.join(rootDir, 'client');
    const storyPath = path.join(clientDir, 'src', 'sites', `station${numericStoryId}`, 'input', 'story.json');
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
 * @returns {Promise<StoryData>} Combined story data
 */
async function loadMultipleStories(storyIds: Array<number | string>): Promise<StoryData> {
  try {
    const storiesPromises = storyIds.map(id => loadStoryFile(id));
    const stories = await Promise.all(storiesPromises);
    
    // Combine all blocks from all stories
    const combinedBlocks = stories.reduce((allBlocks: StoryBlock[], story) => {
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
 * @param {number|string|Array<number|string>} storyId - Story ID(s) to load (1, 2, or [1,2] for both)
 * @returns {Promise<StoryData>} Story data with blocks
 */
async function getStoryData(storyId: number | string | Array<number | string>): Promise<StoryData> {
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
 * @param {StoryBlock[]} blocks - Array of story blocks
 * @param {BlockFilterOptions} options - Filter options
 * @returns {StoryBlock[]} Filtered blocks
 */
function filterBlocks(blocks: StoryBlock[], { blockId = null, blockType = null }: BlockFilterOptions): StoryBlock[] {
  let filteredBlocks = [...blocks];
  
  // IMPORTANT: For "up to this block" feature to work correctly:
  // We need to include all blocks BEFORE the current block, not the block itself
  
  // Filter blocks up to the specified blockId (but not including it)
  if (blockId) {
    console.log(`Filtering blocks up to ID: ${blockId}`);
    const blockIndex = filteredBlocks.findIndex(block => block.id === blockId);
    
    if (blockIndex !== -1) {
      console.log(`Found block at index ${blockIndex}, filtering to include blocks 0-${blockIndex-1}`);
      // Only include blocks BEFORE the current block (do not include the current block)
      filteredBlocks = filteredBlocks.slice(0, blockIndex);
      console.log(`After filtering, have ${filteredBlocks.length} blocks`);
    } else {
      console.log(`Block ID ${blockId} not found in blocks array`);
    }
  }
  
  // Filter by block type if specified
  if (blockType) {
    const beforeCount = filteredBlocks.length;
    filteredBlocks = filteredBlocks.filter(block => block.type === blockType);
    console.log(`Type filtering: ${beforeCount} -> ${filteredBlocks.length} blocks (type: ${blockType})`);
  }
  
  return filteredBlocks;
}

/**
 * Enhance blocks with player-specific data
 * 
 * @param {StoryBlock[]} blocks - Array of story blocks
 * @param {string} playerId - The player's ID
 * @returns {Promise<StoryBlock[]>} Blocks enhanced with player data
 */
async function enhanceBlocksWithPlayerData(blocks: StoryBlock[], playerId: string): Promise<StoryBlock[]> {
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
 * @param {number|string|Array<number|string>} storyId - Which story to retrieve (1, 2, [1,2], or 0 for both)
 * @param {string|null} blockType - Filter by block type
 * @returns {Promise<StoryBlock[]>} Array of story blocks
 */
async function getStoryBeforeBlockByPlayer(
  playerId: string | null = null,
  blockId: string | null = null,
  storyId: number | string | Array<number | string> = 1,
  blockType: string | null = null
): Promise<StoryBlock[]> {
  try {
    // 1. Load the appropriate story data
    const storyData = await getStoryData(storyId);
    
    if (!storyData || !storyData.blocks || storyData.blocks.length === 0) {
      return [];
    }
    
    // 2. Filter blocks based on provided criteria
    const filteredBlocks = filterBlocks(storyData.blocks, { blockId, blockType });
    
    // 3. Enhance blocks with player-specific data if needed
    const enhancedBlocks = playerId ? await enhanceBlocksWithPlayerData(filteredBlocks, playerId) : filteredBlocks;
    
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
 * @returns {Promise<StoryBlock|null>} The story block or null if not found
 */
async function getBlockData(blockId: string, playerId: string | null = null): Promise<StoryBlock | null> {
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
const blockRenderers: Record<string, (block: StoryBlock, context: RenderContext) => string> = {
  'scene-header': (block, context) => {
    return (context.compiledText ? '\n\n' : '') + (block.titleName || '') + '\n';
  },
  
  'plain': (block) => block.text || '',
  
  'static': (block) => {
    if (block.playerChoice) {
      const options = block.options || [];
      const chosenIndex = block.playerChoice.chosenIndex || 0;
      const chosenText = options[chosenIndex] || block.playerChoice.chosenText;
      return `<${chosenText}> (choices given: ${options.join(', ')})`;
    } else {
      return `<choice not made> (options: ${block.options?.join(', ') || ''})`;
    }
  },
  
  
  // Unified dynamic block handler
  'dynamic': (block) => {
    // Check if this is an option-generating block
    if (block.generateOptions) {
      // First check if we have dynamic content
      if (block.dynamicContent) {
        // If we have both dynamic content and a player choice, format with choice
        if (block.playerChoice && block.playerChoice.chosenText) {
          const options = block.playerChoice.availableOptions || [];
          return `<${block.playerChoice.chosenText}> (dynamic choices: ${options.join(', ')})`;
        }
        // Format dynamic content: convert array to string if needed
        return Array.isArray(block.dynamicContent) 
          ? block.dynamicContent.join(', ')
          : block.dynamicContent;
      }
      
      // Fall back to just showing the choice if available
      if (block.playerChoice && block.playerChoice.chosenText) {
        const options = block.playerChoice.availableOptions || [];
        return `<${block.playerChoice.chosenText}> (dynamic choices: ${options.join(', ')})`;
      }
      
      return `<dynamic choice not made>`;
    } else {
      // Handle as a text-generating block
      if (block.dynamicContent) {
        const content = block.dynamicContent;
        // Handle both string and string[] by converting arrays to strings if needed
        return typeof content === 'string' ? content : content.join('\n');
      }
      
      return `<dynamic content not generated for block ${block.id.substring(0, 8)}...>`;
    }
  },
  
  // Default renderer for any unhandled block types
  'default': (block) => `<${block.type} block: ${block.id.substring(0, 8)}...>`
};

/**
 * Render a single block as text
 * 
 * @param {StoryBlock} block - The block to render
 * @param {RenderContext} context - Context data for rendering
 * @returns {string} Text representation of the block
 */
function renderBlock(block: StoryBlock, context: RenderContext): string {
  // Get the appropriate renderer for this block type, or use default
  const renderer = blockRenderers[block.type] || blockRenderers.default;
  return renderer(block, context);
}

/**
 * Compile blocks into readable text
 * 
 * @param {StoryBlock[]} blocks - The blocks to compile
 * @param {RenderContext} context - Compilation context (e.g., playerId)
 * @returns {string} Compiled story text
 */
function compileStoryText(blocks: StoryBlock[], context: RenderContext = {}): string {
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
 * @param {number|string|Array<number|string>} storyId - the story to compile (1, 2, [1,2], or 0 for both)
 * @param {string|null} blockId - if provided, compile story up to this block
 * @return {Promise<string>} a single or multi-paragraph string of compiled story text
 */
async function compileStoryForPlayer(
  playerId: string,
  storyId: number | string | Array<number | string>,
  blockId: string | null = null
): Promise<string> {
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
async function compileChoiceSummaryForBlock(blockId: string): Promise<string> {
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
    const choiceCounts: Record<string, number> = {};
    let totalChoices = 0;
    
    // Initialize counts for all options
    block.options.forEach((option) => {
      choiceCounts[option] = 0;
    });
    
    // Count player choices
    Object.values(db.data.players).forEach((player: Player) => {
      if (player.choices && player.choices[blockId]) {
        const choice = player.choices[blockId];
        const chosenText = choice.chosenText || (block.options && block.options[choice.chosenIndex || 0]);
        
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
 * @returns {Promise<StoryBlock[]>} Array of story blocks
 */
async function getStoryBlocks(storyId: string | number): Promise<StoryBlock[]> {
  try {
    const storyData = await getStoryData(storyId);
    return storyData.blocks || [];
  } catch (error) {
    console.error(`Error in getStoryBlocks(${storyId}):`, error);
    return [];
  }
}

/**
 * Retrieves a player's basic metadata
 * 
 * @param {string} playerId - The player's unique identifier
 * @returns {Promise<{exists: boolean, codename: string|null}>} Player metadata
 */
async function getPlayerMetadata(playerId: string): Promise<{exists: boolean, codename: string|null}> {
  try {
    await db.read();
    
    if (!db.data || !db.data.players || !db.data.players[playerId]) {
      return { exists: false, codename: null };
    }
    
    return { 
      exists: true, 
      codename: db.data.players[playerId].codename || null 
    };
  } catch (error) {
    console.error('Error retrieving player metadata:', error);
    return { exists: false, codename: null };
  }
}

export {
  getStoryBeforeBlockByPlayer,
  getBlockData,
  compileStoryForPlayer,
  compileChoiceSummaryForBlock,
  getStoryBlocks,
  compileStoryText,
  filterBlocks,
  getPlayerMetadata
};