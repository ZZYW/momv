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

interface Template extends ASCII_ART {
    extendableLineNumbers: number[]
}

interface Symbol extends ASCII_ART {
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
 * Assembles a template with symbols to create a complete ASCII art
 */
function assemble(tem: Template, syms: Symbol[]): string {
    if (syms.length > 3 || syms.length < 2) {
        console.warn('Invalid number of symbols. Must be 2 or 3 symbols.')
        return null
    }

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