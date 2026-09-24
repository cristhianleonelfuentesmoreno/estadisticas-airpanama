// Aeropuertos con los que se opera desde David (los más usados primero). Lista única
// para el importador de Excel, el itinerario y los formularios.
// Sin nombre = código visto en los registros cuyo nombre no está confirmado.
export const AIRPORTS: { code: string; name?: string }[] = [
  { code: "DAV", name: "David, Enrique Malek" },
  { code: "PAC", name: "Albrook, Panamá" },
  { code: "PTY", name: "Tocumen, Panamá" },
  { code: "BOC", name: "Bocas del Toro" },
  { code: "CHX", name: "Changuinola" },
  { code: "CTD", name: "Chitré" },
  { code: "BLB", name: "Panamá Pacífico" },
  { code: "SJO", name: "San José, Costa Rica" },
  { code: "SYQ", name: "Tobías Bolaños, Costa Rica" },
  { code: "PUE", name: "Puerto Obaldía" },
  { code: "PYC", name: "Playón Chico" },
  { code: "OGM", name: "Ogobsucum" },
  { code: "ACU" },
  { code: "LCL" },
  { code: "SIC" },
  { code: "MAN" },
];

export const KNOWN_AIRPORTS = new Set(AIRPORTS.map(a => a.code));

export const airportLabel = (code: string) => {
  const a = AIRPORTS.find(x => x.code === code);
  return a?.name ? `${a.code} · ${a.name}` : code;
};
