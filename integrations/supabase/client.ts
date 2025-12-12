import { createClient } from '@supabase/supabase-js';

// Supabase configuration using environment variables
// Note: For Expo, use EXPO_PUBLIC_ prefix in .env file
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bsowkgwvcbzrmctxjzor.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzb3drZ3d2Y2J6cm1jdHhqem9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MTY4NjAsImV4cCI6MjA4MTA5Mjg2MH0.MLzaE8NPieZ1wrVEzNYtN4ssoFHdU2f2auEo7qshIgM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
