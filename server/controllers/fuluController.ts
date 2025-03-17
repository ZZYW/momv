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
 * Finds all 'y' characters in the body, computes the bounding rectangle 
 * of those points, and removes them from the ASCII. Returns the rectangle
 * plus the updated body.
 *
 * @param body The full ASCII text
 * @returns The bounding rectangle + newBody, or null if no 'y' found
 */
function findBellyByMarkers(body: string): {
    bellyStartRow: number
    bellyEndRow: number
    bellyStartCol: number
    bellyEndCol: number
    newBody: string
} | null {
    const lines = body.split('\n')

    const yPoints: Array<[number, number]> = []
    // Collect all coordinates where we have 'y'
    for (let row = 0; row < lines.length; row++) {
        const line = lines[row]
        for (let col = 0; col < line.length; col++) {
            if (line[col] === 'y') {
                yPoints.push([row, col])
            }
        }
    }

    if (yPoints.length === 0) {
        // No 'y' found at all
        return null
    }

    // Compute the bounding rectangle of all 'y' coordinates
    let minRow = Infinity
    let maxRow = -Infinity
    let minCol = Infinity
    let maxCol = -Infinity

    for (const [r, c] of yPoints) {
        if (r < minRow) minRow = r
        if (r > maxRow) maxRow = r
        if (c < minCol) minCol = c
        if (c > maxCol) maxCol = c
    }

    // Remove the 'y' markers from the ASCII
    for (const [r, c] of yPoints) {
        const lineArr = lines[r].split('')
        lineArr[c] = ' ' // or any empty character
        lines[r] = lineArr.join('')
    }

    return {
        bellyStartRow: minRow,
        bellyEndRow: maxRow,
        bellyStartCol: minCol,
        bellyEndCol: maxCol,
        newBody: lines.join('\n')
    }
}


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

        for (const file of templateFiles) {
            const filePath = path.join(fuluTemplateDir, file)
            let content = await fs.readFile(filePath, 'utf8')

            // Extract keyword from filename (e.g., template_dragon_...)
            const parts = file.split('_')
            if (parts[0] !== 'template') {
                throw new Error('template naming wrong')
            }

            // The second part is presumably your main keyword
            const keyword = parts[1] || 'unknown'

            // --- 1) Find extendableLineNumbers by scanning for ⭕ in the ASCII content
            let lines = content.split('\n')
            const extendableLineNumbers: number[] = []
            lines.forEach((line, index) => {
                if (line.includes('⭕')) {
                    extendableLineNumbers.push(index)
                    // Remove the marker & trim
                    lines[index] = line.replace('⭕', '').trimEnd();
                }
            })
            // Rebuild content after removing ⭕
            content = lines.join('\n')

            // --- 2) Attempt to find belly region via BFS from a known coordinate, e.g. (21, 16)
            // Adjust if needed for your ASCII shape
            const possibleBelly = findBellyByMarkers(content)
            let bellyStartRow = 0
            let bellyEndRow = 0
            let bellyStartCol = 0
            let bellyEndCol = 0

            if (possibleBelly) {
                bellyStartRow = possibleBelly.bellyStartRow
                bellyEndRow = possibleBelly.bellyEndRow
                bellyStartCol = possibleBelly.bellyStartCol
                bellyEndCol = possibleBelly.bellyEndCol
                // Update the content with 'y' removed
                content = possibleBelly.newBody
            } else {
                console.warn(`No belly region found for ${file} at (21,16). Using zeroed coords.`)
            }

            templates.push({
                body: content,
                keywords: keyword,
                extendableLineNumbers,
                bellyStartRow,
                bellyEndRow,
                bellyStartCol,
                bellyEndCol
            })
        }

        // Read symbol files
        const symbolFiles = (await fs.readdir(fuluTemplateDir))
            .filter(file => file.startsWith('symbol_') && file.endsWith('.txt'))

        for (const file of symbolFiles) {
            const filePath = path.join(fuluTemplateDir, file)
            const content = await fs.readFile(filePath, 'utf8')

            // Extract keywords from filename (e.g., symbol_sun.txt -> 'sun')
            const keywords = file.replace('symbol_', '').replace('.txt', '')

            symbols.push({
                body: content,
                keywords
            })
        }

        // console.log("Templates:", JSON.stringify(templates, null, 4))
        // console.log("Symbols:", JSON.stringify(symbols, null, 4))

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

    // Distribute additional lines evenly among extendable points
    const linesPerPoint = Math.floor(additionalLines / tem.extendableLineNumbers.length)
    const extraLines = additionalLines % tem.extendableLineNumbers.length

    // Sort extendable line numbers in descending order so we can insert from bottom to top
    const sortedExtendableLines = [...tem.extendableLineNumbers].sort((a, b) => b - a)

    // Insert lines at each extendable point
    for (let i = 0; i < sortedExtendableLines.length; i++) {
        const lineNumber = sortedExtendableLines[i]
        const linesToAdd = linesPerPoint + (i < extraLines ? 1 : 0)

        if (linesToAdd > 0 && lineNumber < newLines.length) {
            const extendableLine = newLines[lineNumber]
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
 */
function assemble(template: Template, symbols: Symbol[]): string {
    let templateLines = template.body.split("\n")

    // Determine how many lines the belly region currently has
    const currentBellyHeight = template.bellyEndRow - template.bellyStartRow + 1

    // Calculate total lines needed for all symbols
    const totalSymbolHeight = symbols.reduce((sum, sym) => {
        const lines = sym.body.split("\n")
        return sum + lines.length
    }, 0)

    // If the total symbol height exceeds the belly region, elongate
    if (totalSymbolHeight > currentBellyHeight) {
        console.log("the total symbol height exceeds the height of the belly region so we are making the fulu longer!");
        const shortfall = totalSymbolHeight - currentBellyHeight
        const elongatedTemplate = getElongatedTemplate(template, shortfall)

        // Move bellyEndRow downward by the shortfall
        elongatedTemplate.bellyEndRow += shortfall

        // Update references
        template = elongatedTemplate
        templateLines = elongatedTemplate.body.split("\n")
    }

    // Convert lines to a 2D char matrix
    const charMatrix = templateLines.map(line => line.split(""))

    // Helper for inserting a single symbol block
    function insertSymbolBlock(
        matrix: string[][],
        sym: Symbol,
        startRow: number,
        startCol: number,
        maxRow: number,
        maxCol: number
    ): number {
        const lines = sym.body.split("\n")
        for (let r = 0; r < lines.length; r++) {
            const symbolRow = startRow + r
            if (symbolRow < 0 || symbolRow >= matrix.length || symbolRow > maxRow) continue

            const rowChars = lines[r].split("")
            for (let c = 0; c < rowChars.length; c++) {
                const symbolCol = startCol + c
                if (symbolCol < 0 || symbolCol >= matrix[symbolRow].length || symbolCol > maxCol) continue
                matrix[symbolRow][symbolCol] = rowChars[c]
            }
        }
        return lines.length
    }

    // Place each symbol in the belly, stacking vertically
    let currentRow = template.bellyStartRow
    for (const sym of symbols) {
        const usedHeight = insertSymbolBlock(
            charMatrix,
            sym,
            currentRow,
            template.bellyStartCol,
            template.bellyEndRow,
            template.bellyEndCol
        )
        currentRow += usedHeight
    }

    // Convert char matrix back to lines
    return charMatrix.map(rowArr => rowArr.join("")).join("\n")
}

// Initialize by reading ASCII arts when the module is imported
readAsciiArts().catch(err => console.error('Failed to initialize fuluController:', err))

// Test the assemble function with random template and symbols
function testAssemble() {
    // Get random template
    const template = templates[Math.floor(Math.random() * templates.length)]

    // Get 2 or 3 random symbols
    const numSymbols = Math.random() < 0.5 ? 2 : 3
    const selectedSymbols: Symbol[] = []
    for (let i = 0; i < numSymbols; i++) {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)]
        selectedSymbols.push(symbol)
    }

    console.log('Selected template:', template.keywords)
    console.log('Selected symbols:', selectedSymbols.map(s => s.keywords))

    const result = assemble(template, selectedSymbols)
    console.log('\nAssembled result:')
    console.log(result)
}

// Run the test
setTimeout(testAssemble, 1000) // Wait for readAsciiArts to complete



export {
    readAsciiArts,
    getAllTemplates,
    getAllSymbols,
    getSymbolHeight,
    getTemplateContainerHeight,
    getElongatedTemplate,
    assemble
}
