// Script para eliminar vuelos de Copa Airlines de septiembre 2026
// Usa las credenciales del .env.local del proyecto airpanama
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function deleteCopaSeptember() {
  console.log("Conectando a Supabase:", process.env.NEXT_PUBLIC_SUPABASE_URL);

  // Primero verificar cuántos registros hay
  const { data: preview, error: previewErr } = await supabase
    .from('manual_flights_log')
    .select('id, numero_vuelo, fecha_vuelo, aerolinea')
    .eq('aerolinea', 'Copa Airlines')
    .gte('fecha_vuelo', '2026-09-01')
    .lte('fecha_vuelo', '2026-09-30')
    .order('fecha_vuelo', { ascending: true });

  if (previewErr) {
    console.error("Error al consultar:", previewErr.message);
    return;
  }

  console.log(`\nRegistros encontrados para Copa Airlines - Septiembre 2026: ${preview.length}`);
  if (preview.length > 0) {
    console.log("Muestra (primeros 5):", preview.slice(0, 5));
    console.log("Muestra (últimos 5):", preview.slice(-5));
  }

  if (preview.length === 0) {
    console.log("No hay registros para eliminar.");
    return;
  }

  // Eliminar
  const { error: deleteErr, count } = await supabase
    .from('manual_flights_log')
    .delete()
    .eq('aerolinea', 'Copa Airlines')
    .gte('fecha_vuelo', '2026-09-01')
    .lte('fecha_vuelo', '2026-09-30');

  if (deleteErr) {
    console.error("Error al eliminar:", deleteErr.message);
    return;
  }

  console.log(`\n✅ Eliminados exitosamente. Registros borrados: ${preview.length}`);

  // Verificar que quedó en 0
  const { data: check } = await supabase
    .from('manual_flights_log')
    .select('id', { count: 'exact' })
    .eq('aerolinea', 'Copa Airlines')
    .gte('fecha_vuelo', '2026-09-01')
    .lte('fecha_vuelo', '2026-09-30');

  console.log(`Verificación final — registros Copa Airlines Sep 2026 restantes: ${check?.length ?? 0}`);
}

deleteCopaSeptember().catch(console.error);
