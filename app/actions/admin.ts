"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireAdmin, type SessionUser } from "@/lib/auth";

// Estas acciones devuelven { error } en vez de lanzar, porque la UI lo muestra en un toast
async function getAdminOrNull(): Promise<SessionUser | null> {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

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
  const admin = await getAdminOrNull();
  if (!admin) return { error: "No autorizado" };
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("perfiles")
    .select("id, email, role, status, nombre, cargo, created_at")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { users: data };
}

export async function updateUserStatus(userId: string, status: "aprobado" | "pendiente" | "rechazado") {
  const admin = await getAdminOrNull();
  if (!admin) return { error: "No autorizado" };
  const supabase = await createClient();

  const { error } = await supabase
    .from("perfiles")
    .update({ status })
    .eq("id", userId);

  if (error) return { error: error.message };
  
  if (status === "aprobado") {
    try {
      const adminAuthClient = createAdminClient();
      await adminAuthClient.auth.admin.updateUserById(userId, { email_confirm: true });
    } catch (err) {
      console.error("Error auto-confirming email:", err);
    }
  }
  
  await logAdminAction(admin.id, userId, `cambió el estado a "${status}"`);
  
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateUserRole(userId: string, role: "administrador" | "usuario") {
  const admin = await getAdminOrNull();
  if (!admin) return { error: "No autorizado" };

  const adminAuthClient = createAdminClient();

  const { error } = await adminAuthClient
    .from("perfiles")
    .update({ role })
    .eq("id", userId);

  if (error) return { error: error.message };
  
  await logAdminAction(admin.id, userId, `modificó el rol a "${role}"`);
  
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateUserCargo(userId: string, cargo: string | null) {
  const admin = await getAdminOrNull();
  if (!admin) return { error: "No autorizado" };

  const adminAuthClient = createAdminClient();

  const { error } = await adminAuthClient
    .from("perfiles")
    .update({ cargo: cargo || null })
    .eq("id", userId);

  if (error) return { error: error.message };
  
  await logAdminAction(admin.id, userId, `actualizó el cargo a "${cargo || 'Vacío'}"`);
  
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateUserName(userId: string, nombre: string | null) {
  const admin = await getAdminOrNull();
  if (!admin) return { error: "No autorizado" };

  const adminAuthClient = createAdminClient();

  const { error } = await adminAuthClient
    .from("perfiles")
    .update({ nombre: nombre || null })
    .eq("id", userId);

  if (error) return { error: error.message };
  
  await logAdminAction(admin.id, userId, `modificó el nombre a "${nombre || 'Vacío'}"`);
  
  revalidatePath("/dashboard");
  return { success: true };
}


export async function deleteUserAction(userId: string) {
  const admin = await getAdminOrNull();
  if (!admin) return { error: "No autorizado" };

  const supabaseAdmin = createAdminClient();

  // Intentamos borrar el perfil primero por si no hay CASCADE
  await supabaseAdmin.from("perfiles").delete().eq("id", userId);

  // Borrar al usuario de la autenticación
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) return { error: error.message };
  
  await logAdminAction(admin.id, userId, `eliminó permanentemente la cuenta del sistema`, 'eliminacion');
  
  revalidatePath("/dashboard");
  return { success: true };
}

// Pública a propósito: la pantalla de login necesita el fondo y los textos antes de tener sesión
export async function getAppSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('assets').download('settings.json');
  if (error) return null;
  const text = await data.text();
  return JSON.parse(text);
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function updateAppSettings(formData: FormData) {
  const admin = await getAdminOrNull();
  if (!admin) return { error: "No autorizado" };

  let bgUrl = formData.get("bgUrl") as string;
  const imageFile = formData.get("imageFile") as File | null;

  const supabaseAdmin = createAdminClient();

  if (imageFile && imageFile.size > 0) {
    // El bucket es público: solo aceptamos imágenes reales (evita subir HTML/JS)
    const ext = ALLOWED_IMAGE_TYPES[imageFile.type];
    if (!ext) return { error: "Formato de imagen no permitido (usa JPG, PNG o WEBP)" };
    if (imageFile.size > 8 * 1024 * 1024) return { error: "La imagen supera 8 MB" };
    const fileName = `bg-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage.from('assets').upload(fileName, imageFile, { upsert: true, contentType: imageFile.type });
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
