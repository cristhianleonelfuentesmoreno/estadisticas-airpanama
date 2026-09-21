import { config } from 'dotenv';
config({ path: '.env.local' });
import { getUpcomingFlights } from './app/actions/flights';

async function run() {
  const flights = await getUpcomingFlights();
  console.log(flights.filter(f => f.airline === 'Copa Airlines').map(f => ({
    num: f.flightNumber,
    status: f.status,
    dep: f.departureTimeLocal,
    progress: f.progress
  })));
}
run();
