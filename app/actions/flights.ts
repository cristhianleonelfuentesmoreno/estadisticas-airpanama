"use server";

export interface FlightData {
  id: string;
  flightNumber: string;
  aircraft: string;
  aircraftReg: string;
  origin: string;
  originName: string;
  destination: string;
  destinationName: string;
  departureTime: string; // ISO string so it's serializable to client
  arrivalTime: string;
  status: 'A TIEMPO' | 'ABORDANDO' | 'RETRASADO' | 'EN VUELO' | 'LLEGÓ';
  gate: string;
  pilot: string;
  paxCount: number;
  paxMax: number;
  flightType: string;
  progress: number; // 0 to 100
  durationStr: string;
}

export async function getUpcomingFlights(): Promise<FlightData[]> {
  const now = new Date();
  
  // Create some simulated flights around current time
  const createFlight = (
    flightNum: string, offsetMins: number, durationMins: number, 
    origin: string, originName: string, dest: string, destName: string, 
    gate: string, type: string, pilot: string, pax: number, maxPax: number, aircraft: string, reg: string
  ): FlightData => {
    const depTime = new Date(now.getTime() + offsetMins * 60000);
    const arrTime = new Date(depTime.getTime() + durationMins * 60000);
    
    // Calculate progress
    const totalDurationMs = arrTime.getTime() - depTime.getTime();
    const elapsedMs = now.getTime() - depTime.getTime();
    
    let progress = 0;
    let status: FlightData['status'] = 'A TIEMPO';
    
    if (elapsedMs < 0) {
      progress = 0;
      if (Math.abs(offsetMins) <= 30) status = 'ABORDANDO';
      else status = 'A TIEMPO';
    } else if (elapsedMs >= totalDurationMs) {
      progress = 100;
      status = 'LLEGÓ';
    } else {
      progress = Math.floor((elapsedMs / totalDurationMs) * 100);
      status = 'EN VUELO';
    }

    const hours = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    const durationStr = hours > 0 ? `${hours}h ${mins.toString().padStart(2, '0')}m` : `${mins} min`;

    return {
      id: flightNum,
      flightNumber: flightNum,
      aircraft,
      aircraftReg: reg,
      origin,
      originName,
      destination: dest,
      destinationName: destName,
      departureTime: depTime.toISOString(),
      arrivalTime: arrTime.toISOString(),
      status,
      gate,
      pilot,
      paxCount: pax,
      paxMax: maxPax,
      flightType: type,
      progress,
      durationStr
    };
  };

  const flights = [
    // Flight 1: In the air (offset -25 means it departed 25 mins ago, duration 50 mins -> halfway)
    createFlight('7P-702', -25, 50, 'PAC', 'Panamá (Albrook)', 'DAV', 'David (Malek)', 'Puerta 03', 'Directo', 'Cap. A. Castillo', 46, 48, 'Fokker 50', 'HP-1890'),
    // Flight 2: Boarding soon (departs in 15 mins)
    createFlight('7P-814', 15, 60, 'PAC', 'Panamá (Albrook)', 'BOC', 'Bocas del Toro', 'Puerta 01', 'Directo', 'Cap. R. Vega', 48, 48, 'Fokker 50', 'HP-1721'),
    // Flight 3: Delayed/later (departs in 90 mins)
    createFlight('7P-901', 90, 75, 'PAC', 'Panamá (Albrook)', 'SJO', 'San José (CR)', 'Puerta Int-05', 'Chárter Especial', 'Cap. L. Pitti', 134, 144, 'Boeing 737-400', 'HP-1922'),
    // Flight 4: Arrived (departed 100 mins ago, duration 45 mins)
    createFlight('7P-410', -100, 45, 'PAC', 'Panamá (Albrook)', 'CHX', 'Changuinola', 'Puerta 02', 'Directo', 'Cap. M. Bernal', 40, 48, 'Fokker 50', 'HP-1800'),
    
    // Additional flights to cover the whole day
    createFlight('7P-101', -300, 50, 'PAC', 'Panamá (Albrook)', 'DAV', 'David (Malek)', 'Puerta 01', 'Directo', 'Cap. J. Perez', 48, 48, 'Fokker 50', 'HP-1890'),
    createFlight('7P-102', -200, 50, 'DAV', 'David (Malek)', 'PAC', 'Panamá (Albrook)', 'Puerta 01', 'Directo', 'Cap. J. Perez', 45, 48, 'Fokker 50', 'HP-1890'),
    createFlight('7P-505', -10, 60, 'PAC', 'Panamá (Albrook)', 'BOC', 'Bocas del Toro', 'Puerta 04', 'Directo', 'Cap. S. Ruiz', 35, 48, 'Fokker 50', 'HP-1770'),
    createFlight('7P-220', 120, 50, 'PAC', 'Panamá (Albrook)', 'DAV', 'David (Malek)', 'Puerta 02', 'Directo', 'Cap. E. Gomez', 20, 48, 'Fokker 50', 'HP-1800'),
    createFlight('7P-805', 240, 60, 'BOC', 'Bocas del Toro', 'PAC', 'Panamá (Albrook)', 'Puerta 01', 'Directo', 'Cap. R. Vega', 48, 48, 'Fokker 50', 'HP-1721'),
    createFlight('7P-708', 300, 50, 'DAV', 'David (Malek)', 'PAC', 'Panamá (Albrook)', 'Puerta 02', 'Directo', 'Cap. A. Castillo', 42, 48, 'Fokker 50', 'HP-1890')
  ];

  return flights;
}
