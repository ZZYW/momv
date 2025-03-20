import {
  compileStoryForPlayer,
  getBlockData,
  compileChoiceSummaryForBlock,
  getStoryBeforeBlockByPlayer,
  compileStoryText,
  StoryBlock
} from '../controllers/storyRetriever.js';
import logger from './logger.js';

/**
 * Placeholder query types
 */
type QueryType = 'compiledStory' | 'decisions' | 'answer' | 'codename' | 'unknown';

/**
 * Interface for a parsed placeholder query
 */
interface PlaceholderQuery {
  type: QueryType;
  target?: 'thisPlayer' | 'all' | 'nobody';
  questionIds?: string[];
  questionId?: string;  // Single question ID for the answer query
  storyIds?: string[];
  isAll?: boolean;
  originalText?: string;
  error?: string;
}

/**
 * Interface for a found placeholder in text
 */
interface Placeholder {
  fullMatch: string;
  innerContent: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Interface for a replacement to be made in the text
 */
interface TextReplacement {
  start: number;
  end: number;
  replacement: string;
}

/**
 * Context information for interpreting dynamic blocks
 */
interface DynamicBlockContext {
  playerId: string | { [key: string]: any } | null;
  blockId?: string | null;
  storyId?: string | number | null;
}

/**
 * Regular expression to match dynamic query placeholders
 * Matches patterns like: {get compiled story for this player}
 * Using a more specific pattern to correctly capture complete placeholders
 */
const PLACEHOLDER_REGEX = /\{(get\s+[^{}]*)\}/g;


/**
 * Parse a single dynamic query placeholder and identify the query type and parameters
 * @param placeholder - The placeholder text without the outer curly braces
 * @returns Query information including type and parameters
 */
function parsePlaceholder(placeholder: string): PlaceholderQuery {
  logger.info(`Parsing placeholder: ${placeholder}`);

  // Normalize whitespace
  const normalizedText = placeholder.trim().replace(/\s+/g, ' ');

  // Basic structure check
  if (!normalizedText.startsWith('get ')) {
    return {
      type: 'unknown',
      error: 'Invalid placeholder format: must start with "get"'
    };
  }

  const queryText = normalizedText.substring(4).trim();

  // Check for compiled story query
  if (queryText.match(/^compiled story for this player$/i) || queryText.match(/^story so far for this player$/i)) {
    return {
      type: 'compiledStory',
      target: 'thisPlayer'
    };
  }
  
  // Check for story so far for nobody
  if (queryText.match(/^story so far for nobody$/i)) {
    return {
      type: 'compiledStory',
      target: 'nobody'
    };
  }
  
  // Check for codename query - we'll handle this server-side
  if (queryText.match(/^codename$/i)) {
    logger.info('Found codename placeholder - will be handled server-side');
    return {
      type: 'codename'
    };
  }

  // Check for single answer query
  // Format: answer of question#X from this player
  // Using \s+ to make the pattern more flexible with whitespace variations
  const answerRegex = /^answer\s+of\s+question#([a-zA-Z0-9\-]+)\s+from\s+this\s+player$/i;
  const answerMatch = queryText.match(answerRegex);
  
  
  // Handle any inconsistent spacing in the format
  if (!answerMatch) {
    // Try an alternate matching approach for robustness
    const altMatch = queryText.match(/answer.*question#([a-zA-Z0-9\-]+).*this player/i);
    if (altMatch) {
      logger.info('Matched with alternate pattern:', altMatch);
      const questionId = altMatch[1].trim();
      return {
        type: 'answer',
        questionId,
        target: 'thisPlayer'
      };
    }
  }

  if (answerMatch) {
    logger.info('Answer match found:', answerMatch);
    const questionId = answerMatch[1].trim();
    
    logger.info('Parsed into:', {
      type: 'answer',
      questionId,
      target: 'thisPlayer'
    });

    return {
      type: 'answer',
      questionId,
      target: 'thisPlayer'
    };
  } else {
    logger.info('No match for answer pattern');
  }

  // Check for decisions query
  // Format: decisions of question#X by [this player|all], from story Y
  // Updated to support both 3-digit IDs and legacy UUIDs
  const decisionsRegex = /^decisions of question#([a-zA-Z0-9\-\,]+) by (this player|all), from story ([0-9\,]+)$/i;

  logger.info('Query text:', queryText);
  logger.info('Testing against regex:', decisionsRegex.toString());

  const decisionsMatch = queryText.match(decisionsRegex);

  if (decisionsMatch) {
    logger.info('Match found:', decisionsMatch);
    const questionIds = decisionsMatch[1].split(',').map(id => id.trim());
    const target = decisionsMatch[2].toLowerCase() === 'this player' ? 'thisPlayer' : 'all';
    const storyIds = decisionsMatch[3].split(',').map(id => id.trim());

    logger.info('Parsed into:', {
      type: 'decisions',
      questionIds,
      target,
      storyIds,
      isAll: questionIds.includes('all')
    });

    return {
      type: 'decisions',
      questionIds,
      target,
      storyIds,
      isAll: questionIds.includes('all')
    };
  } else {
    logger.info('No match for decisions pattern');
  }

  // If no recognized pattern matches
  const errorMessage = `Unrecognized placeholder format. Got: "${queryText}". Expected formats: "story so far for this player", "story so far for nobody", "answer of question#[ID] from this player", or "decisions of question#[ID] by [this player|all], from story [ID]"`;
  logger.error(errorMessage);

  return {
    type: 'unknown',
    originalText: placeholder,
    error: errorMessage
  };
}

/**
 * Find all dynamic query placeholders in a text
 * @param text - The text to search for placeholders
 * @returns Array of found placeholders with their positions
 */
function findPlaceholders(text: string): Placeholder[] {
  logger.info("Finding placeholders in text:", text);
  logger.info("Text type:", typeof text);

  if (typeof text !== 'string') {
    logger.info("Not a string, returning empty array");
    return [];
  }

  // Check if the text contains any curly braces
  if (!text.includes('{') || !text.includes('}')) {
    logger.info("Text doesn't contain curly braces, skipping regex search");
    return [];
  }

  const placeholders: Placeholder[] = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex to ensure we start from the beginning
  PLACEHOLDER_REGEX.lastIndex = 0;

  // Log the regex pattern
  logger.info("Using regex pattern:", PLACEHOLDER_REGEX.toString());

  try {
    while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
      logger.info("Found match:", match[0]);
      logger.info("  at position:", match.index);
      logger.info("  with inner content:", match[1]);

      placeholders.push({
        fullMatch: match[0],          // The full match including {}
        innerContent: match[1],       // The content between the braces
        startIndex: match.index,      // Start position of the match
        endIndex: match.index + match[0].length  // End position of the match
      });
    }

    logger.info(`Found ${placeholders.length} placeholders in total`);
    return placeholders;
  } catch (error) {
    logger.error("Error in regex matching:", error);
    return [];
  }
}

/**
 * Get compiled story for a player up to the current dynamic block
 * @param playerId - The player's ID, or 'nobody' for a version without player choices
 * @param blockId - The current block ID (to compile story up to this point)
 * @param target - The target specifier ('thisPlayer' or 'nobody')
 * @returns The compiled story text
 */
async function getCompiledStory(playerId: string, blockId: string | null, target: 'thisPlayer' | 'nobody' = 'thisPlayer'): Promise<string> {
  logger.info(`Getting compiled story for ${target === 'nobody' ? 'nobody' : `player: ${playerId}`} up to block: ${blockId || 'end'}`);

  try {
    // If blockId is provided, get story only up to this point
    if (blockId) {
      // For 'nobody' target, we skip player choices
      if (target === 'nobody') {
        // Get story blocks without player data
        const storyBlocks = await getStoryBeforeBlockByPlayer(null, blockId);
        
        // Check if blocks were retrieved successfully and it's an array
        if (!storyBlocks || !Array.isArray(storyBlocks)) {
          logger.error('Failed to retrieve story blocks or result is not an array');
          return "No story compiled yet.";
        }
        
        // Compile without player context
        const compiledText = compileStoryText(storyBlocks, {});
        return compiledText || "No story compiled yet.";
      } else {
        // Regular flow for a specific player
        const storyBlocks = await getStoryBeforeBlockByPlayer(playerId, blockId);

        // Check if blocks were retrieved successfully and it's an array
        if (!storyBlocks || !Array.isArray(storyBlocks)) {
          logger.error('Failed to retrieve story blocks or result is not an array');
          return "No story compiled yet.";
        }

        // Use compileStoryText to convert blocks to text
        const compiledText = compileStoryText(storyBlocks, { playerId });
        return compiledText || "No story compiled yet.";
      }
    } else {
      // Otherwise get the full story (fallback)
      if (target === 'nobody') {
        // Get all blocks without player data
        const storyBlocks = await getStoryBeforeBlockByPlayer(null, null);
        return compileStoryText(storyBlocks, {}) || "No story compiled yet.";
      } else {
        // Regular flow for a specific player
        const compiledText = await compileStoryForPlayer(playerId, 0); // 0 means all stories
        return compiledText || "No story compiled yet.";
      }
    }
  } catch (error: any) {
    logger.error('Error getting compiled story:', error);
    return `[Error compiling story: ${error.message}]`;
  }
}

/**
 * Get decisions for specific questions using storyRetriever functionality
 * @param questionIds - Array of question IDs to retrieve
 * @param target - 'thisPlayer' or 'all'
 * @param storyIds - Array of story IDs to retrieve from
 * @param playerId - The current player's ID (if target is 'thisPlayer')
 * @returns Formatted decision information
 */
/**
 * Get a player's answer for a specific question
 * @param questionId - The question ID to retrieve the answer for
 * @param playerId - The player's ID
 * @returns Promise<string> - The player's answer as a string
 */
async function getAnswer(questionId: string, playerId: string): Promise<string> {
  logger.info(`Getting answer for question: ${questionId}, player: ${playerId}`);

  try {
    const blockData = await getBlockData(questionId, playerId);

    if (blockData && blockData.playerChoice && blockData.playerChoice.chosenText) {
      // Return just the chosen text without any formatting
      return blockData.playerChoice.chosenText;
    } else {
      return '';  // Return empty string if no answer is found
    }
  } catch (error: any) {
    logger.error('Error getting answer:', error);
    return `[Error retrieving answer: ${error.message}]`;
  }
}

/**
 * Get a player's codename from the database
 * @param playerId - The player's ID
 * @returns Promise<string> - The player's codename as a string
 */
async function getCodename(playerId: string): Promise<string> {
  logger.info(`Getting codename for player: ${playerId}`);

  try {
    // Import database dynamically to avoid circular dependencies
    const db = (await import('../db.js')).default;
    await db.read();
    
    if (!db.data.players || !db.data.players[playerId]) {
      logger.warn(`No player found with ID: ${playerId}`);
      return '';
    }
    
    const codename = db.data.players[playerId].codename || '';
    logger.info(`Retrieved codename for player ${playerId}: ${codename}`);
    return codename;
  } catch (error: any) {
    logger.error('Error getting player codename:', error);
    return `[Error retrieving codename: ${error.message}]`;
  }
}

async function getDecisions(
  questionIds: string[],
  target: 'thisPlayer' | 'all',
  storyIds: string[],
  playerId: string
): Promise<string> {
  logger.info(`Getting decisions for questions: ${questionIds}, target: ${target}, stories: ${storyIds}`);

  try {
    // Handle 'all' questions special case
    if (questionIds.includes('all')) {
      const allBlocks = await getStoryBeforeBlockByPlayer(
        playerId,
        null,
        storyIds.map(id => parseInt(id, 10))
      );

      // Filter to only question blocks (static or dynamic with generateOptions)
      const questionBlocks = allBlocks.filter(block =>
        block.type === 'static' || 
        (block.type === 'dynamic' && block.generateOptions === true)
      );

      // Replace 'all' with the actual question IDs
      questionIds = questionBlocks.map(block => block.id);
    }

    let result = '';

    if (target === 'thisPlayer') {
      // Get player's choices for specific questions
      for (const questionId of questionIds) {
        const blockData = await getBlockData(questionId, playerId);

        if (blockData && blockData.playerChoice) {
          result += `问题 ${questionId}: ${blockData.playerChoice.chosenText}\n`;

          if (blockData.playerChoice.availableOptions) {
            result += `(可选项: ${blockData.playerChoice.availableOptions.join(' | ')})\n\n`;
          } else {
            result += '\n';
          }
        } else {
          // result += `问题 ${questionId}: [未做选择]\n\n`;
        }
      }
    } else {
      // Get aggregated choices for all players
      for (const questionId of questionIds) {
        const summary = await compileChoiceSummaryForBlock(questionId);
        result += summary + '\n\n';
      }
    }

    return result;
  } catch (error: any) {
    logger.error('Error getting decisions:', error);
    return `[Error retrieving decisions: ${error.message}]`;
  }
}

/**
 * Main function to interpret and process a text with dynamic placeholders
 * @param text - The text containing placeholders to process
 * @param context - Contextual information 
 * @returns The processed text with placeholders replaced
 */
async function interpretDynamicBlock(text: string, context: DynamicBlockContext = { playerId: null }): Promise<string> {
  logger.info('=== Starting interpretDynamicBlock ===');
  logger.info('Received text:', text);
  logger.info('Received context:', JSON.stringify(context));

  if (typeof text !== 'string') {
    logger.info('Text is not a string, returning as is:', typeof text, text);
    return text;
  }

  try {
    // Default context values
    let { playerId = 'unknown', blockId = null } = context;

    // Fix for playerId being an object
    if (typeof playerId === 'object' && playerId !== null) {
      // Use a default string value for playerId when it's an object
      logger.info('PlayerId is an object:', playerId);
      // Check if the object has a 'generateOptions' property (that means it's the playerId coming from context)
      if ('generateOptions' in playerId) {
        // This likely means playerId is not a real player ID but the context/settings object
        playerId = 'unknown-' + Date.now();
      } else {
        // Convert object to string id if possible
        playerId = String(playerId);
      }
    }

    // Ensure playerId is a string
    const playerIdStr = String(playerId);

    logger.info(`Using playerId: ${playerIdStr}, blockId: ${blockId || 'not provided'}`);

    // Find all placeholders in the text
    logger.info('Looking for placeholders...');
    
    // Debug: Check if there are any "answer" placeholders
    const hasAnswerPlaceholders = text.includes('answer of question#');
    logger.info(`Text includes 'answer of question#': ${hasAnswerPlaceholders}`);
    if (hasAnswerPlaceholders) {
      logger.info('Answer placeholder examples in text:', text.match(/\{get\s+answer\s+of\s+question#[^}]*\}/gi));
    }
    
    const placeholders = findPlaceholders(text);

    if (placeholders.length === 0) {
      logger.info('No placeholders found, returning original text');
      return text; // No placeholders found, return original text
    }

    logger.info(`Found ${placeholders.length} placeholders to process:`, placeholders);

    // Process each placeholder and collect replacements
    const replacements: TextReplacement[] = [];

    for (const placeholder of placeholders) {
      logger.info(`Processing placeholder: ${placeholder.fullMatch}`);
      const query = parsePlaceholder(placeholder.innerContent);
      logger.info('Query parsed as:', query);

      // Default to passing through the original placeholder text if there's an error
      let replacement = placeholder.fullMatch;

      // Process based on query type
      if (query.type === 'compiledStory') {
        logger.info('Getting compiled story up to current block...');
        if (query.target === 'nobody') {
          replacement = await getCompiledStory(playerIdStr, blockId, 'nobody');
          logger.info('Compiled story (for nobody) length:', replacement.length);
        } else {
          replacement = await getCompiledStory(playerIdStr, blockId, 'thisPlayer');
          logger.info('Compiled story length:', replacement.length);
        }
      }
      else if (query.type === 'answer' && query.questionId && query.target === 'thisPlayer') {
        logger.info('Getting answer for specific question...');
        replacement = await getAnswer(
          query.questionId,
          playerIdStr
        );
        logger.info('Answer result:', replacement);
      }
      else if (query.type === 'decisions' && query.questionIds && query.storyIds && query.target) {
        logger.info('Getting decisions...');
        replacement = await getDecisions(
          query.questionIds,
          query.target,
          query.storyIds,
          playerIdStr
        );
        logger.info('Decisions result length:', replacement.length);
      }
      else if (query.type === 'codename') {
        // Get the player's codename and replace the placeholder
        logger.info('Getting codename for player...');
        replacement = await getCodename(playerIdStr);
        logger.info(`Replaced codename placeholder with: "${replacement}"`);
      }
      else if (query.type === 'unknown') {
        // Unknown placeholder type - return the original text instead of an error message
        logger.error(`Placeholder parsing error: ${query.error}`);
        replacement = `{${placeholder.innerContent}}`;
        logger.info(`Keeping original placeholder: ${replacement}`);
      }
      else {
        // Unknown placeholder type
        logger.error(`Unknown placeholder type: ${query.type}`);
        replacement = `{${placeholder.innerContent}}`;
        logger.info(`Keeping original placeholder: ${replacement}`);
      }

      replacements.push({
        start: placeholder.startIndex,
        end: placeholder.endIndex,
        replacement
      });
    }

    // Sort replacements in reverse order so we can replace without affecting other indices
    replacements.sort((a, b) => b.start - a.start);
    logger.info('Sorted replacements:', replacements);

    // Apply replacements
    let processedText = text;
    for (const { start, end, replacement } of replacements) {
      logger.info(`Replacing from positions ${start} to ${end} with content of length ${replacement.length}`);
      processedText = processedText.substring(0, start) + replacement + processedText.substring(end);
    }

    logger.info('Final processed text length:', processedText.length);
    logger.info('=== Finished interpretDynamicBlock ===');
    return processedText;
  } catch (error: any) {
    logger.error('Error interpreting dynamic block:', error);
    logger.error('Stack trace:', error.stack);
    return text; // Return original text on error
  }
}

// Export both ES Module and CommonJS formats
export {
  interpretDynamicBlock,
  findPlaceholders,
  parsePlaceholder,
  getAnswer,
  getCodename
};

export default {
  interpretDynamicBlock,
};