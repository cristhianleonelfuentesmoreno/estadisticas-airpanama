const { GoogleGenAI } = require("@google/genai");
require("dotenv").config({ path: ".env.local" });

async function run() {
  const apiKey = process.env.GEMINI_API_KEY.trim();
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.list();
    for await (const model of response) {
      console.log(model.name);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}
run();
