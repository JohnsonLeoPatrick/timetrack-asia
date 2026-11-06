import { z } from 'zod';

export const bibNumberSchema = z.string().trim().max(100, 'Bib numbers must be at most 100 characters')
  .refine(value => value === '' || /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(value), 'Use letters, numbers, and hyphens only')
  .nullable().transform(value => value || null);

export const bibAssignmentSchema = z.object({
  participant_id: z.string().uuid(),
  bib_number: bibNumberSchema,
  expected_bib_number: z.string().max(100).nullable(),
});

export interface ManagedParticipant {
  tee_size?: string | null;
  finisher_tee_size?: string | null;
  id: string;
  full_name: string;
  bib_number: string | null;
  ic_passport: string | null;
  registration_number: string;
  registration_id: string;
  category_name: string;
  status: string;
}

export type BibFilter = 'all' | 'assigned' | 'unassigned';

export function filterParticipants(participants: ManagedParticipant[], search: string, filter: BibFilter) {
  const query = search.trim().toLocaleLowerCase();
  return participants.filter(person =>
    (filter === 'all' || (filter === 'assigned' ? !!person.bib_number : !person.bib_number)) &&
    (!query || [person.full_name, person.ic_passport, person.registration_number, person.bib_number]
      .some(value => value?.toLocaleLowerCase().includes(query))));
}

export function maskIdentity(value: string | null) {
  return value ? `${'•'.repeat(Math.min(8, Math.max(0, value.length - 4)))}${value.slice(-4)}` : 'Not provided';
}

// Printing consumes stored values only. Missing or ambiguous bibs must be fixed first.
export function printableParticipants(participants: ManagedParticipant[]) {
  const seen = new Set<string>();
  for (const person of participants) {
    if (!person.bib_number) throw new Error('Assign bib numbers to all selected participants before printing');
    const key = person.bib_number.trim().toUpperCase();
    if (seen.has(key)) throw new Error('Duplicate bib numbers must be resolved before printing');
    seen.add(key);
  }
  return participants;
}
