'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AuthUser, Role } from '@/lib/types';

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
      setLoading(false);
      return;
    }

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const meta = session.user.user_metadata;
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          role: (meta?.role as Role) || 'ATHLETE',
          firstName: meta?.first_name || meta?.full_name?.split(' ')[0],
          lastName: meta?.last_name || meta?.full_name?.split(' ').slice(1).join(' '),
          phone: meta?.phone,
          status: meta?.status || 'ACTIVE',
          avatarUrl: session.user.user_metadata?.avatar_url,
        });
      }
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) {
        const meta = session.user.user_metadata;
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          role: (meta?.role as Role) || 'ATHLETE',
          firstName: meta?.first_name || meta?.full_name?.split(' ')[0],
          lastName: meta?.last_name || meta?.full_name?.split(' ').slice(1).join(' '),
          phone: meta?.phone,
          status: meta?.status || 'ACTIVE',
          avatarUrl: session.user.user_metadata?.avatar_url,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [getSupabase, router]);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase client not available');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data?.user) {
      const meta = data.user.user_metadata;
      setUser({
        id: data.user.id,
        email: data.user.email || '',
        role: (meta?.role as Role) || 'ATHLETE',
        firstName: meta?.first_name || meta?.full_name?.split(' ')[0],
        lastName: meta?.last_name || meta?.full_name?.split(' ').slice(1).join(' '),
        phone: meta?.phone,
        status: meta?.status || 'ACTIVE',
        avatarUrl: data.user.user_metadata?.avatar_url,
      });
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
