import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Configure daily rotating log file

// Define custom logging levels (http is between info and debug)
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'momv-server' },
  transports: [
    // Write to daily rotating log file with human readable format
    new winston.transports.DailyRotateFile({
      dirname: logsDir,
      filename: 'server-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d', // Keep logs for 14 days
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => {
          const { timestamp, level, message, ...rest } = info;
          return `${timestamp} ${level.toUpperCase()}: ${message} ${Object.keys(rest).length ? JSON.stringify(rest) : ''}`;
        })
      )
    }),

    // Separate error log file with human readable format
    new winston.transports.DailyRotateFile({
      level: 'error',
      dirname: logsDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d', // Keep error logs longer (30 days)
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => {
          const { timestamp, level, message, ...rest } = info;
          return `${timestamp} ${level.toUpperCase()}: ${message} ${Object.keys(rest).length ? JSON.stringify(rest) : ''}`;
        })
      )
    })
  ]
});

export default logger;