const { GoogleGenAI } = require("@google/genai");
require("dotenv").config({ path: ".env.local" });

const modelsToTest = [
  "gemini-flash-latest",
  "gemini-pro-latest",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-omni-1.1-flash"
];

async function run() {
  const apiKey = process.env.GEMINI_API_KEY.trim();
  const ai = new GoogleGenAI({ apiKey });
  
  for (const model of modelsToTest) {
    try {
      console.log(`Testing ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents: [
          "Say hello",
          {
            inlineData: {
              data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
              mimeType: "image/png"
            }
          }
        ]
      });
      console.log(`[SUCCESS] ${model} works! Response: ${response.text}`);
    } catch (error) {
      console.log(`[FAILED] ${model}: ${error.status} - ${error.message}`);
    }
  }
}
run();
