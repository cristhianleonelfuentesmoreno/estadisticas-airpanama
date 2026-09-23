"use server";

import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";
import { logAudit } from "@/lib/audit";
import { requireAdmin, requireApprovedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";


const isValidCoord = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;

export async function registrarSesion(lat: number | null, lon: number | null, userAgentStr: string) {
  // El userId sale de la sesión, nunca del cliente (evita suplantar a otro usuario)
  const { id: userId } = await requireApprovedUser();
  const supabaseAdmin = createAdminClient();
  if (!isValidCoord(lat, 90) || !isValidCoord(lon, 180)) {
    lat = null;
    lon = null;
  }
  userAgentStr = String(userAgentStr || '').slice(0, 512);

  const headersList = await headers();
  // Extraer IP de headers estándar (Vercel, proxies, etc.)
  let ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'IP desconocida';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim(); // Si hay multiples, tomar la primera
  }
  
  const parser = new UAParser(userAgentStr);
  const result = parser.getResult();
  
  const dispositivoTipo = result.device.type || (result.os.name === 'iOS' || result.os.name === 'Android' ? 'mobile' : 'desktop');
  const dispositivoModelo = result.device.model || result.device.vendor || result.browser.name || 'Desconocido';
  const sistemaOperativo = `${result.os.name || ''} ${result.os.version || ''}`.trim();
  const navegador = result.browser.name || 'Desconocido';
  
  let ubicacionTexto = lat && lon ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : "Ubicación Desconocida";
  
  if (lat && lon) {
    try {
      // Nominatim requiere User-Agent válido y tiene límite de peticiones.
      const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`, {
        headers: { 'User-Agent': 'AirPanamaApp/1.0' }
      });
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        // Construir algo limpio como "Ciudad, Región"
        const city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.county;
        const state = geoData.address.state || geoData.address.country;
        if (city && state) {
            ubicacionTexto = `${city}, ${state}`;
        } else if (geoData.display_name) {
            ubicacionTexto = geoData.display_name.split(',').slice(0, 2).join(', ');
        }
      }
    } catch (e) {
        console.error("Error reverse geocoding:", e);
    }
  }

  const { data, error } = await supabaseAdmin
    .from('sesiones')
    .insert([{
      user_id: userId,
      dispositivo_tipo: dispositivoTipo,
      dispositivo_modelo: dispositivoModelo,
      sistema_operativo: sistemaOperativo,
      navegador: navegador,
      ip: ip,
      ubicacion_texto: ubicacionTexto,
      latitud: lat,
      longitud: lon,
      estado: 'en_linea'
    }])
    .select('id')
    .single();

  if (error) {
    console.error("Error al registrar sesion:", error);
    return { success: false, error };
  }
  
  // Auditar inicio de sesión
  const { data: perfil } = await supabaseAdmin.from('perfiles').select('nombre, email').eq('id', userId).single();
  const userName = perfil ? (perfil.nombre || perfil.email) : 'Usuario';
  await logAudit({
    tipo_evento: 'inicio_sesion',
    usuario_id: userId,
    nombre_referencia: userName,
    descripcion: 'Acceso concedido vía autenticación.',
  });

  return { success: true, sessionId: data.id };
}

export async function actualizarActividad(sessionId: string) {
  if (!sessionId) return { success: false };
  const { id: userId } = await requireApprovedUser();
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from('sesiones')
    .update({ ultima_actividad: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', userId);
    
  return { success: !error };
}

export async function cerrarSesion(sessionId: string) {
  if (!sessionId) return { success: false };
  const { id: userId } = await requireApprovedUser();
  const supabaseAdmin = createAdminClient();

  // Obtener info para auditoria antes de actualizar (solo sesiones propias)
  const { data: sessionData } = await supabaseAdmin.from('sesiones').select('user_id').eq('id', sessionId).eq('user_id', userId).single();
  if (!sessionData) return { success: false };

  const { error } = await supabaseAdmin
    .from('sesiones')
    .update({ 
      estado: 'desconectado',
      fin_sesion: new Date().toISOString(),
      ultima_actividad: new Date().toISOString()
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (!error && sessionData) {
    const { data: perfil } = await supabaseAdmin.from('perfiles').select('nombre, email').eq('id', sessionData.user_id).single();
    const userName = perfil ? (perfil.nombre || perfil.email) : 'Usuario';
    await logAudit({
      tipo_evento: 'cierre_sesion',
      usuario_id: sessionData.user_id,
      nombre_referencia: userName,
      descripcion: 'Cierre formal y seguro de sesión.',
    });
  }
    
  return { success: !error };
}

// Pública a propósito (se llama antes de tener sesión): solo registra
// un evento fijo y limita el tamaño del texto recibido.
export async function logFailedLogin(email: string) {
  const ref = typeof email === 'string' ? email.trim().slice(0, 254) : '';
  await logAudit({
    tipo_evento: 'acceso_fallido',
    nombre_referencia: ref || 'Intento Anónimo',
    descripcion: 'Credenciales inválidas o acceso bloqueado por política de firewall.',
  });
}

export interface Sesion {
  id: string;
  user_id: string;
  dispositivo_tipo: string | null;
  dispositivo_modelo: string | null;
  sistema_operativo: string | null;
  navegador: string | null;
  ip: string | null;
  ubicacion_texto: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: string;
  inicio_sesion: string;
  ultima_actividad: string;
  fin_sesion: string | null;
}

export type SesionConUsuario = Sesion & {
  user: { nombre: string; email: string; role?: string; cargo?: string | null };
};

export async function getSesionesActivas(): Promise<SesionConUsuario[]> {
  await requireAdmin();
  const supabaseAdmin = createAdminClient();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60000).toISOString();

  const { data: sesiones, error } = await supabaseAdmin
    .from('sesiones')
    .select('*')
    .eq('estado', 'en_linea')
    .gte('ultima_actividad', tenMinutesAgo)
    .order('ultima_actividad', { ascending: false });

  if (error || !sesiones) return [];

  const userIds = [...new Set(sesiones.map(s => s.user_id))];
  const { data: perfiles } = await supabaseAdmin
    .from('perfiles')
    .select('id, nombre, email, role, cargo')
    .in('id', userIds);

  const perfilesMap = new Map((perfiles || []).map(p => [p.id, p]));

  return sesiones.map(s => ({
    ...s,
    user: perfilesMap.get(s.user_id) || { nombre: 'Desconocido', email: '' }
  }));
}

export async function getHistorialSesionesUser(userId: string): Promise<Sesion[]> {
  await requireAdmin();
  const supabaseAdmin = createAdminClient();
  const { data } = await supabaseAdmin
    .from('sesiones')
    .select('*')
    .eq('user_id', userId)
    .order('inicio_sesion', { ascending: false });
    
  return data || [];
}
