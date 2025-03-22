import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { beforeEach, afterEach, describe, it } from 'mocha';
import Database from 'better-sqlite3';

// Mock dependencies
const mockLogger = {
  info: console.log,
  warn: console.warn,
  error: console.error
};

// Set up test environment
const TEST_DB_PATH = path.join(process.cwd(), 'test_database.sqlite');
const TEST_ARCHIVES_PATH = path.join(process.cwd(), 'test_archives');

// Import the database related code with mocked components
let db: any;
let dbManager: any;
let getMostRecentMonday: Function;
let formatDate: Function;
let performMondayCleanup: Function;
let checkMondayBasedCleanup: Function;

// Helper to reset the test environment
function resetTestEnvironment() {
  // Clean up any previous test files
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  if (fs.existsSync(TEST_DB_PATH + '-shm')) {
    try {
      fs.unlinkSync(TEST_DB_PATH + '-shm');
    } catch (e) {
      // Ignore errors - file might not exist
    }
  }
  
  if (fs.existsSync(TEST_DB_PATH + '-wal')) {
    try {
      fs.unlinkSync(TEST_DB_PATH + '-wal');
    } catch (e) {
      // Ignore errors - file might not exist
    }
  }
  
  if (fs.existsSync(TEST_ARCHIVES_PATH)) {
    fs.rmSync(TEST_ARCHIVES_PATH, { recursive: true, force: true });
  }
  
  // Re-create directories for testing
  if (!fs.existsSync(TEST_ARCHIVES_PATH)) {
    fs.mkdirSync(TEST_ARCHIVES_PATH);
  }
}

// Create a test version of the modules
function createTestModules() {
  // Helper function to get most recent Monday
  getMostRecentMonday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };
  
  // Helper function to format date
  formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };
  
  try {
    // Create a modified version of db.ts
    const testDb = new Database(TEST_DB_PATH);
    testDb.pragma('journal_mode = WAL');
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS app_data (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);
    
    const getStmt = testDb.prepare('SELECT data FROM app_data WHERE id = ?');
    const setStmt = testDb.prepare('INSERT OR REPLACE INTO app_data (id, data) VALUES (?, ?)');
    
    // Initial data structure
    const defaultData = {
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
    
    // Mock database wrapper
    db = {
      data: { ...defaultData },
      
      read: () => {
        try {
          const row = getStmt.get('app_data');
          
          if (row) {
            db.data = JSON.parse(row.data);
          } else {
            db.write();
          }
          
          return Promise.resolve(db.data);
        } catch (error) {
          console.error(`Error reading from database: ${error}`);
          return Promise.reject(error);
        }
      },
      
      write: () => {
        try {
          const dataJson = JSON.stringify(db.data);
          setStmt.run('app_data', dataJson);
          
          return Promise.resolve(true);
        } catch (error) {
          console.error(`Error writing to database: ${error}`);
          return Promise.reject(error);
        }
      }
    };
    
    // Initialize the database with initial write
    db.write();
    
    // Create the dbManager functions (simplified for testing)
    dbManager = {
      // Function to ensure database structure
      ensureDatabaseStructure: () => {
        if (!db.data.creationDate) {
          db.data.creationDate = new Date().toISOString();
        }
        
        if (!db.data.cleanup) {
          db.data.cleanup = {
            lastCompletedMonday: null,
            currentOperation: {
              status: 'idle',
              startedAt: null,
              error: null
            }
          };
        }
        
        if (!db.data.creationDate || !db.data.cleanup) {
          return db.write();
        }
        
        return Promise.resolve();
      },
      
      // Function to archive database
      archiveDatabase: () => {
        try {
          const currentDate = new Date();
          const dbCreationDate = new Date(db.data.creationDate || currentDate);
          
          const archiveName = `database_${formatDate(dbCreationDate)}_to_${formatDate(currentDate)}.sqlite`;
          const archivePath = path.join(TEST_ARCHIVES_PATH, archiveName);
          
          if (!fs.existsSync(TEST_ARCHIVES_PATH)) {
            fs.mkdirSync(TEST_ARCHIVES_PATH, { recursive: true });
          }
          
          // Simulate copying the current DB to an archive file
          fs.writeFileSync(archivePath, "Archive database content simulation");
          
          // Preserve the cleanup state for the new database
          const currentCleanupState = db.data.cleanup || {
            lastCompletedMonday: null,
            currentOperation: {
              status: 'idle',
              startedAt: null,
              error: null
            }
          };
          
          // Reset the database with a new creation date but keep cleanup state
          db.data = {
            players: {},
            blocks: [],
            creationDate: new Date().toISOString(),
            cleanup: currentCleanupState
          };
          
          return db.write().then(() => true);
        } catch (error) {
          console.error('Error archiving database', error);
          return Promise.resolve(false);
        }
      }
    };
    
    // Function to perform Monday cleanup
    performMondayCleanup = async (mondayDate: string, isRecovery: boolean = false) => {
      try {
        // Ensure cleanup state exists
        if (!db.data.cleanup) {
          db.data.cleanup = {
            lastCompletedMonday: null,
            currentOperation: {
              status: 'idle',
              startedAt: null,
              error: null
            }
          };
        }
        
        // Mark operation as in progress
        db.data.cleanup.currentOperation = {
          status: 'in_progress',
          startedAt: new Date().toISOString(),
          error: null
        };
        
        try {
          // Write this status change before any other operations
          await db.write();
          
          // Perform the actual cleanup operation (archive database)
          const success = await dbManager.archiveDatabase();
          
          if (success) {
            // Update cleanup status to indicate completion
            db.data.cleanup.lastCompletedMonday = mondayDate;
            db.data.cleanup.currentOperation = {
              status: 'idle',
              startedAt: null,
              error: null
            };
            
            await db.write();
            return { success: true, error: null };
          } else {
            throw new Error('Archive operation failed');
          }
        } catch (err) {
          // This catch block handles all errors in the cleanup process
          const errorMsg = err instanceof Error ? err.message : String(err);
          
          // Mark operation as failed
          if (db.data.cleanup) {
            db.data.cleanup.currentOperation = {
              status: 'failed',
              startedAt: db.data.cleanup.currentOperation?.startedAt || new Date().toISOString(),
              error: errorMsg
            };
            
            await db.write();
          }
          return { success: false, error: errorMsg };
        }
      } catch (criticalError) {
        // This catch block handles errors that occur outside the main try/catch
        const errorMsg = criticalError instanceof Error ? criticalError.message : String(criticalError);
        
        try {
          if (db.data && typeof db.data === 'object') {
            if (!db.data.cleanup) {
              db.data.cleanup = {
                lastCompletedMonday: null,
                currentOperation: {
                  status: 'failed',
                  startedAt: new Date().toISOString(),
                  error: errorMsg
                }
              };
            } else {
              db.data.cleanup.currentOperation = {
                status: 'failed',
                startedAt: new Date().toISOString(),
                error: errorMsg
              };
            }
            
            await db.write();
          }
        } catch (e) {
          console.error('Critical error in cleanup status update', e);
        }
        
        return { success: false, error: errorMsg };
      }
    };
    
    // Function to check for Monday-based cleanup
    checkMondayBasedCleanup = async (mockToday?: Date) => {
      // Store the original Date constructor
      const originalDate = global.Date;
      
      try {
        // Use mockToday for testing specific dates
        if (mockToday) {
          // @ts-ignore - Mock the Date constructor for testing
          global.Date = class extends Date {
            constructor() {
              if (arguments.length === 0) {
                super(mockToday);
              } else {
                // @ts-ignore
                super(...arguments);
              }
            }
          };
        }
        
        // Ensure database has necessary structure
        await dbManager.ensureDatabaseStructure();
        
        // Get cleanup state from database
        const cleanup = db.data.cleanup;
        if (!cleanup) {
          console.error('Cleanup state is missing after initialization');
          return { executed: false, reason: 'missing_cleanup_state' };
        }
        
        const mostRecentMonday = getMostRecentMonday();
        const mostRecentMondayStr = formatDate(mostRecentMonday);
        
        // Check if we have a failed or stalled operation that needs recovery
        if (cleanup.currentOperation.status === 'in_progress' || cleanup.currentOperation.status === 'failed') {
          const startTime = cleanup.currentOperation.startedAt 
            ? new Date(cleanup.currentOperation.startedAt) 
            : new Date();
          
          const timeElapsed = Date.now() - startTime.getTime();
          
          // If operation has been "in progress" for more than 10 minutes, consider it stalled
          // For testing, reduce to 1 second
          if (timeElapsed > 1000) {
            await performMondayCleanup(mostRecentMondayStr, true);
            return { executed: true, reason: 'recovery' };
          } else {
            return { executed: false, reason: 'recent_operation_in_progress' };
          }
        }
        
        // Check if we've already completed cleanup for this Monday
        if (cleanup.lastCompletedMonday === mostRecentMondayStr) {
          return { executed: false, reason: 'already_completed' };
        }
        
        // Check if today is Monday (day === 1) or if we missed a Monday cleanup
        const today = new Date();
        const isMonday = today.getDay() === 1;
        const missedThisMonday = !cleanup.lastCompletedMonday || 
                                new Date(cleanup.lastCompletedMonday) < mostRecentMonday;
        
        if (isMonday || missedThisMonday) {
          await performMondayCleanup(mostRecentMondayStr);
          return { 
            executed: true, 
            reason: isMonday ? 'monday_cleanup' : 'missed_cleanup' 
          };
        } else {
          return { executed: false, reason: 'not_monday_no_missed_cleanup' };
        }
      } catch (error) {
        console.error('Error checking Monday-based cleanup', error);
        return { executed: false, reason: 'error', error };
      } finally {
        // Reset Date mock if it was used
        if (mockToday) {
          global.Date = originalDate;
        }
      }
    };
  } catch (error) {
    console.error('Error in test module setup:', error);
  }
}

describe('Monday Database Cleanup Tests', function() {
  // Increase timeout for async tests
  this.timeout(5000);
  
  beforeEach(function() {
    // Set up a clean test environment before each test
    resetTestEnvironment();
    createTestModules();
  });
  
  afterEach(function() {
    // Clean up after each test
    resetTestEnvironment();
  });
  
  it('should correctly identify most recent Monday', function() {
    // Mock date to a specific day
    const testDate = new Date(2025, 2, 19); // Wednesday, March 19, 2025
    
    // @ts-ignore - Mock the Date constructor
    const originalDate = global.Date;
    global.Date = class extends Date {
      constructor() {
        if (arguments.length === 0) {
          super(testDate);
        } else {
          // @ts-ignore
          super(...arguments);
        }
      }
    };
    
    try {
      const monday = getMostRecentMonday();
      const mondayStr = formatDate(monday);
      
      // The most recent Monday from Wednesday March 19, 2025 should be March 17, 2025
      assert.strictEqual(mondayStr, '2025-03-17');
    } finally {
      global.Date = originalDate;
    }
  });
  
  it('should not perform cleanup if already completed for the week', async function() {
    // Set up a scenario where cleanup was already done this week
    const mostRecentMonday = getMostRecentMonday();
    const mondayStr = formatDate(mostRecentMonday);
    
    // Manually set the lastCompletedMonday
    db.data.cleanup.lastCompletedMonday = mondayStr;
    await db.write();
    
    // Check if cleanup runs
    const result = await checkMondayBasedCleanup();
    
    assert.strictEqual(result.executed, false);
    assert.strictEqual(result.reason, 'already_completed');
  });
  
  it('should perform cleanup on Monday if not done yet', async function() {
    // Mock today as a Monday
    const monday = getMostRecentMonday();
    
    // Run the cleanup check with mocked date
    const result = await checkMondayBasedCleanup(monday);
    
    assert.strictEqual(result.executed, true);
    assert.strictEqual(result.reason, 'monday_cleanup');
    
    // Verify the lastCompletedMonday was updated
    await db.read();
    assert.strictEqual(db.data.cleanup.lastCompletedMonday, formatDate(monday));
    assert.strictEqual(db.data.cleanup.currentOperation.status, 'idle');
  });
  
  it('should perform cleanup if a Monday was missed', async function() {
    // Mock today as a Wednesday
    const wednesday = new Date(2025, 2, 19); // Wednesday, March 19, 2025
    
    // Set last completed to an old date (more than a week ago)
    const oldMonday = formatDate(new Date(2025, 2, 3)); // Monday, March 3, 2025
    db.data.cleanup.lastCompletedMonday = oldMonday;
    await db.write();
    
    // Run the cleanup check with mocked date
    const result = await checkMondayBasedCleanup(wednesday);
    
    assert.strictEqual(result.executed, true);
    assert.strictEqual(result.reason, 'missed_cleanup');
    
    // Should now be updated to the most recent Monday
    await db.read();
    const newLastMonday = db.data.cleanup.lastCompletedMonday;
    assert.strictEqual(newLastMonday, '2025-03-17'); // Should be March 17, 2025
  });
  
  it('should recover from a stalled cleanup operation', async function() {
    // Create a stalled operation
    db.data.cleanup.currentOperation = {
      status: 'in_progress',
      startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Started 1 hour ago
      error: null
    };
    await db.write();
    
    // Run the recovery
    const result = await checkMondayBasedCleanup();
    
    assert.strictEqual(result.executed, true);
    assert.strictEqual(result.reason, 'recovery');
    
    // Check that operation is now completed
    await db.read();
    assert.strictEqual(db.data.cleanup.currentOperation.status, 'idle');
  });
  
  it('should handle errors during cleanup', async function() {
    // Make archiveDatabase fail
    const originalArchive = dbManager.archiveDatabase;
    dbManager.archiveDatabase = async () => {
      throw new Error('Simulated archive failure');
    };
    
    try {
      // Try to run cleanup
      const result = await performMondayCleanup(formatDate(getMostRecentMonday()));
      
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Simulated archive failure'));
      
      // Verify error was recorded in database
      await db.read();
      assert.strictEqual(db.data.cleanup.currentOperation.status, 'failed');
      assert.ok(db.data.cleanup.currentOperation.error.includes('Simulated archive failure'));
    } finally {
      // Restore original function
      dbManager.archiveDatabase = originalArchive;
    }
  });
  
  it('should not run cleanup on non-Monday if already up to date', async function() {
    // Mock today as a Tuesday
    const tuesday = new Date(2025, 2, 18); // Tuesday, March 18, 2025
    
    // Set last completed to this week's Monday
    db.data.cleanup.lastCompletedMonday = '2025-03-17'; // Monday, March 17, 2025
    await db.write();
    
    // Run the cleanup check with mocked date
    const result = await checkMondayBasedCleanup(tuesday);
    
    assert.strictEqual(result.executed, false);
    assert.strictEqual(result.reason, 'already_completed');
  });
});