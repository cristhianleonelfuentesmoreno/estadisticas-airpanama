import { config } from 'dotenv';
config({ path: '.env.local' });
import fs from 'fs';
import path from 'path';

// read the exact code of flights.ts
const flightsContent = fs.readFileSync(path.join(process.cwd(), 'app/actions/flights.ts'), 'utf-8');

// evaluate it!
const match = flightsContent.match(/export async function getUpcomingFlights\(\) \{([\s\S]*?)\nexport async function saveCompletedMalekFlights\(\) \{/);
let body = match[1];

body = body.replace(/import .*? from .*?;/g, '');
body = body.replace(/export async function/g, 'async function');

// We need to inject mocks for getManualFlightsForDate
const script = `
const fetch = require('node-fetch');
async function getManualFlightsForDate() {
  return [
    { flightNumber: '30', departureTimeLocal: '19:57', arrivalTimeLocal: '20:43', origin: 'DAV', destination: 'PTY', airline: 'Copa Airlines', paxCount: 0, paxMax: 160 },
    { flightNumber: '28', departureTimeLocal: '17:53', arrivalTimeLocal: '18:49', origin: 'PTY', destination: 'DAV', airline: 'Copa Airlines', paxCount: 0, paxMax: 160 }
  ];
}
async function getUpcomingFlights() {
  ${body}
}
getUpcomingFlights().then(flights => {
  console.log(flights.filter(f => f.flightNumber.includes('30') || f.flightNumber.includes('28')));
});
`;

fs.writeFileSync('scratch/run-exact.js', script);
