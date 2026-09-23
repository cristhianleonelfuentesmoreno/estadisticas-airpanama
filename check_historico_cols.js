const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  // Probar en llegadas_malek_historico con avion y matricula
  const test1 = {
    fecha: '2099-12-31',
    aerolinea: 'Test',
    numero_vuelo: 'CM-013',
    origen: 'PTY',
    hora_itinerario: new Date().toISOString(),
    estado_final: 'LLEGÓ',
    pasajeros_abordo: 0,
    capacidad_total: 160,
    avion: 'B738',
    matricula: 'HP1856'
  };
  
  const { data, error } = await supabase.from('llegadas_malek_historico').insert(test1).select();
  if (error) console.log('❌ llegadas_malek_historico error:', error.message, error.code);
  else {
    console.log('✅ llegadas_malek_historico ok');
    await supabase.from('llegadas_malek_historico').delete().eq('id', data[0].id);
  }
  
  // Verificar las columnas reales de llegadas_malek_historico
  const { data: sample } = await supabase.from('llegadas_malek_historico').select('*').limit(1);
  console.log('\nColumnas llegadas_malek_historico:', sample?.[0] ? Object.keys(sample[0]) : 'no data');
}
run();
