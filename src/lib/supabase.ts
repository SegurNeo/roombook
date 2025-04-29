import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Make sure to use HTTPS
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace('http://', 'https://');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'propertyhub@1.0.0'
    }
  }
});