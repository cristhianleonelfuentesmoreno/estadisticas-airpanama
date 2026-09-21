const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function run() {
  const panamaTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/Panama" });
  const targetDate = new Date(panamaTimeStr).toISOString().split('T')[0];

  console.log(`Borrando vuelos del día: ${targetDate}`);
  const { data, error } = await supabase
    .from('manual_flights_log')
    .delete()
    .eq('flightDate', targetDate);
    
  if (error) {
    console.error("Error al borrar:", error);
  } else {
    console.log("Vuelos borrados exitosamente.");
  }
}
run();
