const { GoogleGenAI } = require("@google/genai");
require("dotenv").config({ path: ".env.local" });

async function run() {
  const apiKey = process.env.GEMINI_API_KEY.trim();
  console.log("Using API Key length:", apiKey.length);
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: "Say hello",
    });
    console.log("Response:", response.text);
  } catch (error) {
    console.error("Error details:", error.message, error.status);
  }
}
run();
