import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import fs from 'fs';
import logger from './utils/logger.js';


export interface PlayerChoice {
  chosenIndex?: number;
  chosenText: string;
  availableOptions?: string[];
}

export interface DynamicContent {
  blockType: string;
  content: string | string[];
  timestamp: string;
}

export interface Player {
  choices: Record<string, PlayerChoice>;
  dynamicContent: Record<string, DynamicContent>;
  codename?: string;
  codenameId?: string;
}

export interface Database {
  players: Record<string, Player>;
  blocks: any[];
  creationDate?: string;
}

const defaultData: Database = {
  players: {},
  blocks: [],
  creationDate: new Date().toISOString()
};

// Get absolute path for database file
const dbPath = path.join(process.cwd(), 'database.json');

// Initialize database with error handling
let db;
try {
  // Check if database file exists and is valid
  if (fs.existsSync(dbPath)) {
    try {
      // Validate JSON file is readable
      const content = fs.readFileSync(dbPath, 'utf8');
      JSON.parse(content); // Just to check if it's valid JSON
      logger.info(`Database file found and validated at: ${dbPath}`);
    } catch (validationError) {
      logger.error(`Database file exists but is corrupted: ${validationError.message}`);
      // Create backup of corrupted file
      const backupPath = `${dbPath}.corrupted.${Date.now()}.bak`;
      fs.copyFileSync(dbPath, backupPath);
      logger.info(`Corrupted database backed up to: ${backupPath}`);
      // Remove corrupted file to allow fresh start
      fs.unlinkSync(dbPath);
      logger.info('Corrupted database file removed, will create fresh database');
    }
  } else {
    logger.info(`No database file found at path: ${dbPath}, will create new one`);
  }

  // Initialize DB with proper path and error handling
  db = await JSONFilePreset<Database>(dbPath, defaultData);

  // Verify database was loaded properly
  await db.read();
  logger.info('Database loaded successfully');
} catch (error) {
  logger.error(`Critical error initializing database: ${error.message}`);
  // Create emergency fallback in-memory database
  logger.warn('Creating emergency in-memory database (data will not persist!)');
  // @ts-ignore: Creating a minimal compatible interface
  db = {
    data: { ...defaultData },
    read: async () => { },
    write: async () => {
      logger.warn('Write attempted on emergency in-memory database (no data was persisted)');
      return Promise.resolve();
    }
  };
}

export default db;