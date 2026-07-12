'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

interface ResultRow {
  bib_number: string;
  status: string;
  finish_time?: string;
  gun_time?: string;
  chip_time?: string;
  overall_rank?: number;
  gender_rank?: number;
  category_rank?: number;
}

export async function importResultsAction(eventId: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify organizer owns the event
  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id')
    .eq('id', eventId)
    .single();

  if (!event || event.organizer_id !== user.id) throw new Error('Forbidden');

  const csvFile = formData.get('file') as File;
  if (!csvFile) throw new Error('No file uploaded');

  const text = await csvFile.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have header + at least one row');

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const results: ResultRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

    results.push({
      bib_number: row.bib_number || row.bib || '',
      status: (row.status || 'FINISHED').toUpperCase(),
      finish_time: row.finish_time || row.time || '',
      gun_time: row.gun_time || '',
      chip_time: row.chip_time || '',
      overall_rank: row.overall_rank || row.rank ? Number(row.overall_rank || row.rank) : undefined,
      gender_rank: row.gender_rank ? Number(row.gender_rank) : undefined,
      category_rank: row.category_rank ? Number(row.category_rank) : undefined,
    });
  }

  // Match bib numbers to participants
  const { data: participants } = await supabase
    .from('participants')
    .select('id, bib_number')
    .in('bib_number', results.map(r => r.bib_number));

  const participantMap = new Map((participants || []).map((p: any) => [p.bib_number, p.id]));

  const inserts = results
    .filter(r => participantMap.has(r.bib_number))
    .map(r => ({
      event_id: eventId,
      participant_id: participantMap.get(r.bib_number)!,
      bib_number: r.bib_number,
      status: r.status,
      finish_time: r.finish_time?.toString() || null,
      gun_time: r.gun_time || null,
      chip_time: r.chip_time || null,
      overall_rank: r.overall_rank || null,
      gender_rank: r.gender_rank || null,
      category_rank: r.category_rank || null,
    }));

  if (inserts.length === 0) throw new Error('No matching participants found');

  // Upsert results
  for (const insert of inserts) {
    await supabase.from('results').upsert(insert, {
      onConflict: 'participant_id',
      ignoreDuplicates: false,
    });
  }

  revalidatePath(`/organizer/dashboard/results`, 'page');
  redirect(`/organizer/dashboard/results?eventId=${eventId}`);
}

export async function finalizeResultsAction(eventId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id')
    .eq('id', eventId)
    .single();

  if (!event || event.organizer_id !== user.id) throw new Error('Forbidden');

  // Calculate ranks
  const { data: results } = await supabase
    .from('results')
    .select('*')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('chip_time', { ascending: true, nullsFirst: false });

  if (results) {
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r.overall_rank) {
        await supabase.from('results').update({ overall_rank: i + 1 }).eq('id', r.id);
      }
    }
  }

  await supabase
    .from('events')
    .update({ results_finalized: true, status: 'COMPLETED' })
    .eq('id', eventId);

  revalidatePath('/organizer/dashboard/results', 'page');
}

export async function deleteResultAction(resultId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: result } = await supabase
    .from('results')
    .select('id, event_id')
    .eq('id', resultId)
    .single();

  if (!result) throw new Error('Result not found');

  const { data: event } = await supabase
    .from('events')
    .select('organizer_id')
    .eq('id', result.event_id)
    .single();

  if (!event || event.organizer_id !== user.id) throw new Error('Forbidden');

  await supabase
    .from('results')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', resultId);

  revalidatePath('/organizer/dashboard/results', 'page');
}
