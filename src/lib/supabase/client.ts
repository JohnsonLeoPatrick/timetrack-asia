import { createBrowserClient } from '@supabase/ssr';
import { createLocalSupabaseClient } from './local-db';

export function createSupabaseBrowserClient() {
  const useLocal = process.env.NEXT_PUBLIC_USE_LOCAL_BACKEND === 'true' || process.env.USE_LOCAL_BACKEND === 'true';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (useLocal) {
    if (process.env.NODE_ENV === 'production') throw new Error('Local backend is disabled in production');
    return createLocalSupabaseClient();
  }
  if (!url || !anonKey) throw new Error('Supabase public configuration is missing');
  return createBrowserClient(url, anonKey);
}
