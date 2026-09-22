require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

async function getUpcomingFlights() {
  const aeroApiKey = process.env.FLIGHTAWARE_API_KEY;
  let aeroApiData = [];
  try {
    const resAero = await fetch('https://aeroapi.flightaware.com/aeroapi/airports/MPDA/flights?type=Airline', {
      headers: { 'x-apikey': aeroApiKey, 'Accept': 'application/json' }
    });
    if (resAero.ok) {
      const j = await resAero.json();
      aeroApiData = [...(j.arrivals || []), ...(j.departures || []), ...(j.scheduled_arrivals || []), ...(j.scheduled_departures || [])];
    }
  } catch (e) {}

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
  const flightsArray = [
    { num: '30', dep: '19:57', arr: '21:02', airline: 'Copa Airlines', ori: 'DAV', des: 'PTY', type: 'B738', reg: '', paxCount: 0, paxMax: 160 },
    { num: '28', dep: '17:53', arr: '18:49', airline: 'Copa Airlines', ori: 'PTY', des: 'DAV', type: 'B738', reg: '', paxCount: 0, paxMax: 160 }
  ];

  const now = new Date();
  
  const formattedFlights = flightsArray.map(flight => {
    let depDate, arrDate;
    const [hours, mins] = flight.dep.split(':');
    const paddedHours = hours.padStart(2, '0');
    depDate = new Date(`${today}T${paddedHours}:${mins}:00-05:00`);
    
    const [arrHours, arrMins] = flight.arr.split(':');
    arrDate = new Date(`${today}T${arrHours.padStart(2, '0')}:${arrMins}:00-05:00`);

    const targetIdents = [`CMP${flight.num}`, `CM${flight.num}`, flight.num];
    const matches = aeroApiData.filter(f => targetIdents.includes(f.ident) || targetIdents.includes(f.flight_number));
    
    let apiMatch = undefined;
    if (matches.length > 0) {
      apiMatch = matches.reduce((closest, current) => {
        const closestTime = closest.scheduled_out ? new Date(closest.scheduled_out).getTime() : 0;
        const currentTime = current.scheduled_out ? new Date(current.scheduled_out).getTime() : 0;
        return Math.abs(currentTime - depDate.getTime()) < Math.abs(closestTime - depDate.getTime()) ? current : closest;
      }, matches[0]);
      
      if (apiMatch && apiMatch.scheduled_out && Math.abs(new Date(apiMatch.scheduled_out).getTime() - depDate.getTime()) > 12 * 3600000) {
        apiMatch = null;
      }
    }
    
    const totalDurationMs = arrDate.getTime() - depDate.getTime();
    const elapsedMs = now.getTime() - depDate.getTime();
    
    let status = 'PROGRAMADO';
    let isApiStatus = false;
    
    if (flight.airline === 'Copa Airlines' && apiMatch) {
      if (apiMatch.actual_in || apiMatch.actual_on) {
        status = 'ARRIBO';
        isApiStatus = true;
      } else if (apiMatch.actual_off) {
        status = 'EN VUELO';
        isApiStatus = true;
      } else if (apiMatch.actual_out) {
        status = 'ABORDANDO';
        isApiStatus = true;
      }
    }
    
    if (!isApiStatus) {
      if (elapsedMs < 0) {
        if (Math.abs(elapsedMs) <= 30 * 60000) status = 'ABORDANDO';
        else status = 'PROGRAMADO';
      } else if (elapsedMs >= totalDurationMs) {
        status = 'ARRIBO';
      } else {
        status = 'EN VUELO';
      }
    }
    return { flightNumber: flight.num, status, isApiStatus, apiMatch: !!apiMatch };
  });

  console.log(formattedFlights);
}
getUpcomingFlights();
