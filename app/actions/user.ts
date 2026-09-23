"use server";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre, cargo, role, avatar_url')
    .eq('id', user.id)
    .single();

  return {
    nombre: perfil?.nombre || user.email?.split('@')[0] || "Usuario",
    cargo: perfil?.cargo || "Sin cargo asignado",
    role: perfil?.role,
    avatar_url: perfil?.avatar_url
  };
}
