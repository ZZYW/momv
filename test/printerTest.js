import { Printer } from '@node-escpos/core';
import USB from '@node-escpos/usb-adapter';

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
    // Create a USB device instance. Optionally, you can pass specific VID and PID:
    // const device = new USB(0x04B8, 0xXXXX);
    const device = new USB();

    // Open the USB connection.
    device.open(async (err) => {
        if (err) {
            console.error('Printer connection error:', err);
            return;
        }

        // Create a Printer instance with the specified encoding.
        const printer = new Printer(device, { encoding: options.encoding });

        // Optional: if needed, you can explicitly set the character code table,
        // for example, printer.setCharacterCodeTable(0);  // For CP437 (table 0)

        try {
            // Configure and print the text.
            printer
                .font('a')       // Use font "A" (you can adjust based on your printer)
                .align('ct')     // Center align the text
                .style('normal') // Use normal style (change to "bu", "b", etc., for different effects) //b->bold, i->italic, u->underline
                .text(text)      // Print the provided text
                .cut();          // Cut the paper after printing

            await printer.close();  // Ensure the connection is gracefully closed.
        } catch (printErr) {
            console.error('Printing error:', printErr);
            printer.close();
        }
    });
};

printText(`      ████████████████████
    ██████████████████████
  ████████████████████████
██████████████████████████
██████████████████████████
██████████████████████████
██████████████████████████
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
░░░░░░░░░░░░░░░░░░░░░░░░
   ░░░░░░░░░░░░░░░░░░░░░
      ░░░░░░░░░░░░░░░░░
         ░░░░░░░░░░░░░
            ░░░░░░░░░
               ░░░░░
                  ░`);