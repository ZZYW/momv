import * as fuluController from './fuluController.js';
import { printText } from './printerController.js';
import { sendPromptToLLM } from '../utils/aiCommunicator.js';
import {
	compileStoryForPlayer,
	compileChoiceSummaryForBlock,
	getStoryBlocks,
	getStoryBeforeBlockByPlayer,
	getPlayerMetadata
} from './storyRetriever.js';
import { interpretDynamicBlock, getAnswer } from '../utils/dynamicBlockInterpreter.js';
import pinyin from 'chinese-to-pinyin';
import logger from '../utils/logger.js';


const command = `
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
`;

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
}`;

/**
 * Returns a formatted header for the Fulu talisman.
 * @param {string} codename - The player's codename.
 * @returns {string} The header string.
 */
function getTalismanFooter(codename: string): string {
	return `\n\n\n-------------------------\n\nTo: ${codename}\nfrom: Temple of Many Voices\ndate: ${getFormattedDate()}`;
}

/**
 * Returns the current date formatted as YYYY / MM / DD.
 * @returns {string} The formatted date.
 */
function getFormattedDate(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year} / ${month} / ${day}`;
}


function getPinyin(chineseChars: string) {
	return pinyin(chineseChars, { removeTone: true }).toUpperCase()
}

/**
 * Processes any remaining answer placeholders in the text that weren't handled by interpretDynamicBlock
 * @param text - The text containing placeholders
 * @param playerId - The player's ID
 * @returns The processed text with placeholders replaced
 */
async function processRemainingAnswerPlaceholders(text: string, playerId: string): Promise<string> {
	logger.debug("Looking for remaining answer placeholders", { playerId });
	let processedText = text;
	
	// Regex to find {get answer of question#XXX from this player} placeholders
	const answerRegex = /\{get\s+answer\s+of\s+question#([a-zA-Z0-9\-]+)\s+from\s+this\s+player\}/gi;
	let match;
	
	// Process each match
	while ((match = answerRegex.exec(text)) !== null) {
		const fullMatch = match[0];
		const questionId = match[1];
		logger.debug(`Found remaining answer placeholder`, { fullMatch, questionId, playerId });
		
		try {
			// Use the getAnswer function from dynamicBlockInterpreter to get the answer
			const answer = await getAnswer(questionId, playerId);
			logger.debug(`Got answer for question`, { questionId, answer, playerId });
			
			// Replace this instance of the placeholder
			processedText = processedText.replace(fullMatch, answer || '');
		} catch (error) {
			logger.error(`Error processing answer placeholder`, { 
				questionId, 
				playerId, 
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			});
		}
	}
	
	return processedText;
}

export async function drawFulu(playerId: string): Promise<string> {
	let talismanText: string = '';
	let codename = 'Traveler';
	let symbolObjs: fuluController.Symbol[] = [];
	try {
		logger.info('Starting drawFulu process', { playerId });
		// Retrieve player metadata and verify existence
		const playerMeta = await getPlayerMetadata(playerId);
		if (!playerMeta.exists) {
			logger.error(`Player not found`, { playerId });
			throw new Error(`Player with ID ${playerId} not found`);
		}

		if (!playerMeta.codename) playerMeta.codename = 'Traveler';
		codename = playerMeta.codename || 'Traveler';
		logger.debug('Player metadata retrieved', { playerId, codename });

		// Retrieve story and choice data
		await compileStoryForPlayer(playerId, [1, 2]);
		const enhancedBlocks = await getStoryBeforeBlockByPlayer(playerId, null, [1, 2]);
		logger.debug('Story data compiled', { playerId, blockCount: enhancedBlocks.length });

		// Filter to choice blocks that include a player choice
		const choiceBlocks = enhancedBlocks.filter(block =>
			(block.type === 'static' || (block.type === 'dynamic' && block.generateOptions)) &&
			block.playerChoice
		);
		logger.debug('Choice blocks filtered', { playerId, choiceBlockCount: choiceBlocks.length });

		// Compile summaries (for potential use in LLM prompt)
		let playerChoicesSummary = '';
		for (const block of choiceBlocks) {
			if (block.playerChoice) {
				playerChoicesSummary += `Block ${block.id}: Player chose "${block.playerChoice.chosenText}"\n`;
			}
		}
		let allChoicesSummary = '';
		for (const block of choiceBlocks) {
			const blockSummary = await compileChoiceSummaryForBlock(block.id);
			allChoicesSummary += blockSummary + '\n';
		}

		// Get available templates and symbols
		const templates = fuluController.getAllTemplates();
		const symbols = fuluController.getAllSymbols();
		logger.debug('Templates and symbols loaded', { 
			playerId, 
			templateCount: templates.length, 
			symbolCount: symbols.length 
		});

		// Format the lists for the prompt
		const allTemplateNames = templates.map(t => t.keywords).join(', ');
		const allSymbolNames = symbols.map(s => s.keywords).join(', ');

		// Hydrate the prompt dynamically
		logger.debug('Starting dynamic prompt hydration', { playerId });
		let hydratedPrompt = await interpretDynamicBlock(command, {
			playerId,
			blockId: null,
			storyId: "1,2" // Using a string instead of an array to match the expected type
		});
		
		// Process any remaining answer placeholders that weren't handled by interpretDynamicBlock
		hydratedPrompt = await processRemainingAnswerPlaceholders(hydratedPrompt, playerId);
		
		// Replace any remaining placeholders
		hydratedPrompt = hydratedPrompt.replace(/\{get codename\}/g, codename);
		logger.debug('Prompt hydration complete', { playerId });

		// Construct the final prompt
		const finalPrompt = [
			hydratedPrompt,
			'This is all the templates:',
			allTemplateNames,
			'This is all the symbols:',
			allSymbolNames,
			'',
			returnObjectSchema
		].join('\n');

		// Send prompt to the LLM and process its response
		logger.info('Sending prompt to LLM', { playerId });
		const llmResponse = await sendPromptToLLM(finalPrompt, 'dynamic', {}, false);
		let selectedTemplate: string;

		try {
			if (typeof llmResponse === 'string') {
				const responseJson = JSON.parse(llmResponse);
				selectedTemplate = responseJson.template;
				const selectedSymbolKeywords: string[] = responseJson.symbols;
				logger.debug('Received valid response from LLM', { 
					playerId, 
					selectedTemplate, 
					selectedSymbols: selectedSymbolKeywords 
				});

				if (!selectedTemplate || !selectedSymbolKeywords || !Array.isArray(selectedSymbolKeywords) || selectedSymbolKeywords.length !== 3) {
					logger.warn('Invalid LLM response structure', { 
						playerId, 
						hasTemplate: !!selectedTemplate, 
						hasSymbols: !!selectedSymbolKeywords,
						symbolCount: selectedSymbolKeywords ? selectedSymbolKeywords.length : 0
					});
					throw new Error('Invalid or incomplete LLM response structure');
				}
				// Map LLM symbol keywords to symbol objects
				symbolObjs = selectedSymbolKeywords.map(symbolName => {
					const symbolObj = fuluController.getSymbolObjectByKeywords(symbolName);
					if (!symbolObj) {
						logger.warn(`Symbol not found`, { playerId, symbolName });
						throw new Error(`Symbol "${symbolName}" not found`);
					}
					return symbolObj;
				});
			} else {
				logger.warn('Non-string response from LLM', { playerId, responseType: typeof llmResponse });
				throw new Error('Unexpected non-string response from LLM');
			}
		} catch (parseError) {
			logger.error('Failed to parse LLM response as JSON', { 
				error: parseError instanceof Error ? parseError.message : String(parseError),
				stack: parseError instanceof Error ? parseError.stack : undefined,
				playerId 
			});
			// Fallback: use pickRandomSymbol to select 3 symbols and pickRandomTemplate for template fallback
			selectedTemplate = pickRandomTemplate(templates).keywords;
			symbolObjs = pickRandomSymbol(3, symbols);
			logger.warn('Using fallback random selections', { 
				playerId,
				selectedTemplate, 
				selectedSymbols: symbolObjs.map(s => s.keywords)
			});
		}

		// Override AI's template choice with a random one to avoid observed biases
		const templateObj = pickRandomTemplate(templates);
		if (!templateObj) {
			logger.error(`Template not found`, { playerId, template: selectedTemplate });
			throw new Error(`Template "${selectedTemplate}" not found`);
		}

		// Assemble the Fulu using the selected template and symbols, with the header text
		logger.info('Assembling Fulu talisman', { 
			playerId,
			template: templateObj.keywords,
			symbols: symbolObjs.map(s => s.keywords)
		});
		talismanText = fuluController.assemble(templateObj, symbolObjs, getTalismanFooter(getPinyin(codename)));
	} catch (error) {
		logger.error('Error in drawFulu main processing, falling back to random selections', { 
			playerId,
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined
		});
		// Fallback to ensure we always have a talisman to print
		try {
			const fallbackTemplates = fuluController.getAllTemplates();
			const fallbackSymbols = fuluController.getAllSymbols();
			const fallbackTemplate = pickRandomTemplate(fallbackTemplates);
			const fallbackSymbolObjs = pickRandomSymbol(3, fallbackSymbols);
			logger.info('Using emergency fallback for talisman creation', { 
				playerId,
				template: fallbackTemplate.keywords,
				symbolCount: fallbackSymbolObjs.length
			});
			talismanText = fuluController.assemble(
				fallbackTemplate,
				fallbackSymbolObjs,
				getTalismanFooter(getPinyin(codename))
			);
		} catch (fallbackError) {
			logger.error('Fallback also failed', { 
				playerId,
				error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
				stack: fallbackError instanceof Error ? fallbackError.stack : undefined
			});
			talismanText = 'Default talisman text';
		}
	}
	// Ensure the talisman is always printed
	logger.info('Printing talisman', { playerId, talismanLength: talismanText.length });
	printText(talismanText);
	return talismanText;
}

function pickRandomTemplate(templates: fuluController.Template[]): fuluController.Template {
	return templates[Math.floor(Math.random() * templates.length)];
}

function pickRandomSymbol(howMany: number, symbols: fuluController.Symbol[]): fuluController.Symbol[] {
	const shuffled = [...symbols].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, howMany);
}