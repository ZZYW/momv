import OpenAI from "openai";

// Initialize OpenAI client using DashScope API
const openai = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY, // Ensure environment variable is set
    baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
});

/**
 * Sends a prompt to the LLM and returns the response
 * @param {string} prompt - The prompt to send to the LLM
 * @param {string} blockType - Type of block (for parsing fallbacks)
 * @returns {Promise<any>} - Parsed response
 * @throws {Error} - If there's an error communicating with the API
 */
export const sendPromptToLLM = async (prompt, blockType) => {
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
function cleanMessage(message) {
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
 * @param {string} blockType - Type of block (for fallback extraction)
 * @returns {any} - Parsed content (string, array, or raw text)
 */
function parseResponse(reply, blockType) {
    try {
        let jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("JSON not found in response");
        }

        const jsonString = jsonMatch[0];
        const parsed = JSON.parse(jsonString);

        if (!parsed.final_printed_text) {
            throw new Error("Invalid JSON structure: missing final_printed_text");
        }

        return parsed.final_printed_text;
    } catch (parseError) {
        console.error("Error parsing JSON from LLM response:", parseError);
        console.error("Raw reply:", reply);

        return extractFallbackContent(reply, blockType);
    }
}

/**
 * Extracts usable content from a response when JSON parsing fails
 * @param {string} reply - The raw reply from the LLM
 * @param {string} blockType - The type of block
 * @returns {any} - Extracted content (string or array)
 */
function extractFallbackContent(reply, blockType) {
    const textMatch = reply.match(/最终文本[:：]([\s\S]*?)(?:$|(?:思考|最终))/);
    const optionsMatch = reply.match(/最终选项[:：]([\s\S]*?)(?:$|(?:思考|最终))/);
    const wordMatch = reply.match(/最终词语[:：]([\s\S]*?)(?:$|(?:思考|最终))/);

    if (blockType === "dynamic-text" && textMatch) {
        return textMatch[1].trim();
    } else if (blockType === "dynamic-option" && optionsMatch) {
        return optionsMatch[1].trim().split(/\n+/).map(o => o.trim()).filter(o => o);
    } else if (blockType === "dynamic-word" && wordMatch) {
        return wordMatch[1].trim();
    } else {
        return blockType === "dynamic-option" ? ["选项 1", "选项 2", "选项 3"] : reply;
    }
}
