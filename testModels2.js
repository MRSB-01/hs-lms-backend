const fs = require('fs');
require("dotenv").config();

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        if (data.models) {
            fs.writeFileSync('testModelsOutput.txt', data.models.map(m => m.name).join('\n'));
        } else {
            console.error(data);
        }
    } catch (e) {
        console.error(e);
    }
}

listModels();
