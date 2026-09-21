const { createWorker, PSM } = require('tesseract.js');
const fs = require('fs');

async function run() {
  const worker = await createWorker('eng');
  
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
  });
  
  // Use the image the user uploaded
  const imagePath = '/Users/cristhianf3193/.gemini/antigravity-ide/brain/ad606c44-e35b-4bea-ada1-816aa78a9f2b/.user_uploaded/media_1790012561463.png';
  
  console.log("Running OCR on:", imagePath);
  
  const { data: { text } } = await worker.recognize(imagePath);
  console.log("Raw Text Output:");
  console.log(text);
  
  fs.writeFileSync('ocr_output_debug.txt', text);
  console.log("Saved to ocr_output_debug.txt");
  
  await worker.terminate();
}

run();
