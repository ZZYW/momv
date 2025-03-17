import {
  getAllTemplates,
  getAllSymbols,
  assemble
} from '../server/controllers/fuluController.ts';
import { printText } from '../server/controllers/printerController.js';

/**
 * Generates a random fulu by assembling a random template with random symbols
 * and optionally prints the result using the thermal printer.
 * 
 * @param {number} numSymbols - Number of symbols to include (default: 3)
 * @param {boolean} shouldPrint - Whether to print the result (default: false)
 * @returns {string} The assembled ASCII art
 */
export function testRandomAssemble(numSymbols = 3, shouldPrint = false) {
  // Get random template
  const templates = getAllTemplates();
  const template = templates[Math.floor(Math.random() * templates.length)];

  // Get random symbols
  const symbols = getAllSymbols();
  const selectedSymbols = [];
  for (let i = 0; i < numSymbols; i++) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    selectedSymbols.push(symbol);
  }

  console.log('Selected template:', template.keywords);
  console.log('Selected symbols:', selectedSymbols.map(s => s.keywords));

  const result = assemble(template, selectedSymbols, "To: Lu Fei Hao");
  console.log('\nAssembled result:');
  console.log(result);

  // Print the result if requested
  if (shouldPrint) {
    printText(result);
    console.log('Sent to printer');
  }

  return result;
}


// Wait for imports to be properly loaded before executing

testRandomAssemble(3, true);

