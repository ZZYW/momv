import axios from "axios";
import db from "../db.js";

// Generate instructions based on block type and properties.
const getBlockInstructions = ({ blockType, optionCount, sentenceCount, lexiconCategory }) => {
    let baseInstruction = "";
    if (blockType === "dynamic-option" && optionCount) {
        baseInstruction = `Generate ${optionCount} distinct options.`;
    } else if (blockType === "dynamic-text" && sentenceCount) {
        baseInstruction = `Generate a passage of approximately ${sentenceCount} sentences.`;
    } else if (blockType === "dynamic-word" && lexiconCategory) {
        baseInstruction = `Generate a single ${lexiconCategory}.`;
    }
    // Append expected JSON return format instruction.
    let returnFormat = "";
    const formatPrefix = "请把结果作为一个JSON Object返回. 请说中文！请严格的遵从这个schema\n\n"
    if (blockType === "dynamic-option") {
        returnFormat = `${formatPrefix}{"thinking_process": "since...", "final_printed_text": ["option1", "option2", ...]}.`;
    } else if (blockType === "dynamic-word") {
        returnFormat = `${formatPrefix}{"thinking_process": "since...", "final_printed_text": "word"}.`;
    } else if (blockType === "dynamic-text") {
        returnFormat = `${formatPrefix}{"thinking_process": "since...", "final_printed_text": "passage text"}.`;
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

    // Construct the payload as a JSON object with a human-friendly structure.
    const payload = {
        message,
        instructions: getBlockInstructions({ blockType, optionCount, sentenceCount, lexiconCategory })
    };

    // Append human-friendly context if available.
    if (contextRefs && contextRefs.length > 0) {
        const contextInfo = await fetchContextInfo(contextRefs, playerID);
        if (contextInfo.length > 0) {
            payload.context = contextInfo;
        }
    }

    console.log("Sending payload to LLM:");
    console.log(JSON.stringify(payload, null, 2));

    try {
        const apiKey = process.env.DASHSCOPE_API_KEY;
        const response = await axios.post(
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
            {
                model: "qwen-turbo",
                messages: [
                    { role: "system", content: "You are a great, nuanced story writer" },
                    // Send the payload as a JSON string.
                    { role: "user", content: JSON.stringify(payload) }
                ]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`
                }
            }
        );
        const reply = cleanMessage(response.data?.choices?.[0]?.message?.content || "No reply received");
        console.log(`returned result:----\n${reply}\n----\n\n`)
        const parsed = JSON.parse(reply)
        res.json(parsed.final_printed_text);
    } catch (error) {
        console.error("Error calling AI API:", error.message);
        res.json("Simulated response: I am the AI, but an error occurred.");
    }
};

/**
 * Removes markdown code fences (including optional language names) from the input text.
 * @param {string} message - The text potentially containing markdown code fences.
 * @returns {string} - The cleaned text without markdown code fences.
 */
function cleanMessage(message) {
    // Remove lines that start with triple backticks followed optionally by a language name.
    // This regex matches the opening code fence (e.g., ```javascript) and the closing fence (```).
    return message.replace(/```[\w]*\n?/g, "").replace(/```/g, "");
}