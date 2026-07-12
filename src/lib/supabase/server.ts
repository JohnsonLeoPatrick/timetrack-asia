import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createLocalSupabaseClient } from './local-db';

export function createSupabasePublicClient() {
  const useLocal = process.env.NEXT_PUBLIC_USE_LOCAL_BACKEND === 'true' || process.env.USE_LOCAL_BACKEND === 'true';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (useLocal || !url || !anonKey) {
    return createLocalSupabaseClient();
  }
  return createClient(url, anonKey);
}

export async function createSupabaseServerClient() {
  const useLocal = process.env.NEXT_PUBLIC_USE_LOCAL_BACKEND === 'true' || process.env.USE_LOCAL_BACKEND === 'true';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (useLocal || !url || !anonKey) {
    return createLocalSupabaseClient();
  }

  const cookieStore = await cookies();
  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.delete({ name, ...options });
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

export async function createSupabaseAdminClient() {
  const useLocal = process.env.NEXT_PUBLIC_USE_LOCAL_BACKEND === 'true' || process.env.USE_LOCAL_BACKEND === 'true';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (useLocal || !url) {
    return createLocalSupabaseClient();
  }

  if (!adminKey) {
    console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to ANON_KEY for Supabase Admin client.');
    adminKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  if (!adminKey) {
    return createLocalSupabaseClient();
  }

  const cookieStore = await cookies();
  return createServerClient(
    url,
    adminKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Can be ignored if called from Server Component
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.delete({ name, ...options });
          } catch {
            // Can be ignored if called from Server Component
          }
        },
      },
    }
  );
}
