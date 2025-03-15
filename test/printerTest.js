//@ts-check

import { fileURLToPath } from 'url';
import { join } from 'path';
import * as fs from 'node:fs';
import * as printControl from '../server/controllers/printerController.js'

const dirname = fileURLToPath(new URL('.', import.meta.url));
const filePath = join(dirname, 'testingText.txt');

const testText = fs.readFileSync(filePath, 'utf-8');

printControl.printText(testText);
