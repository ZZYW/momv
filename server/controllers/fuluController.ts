import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// -------------------------
// Directory Setup
// -------------------------
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// -------------------------
// Interfaces
// -------------------------
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

export interface Symbol extends ASCII_ART { }

// -------------------------
// Global Variables
// -------------------------
const templates: Template[] = []
const symbols: Symbol[] = []

// -------------------------
// Utility Functions
// -------------------------


/**
 * Scales an ASCII art string by a given factor while keeping the aspect ratio.
 * Each character is repeated 'factor' times horizontally, and each line is repeated 'factor' times vertically.
 *
 * @param body The original ASCII art string.
 * @param factor The scaling factor.
 * @returns The scaled ASCII art string.
 */
function scaleAsciiArt(body: string, factor: number): string {
    const lines = body.split('\n')
    const scaledLines: string[] = []

    lines.forEach(line => {
        let newLine = ''
        // Repeat each character 'factor' times horizontally.
        for (const char of line) {
            newLine += char.repeat(factor)
        }
        // Repeat the entire line 'factor' times vertically.
        for (let i = 0; i < factor; i++) {
            scaledLines.push(newLine)
        }
    })

    return scaledLines.join('\n')
}


/**
 * Finds all 'y' characters in the body, computes the bounding rectangle 
 * of those points, and removes them from the ASCII. Returns the rectangle
 * plus the updated body.
 *
 * @param body The full ASCII text
 * @returns The bounding rectangle + newBody, or null if no 'y' found
 */
function findBellyByMarkers(body: string): {
    bellyStartRow: number,
    bellyEndRow: number,
    bellyStartCol: number,
    bellyEndCol: number,
    newBody: string
} | null {
    const lines = body.split('\n')
    const yPoints: Array<[number, number]> = []

    lines.forEach((line, row) => {
        [...line].forEach((char, col) => {
            if (char === 'y') {
                yPoints.push([row, col])
            }
        })
    })

    if (yPoints.length === 0) return null

    let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity
    yPoints.forEach(([r, c]) => {
        minRow = Math.min(minRow, r)
        maxRow = Math.max(maxRow, r)
        minCol = Math.min(minCol, c)
        maxCol = Math.max(maxCol, c)
    })

    yPoints.forEach(([r, c]) => {
        const lineArr = lines[r].split('')
        lineArr[c] = ' '
        lines[r] = lineArr.join('')
    })

    return {
        bellyStartRow: minRow,
        bellyEndRow: maxRow,
        bellyStartCol: minCol,
        bellyEndCol: maxCol,
        newBody: lines.join('\n')
    }
}

// -------------------------
// File Reading Helper Functions
// -------------------------

/**
 * Processes a single template file.
 *
 * @param file The template filename.
 * @param fuluTemplateDir Directory path containing the file.
 * @returns A Promise resolving to a Template.
 */
async function processTemplateFile(file: string, fuluTemplateDir: string): Promise<Template> {
    const filePath = path.join(fuluTemplateDir, file)
    let content = await fs.readFile(filePath, 'utf8')

    // we replace the thick blocks with lines
    const charToReplace = ["█", "■", "█", "▓"]
    const replaceBy = ["*", "|", "$", "#", "!", "+", "-", "*"]


    for (const char of charToReplace) {
        if (content.includes(char)) {
            const replacement = replaceBy[Math.floor(Math.random() * replaceBy.length)]
            content = content.replaceAll(char, replacement)
        }
    }

    // Extract keyword from filename (e.g., template_dragon_...)
    const parts = file.split('_')
    if (parts[0] !== 'template') {
        throw new Error('template naming wrong')
    }
    const keyword = parts[1] || 'unknown'

    // Process extendable lines: record line numbers and remove marker '⭕'
    let lines = content.split('\n')
    const extendableLineNumbers: number[] = []
    lines = lines.map((line, index) => {
        if (line.includes('⭕')) {
            extendableLineNumbers.push(index)
            return line.replace('⭕', '')
        }
        return line
    })
    content = lines.join('\n')

    // Process belly markers
    const bellyData = findBellyByMarkers(content)
    let bellyStartRow = 0, bellyEndRow = 0, bellyStartCol = 0, bellyEndCol = 0
    if (bellyData) {
        ({ bellyStartRow, bellyEndRow, bellyStartCol, bellyEndCol } = bellyData)
        content = bellyData.newBody
    } else {
        console.warn(`No belly region found for ${file}. Using zeroed coords.`)
    }

    return {
        body: content,
        keywords: keyword,
        extendableLineNumbers,
        bellyStartRow,
        bellyEndRow,
        bellyStartCol,
        bellyEndCol
    }
}


const SYMBOL_SCALE_FACTOR = 2; // adjust this value as needed
/**
 * Processes a single symbol file.
 *
 * @param file The symbol filename.
 * @param fuluTemplateDir Directory path containing the file.
 * @returns A Promise resolving to a Symbol.
 */
async function processSymbolFile(file: string, fuluTemplateDir: string): Promise<Symbol> {
    const filePath = path.join(fuluTemplateDir, file)
    let content = await fs.readFile(filePath, 'utf8')

    // Apply scaling if the factor is greater than 1.
    if (SYMBOL_SCALE_FACTOR > 1) {
        content = scaleAsciiArt(content, SYMBOL_SCALE_FACTOR)
    }

    const keywords = file.replace('symbol_', '').replace('.txt', '')
    return {
        body: content,
        keywords
    }
}

/**
 * Reads all ASCII art templates and symbols from the filesystem.
 */
async function readAsciiArts() {
    try {
        const serverDir = path.dirname(__dirname)
        const fuluTemplateDir = path.join(serverDir, 'assets', 'fulu')
        const allFiles = await fs.readdir(fuluTemplateDir)

        const templateFiles = allFiles.filter(file => file.startsWith('template_') && file.endsWith('.txt'))
        const symbolFiles = allFiles.filter(file => file.startsWith('symbol_') && file.endsWith('.txt'))

        // Process template files concurrently
        const templatePromises = templateFiles.map(file => processTemplateFile(file, fuluTemplateDir))
        const loadedTemplates = await Promise.all(templatePromises)
        loadedTemplates.forEach(t => templates.push(t))

        // Process symbol files concurrently
        const symbolPromises = symbolFiles.map(file => processSymbolFile(file, fuluTemplateDir))
        const loadedSymbols = await Promise.all(symbolPromises)
        loadedSymbols.forEach(s => symbols.push(s))

        // console.log("Templates:", JSON.stringify(templates, null, 4))
        // console.log("Symbols:", JSON.stringify(symbols, null, 4))
    } catch (error) {
        console.error('Error reading ASCII arts:', error)
    }
}

// -------------------------
// Accessor Functions
// -------------------------
function getAllTemplates(): Template[] {
    return templates
}

function getAllSymbols(): Symbol[] {
    return symbols
}

// -------------------------
// Measurement Functions
// -------------------------
function getSymbolHeight(sym: Symbol): number {
    return sym.body.split('\n').length
}

function getTemplateContainerHeight(tem: Template): number {
    return tem.body.split('\n').length
}

// -------------------------
// Template Manipulation Functions
// -------------------------

/**
 * Elongates a template by inserting extra lines at the extendable markers.
 *
 * @param tem The template to modify.
 * @param additionalLines Number of additional lines to insert.
 * @returns The updated template.
 */
function getElongatedTemplate(tem: Template, additionalLines: number = 5): Template {
    if (additionalLines <= 0) return tem

    const lines = tem.body.split('\n')
    let newLines = [...lines]
    const numExtendable = tem.extendableLineNumbers.length
    if (numExtendable === 0) return tem

    const linesPerPoint = Math.floor(additionalLines / numExtendable)
    const extraLines = additionalLines % numExtendable

    const sortedExtendableLines = [...tem.extendableLineNumbers].sort((a, b) => b - a)
    sortedExtendableLines.forEach((lineNumber, i) => {
        const linesToAdd = linesPerPoint + (i < extraLines ? 1 : 0)
        if (linesToAdd > 0 && lineNumber < newLines.length) {
            const extendableLine = newLines[lineNumber]
            newLines = [
                ...newLines.slice(0, lineNumber + 1),
                ...Array(linesToAdd).fill(extendableLine),
                ...newLines.slice(lineNumber + 1)
            ]
        }
    })

    return {
        ...tem,
        body: newLines.join('\n')
    }
}

/**
 * Inserts a symbol block into a character matrix within specified boundaries.
 *
 * @param matrix 2D character array representing the template.
 * @param sym The symbol to insert.
 * @param startRow The starting row for insertion.
 * @param startCol The starting column for insertion.
 * @param maxRow The maximum row allowed for insertion.
 * @param maxCol The maximum column allowed for insertion.
 * @returns The number of lines inserted.
 */
function insertSymbolBlock(
    matrix: string[][],
    sym: Symbol,
    startRow: number,
    startCol: number,
    maxRow: number,
    maxCol: number
): number {
    const lines = sym.body.split('\n')
    lines.forEach((line, r) => {
        const symbolRow = startRow + r
        if (symbolRow < 0 || symbolRow >= matrix.length || symbolRow > maxRow) return
        line.split('').forEach((char, c) => {
            const symbolCol = startCol + c
            if (symbolCol < 0 || symbolCol >= matrix[symbolRow].length || symbolCol > maxCol) return
            matrix[symbolRow][symbolCol] = char
        })
    })
    lines.push("  ")
    return lines.length
}

/**
 * Assembles a template by inserting symbols into the belly region.
 * If the symbols exceed the belly region, the template is elongated.
 *
 * @param template The template to modify.
 * @param symbols Array of symbols to insert.
 * @returns The final assembled ASCII art as a string.
 */
function assemble(template: Template, symbols: Symbol[]): string {
    let templateLines = template.body.split("\n")
    const currentBellyHeight = template.bellyEndRow - template.bellyStartRow + 1
    const totalSymbolHeight = symbols.reduce((sum, sym) => sum + sym.body.split('\n').length, 0)

    if (totalSymbolHeight > currentBellyHeight) {
        const shortfall = totalSymbolHeight - currentBellyHeight
        const elongatedTemplate = getElongatedTemplate(template, shortfall)
        elongatedTemplate.bellyEndRow += shortfall
        template = elongatedTemplate
        templateLines = elongatedTemplate.body.split("\n")
    }

    // Convert the template into a 2D character matrix
    const charMatrix = templateLines.map(line => line.split(""))

    let currentRow = template.bellyStartRow
    const bellyWidth = template.bellyEndCol - template.bellyStartCol + 1

    symbols.forEach(sym => {
        const symLines = sym.body.split('\n')
        // Determine the maximum width of the symbol
        const symbolWidth = symLines.reduce((max, line) => Math.max(max, line.length), 0)
        // Compute horizontal offset for centering within the belly region
        const centeredStartCol = template.bellyStartCol + Math.floor((bellyWidth - symbolWidth) / 2)

        const usedHeight = insertSymbolBlock(
            charMatrix,
            sym,
            currentRow,
            centeredStartCol, // use computed column to center the symbol
            template.bellyEndRow,
            template.bellyEndCol
        )
        currentRow += usedHeight
    })

    return charMatrix.map(rowArr => rowArr.join("")).join("\n")
}


// -------------------------
// Initialization
// -------------------------
readAsciiArts().catch(err => console.error('Failed to initialize fuluController:', err))





// Test the assemble function with random template and symbols
function testAssemble() {
    // Get random template
    const template = templates[Math.floor(Math.random() * templates.length)]

    // Get 2 or 3 random symbols
    const numSymbols = 3;
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
