'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { bibAssignmentSchema } from '@/lib/participants';
import { eventParticipants, staffEvent } from '@/lib/server/participants';
import { parseBibCSV, participantCSV } from '@/lib/participant-csv';

export async function getEventParticipantsAction(eventId: string) {
  return eventParticipants(eventId);
}

export async function getParticipantSafetyAction(eventId: string, participantId: string) {
  const { client } = await staffEvent(eventId);
  const { data, error } = await client.from('participants')
    .select('emergency_name, emergency_phone, emergency_relationship, medical_status, medical_details, medical_acknowledged_at, registrations!inner(event_id, deleted_at)')
    .eq('id', z.uuid().parse(participantId)).eq('registrations.event_id', eventId)
    .is('deleted_at', null).is('registrations.deleted_at', null).single();
  if (error || !data) throw new Error('Participant safety details could not be loaded');
  return { emergency_name: data.emergency_name, emergency_phone: data.emergency_phone,
    emergency_relationship: data.emergency_relationship, medical_status: data.medical_status,
    medical_details: data.medical_details, medical_acknowledged_at: data.medical_acknowledged_at };
}

type MutationResult = { success: true; count: number } | { success: false; error: string };

// Expected validation errors must survive Next.js production error redaction.
async function mutation(work: () => Promise<{ count: number }>): Promise<MutationResult> {
  try { return { success: true, ...await work() }; }
  catch (error) {
    return { success: false, error: error instanceof z.ZodError ? error.issues[0].message
      : error instanceof Error ? error.message : 'Could not update bib assignments' };
  }
}

async function saveAssignments(eventId: string, input: unknown) {
  const assignments = z.array(bibAssignmentSchema).min(1).max(10000).parse(input);
  const { client } = await staffEvent(eventId);
  const { data, error } = await client.rpc('assign_participant_bibs', {
    p_event_id: eventId, p_assignments: assignments,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/organizer/dashboard/events/${eventId}`);
  revalidatePath('/profile');
  return { count: Number(data) };
}

export async function assignParticipantBibsAction(eventId: string, input: unknown) {
  return mutation(() => saveAssignments(eventId, input));
}

export async function generateUnassignedBibsAction(eventId: string, start: number) {
  return mutation(async () => {
    z.number().int().min(1).max(999999999).parse(start);
    const { client } = await staffEvent(eventId);
    const { data, error } = await client.rpc('generate_unassigned_bibs', { p_event_id: eventId, p_start: start });
    if (error) throw new Error(error.message);
    revalidatePath(`/organizer/dashboard/events/${eventId}`);
    return { count: Number(data) };
  });
}

export async function exportEventParticipantsAction(eventId: string) {
  const { participants } = await eventParticipants(eventId);
  return participantCSV(eventId, participants);
}

export async function importParticipantBibsAction(eventId: string, form: FormData) {
  return mutation(async () => {
    await staffEvent(eventId);
    const file = form.get('file');
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.csv') || file.size > 2_000_000) {
      throw new Error('Choose a CSV file of at most 2 MB');
    }
    return saveAssignments(eventId, parseBibCSV(await file.text(), eventId));
  });
}
