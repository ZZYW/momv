
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

export const compilePlayable = (req, res) => {
    const { blocks } = req.body;
    if (!blocks || !Array.isArray(blocks)) {
        return res.status(400).send("Missing or invalid blocks data");
    }

    const templatePath = path.join("templates", "playableTemplate.html");
    fs.readFile(templatePath, "utf8", (err, template) => {
        if (err) {
            logger.error("Error reading template file", { 
                error: err.message, 
                stack: err.stack,
                templatePath 
            });
            return res.status(500).send("Internal Server Error reading template");
        }
        const compiledHTML = template.replace("<!--PROJECT_BLOCKS_PLACEHOLDER-->", JSON.stringify(blocks));
        logger.debug("Compiled HTML template successfully", { blockCount: blocks.length });
        res.send(compiledHTML);
    });
};