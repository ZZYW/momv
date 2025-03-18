import fs from 'fs'
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
 * @returns A Template.
 */
function processTemplateFile(file: string, fuluTemplateDir: string): Template {
    const filePath = path.join(fuluTemplateDir, file)
    let content = fs.readFileSync(filePath, 'utf8')

    // Extract keyword from filename (e.g., template_dragon_...)
    const parts = file.replace(path.extname(file), '').split("_")
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

const SYMBOL_SCALE_FACTOR = 2 // adjust this value as needed

/**
 * Processes a single symbol file.
 *
 * @param file The symbol filename.
 * @param fuluTemplateDir Directory path containing the file.
 * @returns A Symbol.
 */
function processSymbolFile(file: string, fuluTemplateDir: string): Symbol {
    const filePath = path.join(fuluTemplateDir, file)
    let content = fs.readFileSync(filePath, 'utf8')

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
function readAsciiArts() {
    try {
        const serverDir = path.dirname(__dirname)
        const fuluTemplateDir = path.join(serverDir, 'assets', 'fulu')
        const allFiles = fs.readdirSync(fuluTemplateDir)

        const templateFiles = allFiles.filter(file => file.startsWith('template_') && file.endsWith('.txt'))
        const symbolFiles = allFiles.filter(file => file.startsWith('symbol_') && file.endsWith('.txt'))

        // Process template files sequentially
        templateFiles.forEach(file => {
            const templ = processTemplateFile(file, fuluTemplateDir)
            templates.push(templ)
        })

        // Process symbol files sequentially
        symbolFiles.forEach(file => {
            const sym = processSymbolFile(file, fuluTemplateDir)
            symbols.push(sym)
        })

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


/**
 * Finds a template by keyword with fuzzy matching
 * @param {string} keywords - The keyword to search for
 * @returns {Template|null} The matching template or null if not found
 */
function getTemplateObjectByKeywords(keywords: string): Template | null {
    const normalizedKeyword = keywords.toLowerCase().trim();
    const allTemplates = getAllTemplates();

    // First try exact match
    let template = allTemplates.find(t => t.keywords.toLowerCase() === normalizedKeyword);

    // If not found, try partial match
    if (!template) {
        template = allTemplates.find(t =>
            t.keywords.toLowerCase().includes(normalizedKeyword) ||
            normalizedKeyword.includes(t.keywords.toLowerCase())
        );
    }

    // If still not found, return a random template as fallback
    return template || (allTemplates.length > 0 ? allTemplates[Math.floor(Math.random() * allTemplates.length)] : null);
}

/**
 * Finds a symbol by keyword with fuzzy matching
 * @param {string} keywords - The keyword to search for
 * @returns {Symbol|null} The matching symbol or null if not found
 */
function getSymbolObjectByKeywords(keywords: string): Symbol | null {
    const normalizedKeyword = keywords.toLowerCase().trim();
    const allSymbols = getAllSymbols();

    // First try exact match
    let symbol = allSymbols.find(s => s.keywords.toLowerCase() === normalizedKeyword);

    // If not found, try partial match
    if (!symbol) {
        symbol = allSymbols.find(s =>
            s.keywords.toLowerCase().includes(normalizedKeyword) ||
            normalizedKeyword.includes(s.keywords.toLowerCase())
        );
    }

    // If still not found, return a random symbol as fallback
    return symbol || (allSymbols.length > 0 ? allSymbols[Math.floor(Math.random() * allSymbols.length)] : null);
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
 * @param customText Optional custom text to append.
 * @returns The final assembled ASCII art as a string.
 */
function assemble(template: Template, symbols: Symbol[], customText: string | null = null): string {
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
            centeredStartCol,
            template.bellyEndRow,
            template.bellyEndCol
        )
        currentRow += usedHeight
    })

    return `\n\n\n${charMatrix.map(rowArr => rowArr.join("")).join("\n")}\n\n\n${customText ? customText : ''}\n\n\n`
}

// -------------------------
// Initialization
// -------------------------
try {
    readAsciiArts()
} catch (err) {
    console.error('Failed to initialize fuluController:', err)
}

export {
    getSymbolObjectByKeywords,
    getTemplateObjectByKeywords,
    getAllTemplates,
    getAllSymbols,
    assemble
}
