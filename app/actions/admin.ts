"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { logAudit } from "./audit";

async function logAdminAction(adminId: string, targetId: string, actionDesc: string, eventType: 'edicion' | 'eliminacion' = 'edicion', extra = {}) {
  const supabase = await createClient();
  const { data: admin } = await supabase.from('perfiles').select('nombre, email').eq('id', adminId).single();
  const { data: target } = await supabase.from('perfiles').select('nombre, email').eq('id', targetId).single();
  const adminName = admin ? (admin.nombre || admin.email) : 'Administrador';
  const targetName = target ? (target.nombre || target.email) : targetId;
  await logAudit({
    tipo_evento: eventType,
    usuario_id: adminId,
    nombre_referencia: targetName,
    descripcion: `${adminName} ${actionDesc}`,
    detalles_extra: extra
  });
}

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
  if (!authData.user) return { error: "No autorizado" };
  const { data: perfil } = await supabase.from("perfiles").select("role").eq("id", authData.user.id).single();
  
  if (perfil?.role !== "administrador") return { error: "No autorizado" };

  const { error } = await supabase
    .from("perfiles")
    .update({ status })
    .eq("id", userId);

  if (error) return { error: error.message };
  
  if (status === "aprobado") {
    try {
      const adminAuthClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
      );
      await adminAuthClient.auth.admin.updateUserById(userId, { email_confirm: true });
    } catch (err) {
      console.error("Error auto-confirming email:", err);
    }
  }
  
  await logAdminAction(authData.user.id, userId, `cambió el estado a "${status}"`);
  
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateUserRole(userId: string, role: "administrador" | "usuario") {
  const supabase = await createClient();
  
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { error: "No autorizado" };
  const { data: perfil } = await supabase.from("perfiles").select("role").eq("id", authData.user.id).single();
  if (perfil?.role !== "administrador") return { error: "No autorizado" };

  const adminAuthClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  const { error } = await adminAuthClient
    .from("perfiles")
    .update({ role })
    .eq("id", userId);

  if (error) return { error: error.message };
  
  await logAdminAction(authData.user.id, userId, `modificó el rol a "${role}"`);
  
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateUserCargo(userId: string, cargo: string | null) {
  const supabase = await createClient();
  
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { error: "No autorizado" };
  const { data: perfil } = await supabase.from("perfiles").select("role").eq("id", authData.user.id).single();
  if (perfil?.role !== "administrador") return { error: "No autorizado" };

  const adminAuthClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  const { error } = await adminAuthClient
    .from("perfiles")
    .update({ cargo: cargo || null })
    .eq("id", userId);

  if (error) return { error: error.message };
  
  await logAdminAction(authData.user.id, userId, `actualizó el cargo a "${cargo || 'Vacío'}"`);
  
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateUserName(userId: string, nombre: string | null) {
  const supabase = await createClient();
  
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { error: "No autorizado" };
  const { data: perfil } = await supabase.from("perfiles").select("role").eq("id", authData.user.id).single();
  if (perfil?.role !== "administrador") return { error: "No autorizado" };

  const adminAuthClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  const { error } = await adminAuthClient
    .from("perfiles")
    .update({ nombre: nombre || null })
    .eq("id", userId);

  if (error) return { error: error.message };
  
  await logAdminAction(authData.user.id, userId, `modificó el nombre a "${nombre || 'Vacío'}"`);
  
  revalidatePath("/dashboard");
  return { success: true };
}


export async function deleteUserAction(userId: string) {
  const supabase = await createClient();
  
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { error: "No autorizado" };
  const { data: perfil } = await supabase.from("perfiles").select("role").eq("id", authData.user.id).single();
  if (perfil?.role !== "administrador") return { error: "No autorizado" };

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  // Intentamos borrar el perfil primero por si no hay CASCADE
  await supabaseAdmin.from("perfiles").delete().eq("id", userId);

  // Borrar al usuario de la autenticación
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) return { error: error.message };
  
  await logAdminAction(authData.user.id, userId, `eliminó permanentemente la cuenta del sistema`, 'eliminacion');
  
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getAppSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('assets').download('settings.json');
  if (error) return null;
  const text = await data.text();
  return JSON.parse(text);
}

export async function updateAppSettings(formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfiles").select("role").eq("id", authData.user?.id).single();
  if (perfil?.role !== "administrador") return { error: "No autorizado" };

  let bgUrl = formData.get("bgUrl") as string;
  const imageFile = formData.get("imageFile") as File | null;

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  if (imageFile && imageFile.size > 0) {
    const ext = imageFile.name.split('.').pop();
    const fileName = `bg-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage.from('assets').upload(fileName, imageFile, { upsert: true });
    if (uploadError) return { error: uploadError.message };
    
    const { data: urlData } = supabaseAdmin.storage.from('assets').getPublicUrl(fileName);
    bgUrl = urlData.publicUrl;
  }

  const newSettings = {
    loginTitle: formData.get("loginTitle") as string,
    loginText: formData.get("loginText") as string,
    registerTitle: formData.get("registerTitle") as string,
    registerText: formData.get("registerText") as string,
    bgUrl: bgUrl,
    bgSize: formData.get("bgSize") as string,
    bgPosition: formData.get("bgPosition") as string,
    bgSizeMobile: formData.get("bgSizeMobile") as string,
    bgPositionMobile: formData.get("bgPositionMobile") as string,
  };
  
  const { error } = await supabaseAdmin.storage.from('assets').upload('settings.json', JSON.stringify(newSettings), { contentType: 'application/json', upsert: true });
  if (error) return { error: error.message };
  
  revalidatePath("/login");
  revalidatePath("/register");
  return { success: true, settings: newSettings };
}
