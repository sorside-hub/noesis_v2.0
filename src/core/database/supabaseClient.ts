import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string => {
  const metaEnv = (import.meta as any).env;
  if (metaEnv && metaEnv[key]) {
    return metaEnv[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] || '';
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

let supabaseInstance: SupabaseClient | null = null;

export const isSupabaseConfigured = (): boolean => {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  const url = supabaseUrl.trim().toLowerCase();
  const key = supabaseAnonKey.trim();
  if (!url || !key) return false;
  if (url.includes('placeholder') || url.includes('your_supabase') || key.includes('placeholder')) return false;
  return url.startsWith('http://') || url.startsWith('https://');
};

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabaseInstance;
};

export const supabase = getSupabaseClient();
