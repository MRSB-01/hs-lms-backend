const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function run() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    try {
        const prompt = `Generate a 25 question multiple choice test on the following topic:
        Title: Data Structures
        Subject: IT
        Description: Basics
        Difficulty: Easy
        ...
        Output only the JSON array, no extra text, no markdown backticks.`;
        const result = await model.generateContent(prompt);
        console.log("Success with 2.0-flash!");
    } catch (e) {
        console.error("Error with gemini-2.0-flash:", e.message);
    }
}
run();
