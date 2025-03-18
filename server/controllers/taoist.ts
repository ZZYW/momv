import * as fuluController from './fuluController.js'
import { printText } from './printerController.js';
import { sendPromptToLLM } from '../utils/aiCommunicator.js';
import {
  compileStoryForPlayer,
  compileChoiceSummaryForBlock,
  getStoryBlocks,
  getStoryBeforeBlockByPlayer,
  getPlayerMetadata
} from './storyRetriever.js';
import { interpretDynamicBlock } from '../utils/dynamicBlockInterpreter.js';

//will be treated as the same as a 
let command = `
here are the journey player {get codename} has experienced so far:
---
{get story so far for this player}
---
here are all the choices made by {get codename} throughout the journey: 
please pick one template, and three symbols. and return a json object like this:
---
{get decisions of question#all by this player, from story 1,2}
---
and compare it against all player's choices...consider these as the **zeigeist**, the **milieu**, the collective subconscious:
---
{get decisions of question#all by all, from story 1,2}
---
Now..
Knowing these data, we now want to draw a Fulu for {get codename}...the logic is that...this is a talismanic script - it aims to protect and heal this individual
knowing their pain, their love, their past, their history, and their positioning among the all, let our choices of the Fulu grant the power for healing.
we have a fixed amount of symbols, and templates. 
you, as the master Taoist, needs to pick one template, and three symbols.
`

const returnObjectSchema = `
please return a JSON object strictly following this schema. Make sure the JSON object is the only thing in your reply. Do not wrap the JSON in anything. Starting with the JSON object.
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "reasoning": {
      "type": "string"
    },
    "template": {
      "type": "string"
    },
    "symbols": {
      "type": "array",
      "items": [
        {
          "type": "string"
        },
        {
          "type": "string"
        },
        {
          "type": "string"
        }
      ]
    }
  },
  "required": [
    "reasoning",
    "template",
    "symbols"
  ]
}`

/**
 * Draws a Fulu (talismanic script) for a player
 * @param {string} playerId - The player's unique ID
 * @returns {Promise<string>} - The assembled Fulu text
 */
export async function drawFulu(playerId: string): Promise<string> {
  try {
    // Get player metadata using the new function
    const playerMeta = await getPlayerMetadata(playerId);

    // Verify the player exists
    if (!playerMeta.exists) {
      throw new Error(`Player with ID ${playerId} not found`);
    }

    // Get player's codename
    const codename = playerMeta.codename || 'Unknown Traveler';

    // Get player's story so far
    const storyText = await compileStoryForPlayer(playerId, [1, 2]);

    // Get player's choices using storyRetriever
    // First, get all story blocks enhanced with player data
    const enhancedBlocks = await getStoryBeforeBlockByPlayer(playerId, null, [1, 2]);

    // Filter to only choice blocks that have player choices
    const choiceBlocks = enhancedBlocks.filter(block =>
      (block.type === 'static' || (block.type === 'dynamic' && block.generateOptions)) &&
      block.playerChoice
    );

    // Compile player choices summary
    let playerChoicesSummary = '';
    for (const block of choiceBlocks) {
      if (block.playerChoice) {
        playerChoicesSummary += `Block ${block.id}: Player chose "${block.playerChoice.chosenText}"\n`;
      }
    }

    // Compile all players' choices summary
    let allChoicesSummary = '';
    for (const block of choiceBlocks) {
      const blockSummary = await compileChoiceSummaryForBlock(block.id);
      allChoicesSummary += blockSummary + '\n';
    }

    // Get all templates and symbols from fuluController
    const templates = fuluController.getAllTemplates();
    const symbols = fuluController.getAllSymbols();

    // Format the list of templates and symbols for LLM
    const allTemplateNames: string = templates.map(i => i.keywords).join(", ");
    const allSymbolNames: string = symbols.map(i => i.keywords).join(", ");

    // Use the dynamicBlockInterpreter to hydrate the prompt
    let hydratedPrompt = await interpretDynamicBlock(command, {
      playerId: playerId,
      blockId: null,
      storyId: [1, 2]
    });

    // For placeholders that aren't handled by the interpreter, do manual replacement
    hydratedPrompt = hydratedPrompt
      .replace(/\{get codename\}/g, codename);

    // Prepare the final prompt for LLM
    const finalPrompt = `${hydratedPrompt}\nThis is all the templates:\n${allTemplateNames}\nThis is all the symbols:\n${allSymbolNames}\n\n${returnObjectSchema}`;

    // Send the prompt to LLM and get response
    const llmResponse = await sendPromptToLLM(finalPrompt, 'dynamic', {}, false)

    // Parse the LLM response as JSON
    let responseJson;
    let selectedTemplate;
    let selectedSymbols;
    let reasoning;
    
    try {
      if (typeof llmResponse === 'string') {
        try {
          responseJson = JSON.parse(llmResponse);
          
          // Extract template and symbols from LLM response
          selectedTemplate = responseJson.template;
          selectedSymbols = responseJson.symbols;
          reasoning = responseJson.reasoning;
          
          // Check if we have all required fields
          if (!selectedTemplate || !selectedSymbols || !Array.isArray(selectedSymbols) || selectedSymbols.length !== 3) {
            throw new Error('Invalid or incomplete LLM response structure');
          }
        } catch (error) {
          console.error('Failed to parse LLM response as JSON:', error);
          throw new Error('Failed to parse Fulu generation response');
        }
      } else {
        // Handle array response case (should not happen with our schema)
        throw new Error('Unexpected array response from LLM');
      }
    } catch (error) {
      console.error('Error with LLM response, using fallback random selection:', error);
      
      // Fallback: randomly select a template and three symbols
      const allTemplates = templates;
      const allSymbols = symbols;
      
      // Pick a random template
      selectedTemplate = allTemplates[Math.floor(Math.random() * allTemplates.length)].keywords;
      
      // Shuffle symbols array and pick first three
      const shuffledSymbols = [...allSymbols].sort(() => 0.5 - Math.random());
      selectedSymbols = shuffledSymbols.slice(0, 3).map(s => s.keywords);
      
      reasoning = `Auto-generated Fulu created for ${codename} with randomly selected elements due to processing issues.`;
      
      console.log('Using fallback random selections:', { selectedTemplate, selectedSymbols });
    }

    // Get template and symbol objects using fuluController methods
    const templateObj = fuluController.getTemplateObjectByKeywords(selectedTemplate);
    if (!templateObj) {
      throw new Error(`Template "${selectedTemplate}" not found`);
    }

    const symbolObjs = selectedSymbols.map(symbolName => {
      const symObj = fuluController.getSymbolObjectByKeywords(symbolName);
      if (!symObj) {
        throw new Error(`Symbol "${symbolName}" not found`);
      }
      return symObj;
    });

    // Assemble the Fulu with template and symbols
    const talismanText = fuluController.assemble(templateObj, symbolObjs, reasoning);

    // Send the Fulu to the printer
    printText(talismanText);

    return talismanText;
  } catch (error) {
    console.error('Error in drawFulu:', error);
    return `Error generating Fulu: ${error.message}`;
  }
}

