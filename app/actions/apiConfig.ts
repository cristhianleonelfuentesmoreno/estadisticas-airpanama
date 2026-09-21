"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Cliente admin para bypassear RLS
const getAdminSupabase = () => {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
};

export type ApiConfig = {
  id: string; // 'flightaware' | 'flightradar24'
  api_key: string;
  is_active: boolean;
};

// Fallback configs from .env.local
const FALLBACK_CONFIGS: Record<string, ApiConfig> = {
  flightaware: {
    id: 'flightaware',
    api_key: process.env.FLIGHTAWARE_API_KEY || '',
    is_active: true
  },
  flightradar24: {
    id: 'flightradar24',
    api_key: process.env.FLIGHTRADAR24_API_KEY || '',
    is_active: true
  }
};

export async function getApiConfigs(): Promise<Record<string, ApiConfig>> {
  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase.from('api_configurations').select('*');
    
    if (error || !data) {
      // Si la tabla no existe o hay error, usar fallback de .env
      return FALLBACK_CONFIGS;
    }

    const configs: Record<string, ApiConfig> = { ...FALLBACK_CONFIGS };
    data.forEach((row) => {
      configs[row.id] = {
        id: row.id,
        api_key: row.api_key,
        is_active: row.is_active
      };
    });

    return configs;
  } catch (error) {
    return FALLBACK_CONFIGS;
  }
}

export async function saveApiConfig(id: string, apiKey: string, isActive: boolean) {
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from('api_configurations')
    .upsert({ 
      id, 
      api_key: apiKey, 
      is_active: isActive,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error("Error saving API config:", error);
    throw new Error(error.message);
  }
  return true;
}
