import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const adminAuthClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function run() {
  const { data, error } = await adminAuthClient
    .from('perfiles')
    .select('*')
    .eq('id', '48dfb999-a201-4d38-81c0-ccec7b5901e8');
    
  console.log("Perfil con eq:", data, error);
}
run();
