import axios from "axios";

export const askLLM = async (req, res) => {
    const { message } = req.body;


    console.log(`sending message to llm:`)
    console.log(message)

    try {
        const apiKey = process.env.DASHSCOPE_API_KEY;

        const response = await axios.post(
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
            {
                model: "qwen-turbo",
                messages: [
                    { role: "system", content: "You are a great, nuanced story writer" },
                    { role: "user", content: message }
                ]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                }
            }
        );

        const reply =
            response.data?.choices &&
            response.data.choices[0].message?.content ||
            "No reply received";
        res.json({ reply });
    } catch (error) {
        console.error("Error calling AI API:", error.message);
        res.json({ reply: "Simulated response: I am the AI, but an error occurred." });
    }
};
