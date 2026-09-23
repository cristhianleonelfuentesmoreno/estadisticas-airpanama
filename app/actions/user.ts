"use server";
import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function getCurrentUserProfile() {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const adminAuthClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  const { data: perfil, error } = await adminAuthClient
    .from('perfiles')
    .select('nombre, cargo, role')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error("Error fetching profile from DB:", error);
  }

  return {
    nombre: perfil?.nombre || user.email?.split('@')[0] || "Usuario",
    cargo: perfil?.cargo || "Sin cargo asignado",
    role: perfil?.role,
    avatar_url: null
  };
}
