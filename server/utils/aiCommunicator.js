import axios from 'axios';

/**
 * Sends a prompt to the LLM and returns the response
 * @param {string} prompt - The prompt to send to the LLM
 * @param {string} blockType - Type of block (for parsing fallbacks)
 * @returns {Promise<any>} - Parsed response
 * @throws {Error} - If there's an error communicating with the API
 */
export const sendPromptToLLM = async (prompt, blockType) => {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
        throw new Error("API key not found. Set DASHSCOPE_API_KEY in environment variables.");
    }
    
    console.log("Sending natural language prompt to LLM:");
    console.log(prompt);
    
    const response = await axios.post(
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
        {
            model: "qwen-turbo",
            messages: [
                { role: "system", content: "You are a great, nuanced story writer who specializes in creative writing in Chinese." },
                { role: "user", content: prompt }
            ]
        },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            }
        }
    );
    
    // Get and clean up the LLM response
    const reply = cleanMessage(response.data?.choices?.[0]?.message?.content || "No reply received");
    console.log(`returned result:----\n${reply}\n----\n\n`);
    
    return parseResponse(reply, blockType);
};

/**
 * Cleans and normalizes LLM response text.
 * @param {string} message - The raw response text from the LLM.
 * @returns {string} - The cleaned text.
 */
function cleanMessage(message) {
    if (!message) return "";
    
    // First, extract content from code blocks if they exist
    const codeBlockMatch = message.match(/```(?:json)?([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
        // If we found a code block, use its content
        return codeBlockMatch[1].trim();
    }
    
    // Otherwise, remove markdown code fences
    let cleaned = message.replace(/```[\w]*\n?/g, "").replace(/```/g, "");
    
    // Clean up common formatting issues
    cleaned = cleaned.replace(/\\n/g, "\n") // Replace literal \n with newlines
              .replace(/\\"/g, '"')        // Replace \" with "
              .trim();                     // Remove leading/trailing whitespace
    
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
        // Extract JSON from the response using regex
        let jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("JSON not found in response");
        }
        
        // Parse the JSON object
        const jsonString = jsonMatch[0];
        const parsed = JSON.parse(jsonString);
        
        if (!parsed.final_printed_text) {
            throw new Error("Invalid JSON structure: missing final_printed_text");
        }
        
        return parsed.final_printed_text;
    } catch (parseError) {
        console.error("Error parsing JSON from LLM response:", parseError);
        console.error("Raw reply:", reply);
        
        // Fallback text extraction
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
    // Try to extract content after '最终文本:', '最终选项:', or '最终词语:'
    const textMatch = reply.match(/最终文本[:：]([\s\S]*?)(?:$|(?:思考|最终))/);
    const optionsMatch = reply.match(/最终选项[:：]([\s\S]*?)(?:$|(?:思考|最终))/);
    const wordMatch = reply.match(/最终词语[:：]([\s\S]*?)(?:$|(?:思考|最终))/);
    
    if (blockType === "dynamic-text" && textMatch) {
        return textMatch[1].trim();
    } else if (blockType === "dynamic-option" && optionsMatch) {
        // Split by newlines for options
        return optionsMatch[1].trim().split(/\n+/).map(o => o.trim()).filter(o => o);
    } else if (blockType === "dynamic-word" && wordMatch) {
        return wordMatch[1].trim();
    } else {
        // Last resort fallback
        return blockType === "dynamic-option" ? ["选项 1", "选项 2", "选项 3"] : reply;
    }
}