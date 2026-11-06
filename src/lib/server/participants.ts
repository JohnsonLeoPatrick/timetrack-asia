import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/server/auth/require-role';
import type { ManagedParticipant } from '@/lib/participants';
import { z } from 'zod';

export async function staffEvent(eventId: string) {
  z.string().uuid().parse(eventId);
  const { user, role } = await requireRole(['ORGANIZER', 'ADMIN', 'SUPER_ADMIN']);
  const client = await createSupabaseServerClient();
  const { data: event, error } = await client.from('events').select('id, title, organizer_id')
    .eq('id', eventId).is('deleted_at', null).single();
  if (error || !event || (role === 'ORGANIZER' && event.organizer_id !== user.id)) {
    throw new Error('Event not found or access denied');
  }
  return { client, event, user };
}

export async function eventParticipants(eventId: string) {
  const { client, event } = await staffEvent(eventId);
  const participants: ManagedParticipant[] = [];
  // PostgREST caps individual responses. Fetch every row, with a stable order.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from('participants')
      .select('id, full_name, bib_number, ic_passport, tee_size, finisher_tee_size, registration_id, registrations!inner(event_id, registration_number, status, deleted_at), event_categories!inner(name, event_id)')
      .eq('registrations.event_id', eventId).eq('event_categories.event_id', eventId)
      .is('deleted_at', null).is('registrations.deleted_at', null)
      .order('id').range(offset, offset + 999);
    if (error) throw new Error('Participants could not be loaded');
    for (const row of data || []) {
      const registration = Array.isArray(row.registrations) ? row.registrations[0] : row.registrations;
      const category = Array.isArray(row.event_categories) ? row.event_categories[0] : row.event_categories;
      participants.push({ id: row.id, full_name: row.full_name, bib_number: row.bib_number, tee_size: row.tee_size, finisher_tee_size: row.finisher_tee_size,
        ic_passport: row.ic_passport, registration_id: row.registration_id,
        registration_number: registration.registration_number, status: registration.status,
        category_name: category.name });
    }
    if (!data || data.length < 1000) break;
  }
  return { event: { id: event.id, title: event.title }, participants };
}
