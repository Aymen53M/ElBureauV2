import { createClient, SupabaseClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any)?.env as Record<string, string | undefined> | undefined;
const nodeEnv = (globalThis as any)?.process?.env as Record<string, string | undefined> | undefined;

const supabaseUrl =
    metaEnv?.VITE_SUPABASE_URL ||
    nodeEnv?.VITE_SUPABASE_URL ||
    nodeEnv?.SUPABASE_URL;

const supabaseAnonKey =
    metaEnv?.VITE_SUPABASE_ANON_KEY ||
    metaEnv?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    nodeEnv?.VITE_SUPABASE_ANON_KEY ||
    nodeEnv?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    nodeEnv?.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const supabase: SupabaseClient | null = isSupabaseConfigured
    ? createClient(supabaseUrl as string, supabaseAnonKey as string)
    : null;
