import OpenAI from "openai";

// Initialize OpenAI client using DashScope API
const openai = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY, // Ensure environment variable is set
    baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
});

/**
 * Block types supported by the application
 */
export type BlockType = 'dynamic-option' | 'dynamic-text' | 'dynamic-word';

/**
 * Sends a prompt to the LLM and returns the response
 * @param {string} prompt - The prompt to send to the LLM
 * @param {BlockType} blockType - Type of block (for parsing fallbacks)
 * @returns {Promise<string | string[]>} - Parsed response
 * @throws {Error} - If there's an error communicating with the API
 */
export const sendPromptToLLM = async (prompt: string, blockType: BlockType): Promise<string | string[]> => {
    if (!process.env.DASHSCOPE_API_KEY) {
        throw new Error("API key not found. Set DASHSCOPE_API_KEY in environment variables.");
    }

    for (let index = 0; index < 4; index++) {
        console.log('..........................................................................................................')
    }

    console.log(prompt);

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
        console.log('..........................................................................................................')
    }

    console.log(`Returned result: ----\n${reply}\n----\n\n`);

    return parseResponse(reply, blockType);
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
 * @param {BlockType} blockType - Type of block (for fallback extraction)
 * @returns {string | string[]} - Parsed content (string, array, or raw text)
 */
function parseResponse(reply: string, blockType: BlockType): string | string[] {
    try {
        // First attempt: try standard JSON parsing
        let jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const jsonString = jsonMatch[0];
                const parsed = JSON.parse(jsonString);

                // Check for deliverable field
                if (parsed.deliverable) {
                    console.log("Successfully parsed JSON response using standard parser");
                    return parsed.deliverable;
                }
            } catch (standardParseError) {
                console.log("Standard JSON parsing failed, falling back to robust parser");
                // Continue to robust parsing
            }
        }

        // Second attempt: use robust regex-based parsing
        console.log("Using robust regex-based parsing for LLM response");

        // For dynamic-option (array of options)
        if (blockType === "dynamic-option") {
            // Look for "deliverable": [...]
            const arrayMatch = reply.match(/"deliverable"\s*:\s*\[([\s\S]*?)\]/);
            if (arrayMatch) {
                // Extract items from the array
                const arrayContent = arrayMatch[1];
                // Split by commas not inside quotes, clean up and filter empty items
                const options = arrayContent
                    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
                    .map(item => {
                        // Clean up each item
                        return item.trim()
                            .replace(/^["']+|["']+$/g, '') // Remove quotes
                            .replace(/\\"/g, '"')          // Fix escaped quotes
                            .replace(/\\n/g, '\n');        // Replace escaped newlines
                    })
                    .filter(item => item); // Filter empty items

                console.log(`Extracted ${options.length} options via regex parser`);
                return options;
            }
        }

        // For dynamic-text (single text block)
        if (blockType === "dynamic-text") {
            // Look for "deliverable": "..."
            const textMatch = reply.match(/"deliverable"\s*:\s*"([\s\S]*?)(?:"|$)/);
            if (textMatch) {
                const extractedText = textMatch[1]
                    .replace(/\\"/g, '"')  // Fix escaped quotes
                    .replace(/\\n/g, '\n') // Replace escaped newlines
                    .trim();

                console.log("Extracted text content via regex parser");
                return extractedText;
            }
        }

        // For dynamic-word (single word)
        if (blockType === "dynamic-word") {
            // Look for "deliverable": "..."
            const wordMatch = reply.match(/"deliverable"\s*:\s*"([\s\S]*?)(?:"|$)/);
            if (wordMatch) {
                const extractedWord = wordMatch[1]
                    .replace(/\\"/g, '"')  // Fix escaped quotes
                    .replace(/\\n/g, '\n') // Replace escaped newlines
                    .trim();

                console.log("Extracted word via regex parser");
                return extractedWord;
            }
        }

        // If we get here, both parsing attempts failed
        console.error("Both standard and robust parsing failed");
        return extractFallbackContent(reply, blockType);

    } catch (parseError) {
        console.error("Error in parseResponse function:", parseError);
        console.error("Raw reply:", reply);
        return extractFallbackContent(reply, blockType);
    }
}

/**
 * Extracts usable content from a response when JSON parsing fails
 * @param {string} reply - The raw reply from the LLM
 * @param {BlockType} blockType - The type of block
 * @returns {string | string[]} - Extracted content (string or array)
 */
function extractFallbackContent(reply: string, blockType: BlockType): string | string[] {
    console.log("Using last-resort fallback content extraction");

    // For dynamic options, look for numbered items or bullet points
    if (blockType === "dynamic-option") {
        // Try to find options in various formats

        // 1. Try to find array-like structures with numbered items (1. Option A, 2. Option B)
        const numberedOptions = reply.match(/(?:\d+[\.\)、]|\*|\-)\s*([^\n\d\.\)、\*\-][^\n]*)/g);
        if (numberedOptions && numberedOptions.length > 0) {
            const options = numberedOptions
                .map(opt => opt.replace(/^\d+[\.\)、]|\*|\-\s*/, '').trim())
                .filter(opt => opt.length > 0);

            console.log(`Extracted ${options.length} numbered options as fallback`);
            if (options.length > 0) return options;
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
                const options = match[1].trim()
                    .split(/\n+|[,，、|]/)
                    .map(o => o.trim())
                    .filter(o => o && o.length > 0);

                if (options.length > 0) {
                    console.log(`Extracted ${options.length} Chinese-pattern options as fallback`);
                    return options;
                }
            }
        }

        // 4. Last resort - default options
        console.log("Using default options as last resort");
        return ["选项 1", "选项 2", "选项 3", "选项 4"];
    }

    // For dynamic text, try different extraction patterns
    else if (blockType === "dynamic-text") {
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

    // For dynamic word, try different extraction patterns
    else if (blockType === "dynamic-word") {
        // 1. Try common Chinese patterns
        const chinesePatterns = [
            /最终词语[:：]([\s\S]*?)(?:$|(?:思考|最终))/,  // "最终词语："
            /词语[:：]([\s\S]*?)(?:$|(?:思考|分析))/,      // "词语："
            /单词[:：]([\s\S]*?)(?:$|(?:思考|分析))/       // "单词："
        ];

        for (const pattern of chinesePatterns) {
            const match = reply.match(pattern);
            if (match) {
                console.log("Extracted word using Chinese pattern as fallback");
                return match[1].trim();
            }
        }

        // 2. Look for short, standalone words
        const words = reply.split(/\n+/)
            .map(line => line.trim())
            .filter(line =>
                line.length > 0 &&
                line.length < 15 &&
                !line.includes('{') &&
                !line.includes('}') &&
                !line.includes(':') &&
                !line.includes('：')
            );

        if (words.length > 0) {
            // Use the shortest one as it's likely to be just a word
            words.sort((a, b) => a.length - b.length);
            console.log("Using shortest standalone text as fallback word");
            return words[0];
        }

        // 3. Last resort
        return "词语";
    }

    // Generic fallback for unknown types
    return blockType === "dynamic-option"
        ? ["选项 1", "选项 2", "选项 3", "选项 4"]
        : "无法解析内容。";
}