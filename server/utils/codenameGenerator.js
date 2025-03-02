// Generate unique codenames for players who complete Station 1
// These will be used to connect their experience to Station 2

// Set of generated codenames loaded from the database to ensure uniqueness
let generatedCodenames = new Set();

// Load existing codenames from the database
const loadCodenames = async (db) => {
  await db.read();
  
  // Initialize codenames list in database if needed
  if (!db.data.codenames) {
    db.data.codenames = [];
    await db.write();
  }
  
  // Add all existing codenames to the Set
  generatedCodenames = new Set(db.data.codenames);
  console.log(`Loaded ${generatedCodenames.size} existing codenames from database`);
};

// Chinese character components to combine for codenames
const components = {
  prefixes: ['青', '红', '白', '黑', '金', '银', '铜', '玉', '木', '水', '火', '土', '石'],
  animals: ['龙', '虎', '蛇', '马', '羊', '猴', '鸡', '狗', '猪', '鼠', '牛', '兔'],
  nouns: ['山', '云', '河', '湖', '海', '风', '雨', '雷', '电', '星', '月', '日']
};

// Generate a unique codename by combining elements
export async function generateCodename(db) {
  // Ensure codenames are loaded from the database
  if (generatedCodenames.size === 0) {
    await loadCodenames(db);
  }

  let attempts = 0;
  let codename;
  
  // Try to generate a unique codename
  do {
    const prefix = components.prefixes[Math.floor(Math.random() * components.prefixes.length)];
    const animal = components.animals[Math.floor(Math.random() * components.animals.length)];
    const noun = components.nouns[Math.floor(Math.random() * components.nouns.length)];
    
    codename = `${prefix}${animal}${noun}`;
    attempts++;
    
    // Safety valve in case we somehow run out of combinations
    if (attempts > 100) {
      codename = `${prefix}${animal}${noun}${Math.floor(Math.random() * 100)}`;
      break;
    }
  } while (generatedCodenames.has(codename));
  
  // Add to set of used codenames
  generatedCodenames.add(codename);
  
  // Save to database
  if (!db.data.codenames.includes(codename)) {
    db.data.codenames.push(codename);
    await db.write();
  }
  
  console.log(`Generated new codename: ${codename}`);
  return codename;
};

// Check if a codename exists
export async function codenameExists(db, codename) {
  // Ensure codenames are loaded from the database
  if (generatedCodenames.size === 0) {
    await loadCodenames(db);
  }
  return generatedCodenames.has(codename);
};

// Get player ID from codename
export async function getPlayerIdFromCodename(db, codename) {
  await db.read();
  
  console.log(`Looking for player with codename '${codename}'`);
  
  // Debug: Check what players and codenames exist
  console.log("Available players and their codenames:");
  for (const playerId in db.data.players) {
    console.log(`- Player ID: ${playerId}, Codename: ${db.data.players[playerId].codename || 'NONE'}`);
  }
  
  // Find player with matching codename
  for (const playerId in db.data.players) {
    if (db.data.players[playerId].codename === codename) {
      console.log(`Found matching player: ${playerId}`);
      return playerId;
    }
  }
  
  console.log(`No player found with codename: ${codename}`);
  return null;
};

// Check if a player has completed Station 1
export async function hasCompletedStation1(db, playerId) {
  await db.read();
  
  // If player has a codename, they've completed Station 1
  return !!(db.data.players[playerId]?.codename);
};