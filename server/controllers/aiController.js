import axios from "axios";
import db from "../db.js";

// Generate instructions based on block type and properties.
const getBlockInstructions = ({ blockType, optionCount, sentenceCount, lexiconCategory }) => {
    let baseInstruction = "";
    // Create natural language instructions based on the block type
    if (blockType === "dynamic-option" && optionCount) {
        baseInstruction = `You are a creative storyteller. Please generate ${optionCount} distinct and compelling options for a story choice. 
These options should be interesting, diverse, and appropriate for the context.`;
    } else if (blockType === "dynamic-text" && sentenceCount) {
        baseInstruction = `You are a creative storyteller. Please generate a passage of approximately ${sentenceCount} sentences.
The text should be vivid, engaging, and should fit naturally within the story context.`;
    } else if (blockType === "dynamic-word" && lexiconCategory) {
        baseInstruction = `You are a creative storyteller. Please generate a single ${lexiconCategory} that fits the story context.
The word should be expressive, evocative, and relevant to the narrative situation.`;
    }
    
    // Still append expected JSON return format instruction
    let returnFormat = "";
    const formatPrefix = "\n\n请一定要以JSON格式回复。请使用中文！请严格遵循以下格式:\n\n"
    if (blockType === "dynamic-option") {
        returnFormat = `${formatPrefix}{"thinking_process": "your reasoning process here...", "final_printed_text": ["option1", "option2", ...]}`;
    } else if (blockType === "dynamic-word") {
        returnFormat = `${formatPrefix}{"thinking_process": "your reasoning process here...", "final_printed_text": "word"}`;
    } else if (blockType === "dynamic-text") {
        returnFormat = `${formatPrefix}{"thinking_process": "your reasoning process here...", "final_printed_text": "passage text"}`;
    }
    
    return baseInstruction + returnFormat;
};

// Retrieve context information in a human-friendly format.
const fetchContextInfo = async (contextRefs, currentPlayerID) => {
    await db.read();
    const contextInfo = [];
    const players = db.data.players || {};

    for (const contextRef of contextRefs) {
        const blockId = contextRef.value;
        const includeAll = contextRef.includeAll === true;
        if (!blockId) continue;

        if (includeAll) {
            for (const playerId in players) {
                const playerChoices = players[playerId].choices || {};
                if (playerChoices[blockId]) {
                    const { availableOptions, chosenText } = playerChoices[blockId];
                    contextInfo.push({ availableOptions, chosenText });
                }
            }
        } else if (players[currentPlayerID]?.choices?.[blockId]) {
            const { availableOptions, chosenText } = players[currentPlayerID].choices[blockId];
            contextInfo.push({ availableOptions, chosenText });
        }
    }
    return contextInfo;
};

export const askLLM = async (req, res) => {
    const {
        message,
        playerID,
        contextRefs,
        blockType,
        optionCount,
        sentenceCount,
        lexiconCategory
    } = req.body;

    // Get block-specific instructions
    const instructions = getBlockInstructions({ blockType, optionCount, sentenceCount, lexiconCategory });
    
    // Get context information if available
    let contextString = "";
    if (contextRefs && contextRefs.length > 0) {
        const contextInfo = await fetchContextInfo(contextRefs, playerID);
        if (contextInfo.length > 0) {
            contextString = "\n\n上下文信息:\n" + contextInfo.map((ctx, index) => {
                if (ctx.chosenText) {
                    let optionsInfo = "";
                    if (ctx.availableOptions && Array.isArray(ctx.availableOptions)) {
                        optionsInfo = "\n可选项: " + ctx.availableOptions.join(", ");
                    }
                    return `上下文 ${index + 1}: 玩家从多个选项中选择了 "${ctx.chosenText}"${optionsInfo}`;
                }
                return `上下文 ${index + 1}: 无选择记录`;
            }).join("\n");
        }
    }
    
    // Construct a natural language prompt with the message, context, and instructions
    const prompt = `${message || ""}
${contextString}

${instructions}`;

    console.log("Sending natural language prompt to LLM:");
    console.log(prompt);

    try {
        const apiKey = process.env.DASHSCOPE_API_KEY;
        const response = await axios.post(
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
            {
                model: "qwen-turbo",
                messages: [
                    { role: "system", content: "You are a great, nuanced story writer who specializes in creative writing in Chinese." },
                    // Send the natural language prompt
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
        // Get LLM response and clean it up
        const reply = cleanMessage(response.data?.choices?.[0]?.message?.content || "No reply received");
        console.log(`returned result:----\n${reply}\n----\n\n`);
        
        try {
            // Extract JSON from the response - find the JSON object using regex
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
            
            // Return the final printed text portion to the client
            res.json(parsed.final_printed_text);
        } catch (parseError) {
            console.error("Error parsing JSON from LLM response:", parseError);
            console.error("Raw reply:", reply);
            
            // Fallback if parsing fails - try to extract content after '最终文本:', '最终选项:', or '最终词语:'
            let fallbackContent;
            const textMatch = reply.match(/最终文本[:：]([\s\S]*?)(?:$|(?:思考|最终))/);
            const optionsMatch = reply.match(/最终选项[:：]([\s\S]*?)(?:$|(?:思考|最终))/);
            const wordMatch = reply.match(/最终词语[:：]([\s\S]*?)(?:$|(?:思考|最终))/);
            
            if (blockType === "dynamic-text" && textMatch) {
                fallbackContent = textMatch[1].trim();
            } else if (blockType === "dynamic-option" && optionsMatch) {
                // Split by newlines for options
                fallbackContent = optionsMatch[1].trim().split(/\n+/).map(o => o.trim()).filter(o => o);
            } else if (blockType === "dynamic-word" && wordMatch) {
                fallbackContent = wordMatch[1].trim();
            } else {
                // Last resort fallback - just return the whole reply
                fallbackContent = blockType === "dynamic-option" ? ["选项 1", "选项 2", "选项 3"] : reply;
            }
            
            res.json(fallbackContent);
        }
    } catch (error) {
        console.error("Error calling AI API:", error.message);
        console.error("Full error details:", error);
        console.error("Stack trace:", error.stack);

        // For JSON parsing errors, include the problematic text
        let problematicText = "";
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
            try {
                // 'reply' might not be defined in this scope if the error happened earlier
                problematicText = typeof reply !== 'undefined' ? reply : "Reply not available";
                console.error("JSON parsing error. Problematic text:", problematicText);
            } catch (e) {
                console.error("Could not access problematic JSON text:", e.message);
            }
        }

        // Include response data if available (for API errors)
        if (error.response) {
            console.error("API response data:", error.response.data);
            console.error("API response status:", error.response.status);
            console.error("API response headers:", error.response.headers);
        }

        // Return detailed error information to the client
        res.status(500).json({
            error: "AI API Error",
            message: error.message,
            stack: error.stack,
            details: error.response?.data || "No additional details available"
        });
    }
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