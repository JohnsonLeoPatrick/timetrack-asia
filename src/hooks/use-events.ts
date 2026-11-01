'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Event } from '@/lib/types';

export function useEvents(status?: string) {
  return useQuery({
    queryKey: ['events', status],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let query = supabase
        .from('events')
        .select('*, event_categories(*)')
        .is('deleted_at', null)
        .order('event_date', { ascending: true });

      if (status) {
        const statuses = status.split(',');
        query = query.in('status', statuses);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Event[];
    },
    staleTime: 30_000,
  });
}

export function usePublicEvents() {
  return useEvents('LIVE,APPROVED');
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('events')
        .select('*, event_categories(*)')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      if (error) throw error;
      return data as unknown as Event;
    },
    enabled: !!id,
  });
}

export function useOrganizerEvents() {
  return useQuery({
    queryKey: ['organizer-events'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      const { data, error } = await supabase
        .from('events')
        .select('*, event_categories(*)')
        .eq('organizer_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Event[];
    },
    staleTime: 10_000,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventData: Partial<Event> & { categories?: unknown[] }) => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      const { data, error } = await supabase
        .from('events')
        .insert({ ...eventData, organizer_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['organizer-events'] });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['organizer-events'] });
    },
  });
}
