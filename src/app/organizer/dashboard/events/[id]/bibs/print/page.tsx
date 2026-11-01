import Link from 'next/link';
import { z } from 'zod';
import { PrintButton } from '@/components/events/print-button';
import { eventParticipants } from '@/lib/server/participants';
import { printableParticipants } from '@/lib/participants';

export default async function BibPrintPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ participants?: string }>;
}) {
  const { id } = await params;
  const { participants: selection } = await searchParams;
  const { event, participants } = await eventParticipants(id);
  const ids = z.array(z.string().uuid()).min(1).max(200).safeParse(selection?.split(','));
  let error = '';
  let selected = participants.filter(person => ids.success && ids.data.includes(person.id));
  if (!ids.success || new Set(ids.data).size !== ids.data.length || selected.length !== ids.data.length) {
    error = 'Choose 1-200 participants from this event before printing.';
  } else {
    try {
      // Also catch legacy duplicates outside the selected batch.
      printableParticipants(participants.filter(person => person.bib_number));
      selected = printableParticipants(selected);
    } catch (failure) { error = failure instanceof Error ? failure.message : 'Bib numbers could not be printed'; }
  }
  return <main className="mx-auto max-w-5xl p-6">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
      <Link href={`/organizer/dashboard/events/${id}?tab=registrations`} className="btn-secondary">Back to participants</Link>
      {!error && <PrintButton />}
    </div>
    <h1 className="text-2xl font-semibold">{event.title} — Bib printing list</h1>
    {error ? <p role="alert" className="mt-6 text-red-700">{error}</p> : <>
      <p className="my-4 text-sm text-slate-600 print:hidden">{selected.length} participant(s). Bib numbers below are the current database assignments.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">{selected.map(person => <article key={person.id} className="break-inside-avoid border border-slate-300 bg-white p-5">
        <p className="text-5xl font-bold tracking-wider">{person.bib_number}</p>
        <h2 className="mt-4 text-lg font-semibold">{person.full_name}</h2>
        <p className="mt-2 text-sm">{person.category_name}</p>
        <p className="mt-2 text-xs text-slate-600">Order: {person.registration_number}</p>
      </article>)}</div>
    </>}
  </main>;
}
