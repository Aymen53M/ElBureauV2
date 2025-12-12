import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const supabase: SupabaseClient | null = isSupabaseConfigured
    ? createClient(supabaseUrl as string, supabaseAnonKey as string)
    : null;
