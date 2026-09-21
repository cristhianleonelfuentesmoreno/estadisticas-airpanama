const { GoogleGenAI } = require("@google/genai");
require("dotenv").config({ path: ".env.local" });

async function run() {
  const apiKey = process.env.GEMINI_API_KEY.trim();
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    console.log("Sending request to gemini-3.6-flash...");
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        "What is this?",
        {
          inlineData: {
            data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            mimeType: "image/png"
          }
        }
      ]
    });
    console.log("Response:", response.text);
  } catch (error) {
    console.error("Error:", error);
  }
}
run();
