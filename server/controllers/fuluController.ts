import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ASCII_ART {
    body: string,
    keywords: string,
}

export interface Template extends ASCII_ART {
    extendableLineNumbers: number[],
    bellyStartRow: number,
    bellyEndRow: number,
    bellyStartCol: number,
    bellyEndCol: number,
}

export interface Symbol extends ASCII_ART {
    // Symbol has same structure as ASCII_ART base interface
}

const templates: Template[] = []
const symbols: Symbol[] = []

/**
 * Reads ASCII art templates and symbols from the filesystem
 * and loads them into memory
 */
async function readAsciiArts() {
    try {
        // Get the server directory which contains the assets folder
        const serverDir = path.dirname(__dirname)
        const fuluTemplateDir = path.join(serverDir, 'assets', 'fulu')

        // Read template files
        const templateFiles = (await fs.readdir(fuluTemplateDir))
            .filter(file => file.startsWith('template_') && file.endsWith('.txt'))

        // Process each template file
        for (const file of templateFiles) {
            const filePath = path.join(fuluTemplateDir, file)
            const content = await fs.readFile(filePath, 'utf8')

            const parts = file.split('_')
            if (parts[0] !== 'template') {
                throw new Error('template naming wrong')
            } else if (parts.length < 3) {
                throw new Error("template naming should be <template>_keyword_extendingLineheight")
            }

            templates.push({
                body: content,
                keywords: parts[1],
                extendableLineNumbers: parts.splice(2).map(num => parseInt(num))
            })
        }

        // Read symbol files
        const symbolFiles = (await fs.readdir(fuluTemplateDir))
            .filter(file => file.startsWith('symbol_') && file.endsWith('.txt'))

        // Process each symbol file
        for (const file of symbolFiles) {
            const filePath = path.join(fuluTemplateDir, file)
            const content = await fs.readFile(filePath, 'utf8')

            // Extract keywords from filename (e.g., symbol_sun.txt -> ['sun'])
            const keywords = file.replace('symbol_', '').replace('.txt', '')

            symbols.push({
                body: content,
                keywords
            })
        }

        console.log(JSON.stringify(templates, null, 4))
        console.log(JSON.stringify(symbols, null, 4))

    } catch (error) {
        console.error('Error reading ASCII arts:', error)
    }
}

/**
 * Returns all available templates
 */
function getAllTemplates(): Template[] {
    return templates
}

/**
 * Returns all available symbols
 */
function getAllSymbols(): Symbol[] {
    return symbols
}

/**
 * Calculates the height of a symbol in lines
 */
function getSymbolHeight(sym: Symbol): number {
    return sym.body.split('\n').length
}

/**
 * Calculates the container height of a template in lines
 */
function getTemplateContainerHeight(tem: Template): number {
    // Count the lines in the template
    return tem.body.split('\n').length
}

/**
 * Creates an elongated version of a template by repeating
 * sections at the extendable lines
 */
function getElongatedTemplate(tem: Template, additionalLines: number = 5): Template {
    if (additionalLines <= 0) return tem

    const lines = tem.body.split('\n')
    let newLines = [...lines]

    // Calculate how many lines to add at each extendable point
    // Distribute additional lines evenly among extendable points
    const linesPerPoint = Math.floor(additionalLines / tem.extendableLineNumbers.length)
    const extraLines = additionalLines % tem.extendableLineNumbers.length

    // Sort extendable line numbers in descending order so we can insert from bottom to top
    // without affecting the indices of lines above
    const sortedExtendableLines = [...tem.extendableLineNumbers].sort((a, b) => b - a)

    // Insert lines at each extendable point
    for (let i = 0; i < sortedExtendableLines.length; i++) {
        const lineNumber = sortedExtendableLines[i]

        // Calculate how many lines to add at this point
        const linesToAdd = linesPerPoint + (i < extraLines ? 1 : 0)

        if (linesToAdd > 0 && lineNumber < newLines.length) {
            const extendableLine = newLines[lineNumber]

            // Insert duplicate lines at the extendable point
            newLines = [
                ...newLines.slice(0, lineNumber + 1),
                ...Array(linesToAdd).fill(extendableLine),
                ...newLines.slice(lineNumber + 1)
            ]
        }
    }

    return {
        ...tem,
        body: newLines.join('\n'),
        extendableLineNumbers: tem.extendableLineNumbers
    }
}


/**
 * Inserts multiple ASCII symbol blocks into the "belly" region of a template.
 * Stacks them vertically starting at bellyStartRow, bellyStartCol.
 * If the total symbol height exceeds the belly region, it elongates
 * the template using getElongatedTemplate, then re-calculates the belly region.
 *
 * @param template A Template object (includes body, belly coords, and extendableLineNumbers).
 * @param symbols  An array of Symbol objects to be inserted in order.
 * @returns A string containing the final ASCII art with the symbols swapped in.
 */
function assemble(template: Template, symbols: Symbol[]): string {
    // 1) Convert the template’s body to an array of lines
    let templateLines = template.body.split("\n");

    // 2) Determine how many lines the belly region currently has
    //    (from bellyStartRow to bellyEndRow, inclusive).
    const currentBellyHeight = template.bellyEndRow - template.bellyStartRow + 1;

    // 3) Calculate total lines (height) needed for all symbols stacked vertically
    const totalSymbolHeight = symbols.reduce((sum, sym) => {
        const lines = sym.body.split("\n");
        return sum + lines.length;
    }, 0);

    // 4) If the total symbol height exceeds the current belly height,
    //    we need to elongate the template. This will also add lines
    //    below (or at) the extendableLineNumbers to create more space.
    if (totalSymbolHeight > currentBellyHeight) {
        // Example: shortfall is how many extra lines we need
        const shortfall = totalSymbolHeight - currentBellyHeight;

        // Use your existing function to extend the template
        const elongatedTemplate = getElongatedTemplate(template, shortfall);

        // The elongation presumably keeps bellyStartRow, bellyStartCol the same,
        // but we need to re-calculate bellyEndRow because the template is now taller.
        // A simple approach is to shift bellyEndRow downward by 'shortfall':
        const newBellyEndRow = elongatedTemplate.bellyEndRow + shortfall;
        elongatedTemplate.bellyEndRow = newBellyEndRow;

        // Update local references
        template = elongatedTemplate;
        templateLines = elongatedTemplate.body.split("\n");
    }

    // 5) Now we have a tall-enough template. Convert its lines to a 2D array of characters
    const charMatrix = templateLines.map(line => line.split(""));

    // 6) A helper function to insert a symbol’s lines (vertically) into the belly region
    function insertSymbolBlock(
        matrix: string[][],
        sym: Symbol,
        startRow: number,
        startCol: number,
        maxRow: number,
        maxCol: number
    ): number {
        // Convert symbol into lines
        const lines = sym.body.split("\n");
        for (let r = 0; r < lines.length; r++) {
            const symbolRow = startRow + r;
            if (symbolRow > maxRow || symbolRow < 0 || symbolRow >= matrix.length) {
                // If outside the “belly” or matrix, skip
                continue;
            }
            // Overwrite characters from bellyStartCol..bellyEndCol
            const rowChars = lines[r].split("");
            for (let c = 0; c < rowChars.length; c++) {
                const symbolCol = startCol + c;
                if (symbolCol > maxCol || symbolCol < 0 || symbolCol >= matrix[symbolRow].length) {
                    // If outside the “belly” or line boundary, skip
                    continue;
                }
                matrix[symbolRow][symbolCol] = rowChars[c];
            }
        }
        // Return how many lines we used
        return lines.length;
    }

    // 7) Place each symbol in the belly region, starting at bellyStartRow, bellyStartCol,
    //    stacking them one under another
    let currentRow = template.bellyStartRow;
    for (const sym of symbols) {
        const usedHeight = insertSymbolBlock(
            charMatrix,
            sym,
            currentRow,
            template.bellyStartCol,
            template.bellyEndRow,
            template.bellyEndCol
        );
        // Advance currentRow by that many lines
        currentRow += usedHeight;
        // If we exceed the belly, it's possible the elongation was insufficient,
        // but we accounted for that earlier. If you want to do further checks here,
        // you could do so.
    }

    // 8) Convert the matrix back to an array of lines, then join with newline
    const updatedLines = charMatrix.map(rowArr => rowArr.join(""));
    return updatedLines.join("\n");
}





// Initialize by reading ASCII arts when the module is imported
readAsciiArts().catch(err => console.error('Failed to initialize fuluController:', err))

export {
    readAsciiArts,
    getAllTemplates,
    getAllSymbols,
    getSymbolHeight,
    getTemplateContainerHeight,
    getElongatedTemplate,
    assemble
}