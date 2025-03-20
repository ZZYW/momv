import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import db from '../db.js';

const DB_FILE_PATH = './database.json';
const MAX_AGE_DAYS = 5;

/**
 * Checks if the database is older than a specified number of days
 * and archives it if necessary.
 */
export function checkDatabaseAge() {
  try {
    logger.info('Checking database age before any other component accesses it');

    const { creationDate } = db.data;
    if (!creationDate) {
      // No creation date set; initialize it now
      db.data.creationDate = new Date().toISOString();
      db.write();
      logger.info('Initialized database creation date: ' + db.data.creationDate);
      return;
    }

    const dbCreationDate = new Date(creationDate);
    const currentDate = new Date();
    const ageInMs = currentDate.getTime() - dbCreationDate.getTime();
    const ageInDays = ageInMs / (1000 * 60 * 60 * 24);

    if (ageInDays >= MAX_AGE_DAYS) {
      logger.info(`Database is ${ageInDays.toFixed(2)} days old; archiving...`);

      const formatDate = (date: any) => date.toISOString().split('T')[0];
      const archiveName = `database_${formatDate(dbCreationDate)}_to_${formatDate(currentDate)}.json`;
      const archivePath = path.join('./archives', archiveName);

      // Ensure the archives directory exists
      if (!fs.existsSync('./archives')) {
        fs.mkdirSync('./archives', { recursive: true });
      }

      // Copy the current DB to an archive file
      fs.copyFileSync(DB_FILE_PATH, archivePath);
      logger.info('Database archived', { archivePath });

      // Reset the database with a new creation date
      db.data = {
        players: {},
        blocks: [],
        creationDate: new Date().toISOString(),
      };
      db.write();

      logger.info('Created a fresh database');
    } else {
      logger.info(`Database age: ${ageInDays.toFixed(2)} days; no archive needed`);
    }
  } catch (error) {
    logger.error('Error checking database age', { error });
  }
}
