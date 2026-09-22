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
  
  // mock manual flights
  const flightsArray = [
    { num: '30', dep: '19:57', arr: '21:02', airline: 'Copa Airlines', ori: 'DAV', des: 'PTY', type: 'B738', reg: '', paxCount: 0, paxMax: 160 },
    { num: '28', dep: '17:53', arr: '18:49', airline: 'Copa Airlines', ori: 'PTY', des: 'DAV', type: 'B738', reg: '', paxCount: 0, paxMax: 160 }
  ];

  const now = new Date();
  const mappedApiIdents = new Set();
  
  const formattedFlights = flightsArray.map(flight => {
    let depDate, arrDate;
    depDate = new Date(`${today}T${flight.dep}:00-05:00`);
    arrDate = new Date(`${today}T${flight.arr}:00-05:00`);

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
    
    let trackingLink = '';
    if (apiMatch) {
      mappedApiIdents.add(apiMatch.ident);
      if (apiMatch.estimated_out) depDate = new Date(apiMatch.estimated_out);
      else if (apiMatch.scheduled_out) depDate = new Date(apiMatch.scheduled_out);
      
      if (apiMatch.estimated_in) arrDate = new Date(apiMatch.estimated_in);
      else if (apiMatch.scheduled_in) arrDate = new Date(apiMatch.scheduled_in);
      
      trackingLink = `https://flightaware.com/live/flight/${apiMatch.ident}`;
    } else {
      trackingLink = `https://flightaware.com/live/flight/CMP${flight.num}`;
    }

    const totalDurationMs = arrDate.getTime() - depDate.getTime();
    const elapsedMs = now.getTime() - depDate.getTime();
    
    let progress = 0;
    let status = 'PROGRAMADO';
    let isApiStatus = false;
    
    if (flight.airline === 'Copa Airlines' && trackingLink.includes('/live/flight/') && mappedApiIdents.has(trackingLink.split('/').pop() || '')) {
      const apiMatch2 = aeroApiData.find(f => f.ident === trackingLink.split('/').pop());
      if (apiMatch2) {
        if (apiMatch2.actual_in || apiMatch2.actual_on) {
          status = 'ARRIBO';
          progress = 100;
          isApiStatus = true;
        } else if (apiMatch2.actual_off) {
          status = 'EN VUELO';
          progress = Math.floor((elapsedMs / totalDurationMs) * 100);
          isApiStatus = true;
        } else if (apiMatch2.actual_out) {
          status = 'ABORDANDO';
          progress = 0;
          isApiStatus = true;
        }
      }
    }
    
    if (!isApiStatus) {
      if (elapsedMs < 0) {
        progress = 0;
        if (Math.abs(elapsedMs) <= 30 * 60000) {
          status = 'ABORDANDO';
        } else {
          status = 'PROGRAMADO';
        }
      } else if (elapsedMs >= totalDurationMs) {
        progress = 100;
        status = 'ARRIBO';
      } else {
        progress = Math.floor((elapsedMs / totalDurationMs) * 100);
        status = 'EN VUELO';
      }
    }
    return { flightNumber: flight.num, status, isApiStatus, apiMatch: !!apiMatch };
  });

  console.log(formattedFlights);
}
getUpcomingFlights();
