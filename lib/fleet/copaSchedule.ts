// Base de conocimiento de Copa Airlines en David (DAV).
// Copa opera en rotaciones: el avión llega de PTY y regresa a PTY con otro número.
// En el itinerario mensual cada columna es una rotación y la celda del día muestra el
// número de regreso (CM11, CM18…) cuando opera, o "X" cuando no opera.
// Fuente: ITINERARIO DE VUELOS CM SEPTIEMBRE-RV00-2026.

export type CopaLeg = { flightNumber: string; origin: string; destination: string; etd: string; eta: string };
export type CopaRotation = { arrival: CopaLeg; departure: CopaLeg };

export const COPA_AIRCRAFT = 'B738';

// En el orden de las columnas del itinerario
export const COPA_ROTATIONS: CopaRotation[] = [
  { arrival: { flightNumber: '13', origin: 'PTY', destination: 'DAV', etd: '06:30', eta: '07:45' },
    departure: { flightNumber: '11', origin: 'DAV', destination: 'PTY', etd: '08:26', eta: '09:39' } },
  { arrival: { flightNumber: '17', origin: 'PTY', destination: 'DAV', etd: '07:55', eta: '09:10' },
    departure: { flightNumber: '18', origin: 'DAV', destination: 'PTY', etd: '09:50', eta: '11:03' } },
  { arrival: { flightNumber: '21', origin: 'PTY', destination: 'DAV', etd: '11:58', eta: '13:13' },
    departure: { flightNumber: '24', origin: 'DAV', destination: 'PTY', etd: '13:53', eta: '15:06' } },
  { arrival: { flightNumber: '26', origin: 'PTY', destination: 'DAV', etd: '15:01', eta: '16:25' },
    departure: { flightNumber: '22', origin: 'DAV', destination: 'PTY', etd: '18:31', eta: '19:44' } },
  { arrival: { flightNumber: '28', origin: 'PTY', destination: 'DAV', etd: '17:53', eta: '19:17' },
    departure: { flightNumber: '30', origin: 'DAV', destination: 'PTY', etd: '19:57', eta: '21:10' } },
];

export const rotationByNumber = (flightNumber: string) =>
  COPA_ROTATIONS.find(r => r.arrival.flightNumber === flightNumber || r.departure.flightNumber === flightNumber);

// Meses ya verificados a mano: día → números de regreso que operan.
// Respaldo si la foto no se puede leer (p. ej. una foto torcida tomada con el celular).
export const COPA_VERIFIED_MONTHS: Record<string, Record<number, string[]>> = {
  '2026-09': {
     1: ['18', '30'],             2: ['18', '30'],             3: ['18', '22', '30'],
     4: ['11', '18', '22', '30'], 5: ['11', '18', '30'],       6: ['11', '18', '24', '30'],
     7: ['11', '18', '30'],       8: ['18', '30'],             9: ['18', '30'],
    10: ['18', '22', '30'],      11: ['11', '18', '24', '22', '30'], 12: ['11', '18', '30'],
    13: ['11', '18', '24', '30'], 14: ['11', '18', '30'],      15: ['18', '30'],
    16: ['18', '30'],            17: ['18', '22', '30'],       18: ['11', '18', '22', '30'],
    19: ['11', '18', '30'],      20: ['11', '18', '30'],       21: ['11', '18', '30'],
    22: ['18', '30'],            23: ['18', '30'],             24: ['18', '22', '30'],
    25: ['11', '18', '22', '30'], 26: ['11', '18', '30'],      27: ['11', '18', '30'],
    28: ['11', '18', '30'],      29: ['18', '30'],             30: ['18', '30'],
  },
};
