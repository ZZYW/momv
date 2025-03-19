
import { drawFulu } from '../server/controllers/taoist.js';
import { interpretDynamicBlock, getAnswer } from '../server/utils/dynamicBlockInterpreter.js';

// Main test
async function testTaoist() {
  console.log("=== TESTING TAOIST MODULE ===");
  
  // Test with a real player ID
  const playerId = "player_1742156729181_2o27std";
  
  // First, let's set up a command string with our placeholder to test
  const testCmd = `
  Testing answer placeholder:
  {get answer of question#268 from this player}
  End of test.
  `;
  
  try {
    console.log("Running test with command:", testCmd);
    
    // First, let's try using interpretDynamicBlock directly
    console.log("Testing interpretDynamicBlock:");
    const interpreted = await interpretDynamicBlock(testCmd, { playerId, blockId: null });
    console.log("Result from interpretDynamicBlock:", interpreted);
    console.log("Contains placeholder?", interpreted.includes("{get answer"));
    
    // Then test the full drawFulu function
    console.log("\nTesting full drawFulu function:");
    const result = await drawFulu(playerId);
    console.log("Fulu drawing result length:", result.length);
    
    return result;
  } catch (error) {
    console.error("Error in testTaoist:", error);
    throw error;
  }
}

testTaoist()
  .then((result) => {
    console.log("Test completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });