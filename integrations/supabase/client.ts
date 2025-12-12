import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const normalizeSupabaseUrl = (url: string | undefined) => {
    if (!url) return undefined;
    let u = url.trim();
    if (!u) return undefined;

    if (!/^https?:\/\//i.test(u)) {
        u = `https://${u}`;
    }

    u = u.replace(/^http:\/\//i, 'https://');
    u = u.replace(/\/(rest|auth|realtime)\/v1.*$/i, '');
    u = u.replace(/\/+$/g, '');
    return u;
};

export const resolvedSupabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
export const isSupabaseConfigured = !!resolvedSupabaseUrl && !!supabaseAnonKey;

export const supabase: SupabaseClient | null = isSupabaseConfigured
    ? createClient(resolvedSupabaseUrl as string, supabaseAnonKey as string)
    : null;
