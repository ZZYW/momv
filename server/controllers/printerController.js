import escpos from 'escpos';
import escposNetwork from 'escpos-network';
import 'dotenv/config'
//@ts-expect-error
escpos.Network = escposNetwork;

const printerIP = process.env.PRINTER_IP
if (!printerIP) {
  console.error("[WARNING] PRINTER_IP not detected. Not using printer this time...\nPlease set the PRINTER_IP environment variable")
}
const printerPort = 9100;

export const printText = (text) => {
  if (!printerIP) return;
  const device = new escpos.Network(printerIP, printerPort);
  device.open(error => {
    if (error) {
      console.error('Printer connection error:', error);
      return;
    }

    const printer = new escpos.Printer(device, { encoding: 'cp437' });
    printer
      .text(text)
      .cut() // Optional: cut the paper
      .close(); // Close the connection after printing
  });
};
