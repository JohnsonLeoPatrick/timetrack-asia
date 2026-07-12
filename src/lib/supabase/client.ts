import { createBrowserClient } from '@supabase/ssr';
import { createLocalSupabaseClient } from './local-db';

export function createSupabaseBrowserClient() {
  const useLocal = process.env.NEXT_PUBLIC_USE_LOCAL_BACKEND === 'true' || process.env.USE_LOCAL_BACKEND === 'true';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (useLocal || !url || !anonKey) {
    return createLocalSupabaseClient();
  }
  return createBrowserClient(url, anonKey);
}
