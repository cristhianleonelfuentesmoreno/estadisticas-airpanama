const { createWorker } = require('tesseract.js');

async function run() {
  const worker = await createWorker('eng');
  
  // Use the image the user uploaded
  const imagePath = '/Users/cristhianf3193/.gemini/antigravity-ide/brain/ad606c44-e35b-4bea-ada1-816aa78a9f2b/.user_uploaded/media_1790008732914.png';
  
  console.log("Running OCR on:", imagePath);
  
  const { data: { text } } = await worker.recognize(imagePath);
  console.log("Raw Text Output:");
  console.log(text);
  
  await worker.terminate();
  
  // Try to parse it with regex
  console.log("\nAttempting regex extraction:");
  const flightPattern = /\b(\d{1,2}:\d{2})\s+(\d{3,4})\s+([A-Z]{3}-[A-Z]{3})\b/g;
  let match;
  const flights = [];
  
  while ((match = flightPattern.exec(text)) !== null) {
    const time = match[1];
    const flightNumber = match[2];
    const route = match[3];
    const [origin, dest] = route.split('-');
    
    flights.push({
      time,
      flightNumber,
      origin,
      destination: dest
    });
  }
  
  console.log("Extracted Flights:", flights);
}

run();
