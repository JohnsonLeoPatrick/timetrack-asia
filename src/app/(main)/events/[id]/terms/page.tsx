import { Suspense } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default function TermsPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="px-6 pt-32">Loading event terms…</p>}><Terms params={params} /></Suspense>;
}

async function Terms({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const { data: event, error } = await client.from('events').select('title, terms_version, terms_and_conditions').eq('id', id).is('deleted_at', null).single();
  if (error || !event) notFound();
  return <main className="mx-auto max-w-3xl px-5 pb-16 pt-32"><h1 className="text-3xl font-semibold">{event.title}: Event Terms &amp; Conditions</h1><p className="mt-3 text-sm text-slate-600">Terms version: {event.terms_version || '1'}</p><p className="mt-6 whitespace-pre-wrap">{event.terms_and_conditions || 'Registration is subject to the selected category, published event rules, and organizer instructions.'}</p><h2 className="mt-8 text-xl font-semibold">Participant Declaration</h2><p className="mt-3">I confirm that participant details are accurate, that each participant is fit to participate or has obtained appropriate medical advice, and that I am authorized to register and provide information on behalf of every participant in this checkout. I consent to the use of emergency and medical information for event safety and emergency assistance.</p><p className="mt-5"><Link className="underline" href="/privacy-policy">Privacy Policy</Link></p><Link className="btn-secondary mt-8" href={`/events/${id}/register`}>Back to registration</Link></main>;
}
