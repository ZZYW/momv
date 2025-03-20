import { Printer } from '@node-escpos/core';
import USB from '@node-escpos/usb-adapter';
import logger from '../utils/logger.js';

/**
 * Print any text with the specified encoding.
 *
 * This function prints the given text using a USB-connected ESC/POS printer.
 * You can print any character by specifying the appropriate encoding.
 *
 * @param {string} text - The text to print.
 * @param {object} [options] - Optional print settings.
 * @param {string} [options.encoding='cp437'] - Encoding for the text (e.g., 'cp437', 'GB18030').
 */
export const printText = (text, options = { encoding: 'cp437' }) => {
  try {
    // Try to find connected USB printers
    const devices = USB.findPrinter();
    
    if (!devices || devices.length === 0) {
      logger.warn('No printers found. Printing operation skipped.');
      console.log('No printers found. Text that would have been printed:', text);
      return false;
    }
    
    // Create a USB device instance from the first available printer
    const device = new USB();
    
    // Open the USB connection.
    device.open(async (err) => {
      if (err) {
        logger.error('Printer connection error:', err);
        console.log('Failed to connect to printer. Text that would have been printed:', text);
        return false;
      }

      // Create a Printer instance with the specified encoding.
      const printer = new Printer(device, { encoding: options.encoding });

      try {
        // Configure and print the text.
        printer
          .font('a')       // Use font "A" (you can adjust based on your printer)
          .align('ct')     // Center align the text
          .style('normal') // Use normal style (change to "bu", "b", etc., for different effects)
          .text(text)      // Print the provided text
          .cut();          // Cut the paper after printing

        await printer.close();  // Ensure the connection is gracefully closed.
        return true;
      } catch (printErr) {
        logger.error('Printing error:', printErr);
        console.log('Error during printing. Text that would have been printed:', text);
        try {
          printer.close();
        } catch (closeErr) {
          logger.error('Error closing printer:', closeErr);
        }
        return false;
      }
    });
    
    return true; // Connection attempt was successful
  } catch (error) {
    logger.error('Fatal printer error:', error);
    console.log('Fatal printer error. Text that would have been printed:', text);
    return false;
  }
};
