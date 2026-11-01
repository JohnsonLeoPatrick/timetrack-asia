import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { verifyTicketToken, type EntryPayment } from '@/lib/server/tickets';

export default function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <Suspense fallback={<p className="p-10 pt-32">Checking ticket…</p>}><Verify searchParams={searchParams} /></Suspense>;
}

async function Verify({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/tickets/verify?token=${encodeURIComponent(token)}`)}`);
  const id = verifyTicketToken(token);
  if (!id) notFound();
  const { data: profile } = await client.from('users').select('role, status, deleted_at').eq('id', user.id).single();
  if (profile?.status !== 'ACTIVE' || profile.deleted_at) notFound();
  const { data: person, error } = await client.from('participants').select('id, full_name, bib_number, registrations!inner(status, athlete_id, net_amount, events!inner(title, organizer_id), payments(status, metadata, amount, currency, deleted_at))').eq('id', id).is('deleted_at', null).single();
  if (error || !person) notFound();
  const registration = person.registrations as unknown as { athlete_id: string; status: string; net_amount: number; events: { title: string; organizer_id: string }; payments: EntryPayment[] };
  if (registration.athlete_id !== user.id && registration.events?.organizer_id !== user.id && !['ADMIN', 'SUPER_ADMIN'].includes(profile.role)) notFound();
  const payment = registration.payments?.find((p) => !p.deleted_at && p.currency === 'MYR' && p.status === 'SUCCESS' && Number(p.amount) === Number(registration.net_amount));
  const valid = registration.status === 'PAID' && (payment || Number(registration.net_amount) === 0);
  return <main className="mx-auto min-h-screen max-w-lg px-5 pb-16 pt-32"><article className={`border p-6 ${valid ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50'}`}><p className="text-sm font-semibold">Ticket verification</p><h1 className="mt-4 text-2xl font-semibold">{valid ? 'Valid entry' : 'Entry not valid'}</h1>{payment?.metadata?.is_test && <p className="mt-3 font-semibold">SANDBOX / TEST TICKET</p>}<h2 className="mt-5 text-lg">{registration.events?.title}</h2><p className="mt-2">{person.full_name}</p><p className="mt-3 break-all text-sm">Unique ID: {person.id}</p>{person.bib_number && <p className="mt-2">Bib: {person.bib_number}</p>}<p className="mt-5 text-sm">This checks the current registration status. It does not mark attendance.</p></article></main>;
}
