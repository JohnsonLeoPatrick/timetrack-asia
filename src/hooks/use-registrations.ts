'use client';

import { useQuery } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Registration } from '@/lib/types';

export function useRegistrations(eventId?: string) {
  return useQuery({
    queryKey: ['registrations', eventId],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('registrations')
        .select('*, events(title, organizer_id), billing_details(*), participants(*)')
        .order('created_at', { ascending: false });

      if (eventId) {
        query = query.eq('event_id', eventId);
      } else {
        query = query.eq('athlete_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Registration[];
    },
    staleTime: 10_000,
  });
}

export function useRegistration(registrationId: string) {
  return useQuery({
    queryKey: ['registration', registrationId],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('registrations')
        .select('*, events(*), billing_details(*), participants(*, event_categories(*))')
        .eq('id', registrationId)
        .single();
      if (error) throw error;
      return data as unknown as Registration;
    },
    enabled: !!registrationId,
  });
}

export function useOrganizerRegistrations(eventId?: string) {
  return useQuery({
    queryKey: ['org-registrations', eventId],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('registrations')
        .select('*, events(title, organizer_id), participants(*), billing_details(*)')
        .order('created_at', { ascending: false });

      if (eventId) {
        query = query.eq('event_id', eventId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter((r) => r.events?.organizer_id === user.id) as unknown as Registration[];
    },
    staleTime: 10_000,
    enabled: !!eventId,
  });
}
