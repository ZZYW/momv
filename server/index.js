// server/index.js
import express from "express";
import cors from "cors";
import { compilePlayable } from "./controllers/compileController.js";
import { getData, postData } from "./controllers/dataController.js";
import { recordChoice } from "./controllers/choiceController.js";
import { askLLM } from "./controllers/aiController.js";

const app = express();
const port = process.env.BACKEND_PORT || 3001;
const apiKey = process.env.DASHSCOPE_API_KEY;

if (!apiKey) {
    console.error("Missing LLM API key. Set DASHSCOPE_API_KEY in your environment variables.");
}

app.use(cors());
app.use(express.json());

// Existing Routes
app.post("/compile-playable", compilePlayable);
app.get("/data", getData);
app.post("/data", postData);
app.post("/record-choice", recordChoice);
app.post("/generate-dynamic", askLLM);


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
