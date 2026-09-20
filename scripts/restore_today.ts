import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fivelvadctsggzifcmtq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function restoreTodayCorrectly() {
  const today = '2026-09-20';

  console.log("Limpiando datos incorrectos de hoy...");
  await supabase.from('llegadas_malek_historico').delete().eq('fecha', today);
  await supabase.from('salidas_malek_historico').delete().eq('fecha', today);

  console.log("Insertando llegadas correctas...");
  const llegadas = [
    {
      fecha: today,
      aerolinea: 'Copa Airlines',
      numero_vuelo: 'CM-011',
      origen: 'PTY',
      hora_itinerario: `${today}T08:50:00-05:00`,
      hora_llegada_real: `${today}T08:50:00-05:00`,
      estado_final: 'LLEGÓ',
      pasajeros_abordo: 145,
      capacidad_total: 160
    },
    {
      fecha: today,
      aerolinea: 'Air Panama',
      numero_vuelo: '7P-972',
      origen: 'PAC',
      hora_itinerario: `${today}T09:45:00-05:00`,
      hora_llegada_real: `${today}T09:45:00-05:00`,
      estado_final: 'LLEGÓ',
      pasajeros_abordo: 21,
      capacidad_total: 78
    },
    {
      fecha: today,
      aerolinea: 'Copa Airlines',
      numero_vuelo: 'CM-013',
      origen: 'PTY',
      hora_itinerario: `${today}T11:20:00-05:00`,
      hora_llegada_real: `${today}T11:20:00-05:00`,
      estado_final: 'LLEGÓ',
      pasajeros_abordo: 130,
      capacidad_total: 160
    }
  ];

  await supabase.from('llegadas_malek_historico').insert(llegadas);

  console.log("Insertando salidas correctas...");
  const salidas = [
    {
      fecha: today,
      aerolinea: 'Copa Airlines',
      numero_vuelo: 'CM-012',
      destino: 'PTY',
      hora_itinerario: `${today}T09:20:00-05:00`,
      hora_salida_real: `${today}T09:20:00-05:00`,
      estado_final: 'LLEGÓ',
      pasajeros_abordo: 155,
      capacidad_total: 160
    },
    {
      fecha: today,
      aerolinea: 'Air Panama',
      numero_vuelo: '7P-973',
      destino: 'PAC',
      hora_itinerario: `${today}T09:45:00-05:00`,
      hora_salida_real: `${today}T09:45:00-05:00`,
      estado_final: 'LLEGÓ',
      pasajeros_abordo: 70,
      capacidad_total: 78
    },
    {
      fecha: today,
      aerolinea: 'Copa Airlines',
      numero_vuelo: 'CM-014',
      destino: 'PTY',
      hora_itinerario: `${today}T12:00:00-05:00`,
      hora_salida_real: `${today}T12:00:00-05:00`,
      estado_final: 'LLEGÓ',
      pasajeros_abordo: 120,
      capacidad_total: 160
    }
  ];

  await supabase.from('salidas_malek_historico').insert(salidas);

  console.log("¡Vuelos insertados correctamente con la zona horaria correcta (-05:00)!");
}

restoreTodayCorrectly();
