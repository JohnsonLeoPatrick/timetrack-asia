import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createLocalSupabaseClient } from './local-db';

export function createSupabasePublicClient() {
  const useLocal = process.env.NEXT_PUBLIC_USE_LOCAL_BACKEND === 'true' || process.env.USE_LOCAL_BACKEND === 'true';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (useLocal) {
    if (process.env.NODE_ENV === 'production') throw new Error('Local backend is disabled in production');
    return createLocalSupabaseClient();
  }
  if (!url || !anonKey) throw new Error('Supabase public configuration is missing');
  return createClient(url, anonKey);
}

export async function createSupabaseServerClient() {
  const useLocal = process.env.NEXT_PUBLIC_USE_LOCAL_BACKEND === 'true' || process.env.USE_LOCAL_BACKEND === 'true';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (useLocal) {
    if (process.env.NODE_ENV === 'production') throw new Error('Local backend is disabled in production');
    return createLocalSupabaseClient();
  }

  if (!url || !anonKey) throw new Error('Supabase public configuration is missing');
  const cookieStore = await cookies();
  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components cannot write cookies; the proxy refreshes sessions.
          }
        },
      },
    }
  );
}

// Privileged client for admin/service-role operations. This bypasses RLS and
// must never fall back to the anon key: a silent downgrade would either fail
// or, worse, act with the caller's identity. Fails loudly if misconfigured.
export async function createSupabaseAdminClient() {
  const useLocal = process.env.NEXT_PUBLIC_USE_LOCAL_BACKEND === 'true' || process.env.USE_LOCAL_BACKEND === 'true';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (useLocal) {
    if (process.env.NODE_ENV === 'production') throw new Error('Local backend is disabled in production');
    return createLocalSupabaseClient();
  }

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server-only secret key is required for privileged operations');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
