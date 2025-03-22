#!/usr/bin/env node

/**
 * Migration tool to transfer data from lowdb (JSON file) to better-sqlite3
 * This is a one-time tool to migrate existing database.json to database.sqlite
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Define paths
const jsonDbPath = path.join(rootDir, 'database.json');
const sqliteDbPath = path.join(rootDir, 'database.sqlite');

console.log('Starting migration from lowdb (JSON) to better-sqlite3...');

// Check if JSON database exists
if (!fs.existsSync(jsonDbPath)) {
  console.error(`Error: JSON database file not found at ${jsonDbPath}`);
  process.exit(1);
}

// Create backup of the JSON database
const backupPath = `${jsonDbPath}.backup-${Date.now()}`;
fs.copyFileSync(jsonDbPath, backupPath);
console.log(`Created backup of JSON database at: ${backupPath}`);

// Check if SQLite database already exists
if (fs.existsSync(sqliteDbPath)) {
  const backupSqlitePath = `${sqliteDbPath}.backup-${Date.now()}`;
  fs.copyFileSync(sqliteDbPath, backupSqlitePath);
  console.log(`Found existing SQLite database, backed up to: ${backupSqlitePath}`);
}

try {
  // Read data from JSON file
  console.log('Reading data from JSON database...');
  const jsonData = JSON.parse(fs.readFileSync(jsonDbPath, 'utf8'));
  
  // Initialize SQLite database
  console.log('Initializing SQLite database...');
  const db = new Database(sqliteDbPath, { fileMustExist: false });
  
  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  
  // Create table
  console.log('Creating database schema...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_data (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);
  
  // Prepare statement for inserting data
  const insert = db.prepare('INSERT OR REPLACE INTO app_data (id, data) VALUES (?, ?)');
  
  // Insert the data
  console.log('Inserting data into SQLite database...');
  const jsonString = JSON.stringify(jsonData);
  insert.run('app_data', jsonString);
  
  // Verify data was inserted
  const row = db.prepare('SELECT data FROM app_data WHERE id = ?').get('app_data');
  if (!row) {
    throw new Error('Failed to verify data insertion');
  }
  
  console.log('Verifying data integrity...');
  const parsedData = JSON.parse(row.data);
  
  // Basic validation
  if (!parsedData.players || !parsedData.blocks) {
    throw new Error('Data validation failed: missing required properties');
  }
  
  console.log('Migration completed successfully!');
  console.log(`- JSON database size: ${(fs.statSync(jsonDbPath).size / 1024).toFixed(2)} KB`);
  console.log(`- SQLite database size: ${(fs.statSync(sqliteDbPath).size / 1024).toFixed(2)} KB`);
  console.log('\nYou can now use the new SQLite database with your application.');
  console.log('The original JSON database was not deleted and is still available.');
  
} catch (error) {
  console.error('Migration failed with error:', error);
  console.error('Please restore from the backup if needed.');
  process.exit(1);
}