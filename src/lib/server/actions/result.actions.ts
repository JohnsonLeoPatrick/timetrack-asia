'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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

/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields, escaped quotes and
 * CRLF line endings — a plain `split(',')` corrupts names/times containing
 * commas or quotes.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
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
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV must have header + at least one row');

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const results: ResultRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });

    const overallRank = row.overall_rank || row.rank;

    results.push({
      bib_number: row.bib_number || row.bib || '',
      status: (row.status || 'FINISHED').toUpperCase(),
      finish_time: row.finish_time || row.time || '',
      gun_time: row.gun_time || '',
      chip_time: row.chip_time || '',
      overall_rank: overallRank ? Number(overallRank) : undefined,
      gender_rank: row.gender_rank ? Number(row.gender_rank) : undefined,
      category_rank: row.category_rank ? Number(row.category_rank) : undefined,
    });
  }

  // Match bib numbers to participants
  const { data: participants, error: participantsError } = await supabase
    .from('participants')
    .select('id, bib_number, registrations!inner(event_id, deleted_at)')
    .eq('registrations.event_id', eventId)
    .is('registrations.deleted_at', null)
    .is('deleted_at', null)
    .in('bib_number', results.map((r) => r.bib_number));

  if (participantsError) throw new Error(participantsError.message);
  if (new Set((participants || []).map((person: { bib_number: string | null }) => person.bib_number)).size !== participants?.length) {
    throw new Error('Resolve duplicate participant bib numbers before importing results');
  }

  const participantMap = new Map((participants || []).map((p) => [p.bib_number, p.id]));

  const inserts = results
    .filter((r) => participantMap.has(r.bib_number))
    .map((r) => ({
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

  // Single batched upsert instead of one round-trip per row.
  const { error: upsertError } = await supabase.from('results').upsert(inserts, {
    onConflict: 'participant_id',
    ignoreDuplicates: false,
  });
  if (upsertError) throw new Error(upsertError.message);

  revalidatePath('/organizer/dashboard', 'layout');
  return { success: true, count: inserts.length };
}

/** Normalise an interval/time string into seconds for comparison. */
function timeToSeconds(value: unknown): number {
  if (!value) return Infinity;
  const parts = String(value).split(':').map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) {
    return parts[0] * 60 + parts[1];
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? Infinity : parsed;
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

  // Load results with the attributes needed to rank by gender and category.
  const { data: results } = await supabase
    .from('results')
    .select('*, participants(gender, category_id)')
    .eq('event_id', eventId)
    .is('deleted_at', null);

  if (results && results.length > 0) {
    const rankable = results
      .filter((r) => !['DNF', 'DNS', 'DQ'].includes(String(r.status || '').toUpperCase()))
      .filter((r) => timeToSeconds(r.chip_time ?? r.gun_time ?? r.finish_time) !== Infinity)
      .sort((a, b) =>
        timeToSeconds(a.chip_time ?? a.gun_time ?? a.finish_time) -
        timeToSeconds(b.chip_time ?? b.gun_time ?? b.finish_time)
      );

    const genderCounters = new Map<string, number>();
    const categoryCounters = new Map<string, number>();

    const updates = rankable.map((r, idx: number) => {
      const overall = idx + 1;

      let genderRank: number | null = null;
      const gender = r.participants?.gender;
      if (gender) {
        genderRank = (genderCounters.get(gender) || 0) + 1;
        genderCounters.set(gender, genderRank);
      }

      let categoryRank: number | null = null;
      const categoryId = r.participants?.category_id;
      if (categoryId) {
        categoryRank = (categoryCounters.get(categoryId) || 0) + 1;
        categoryCounters.set(categoryId, categoryRank);
      }

      const row: Record<string, unknown> = { ...r };
      delete row.participants;
      return { ...row, overall_rank: overall, gender_rank: genderRank, category_rank: categoryRank };
    });

    const { error: updateError } = await supabase
      .from('results')
      .upsert(updates, { onConflict: 'id' });
    if (updateError) throw new Error(updateError.message);
  }

  await supabase
    .from('events')
    .update({ results_finalized: true, status: 'COMPLETED' })
    .eq('id', eventId);

  revalidatePath('/organizer/dashboard', 'layout');
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

  revalidatePath('/organizer/dashboard', 'layout');
}
