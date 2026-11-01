'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AuthUser, Role } from '@/lib/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

async function readProfile(sb: ReturnType<typeof createSupabaseBrowserClient>, identity: Pick<SupabaseUser, 'id' | 'email'>): Promise<AuthUser> {
  const { data, error } = await sb.from('users').select('role, status, deleted_at, username, first_name, last_name, phone, avatar_url').eq('id', identity.id).single();
  if (error) throw new Error(error.message);
  if (!data || data.status !== 'ACTIVE' || data.deleted_at) throw new Error('Account is inactive');
  return { id: identity.id, email: identity.email || '', role: data.role as Role, username: data.username, firstName: data.first_name, lastName: data.last_name, phone: data.phone, status: data.status, avatarUrl: data.avatar_url };
}

export function useSupabaseAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);

  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      try {
        supabaseRef.current = createSupabaseBrowserClient();
      } catch {
        return null;
      }
    }
    return supabaseRef.current;
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    let active = true;
    const syncUser = async (identity: SupabaseUser | null) => {
      try {
        const profile = identity ? await readProfile(supabase, identity) : null;
        if (active) setUser(profile);
      } catch { if (active) setUser(null); }
      finally { if (active) setLoading(false); }
    };
    void supabase.auth.getUser().then(({ data }) => syncUser(data?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Leave the Auth callback before querying PostgREST to avoid an auth lock.
      setTimeout(() => { if (active) void syncUser(session?.user || null); }, 0);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, [getSupabase, router]);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase client not available');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data?.user) {
      const profile = await readProfile(sb, data.user);
      setUser(profile);
      data.user.app_metadata = { ...data.user.app_metadata, role: profile.role };
    }

    router.refresh();
    return data?.user;
  }, [getSupabase, router]);

  const signUp = useCallback(async (email: string, password: string, metadata?: Record<string, unknown>) => {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase client not available');
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) throw error;
  }, [getSupabase]);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase client not available');
    await sb.auth.signOut();
    setUser(null);
    router.refresh();
    router.push('/');
  }, [getSupabase, router]);

  return { user, loading, signIn, signUp, signOut };
}
