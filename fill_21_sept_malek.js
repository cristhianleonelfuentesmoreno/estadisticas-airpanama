const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

// Del itinerario Air Panama 21-Sep-2026:
// 670: PAC-DAV, DH8D HP-1997, Sal 7:00, Arr ~8:00 (aprox 1h vuelo), 25 pax
// 671: DAV-PAC, DH8D HP-1997, Sal 8:30, Arr ~9:25, 34 pax
// 970: PAC-DAV, DH8D HP-1997, Sal 16:15, Arr ~17:10, 16 pax
// 971: DAV-PAC, DH8D HP-1997, Sal 17:30, Arr ~18:25, 59 pax
// 693: BOC-DAV (C-208 HP-1993), Sal 10:50, Arr ~11:55, 4 pax
// 692: DAV-BOC (C-208 HP-1993), Sal 11:55, Arr ~12:40, 4 pax

async function run() {
  const date = '2026-09-21';

  // ==========================================
  // LLEGADAS MALEK HISTORICO
  // ==========================================
  
  // 7P-670: PAC -> DAV, llegó a las 8:00 AM, salió de PAC a las 7:00 AM
  const { error: e1 } = await supabase
    .from('llegadas_malek_historico')
    .update({
      hora_itinerario_salida: `${date}T07:00:00-05:00`,
      hora_real_salida:       `${date}T07:00:00-05:00`,
      hora_itinerario_llegada:`${date}T08:00:00-05:00`,
      hora_real_llegada:      `${date}T08:15:00-05:00`, // dato real del manual_flights_log
      actualizado_en: new Date().toISOString()
    })
    .eq('id', 'e09b6345-da07-44a4-bdaa-22e522bc074e');
  if (e1) console.error('Error 7P-670 llegada:', e1.message);
  else console.log('✅ 7P-670 llegada actualizada');

  // 7P-693: BOC -> DAV, Sal 10:50 BOC, Arr ~11:55 DAV
  const { error: e2 } = await supabase
    .from('llegadas_malek_historico')
    .update({
      hora_itinerario_salida: `${date}T10:50:00-05:00`,
      hora_real_salida:       `${date}T10:50:00-05:00`,
      hora_itinerario_llegada:`${date}T11:55:00-05:00`,
      hora_real_llegada:      `${date}T11:30:00-05:00`,
      actualizado_en: new Date().toISOString()
    })
    .eq('id', '754ed63d-b1eb-43df-93c0-72e283e2453d');
  if (e2) console.error('Error 7P-693 llegada:', e2.message);
  else console.log('✅ 7P-693 llegada actualizada');

  // CM-17: PTY -> DAV, Sal 7:55 PTY, Arr 8:55 DAV
  const { error: e3 } = await supabase
    .from('llegadas_malek_historico')
    .update({
      hora_itinerario_salida: `${date}T07:55:00-05:00`,
      hora_real_salida:       `${date}T07:55:00-05:00`,
      hora_itinerario_llegada:`${date}T08:55:00-05:00`,
      hora_real_llegada:      `${date}T08:55:00-05:00`,
      actualizado_en: new Date().toISOString()
    })
    .eq('id', '0dddad12-c8d7-4bfd-a52b-2c78b2776dee');
  if (e3) console.error('Error CM-17 llegada:', e3.message);
  else console.log('✅ CM-17 llegada actualizada');

  // CM-13: PTY -> DAV, Sal 6:45 PTY, Arr 7:52 DAV
  const { error: e4 } = await supabase
    .from('llegadas_malek_historico')
    .update({
      hora_itinerario_salida: `${date}T06:45:00-05:00`,
      hora_real_salida:       `${date}T06:45:00-05:00`,
      hora_itinerario_llegada:`${date}T07:52:00-05:00`,
      hora_real_llegada:      `${date}T07:52:00-05:00`,
      actualizado_en: new Date().toISOString()
    })
    .eq('id', '75164cef-09f3-42b7-a2e0-46ed6ad40692');
  if (e4) console.error('Error CM-13 llegada:', e4.message);
  else console.log('✅ CM-13 llegada actualizada');

  // ==========================================
  // SALIDAS MALEK HISTORICO
  // ==========================================

  // 7P-671: DAV -> PAC, Sal 8:30 DAV, Arr ~9:25 PAC
  const { error: e5 } = await supabase
    .from('salidas_malek_historico')
    .update({
      hora_itinerario_salida: `${date}T08:30:00-05:00`,
      hora_real_salida:       `${date}T08:30:00-05:00`,
      hora_itinerario_llegada:`${date}T09:25:00-05:00`,
      hora_real_llegada:      `${date}T09:25:00-05:00`,
      actualizado_en: new Date().toISOString()
    })
    .eq('id', '48e83088-6bd1-4e19-8503-2d0dec7ee04d');
  if (e5) console.error('Error 7P-671 salida:', e5.message);
  else console.log('✅ 7P-671 salida actualizada');

  // 7P-692: DAV -> BOC, Sal 11:55 DAV, Arr ~12:40 BOC
  const { error: e6 } = await supabase
    .from('salidas_malek_historico')
    .update({
      hora_itinerario_salida: `${date}T11:55:00-05:00`,
      hora_real_salida:       `${date}T11:55:00-05:00`,
      hora_itinerario_llegada:`${date}T12:40:00-05:00`,
      hora_real_llegada:      `${date}T12:40:00-05:00`,
      actualizado_en: new Date().toISOString()
    })
    .eq('id', 'be6c4bf0-0e58-45f2-8080-69c0e320853d');
  if (e6) console.error('Error 7P-692 salida:', e6.message);
  else console.log('✅ 7P-692 salida actualizada');

  // CM-18: DAV -> PTY, Sal 9:50 DAV, Arr 10:39 PTY
  const { error: e7 } = await supabase
    .from('salidas_malek_historico')
    .update({
      hora_itinerario_salida: `${date}T09:50:00-05:00`,
      hora_real_salida:       `${date}T09:50:00-05:00`,
      hora_itinerario_llegada:`${date}T10:39:00-05:00`,
      hora_real_llegada:      `${date}T10:39:00-05:00`,
      actualizado_en: new Date().toISOString()
    })
    .eq('id', '93472b37-a509-46d3-a976-9b57b0e02aea');
  if (e7) console.error('Error CM-18 salida:', e7.message);
  else console.log('✅ CM-18 salida actualizada');

  // CM-11: DAV -> PTY, Sal 8:50 DAV, Arr 9:31 PTY
  const { error: e8 } = await supabase
    .from('salidas_malek_historico')
    .update({
      hora_itinerario_salida: `${date}T08:50:00-05:00`,
      hora_real_salida:       `${date}T08:50:00-05:00`,
      hora_itinerario_llegada:`${date}T09:31:00-05:00`,
      hora_real_llegada:      `${date}T09:31:00-05:00`,
      actualizado_en: new Date().toISOString()
    })
    .eq('id', '413300c5-702e-499c-b8ad-cb3c538eda55');
  if (e8) console.error('Error CM-11 salida:', e8.message);
  else console.log('✅ CM-11 salida actualizada');

  // ==========================================
  // INSERTAR REGISTROS QUE FALTAN
  // 970: PAC -> DAV (llegada a DAV)
  // 971: DAV -> PAC (salida de DAV)
  // ==========================================

  // Verificar si ya existen
  const { data: existing970 } = await supabase
    .from('llegadas_malek_historico')
    .select('id')
    .eq('fecha', date)
    .eq('numero_vuelo', '7P-970');
  
  if (!existing970 || existing970.length === 0) {
    const { error: e9 } = await supabase.from('llegadas_malek_historico').insert({
      fecha: date,
      aerolinea: 'Air Panama',
      numero_vuelo: '7P-970',
      origen: 'PAC',
      hora_itinerario:         `${date}T17:10:00-05:00`,
      hora_llegada_real:       `${date}T17:10:00-05:00`,
      hora_itinerario_salida:  `${date}T16:15:00-05:00`,
      hora_real_salida:        `${date}T16:15:00-05:00`,
      hora_itinerario_llegada: `${date}T17:10:00-05:00`,
      hora_real_llegada:       `${date}T17:10:00-05:00`,
      estado_final: 'LLEGÓ',
      pasajeros_abordo: 16,
      capacidad_total: 74
    });
    if (e9) console.error('Error insert 7P-970 llegada:', e9.message);
    else console.log('✅ 7P-970 llegada INSERTADA');
  } else {
    console.log('ℹ️ 7P-970 llegada ya existe, actualizando campos vacíos...');
    await supabase.from('llegadas_malek_historico').update({
      hora_itinerario_salida:  `${date}T16:15:00-05:00`,
      hora_real_salida:        `${date}T16:15:00-05:00`,
      hora_itinerario_llegada: `${date}T17:10:00-05:00`,
      hora_real_llegada:       `${date}T17:10:00-05:00`,
      actualizado_en: new Date().toISOString()
    }).eq('id', existing970[0].id);
  }

  const { data: existing971 } = await supabase
    .from('salidas_malek_historico')
    .select('id')
    .eq('fecha', date)
    .eq('numero_vuelo', '7P-971');
  
  if (!existing971 || existing971.length === 0) {
    const { error: e10 } = await supabase.from('salidas_malek_historico').insert({
      fecha: date,
      aerolinea: 'Air Panama',
      numero_vuelo: '7P-971',
      destino: 'PAC',
      hora_itinerario:        `${date}T17:30:00-05:00`,
      hora_salida_real:       `${date}T17:30:00-05:00`,
      hora_itinerario_salida: `${date}T17:30:00-05:00`,
      hora_real_salida:       `${date}T17:30:00-05:00`,
      hora_itinerario_llegada:`${date}T18:25:00-05:00`,
      hora_real_llegada:      `${date}T18:25:00-05:00`,
      estado_final: 'LLEGÓ',
      pasajeros_abordo: 59,
      capacidad_total: 74
    });
    if (e10) console.error('Error insert 7P-971 salida:', e10.message);
    else console.log('✅ 7P-971 salida INSERTADA');
  } else {
    console.log('ℹ️ 7P-971 salida ya existe, actualizando...');
    await supabase.from('salidas_malek_historico').update({
      hora_itinerario_salida: `${date}T17:30:00-05:00`,
      hora_real_salida:       `${date}T17:30:00-05:00`,
      hora_itinerario_llegada:`${date}T18:25:00-05:00`,
      hora_real_llegada:      `${date}T18:25:00-05:00`,
      actualizado_en: new Date().toISOString()
    }).eq('id', existing971[0].id);
  }

  console.log('\n✅ Completado. Todos los campos actualizados para 21-Sep-2026');
}
run();
