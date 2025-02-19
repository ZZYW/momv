const express = require("express");
const fs = require("fs");
const axios = require("axios");
const cors = require("cors");

const app = express();
const port = 3000;
const dbFile = "./data.json";

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Use express.json() to parse incoming JSON bodies
app.use(express.json());

// ---------------------------
// Database Endpoints
// ---------------------------

// GET endpoint to retrieve stored data
app.get("/data", (req, res) => {
    fs.readFile(dbFile, "utf-8", (err, data) => {
        if (err) return res.status(500).json({ error: "Unable to read database" });
        res.json(JSON.parse(data || "{}"));
    });
});

// POST endpoint to update the stored data
app.post("/data", (req, res) => {
    fs.writeFile(dbFile, JSON.stringify(req.body), err => {
        if (err) return res.status(500).json({ error: "Unable to write to database" });
        res.json({ status: "success" });
    });
});

// ---------------------------
// AI Proxy Endpoint
// ---------------------------
app.post("/ai", async (req, res) => {
    const { message } = req.body;

    try {
        // Replace with your actual API key and ensure it's exported as an environment variable:
        // e.g., export DASHSCOPE_API_KEY=sk-xxx in your shell environment.
        const apiKey = process.env.DASHSCOPE_API_KEY;

        // Call the Qwen API using axios
        const response = await axios.post(
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
            {
                model: "qwen-turbo",
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
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

        // Extract the reply from the response and return it
        const reply =
            response.data?.choices && response.data.choices[0].message?.content ||
            "No reply received";
        res.json({ reply });
    } catch (error) {
        console.error("Error calling AI API:", error.message);
        res.json({ reply: "Simulated response: I am the AI, but an error occurred." });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`DB/AI server running at http://localhost:${port}`);
});