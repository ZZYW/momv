import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import db from '../db.js';

const DB_FILE_PATH = './database.sqlite';

// Helper function to get the date of the most recent Monday
function getMostRecentMonday() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  
  // Create a new date object to avoid mutating the original
  const monday = new Date(today);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Helper function to format date to YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Checks if the database is due for maintenance operations.
 * Performs weekly cleanup on Mondays.
 */
export async function checkDatabaseAge() {
  try {
    logger.info('Checking database maintenance conditions');

    // Initialize db structure if needed
    ensureDatabaseStructure();
    
    // Check for Monday-based cleanup only
    await checkMondayBasedCleanup();
    
    logger.info('Database maintenance check completed');
  } catch (error) {
    logger.error('Error in database maintenance check', { error });
  }
}

/**
 * Ensures that the database has all required fields initialized
 */
function ensureDatabaseStructure() {
  // Check if creationDate exists
  if (!db.data.creationDate) {
    db.data.creationDate = new Date().toISOString();
    logger.info('Initialized database creation date: ' + db.data.creationDate);
  }
  
  // Check if cleanup structure exists
  if (!db.data.cleanup) {
    db.data.cleanup = {
      lastCompletedMonday: null,
      currentOperation: {
        status: 'idle',
        startedAt: null,
        error: null
      }
    };
    logger.info('Initialized database cleanup structure');
  }
  
  // Save changes if we made any initializations
  if (!db.data.creationDate || !db.data.cleanup) {
    db.write().catch(err => {
      logger.error('Error writing database structure changes', { error: err });
    });
  }
}

// Age-based cleanup has been removed in favor of Monday-based cleanup

/**
 * Archives the current database and creates a fresh one
 */
export function archiveDatabase() {
  try {
    const currentDate = new Date();
    const dbCreationDate = new Date(db.data.creationDate || currentDate);
    
    const archiveName = `database_${formatDate(dbCreationDate)}_to_${formatDate(currentDate)}.sqlite`;
    const archivePath = path.join('./archives', archiveName);

    // Ensure the archives directory exists
    if (!fs.existsSync('./archives')) {
      fs.mkdirSync('./archives', { recursive: true });
    }

    // Copy the current DB to an archive file
    fs.copyFileSync(DB_FILE_PATH, archivePath);
    logger.info('Database archived', { archivePath });

    // Preserve the cleanup state for the new database
    // Make sure to handle the case where cleanup might not exist
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
    
    // Use a promise to handle the write operation more safely
    return db.write()
      .then(() => {
        logger.info('Created a fresh database, preserving cleanup state');
        return true;
      })
      .catch(err => {
        logger.error('Failed to write new database after archiving', { error: err });
        return false;
      });
  } catch (error) {
    logger.error('Error archiving database', { error });
    return false;
  }
}

/**
 * Checks if a Monday-based cleanup is due and performs it if needed
 */
async function checkMondayBasedCleanup() {
  try {
    // Ensure database has necessary structure
    ensureDatabaseStructure();
    
    // Get cleanup state from database (should always exist now due to ensureDatabaseStructure)
    const cleanup = db.data.cleanup;
    if (!cleanup) {
      logger.error('Cleanup state is missing after initialization');
      return;
    }
    
    const mostRecentMonday = getMostRecentMonday();
    const mostRecentMondayStr = formatDate(mostRecentMonday);
    
    logger.info('Checking Monday cleanup status', {
      mostRecentMonday: mostRecentMondayStr,
      lastCompleted: cleanup.lastCompletedMonday,
      currentStatus: cleanup.currentOperation.status
    });
    
    // Check if we have a failed or stalled operation that needs recovery
    if (cleanup.currentOperation.status === 'in_progress' || cleanup.currentOperation.status === 'failed') {
      const startTime = cleanup.currentOperation.startedAt 
        ? new Date(cleanup.currentOperation.startedAt) 
        : new Date();
      
      const timeElapsed = Date.now() - startTime.getTime();
      
      // If operation has been "in progress" for more than 10 minutes, consider it stalled
      if (timeElapsed > 10 * 60 * 1000) {
        logger.warn('Found stalled cleanup operation, attempting recovery', {
          startedAt: cleanup.currentOperation.startedAt,
          status: cleanup.currentOperation.status,
          error: cleanup.currentOperation.error
        });
        
        await performMondayCleanup(mostRecentMondayStr, true);
      } else {
        logger.info('Recent cleanup operation in progress, not starting a new one', {
          startedAt: cleanup.currentOperation.startedAt,
          elapsedMinutes: (timeElapsed / (60 * 1000)).toFixed(2)
        });
      }
      return;
    }
    
    // Check if we've already completed cleanup for this Monday
    if (cleanup.lastCompletedMonday === mostRecentMondayStr) {
      logger.info('Monday cleanup already completed for this week', {
        lastCompleted: cleanup.lastCompletedMonday
      });
      return;
    }
    
    // Check if today is Monday (day === 1) or if we missed a Monday cleanup
    const today = new Date();
    const isMonday = today.getDay() === 1;
    const missedThisMonday = !cleanup.lastCompletedMonday || 
                            new Date(cleanup.lastCompletedMonday) < mostRecentMonday;
    
    if (isMonday || missedThisMonday) {
      if (isMonday) {
        logger.info('Today is Monday and cleanup hasn\'t been done yet this week');
      } else {
        logger.info('Missed Monday cleanup detected, running it now', {
          lastCompleted: cleanup.lastCompletedMonday,
          currentMonday: mostRecentMondayStr
        });
      }
      
      await performMondayCleanup(mostRecentMondayStr);
    } else {
      logger.info('Today is not Monday and no missed cleanup detected, skipping weekly cleanup');
    }
  } catch (error) {
    logger.error('Error checking Monday-based cleanup', { error });
  }
}

/**
 * Performs the Monday database cleanup with transaction safety
 * Using async/await for better error handling and code clarity
 */
async function performMondayCleanup(mondayDate: string, isRecovery: boolean = false) {
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
      logger.info(`${isRecovery ? 'Recovery:' : 'Starting'} Monday cleanup for ${mondayDate}`);
      
      // Perform the actual cleanup operation (archive database)
      // archiveDatabase now returns a promise
      const success = await archiveDatabase();
      
      if (success) {
        // Update cleanup status to indicate completion
        db.data.cleanup.lastCompletedMonday = mondayDate;
        db.data.cleanup.currentOperation = {
          status: 'idle',
          startedAt: null,
          error: null
        };
        
        try {
          await db.write();
          logger.info('Monday cleanup completed successfully', { date: mondayDate });
        } catch (err) {
          logger.error('Error updating cleanup status after successful operation', { error: err });
          throw err; // Re-throw to be caught by outer catch
        }
      } else {
        throw new Error('Archive operation failed');
      }
    } catch (err) {
      // This catch block handles all errors in the cleanup process
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('Error during Monday cleanup process', { error: errorMsg });
      
      // Mark operation as failed
      if (db.data.cleanup) {
        db.data.cleanup.currentOperation = {
          status: 'failed',
          startedAt: db.data.cleanup.currentOperation?.startedAt || new Date().toISOString(),
          error: errorMsg
        };
        
        try {
          await db.write();
          logger.info('Updated status to reflect cleanup failure', { date: mondayDate });
        } catch (writeErr) {
          logger.error('Failed to update cleanup status after operation failure', { error: writeErr });
        }
      }
    }
  } catch (criticalError) {
    // This catch block handles errors that occur outside the main try/catch
    // For example, if there's an error accessing db.data.cleanup
    const errorMsg = criticalError instanceof Error ? criticalError.message : String(criticalError);
    logger.error('Critical error in Monday cleanup procedure', { error: errorMsg });
    
    // Try one last time to update the status, being very defensive
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
        
        db.write().catch(e => {
          logger.error('Failed to update cleanup status after critical error', { error: e });
        });
      }
    } catch (e) {
      logger.error('Catastrophic error in cleanup status update, database may be corrupted', { error: e });
    }
  }
}