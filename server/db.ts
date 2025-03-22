import Database from 'better-sqlite3';
import path from 'path';
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

export interface CleanupState {
  lastCompletedMonday: string | null;
  currentOperation: {
    status: 'idle' | 'in_progress' | 'failed';
    startedAt: string | null;
    error: string | null;
  };
}

export interface Database {
  players: Record<string, Player>;
  blocks: any[];
  creationDate?: string;
  cleanup?: CleanupState;
}

export interface DbWrapper {
  data: Database;
  read: () => Promise<Database>;
  write: () => Promise<boolean>;
}

const defaultData: Database = {
  players: {},
  blocks: [],
  creationDate: new Date().toISOString(),
  cleanup: {
    lastCompletedMonday: null,
    currentOperation: {
      status: 'idle',
      startedAt: null,
      error: null
    }
  }
};

// Get absolute path for database file
const dbPath = path.join(process.cwd(), 'database.sqlite');

// Create a mutex for database operations to prevent race conditions
const mutex = { locked: false, queue: [] as Array<() => void> };

// Function to acquire the lock
const acquireLock = (): Promise<void> => {
  return new Promise<void>((resolve) => {
    if (!mutex.locked) {
      mutex.locked = true;
      resolve();
    } else {
      mutex.queue.push(resolve);
    }
  });
};

// Function to release the lock
const releaseLock = (): void => {
  if (mutex.queue.length > 0) {
    const nextResolve = mutex.queue.shift();
    if (nextResolve) nextResolve();
  } else {
    mutex.locked = false;
  }
};

// Initialize SQLite database
let sqliteDb: any;
let dbWrapper: DbWrapper;

try {
  logger.info(`Initializing SQLite database at: ${dbPath}`);
  
  sqliteDb = new Database(dbPath, { fileMustExist: false });
  
  // Enable WAL mode for better performance
  sqliteDb.pragma('journal_mode = WAL');
  
  // Create table if it doesn't exist
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS app_data (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);
  
  // Create prepared statements for common operations
  const getStmt = sqliteDb.prepare('SELECT data FROM app_data WHERE id = ?');
  const setStmt = sqliteDb.prepare('INSERT OR REPLACE INTO app_data (id, data) VALUES (?, ?)');
  
  // Create a database wrapper with a consistent interface
  dbWrapper = {
    data: { ...defaultData },
    
    // Read method loads data from SQLite
    read: async (): Promise<Database> => {
      try {
        await acquireLock();
        logger.info('Database read lock acquired');
        
        const row = getStmt.get('app_data');
        
        if (row) {
          dbWrapper.data = JSON.parse(row.data);
          logger.info('Data loaded from SQLite database');
        } else {
          // First time use, no data in database yet
          logger.info('No data found in database, using default data');
          await dbWrapper.write();
        }
        
        return dbWrapper.data;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Error reading from database: ${errorMsg}`);
        throw error;
      } finally {
        logger.info('Database read lock released');
        releaseLock();
      }
    },
    
    // Write method saves data to SQLite
    write: async (): Promise<boolean> => {
      try {
        await acquireLock();
        logger.info('Database write lock acquired');
        
        const dataJson = JSON.stringify(dbWrapper.data);
        setStmt.run('app_data', dataJson);
        
        logger.info('Data successfully written to SQLite database');
        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Error writing to database: ${errorMsg}`);
        throw error;
      } finally {
        logger.info('Database write lock released');
        releaseLock();
      }
    }
  };
  
  // Initialize the database - read data or create default
  dbWrapper.read().catch((err: Error) => {
    logger.error(`Error during initial database read: ${err.message}`);
  });
  
  logger.info('SQLite database wrapper initialized successfully');
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  logger.error(`Critical error initializing database: ${errorMsg}`);
  // Create emergency fallback in-memory database
  logger.warn('Creating emergency in-memory database (data will not persist!)');
  dbWrapper = {
    data: { ...defaultData },
    read: async () => defaultData,
    write: async () => {
      logger.warn('Write attempted on emergency in-memory database (no data was persisted)');
      return true;
    }
  };
}

export default dbWrapper;