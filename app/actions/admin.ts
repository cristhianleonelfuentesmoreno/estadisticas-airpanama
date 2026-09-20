"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function fetchAllUsers() {
  const supabase = await createClient();
  
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { error: "No autorizado" };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (perfil?.role !== "administrador") return { error: "No autorizado" };

  const { data, error } = await supabase
    .from("perfiles")
    .select("id, email, role, status, nombre, cargo, created_at")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { users: data };
}

export async function updateUserStatus(userId: string, status: "aprobado" | "pendiente" | "rechazado") {
  const supabase = await createClient();
  
  const { data: authData } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfiles").select("role").eq("id", authData.user?.id).single();
  
  if (perfil?.role !== "administrador") return { error: "No autorizado" };

  const { error } = await supabase
    .from("perfiles")
    .update({ status })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateUserRole(userId: string, role: "administrador" | "usuario") {
  const supabase = await createClient();
  
  const { data: authData } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfiles").select("role").eq("id", authData.user?.id).single();
  if (perfil?.role !== "administrador") return { error: "No autorizado" };

  const { error } = await supabase
    .from("perfiles")
    .update({ role })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateUserCargo(userId: string, cargo: string | null) {
  const supabase = await createClient();
  
  const { data: authData } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfiles").select("role").eq("id", authData.user?.id).single();
  if (perfil?.role !== "administrador") return { error: "No autorizado" };

  const { error } = await supabase
    .from("perfiles")
    .update({ cargo: cargo || null })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}
