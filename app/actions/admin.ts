"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { requireAdmin, requireSupervisor, type SessionUser } from "@/lib/auth";
import { canManageAccount, ROLE_LABEL, toRole, type Role } from "@/lib/permissions";

// Estas acciones devuelven { error } en vez de lanzar, porque la UI lo muestra en un toast.
// Supervisores: aceptan/rechazan usuarios y editan su nombre y cargo.
// Administrador: además roles, borrar cuentas y configuración.
async function staffOrNull(): Promise<SessionUser | null> {
  try { return await requireSupervisor(); } catch { return null; }
}
async function adminOrNull(): Promise<SessionUser | null> {
  try { return await requireAdmin(); } catch { return null; }
}

type Target = { id: string; email: string; nombre: string | null; role: Role };

async function getTarget(userId: string): Promise<Target | null> {
  if (typeof userId !== 'string' || !userId) return null;
  const { data } = await createAdminClient().from("perfiles").select("id, email, nombre, role").eq("id", userId).maybeSingle();
  return data ? { ...data, role: toRole(data.role) } as Target : null;
}

// El actor puede gestionar esa cuenta (y nunca la suya: evita quitarse el acceso por error)
async function authorize(actor: SessionUser | null, userId: string): Promise<{ ok: true; target: Target } | { ok: false; error: string }> {
  if (!actor) return { ok: false, error: "No autorizado" };
  const target = await getTarget(userId);
  if (!target) return { ok: false, error: "El usuario no existe" };
  if (target.id === actor.id) return { ok: false, error: "No puedes modificar tu propia cuenta desde aquí" };
  if (!canManageAccount(actor.role, target.role)) return { ok: false, error: "Solo el administrador puede gestionar cuentas de supervisores y administradores" };
  return { ok: true, target };
}

async function logUserChange(actor: SessionUser, target: Target, descripcion: string, cambios: object, tipo: 'edicion' | 'eliminacion' = 'edicion') {
  await logAudit({
    tipo_evento: tipo,
    actor,
    entidad: 'usuario',
    entidad_id: target.id,
    nombre_referencia: target.nombre ? `${target.nombre} (${target.email})` : target.email,
    descripcion,
    detalles_extra: { cambios },
  });
}

export async function fetchAllUsers() {
  const actor = await staffOrNull();
  if (!actor) return { error: "No autorizado" };

  const { data, error } = await createAdminClient()
    .from("perfiles")
    .select("id, email, role, status, nombre, cargo, created_at")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { users: data };
}

const STATUS_LABEL = { aprobado: 'Aprobado', pendiente: 'Pendiente', rechazado: 'Rechazado' } as const;

export async function updateUserStatus(userId: string, status: "aprobado" | "pendiente" | "rechazado") {
  const actor = await staffOrNull();
  const auth = await authorize(actor, userId);
  if (!auth.ok) return { error: auth.error };
  if (!(status in STATUS_LABEL)) return { error: "Estado inválido" };

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("perfiles").select("status").eq("id", userId).single();
  const { error } = await supabase.from("perfiles").update({ status }).eq("id", userId);
  if (error) return { error: error.message };

  if (status === "aprobado") {
    try {
      await supabase.auth.admin.updateUserById(userId, { email_confirm: true });
    } catch (err) {
      console.error("Error auto-confirming email:", err);
    }
  }

  const verbo = status === 'aprobado' ? 'Aceptó el acceso' : status === 'rechazado' ? 'Rechazó el acceso' : 'Suspendió el acceso (pendiente)';
  await logUserChange(actor!, auth.target, `${verbo} de la cuenta`, { estado: { antes: before?.status ?? null, despues: status } });
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateUserRole(userId: string, role: Role) {
  const actor = await adminOrNull();
  const auth = await authorize(actor, userId);
  if (!auth.ok) return { error: auth.error };
  if (role !== 'administrador' && role !== 'supervisor' && role !== 'usuario') return { error: "Rol inválido" };

  const { error } = await createAdminClient().from("perfiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  await logUserChange(actor!, auth.target, `Cambió el rol: ${ROLE_LABEL[auth.target.role]} → ${ROLE_LABEL[role]}`, { rol: { antes: auth.target.role, despues: role } });
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateUserCargo(userId: string, cargo: string | null) {
  const actor = await staffOrNull();
  const auth = await authorize(actor, userId);
  if (!auth.ok) return { error: auth.error };
  const value = typeof cargo === 'string' && cargo.trim() ? cargo.trim().slice(0, 80) : null;

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("perfiles").select("cargo").eq("id", userId).single();
  const { error } = await supabase.from("perfiles").update({ cargo: value }).eq("id", userId);
  if (error) return { error: error.message };

  await logUserChange(actor!, auth.target, `Cambió el cargo: ${before?.cargo || '—'} → ${value || '—'}`, { cargo: { antes: before?.cargo ?? null, despues: value } });
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateUserName(userId: string, nombre: string | null) {
  const actor = await staffOrNull();
  const auth = await authorize(actor, userId);
  if (!auth.ok) return { error: auth.error };
  const value = typeof nombre === 'string' && nombre.trim() ? nombre.trim().slice(0, 80) : null;

  const { error } = await createAdminClient().from("perfiles").update({ nombre: value }).eq("id", userId);
  if (error) return { error: error.message };

  await logUserChange(actor!, auth.target, `Cambió el nombre: ${auth.target.nombre || '—'} → ${value || '—'}`, { nombre: { antes: auth.target.nombre, despues: value } });
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteUserAction(userId: string) {
  const actor = await adminOrNull();
  const auth = await authorize(actor, userId);
  if (!auth.ok) return { error: auth.error };

  const supabaseAdmin = createAdminClient();
  // Se registra antes de borrar: la bitácora conserva quién era
  await logUserChange(actor!, auth.target, `Eliminó permanentemente la cuenta`, { rol: auth.target.role }, 'eliminacion');

  await supabaseAdmin.from("perfiles").delete().eq("id", userId);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

// Nadie ve ni define la contraseña: Supabase le envía al usuario un enlace seguro
export async function sendPasswordResetAction(userId: string) {
  const actor = await staffOrNull();
  const auth = await authorize(actor, userId);
  if (!auth.ok) return { error: auth.error };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const { error } = await createAdminClient().auth.resetPasswordForEmail(auth.target.email, {
    redirectTo: `${origin}/api/auth/confirm?next=/update-password`,
  });
  if (error) return { error: error.message };

  await logUserChange(actor!, auth.target, `Envió un enlace para restablecer la contraseña`, {});
  return { success: true, email: auth.target.email };
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
  const admin = await adminOrNull();
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
  
  await logAudit({
    tipo_evento: 'edicion',
    actor: admin,
    entidad: 'configuracion',
    nombre_referencia: 'Pantalla de inicio de sesión',
    descripcion: `Actualizó la configuración de la pantalla de inicio de sesión${imageFile && imageFile.size > 0 ? ' (nueva imagen de fondo)' : ''}`,
    detalles_extra: { loginTitle: newSettings.loginTitle, registerTitle: newSettings.registerTitle },
  });

  revalidatePath("/login");
  revalidatePath("/register");
  return { success: true, settings: newSettings };
}
