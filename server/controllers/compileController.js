
import fs from 'fs';
import path from 'path';

export const compilePlayable = (req, res) => {
    const { blocks } = req.body;
    if (!blocks || !Array.isArray(blocks)) {
        return res.status(400).send("Missing or invalid blocks data");
    }

    const templatePath = path.join("templates", "playableTemplate.html");
    fs.readFile(templatePath, "utf8", (err, template) => {
        if (err) {
            console.error("Error reading template file:", err);
            return res.status(500).send("Internal Server Error reading template");
        }
        const compiledHTML = template.replace("<!--PROJECT_BLOCKS_PLACEHOLDER-->", JSON.stringify(blocks));
        res.send(compiledHTML);
    });
};