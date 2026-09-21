import { config } from 'dotenv';
config({ path: '.env.local' });
import { getUpcomingFlights } from './app/actions/flights.ts'; // Wait, ts-node or just copy the function

