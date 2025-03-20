import OpenAI from "openai";
import dotenv from 'dotenv';
import logger from './logger.js';

// Load environment variables from .env file
dotenv.config();

// Initialize OpenAI client using DashScope API
const openai = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
});

/**
 * Block type supported by the application
 */
export type BlockType = 'dynamic';

/**
 * Options for dynamic blocks
 */
export interface DynamicBlockOptions {
    generateOptions?: boolean;
}

/**
 * Sends a prompt to the LLM and returns the response
 * @param {string} prompt - The prompt to send to the LLM
 * @param {BlockType} blockType - Type of block
 * @param {DynamicBlockOptions} options - Options for the dynamic block
 * @returns {Promise<string | string[]>} - Parsed response
 * @throws {Error} - If there's an error communicating with the API
 */
export const sendPromptToLLM = async (
    prompt: string,
    blockType: BlockType,
    options: DynamicBlockOptions = {},
    returnParsed = true
): Promise<string | string[]> => {
    if (!process.env.DASHSCOPE_API_KEY) {
        throw new Error("API key not found. Please make sure DASHSCOPE_API_KEY is set in your .env file.");
    }

    for (let index = 0; index < 4; index++) {
        logger.info('..........................................................................................................')
    }

    logger.info(prompt);

    const response = await openai.chat.completions.create({
        model: "qwen-max", // Change as needed
        messages: [
            { role: "system", content: "You are a great, nuanced story writer who specializes in creative writing in Chinese." },
            { role: "user", content: prompt }
        ]
    });

    // Get and clean up the LLM response
    const reply = cleanMessage(response.choices?.[0]?.message?.content || "No reply received");

    for (let index = 0; index < 4; index++) {
        logger.info('..........................................................................................................')
    }

    logger.info(`Returned result: ----\n${reply}\n----\n\n`);
    if (returnParsed) {
        return parseResponse(reply, options);
    } else {
        return reply;
    }

};

/**
 * Cleans and normalizes LLM response text.
 * @param {string} message - The raw response text from the LLM.
 * @returns {string} - The cleaned text.
 */
function cleanMessage(message: string): string {
    if (!message) return "";

    // Extract content from code blocks if they exist
    const codeBlockMatch = message.match(/```(?:json)?([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
        return codeBlockMatch[1].trim();
    }

    // Remove markdown code fences
    let cleaned = message.replace(/```[\w]*\n?/g, "").replace(/```/g, "");

    // Clean up common formatting issues
    cleaned = cleaned.replace(/\\n/g, "\n") // Replace literal \n with newlines
        .replace(/\\"/g, '"')        // Replace \" with "
        .trim();

    return cleaned;
}

/**
 * Parses the response from the LLM into a usable format
 * @param {string} reply - The cleaned reply from the LLM
 * @param {DynamicBlockOptions} options - Options for the dynamic block
 * @returns {string | string[]} - Parsed content (string, array, or raw text)
 */
function parseResponse(reply: string, options: DynamicBlockOptions): string | string[] {
    if (!reply || typeof reply !== 'string') {
        logger.error("Invalid reply received:", reply);
        return options.generateOptions ? ["选项 1", "选项 2", "选项 3"] : "无法解析内容";
    }
    
    try {
        // First attempt: try standard JSON parsing
        let jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const jsonString = jsonMatch[0];
                const parsed = JSON.parse(jsonString);

                // Check for deliverable field
                if (parsed.deliverable) {
                    logger.info("Successfully parsed JSON response using standard parser");
                    return parsed.deliverable;
                }
            } catch (standardParseError) {
                logger.warn("Standard JSON parsing failed, falling back to robust parser", {
                    error: standardParseError.message,
                    jsonMatch: jsonMatch[0].substring(0, 100) // Log a snippet for debugging
                });
                // Continue to robust parsing
            }
        }

        // Second attempt: use robust regex-based parsing
        logger.info("Using robust regex-based parsing for LLM response");

        // For options generation (array of options)
        if (options.generateOptions) {
            // Look for "deliverable": [...]
            const arrayMatch = reply.match(/"deliverable"\s*:\s*\[([\s\S]*?)\]/);
            if (arrayMatch) {
                // Extract items from the array
                const arrayContent = arrayMatch[1];
                // Split by commas not inside quotes, clean up and filter empty items
                const optionsList = arrayContent
                    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
                    .map(item => {
                        // Clean up each item
                        return item.trim()
                            .replace(/^["']+|["']+$/g, '') // Remove quotes
                            .replace(/\\"/g, '"')          // Fix escaped quotes
                            .replace(/\\n/g, '\n');        // Replace escaped newlines
                    })
                    .filter(item => item); // Filter empty items

                if (optionsList.length > 0) {
                    logger.info(`Extracted ${optionsList.length} options via regex parser`);
                    return optionsList;
                } else {
                    logger.warn("Extracted options list is empty, falling back to default options");
                }
            }
        }
        // For standard text generation
        else {
            // Look for "deliverable": "..."
            const textMatch = reply.match(/"deliverable"\s*:\s*"([\s\S]*?)(?:"|$)/);
            if (textMatch) {
                const extractedText = textMatch[1]
                    .replace(/\\"/g, '"')  // Fix escaped quotes
                    .replace(/\\n/g, '\n') // Replace escaped newlines
                    .trim();

                if (extractedText && extractedText.length > 0) {
                    logger.info("Extracted text content via regex parser");
                    return extractedText;
                } else {
                    logger.warn("Extracted text is empty, falling back to alternative parsing");
                }
            }
        }

        // Check for malformed JSON (common in LLM responses)
        const fixedJsonResult = tryToFixMalformedJson(reply, options);
        if (fixedJsonResult) {
            logger.info("Successfully fixed and parsed malformed JSON");
            return fixedJsonResult;
        }

        // If we get here, all parsing attempts failed
        logger.error("All parsing methods failed, using fallback content extraction");
        return extractFallbackContent(reply, options);

    } catch (parseError) {
        logger.error("Error in parseResponse function:", parseError);
        logger.error("Raw reply:", reply);
        return extractFallbackContent(reply, options);
    }
}

/**
 * Attempts to fix and parse malformed JSON that's common in LLM responses
 * @param {string} reply - The raw reply from the LLM
 * @param {DynamicBlockOptions} options - Options for the dynamic block
 * @returns {string | string[] | null} - Parsed content or null if parsing failed
 */
function tryToFixMalformedJson(reply: string, options: DynamicBlockOptions): string | string[] | null {
    try {
        // Common issues with LLM JSON responses:
        // 1. Extra text before or after the JSON object
        // 2. Single quotes instead of double quotes
        // 3. Unquoted property names
        // 4. Missing commas
        // 5. Trailing commas
        
        // Try to extract what looks like a JSON object or array
        let jsonContent = reply;
        
        // Remove markdown code blocks if present
        jsonContent = jsonContent.replace(/```json\s+|```/g, '');
        
        // Fix single quotes to double quotes (but not within already double-quoted strings)
        jsonContent = jsonContent.replace(/(?<!\")(')(?!.*?\".*?')/g, '"');
        
        // Try to extract just the JSON object or array
        const objMatch = jsonContent.match(/\{[\s\S]*\}/);
        const arrMatch = jsonContent.match(/\[[\s\S]*\]/);
        
        if (objMatch) {
            const parsed = JSON.parse(objMatch[0]);
            
            if (parsed.deliverable !== undefined) {
                return parsed.deliverable;
            }
            
            // If we have options, try to extract them
            if (options.generateOptions && Array.isArray(parsed.options || parsed.choices)) {
                return parsed.options || parsed.choices;
            }
            
            // For text content, look for common field names
            if (!options.generateOptions) {
                const textField = parsed.text || parsed.content || parsed.message || parsed.response;
                if (textField && typeof textField === 'string') {
                    return textField;
                }
            }
        }
        
        if (arrMatch && options.generateOptions) {
            const parsed = JSON.parse(arrMatch[0]);
            if (Array.isArray(parsed)) {
                return parsed.filter(item => item && typeof item === 'string');
            }
        }
        
        return null;
    } catch (error) {
        logger.debug("Failed to fix malformed JSON:", error);
        return null;
    }
}

/**
 * Extracts usable content from a response when JSON parsing fails
 * @param {string} reply - The raw reply from the LLM
 * @param {DynamicBlockOptions} options - Options for the dynamic block
 * @returns {string | string[]} - Extracted content (string or array)
 */
function extractFallbackContent(reply: string, options: DynamicBlockOptions): string | string[] {
    console.log("Using last-resort fallback content extraction");

    // For options generation, look for numbered items or bullet points
    if (options.generateOptions) {
        // Try to find options in various formats

        // 1. Try to find array-like structures with numbered items (1. Option A, 2. Option B)
        const numberedOptions = reply.match(/(?:\d+[\.\)、]|\*|\-)\s*([^\n\d\.\)、\*\-][^\n]*)/g);
        if (numberedOptions && numberedOptions.length > 0) {
            const optionsList = numberedOptions
                .map(opt => opt.replace(/^\d+[\.\)、]|\*|\-\s*/, '').trim())
                .filter(opt => opt.length > 0);

            console.log(`Extracted ${optionsList.length} numbered options as fallback`);
            if (optionsList.length > 0) return optionsList;
        }

        // 2. Try to find lines that might be options
        const lineOptions = reply.split(/\n+/)
            .map(line => line.trim())
            .filter(line =>
                line.length > 0 &&
                line.length < 100 &&
                !line.includes('{') &&
                !line.includes('}') &&
                !line.includes('：') &&
                !line.includes(':')
            );

        if (lineOptions.length >= 2 && lineOptions.length <= 5) {
            console.log(`Extracted ${lineOptions.length} line-based options as fallback`);
            return lineOptions;
        }

        // 3. Look for Chinese patterns
        const chinesePatterns = [
            /最终选项[:：]([\s\S]*?)(?:$|(?:思考|最终))/,  // "最终选项："
            /选项[:：]([\s\S]*?)(?:$|(?:思考|选择))/,      // "选项："
            /选择[:：]([\s\S]*?)(?:$|(?:思考|分析))/       // "选择："
        ];

        for (const pattern of chinesePatterns) {
            const match = reply.match(pattern);
            if (match) {
                const optionsList = match[1].trim()
                    .split(/\n+|[,，、|]/)
                    .map(o => o.trim())
                    .filter(o => o && o.length > 0);

                if (optionsList.length > 0) {
                    console.log(`Extracted ${optionsList.length} Chinese-pattern options as fallback`);
                    return optionsList;
                }
            }
        }

        // 4. Last resort - default options
        console.log("Using default options as last resort");
        return ["选项 1", "选项 2", "选项 3", "选项 4"];
    }
    // For standard text generation
    else {
        // 1. Try common Chinese patterns
        const chinesePatterns = [
            /最终文本[:：]([\s\S]*?)(?:$|(?:思考|最终))/,    // "最终文本："
            /内容[:：]([\s\S]*?)(?:$|(?:思考|分析))/,        // "内容："
            /段落[:：]([\s\S]*?)(?:$|(?:思考|分析))/         // "段落："
        ];

        for (const pattern of chinesePatterns) {
            const match = reply.match(pattern);
            if (match) {
                console.log("Extracted text using Chinese pattern as fallback");
                return match[1].trim();
            }
        }

        // 2. Try to find the longest paragraph that's not JSON-like
        const paragraphs = reply.split(/\n\n+/)
            .map(p => p.trim())
            .filter(p =>
                p.length > 30 &&
                !p.includes('{') &&
                !p.includes('}') &&
                !p.includes('function') &&
                !p.includes('reasoning')
            );

        if (paragraphs.length > 0) {
            // Sort by length (descending) and take the longest
            paragraphs.sort((a, b) => b.length - a.length);
            console.log("Using longest paragraph as fallback text");
            return paragraphs[0];
        }

        // 3. Last resort - return a cleaned version of the whole reply
        const cleaned = reply
            .replace(/\{[\s\S]*\}/g, '')  // Remove JSON-like structures
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .trim();

        return cleaned || "无法生成有效内容。";
    }

    // Generic fallback for unknown scenarios
    return options.generateOptions
        ? ["选项 1", "选项 2", "选项 3", "选项 4"]
        : "无法解析内容。";
}