import {
  compileStoryForPlayer,
  getBlockData,
  compileChoiceSummaryForBlock,
  getStoryBeforeBlockByPlayer,
  compileStoryText,
  StoryBlock
} from '../controllers/storyRetriever.ts';

/**
 * Placeholder query types
 */
type QueryType = 'compiledStory' | 'decisions' | 'unknown';

/**
 * Interface for a parsed placeholder query
 */
interface PlaceholderQuery {
  type: QueryType;
  target?: 'thisPlayer' | 'all';
  questionIds?: string[];
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
 * Using a more permissive pattern that should catch all instances
 */
const PLACEHOLDER_REGEX = /\{(get\s+.*?)\}/g;

/**
 * Parse a single dynamic query placeholder and identify the query type and parameters
 * @param placeholder - The placeholder text without the outer curly braces
 * @returns Query information including type and parameters
 */
function parsePlaceholder(placeholder: string): PlaceholderQuery {
  console.log(`Parsing placeholder: ${placeholder}`);

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

  // Check for decisions query
  // Format: decisions of question#X by [this player|all], from story Y
  // Use a more permissive pattern for the question ID to handle UUIDs with hyphens
  const decisionsRegex = /^decisions of question#([a-zA-Z0-9\-\,]+) by (this player|all), from story ([0-9\,]+)$/i;

  console.log('Query text:', queryText);
  console.log('Testing against regex:', decisionsRegex.toString());

  const decisionsMatch = queryText.match(decisionsRegex);

  if (decisionsMatch) {
    console.log('Match found:', decisionsMatch);
    const questionIds = decisionsMatch[1].split(',').map(id => id.trim());
    const target = decisionsMatch[2].toLowerCase() === 'this player' ? 'thisPlayer' : 'all';
    const storyIds = decisionsMatch[3].split(',').map(id => id.trim());

    console.log('Parsed into:', {
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
    console.log('No match for decisions pattern');
  }

  // If no recognized pattern matches
  const errorMessage = `Unrecognized placeholder format. Got: "${queryText}". Expected formats: "story so far for this player" or "decisions of question#[ID] by [this player|all], from story [ID]"`;
  console.error(errorMessage);

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
  console.log("Finding placeholders in text:", text);
  console.log("Text type:", typeof text);

  if (typeof text !== 'string') {
    console.log("Not a string, returning empty array");
    return [];
  }

  // Check if the text contains any curly braces
  if (!text.includes('{') || !text.includes('}')) {
    console.log("Text doesn't contain curly braces, skipping regex search");
    return [];
  }

  const placeholders: Placeholder[] = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex to ensure we start from the beginning
  PLACEHOLDER_REGEX.lastIndex = 0;

  // Log the regex pattern
  console.log("Using regex pattern:", PLACEHOLDER_REGEX.toString());

  try {
    while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
      console.log("Found match:", match[0]);
      console.log("  at position:", match.index);
      console.log("  with inner content:", match[1]);

      placeholders.push({
        fullMatch: match[0],          // The full match including {}
        innerContent: match[1],       // The content between the braces
        startIndex: match.index,      // Start position of the match
        endIndex: match.index + match[0].length  // End position of the match
      });
    }

    console.log(`Found ${placeholders.length} placeholders in total`);
    return placeholders;
  } catch (error) {
    console.error("Error in regex matching:", error);
    return [];
  }
}

/**
 * Get compiled story for a player up to the current dynamic block
 * @param playerId - The player's ID
 * @param blockId - The current block ID (to compile story up to this point)
 * @returns The compiled story text
 */
async function getCompiledStory(playerId: string, blockId: string | null): Promise<string> {
  console.log(`Getting compiled story for player: ${playerId} up to block: ${blockId || 'end'}`);

  try {
    // If blockId is provided, get story only up to this point
    if (blockId) {
      // Use getStoryBeforeBlockByPlayer to get array of blocks
      const storyBlocks = await getStoryBeforeBlockByPlayer(playerId, blockId);

      // Check if blocks were retrieved successfully and it's an array
      if (!storyBlocks || !Array.isArray(storyBlocks)) {
        console.error('Failed to retrieve story blocks or result is not an array');
        return "No story compiled yet.";
      }

      // Use compileStoryText to convert blocks to text
      const compiledText = compileStoryText(storyBlocks, { playerId });
      return compiledText || "No story compiled yet.";
    } else {
      // Otherwise get the full story (fallback)
      const compiledText = await compileStoryForPlayer(playerId, 0); // 0 means all stories
      return compiledText || "No story compiled yet.";
    }
  } catch (error: any) {
    console.error('Error getting compiled story:', error);
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
async function getDecisions(
  questionIds: string[],
  target: 'thisPlayer' | 'all',
  storyIds: string[],
  playerId: string
): Promise<string> {
  console.log(`Getting decisions for questions: ${questionIds}, target: ${target}, stories: ${storyIds}`);

  try {
    // Handle 'all' questions special case
    if (questionIds.includes('all')) {
      const allBlocks = await getStoryBeforeBlockByPlayer(
        playerId,
        null,
        storyIds.map(id => parseInt(id, 10))
      );

      // Filter to only question blocks (static and dynamic-option)
      const questionBlocks = allBlocks.filter(block =>
        block.type === 'static' || block.type === 'dynamic-option'
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
    console.error('Error getting decisions:', error);
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
  console.log('=== Starting interpretDynamicBlock ===');
  console.log('Received text:', text);
  console.log('Received context:', JSON.stringify(context));

  if (typeof text !== 'string') {
    console.log('Text is not a string, returning as is:', typeof text, text);
    return text;
  }

  try {
    // Default context values
    let { playerId = 'unknown', blockId = null } = context;

    // Fix for playerId being an object
    if (typeof playerId === 'object' && playerId !== null) {
      // Use a default string value for playerId when it's an object
      console.log('PlayerId is an object:', playerId);
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

    console.log(`Using playerId: ${playerIdStr}, blockId: ${blockId || 'not provided'}`);

    // Find all placeholders in the text
    console.log('Looking for placeholders...');
    const placeholders = findPlaceholders(text);

    if (placeholders.length === 0) {
      console.log('No placeholders found, returning original text');
      return text; // No placeholders found, return original text
    }

    console.log(`Found ${placeholders.length} placeholders to process:`, placeholders);

    // Process each placeholder and collect replacements
    const replacements: TextReplacement[] = [];

    for (const placeholder of placeholders) {
      console.log(`Processing placeholder: ${placeholder.fullMatch}`);
      const query = parsePlaceholder(placeholder.innerContent);
      console.log('Query parsed as:', query);

      // Default to passing through the original placeholder text if there's an error
      let replacement = placeholder.fullMatch;

      // Process based on query type
      if (query.type === 'compiledStory') {
        console.log('Getting compiled story up to current block...');
        replacement = await getCompiledStory(playerIdStr, blockId);
        console.log('Compiled story length:', replacement.length);
      }
      else if (query.type === 'decisions' && query.questionIds && query.storyIds && query.target) {
        console.log('Getting decisions...');
        replacement = await getDecisions(
          query.questionIds,
          query.target,
          query.storyIds,
          playerIdStr
        );
        console.log('Decisions result length:', replacement.length);
      }
      else if (query.type === 'unknown') {
        // Unknown placeholder type - return the original text instead of an error message
        console.error(`Placeholder parsing error: ${query.error}`);
        replacement = `{${placeholder.innerContent}}`;
        console.log(`Keeping original placeholder: ${replacement}`);
      }
      else {
        // Unknown placeholder type
        console.error(`Unknown placeholder type: ${query.type}`);
        replacement = `{${placeholder.innerContent}}`;
        console.log(`Keeping original placeholder: ${replacement}`);
      }

      replacements.push({
        start: placeholder.startIndex,
        end: placeholder.endIndex,
        replacement
      });
    }

    // Sort replacements in reverse order so we can replace without affecting other indices
    replacements.sort((a, b) => b.start - a.start);
    console.log('Sorted replacements:', replacements);

    // Apply replacements
    let processedText = text;
    for (const { start, end, replacement } of replacements) {
      console.log(`Replacing from positions ${start} to ${end} with content of length ${replacement.length}`);
      processedText = processedText.substring(0, start) + replacement + processedText.substring(end);
    }

    console.log('Final processed text length:', processedText.length);
    console.log('=== Finished interpretDynamicBlock ===');
    return processedText;
  } catch (error: any) {
    console.error('Error interpreting dynamic block:', error);
    console.error('Stack trace:', error.stack);
    return text; // Return original text on error
  }
}

// Export both ES Module and CommonJS formats
export {
  interpretDynamicBlock,
  findPlaceholders,
  parsePlaceholder,
};

export default {
  interpretDynamicBlock,
};