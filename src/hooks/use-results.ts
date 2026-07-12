'use client';

import { useQuery } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Result } from '@/lib/types';

export function useResults(eventId?: string) {
  return useQuery({
    queryKey: ['results', eventId],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();

      let query = supabase
        .from('results')
        .select('*, participants(full_name, bib_number, gender, event_categories(name))')
        .is('deleted_at', null)
        .order('overall_rank', { ascending: true, nullsFirst: false });

      if (eventId) {
        query = query.eq('event_id', eventId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Result[];
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

export function useMyResults() {
  return useQuery({
    queryKey: ['my-results'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user's registrations first
      const { data: regs } = await supabase
        .from('registrations')
        .select('id, event_id')
        .eq('athlete_id', user.id);

      const regIds = (regs || []).map((r: any) => r.id);
      if (regIds.length === 0) return [];

      const { data: participants } = await supabase
        .from('participants')
        .select('id')
        .in('registration_id', regIds);

      const participantIds = (participants || []).map((p: any) => p.id);
      if (participantIds.length === 0) return [];

      const { data, error } = await supabase
        .from('results')
        .select('*, events(title, event_date), participants(full_name, bib_number)')
        .in('participant_id', participantIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}

export function useLeaderboard(eventId: string, categoryName?: string) {
  return useQuery({
    queryKey: ['leaderboard', eventId, categoryName],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();

      let query = supabase
        .from('results')
        .select('*, participants(full_name, bib_number, gender, event_categories(name))')
        .eq('event_id', eventId)
        .not('overall_rank', 'is', null)
        .is('deleted_at', null)
        .order('overall_rank', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      let results = data || [];
      if (categoryName) {
        results = results.filter((r: any) => r.participants?.event_categories?.name === categoryName);
      }

      return results;
    },
    enabled: !!eventId,
    staleTime: 60_000,
  });
}
