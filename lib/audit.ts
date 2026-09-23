"use server";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!; // Service Role Key para poder insertar sin restricciones de RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export type TipoEventoAuditoria = 'acceso_fallido' | 'inicio_sesion' | 'cierre_sesion' | 'edicion' | 'eliminacion' | 'alerta_sistema';

interface AuditParams {
  tipo_evento: TipoEventoAuditoria;
  usuario_id?: string | null;
  nombre_referencia: string;
  descripcion: string;
  detalles_extra?: object;
}

export async function logAudit({ tipo_evento, usuario_id, nombre_referencia, descripcion, detalles_extra = {} }: AuditParams) {
  try {
    const headersList = await headers();
    
    // Obtener IP
    let ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'IP desconocida';
    if (ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    // Obtener User-Agent
    const userAgentStr = headersList.get('user-agent') || '';
    const parser = new UAParser(userAgentStr);
    const result = parser.getResult();
    
    const dispositivoTipo = result.device.type || (result.os.name === 'iOS' || result.os.name === 'Android' ? 'Móvil' : 'PC');
    const dispositivoModelo = result.device.model || result.device.vendor || result.browser.name || 'Desconocido';
    const os = result.os.name || '';
    
    const dispositivo = `${dispositivoTipo} ${dispositivoModelo} ${os}`.trim();

    // Obtener ubicación (Aprovechar headers de Vercel si existen)
    const city = headersList.get('x-vercel-ip-city') || '';
    const country = headersList.get('x-vercel-ip-country') || '';
    const region = headersList.get('x-vercel-ip-country-region') || '';
    
    let ubicacion = 'Ubicación Desconocida';
    // Decodificar los headers de Vercel que vienen url-encoded
    if (city && country) {
      try { ubicacion = `${decodeURIComponent(city)} (${decodeURIComponent(region || country)})`; } catch (e) {}
    }

    // Insertar en Supabase
    await supabaseAdmin.from('registros_auditoria').insert([{
      tipo_evento,
      usuario_id: usuario_id || null,
      nombre_referencia,
      descripcion,
      detalles_extra,
      ip,
      ubicacion,
      dispositivo
    }]);

  } catch (error) {
    console.error("Error al registrar auditoría:", error);
    // No queremos que un fallo en el log rompa la app, así que lo atrapamos silenciosamente.
  }
}

export async function getAuditLogs() {
  const { data, error } = await supabaseAdmin
    .from('registros_auditoria')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(500); // Limitar a 500 para rendimiento en panel

  if (error) {
    console.error("Error obteniendo logs de auditoría:", error);
    return [];
  }
  return data || [];
}
