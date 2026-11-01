import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import QRCode from 'qrcode';
import { ownedRegistration, confirmedPayment, ticketToken } from '@/lib/server/tickets';
import { PrintButton } from '@/components/events/print-button';

export default function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="pt-32 px-6" role="status">Loading race entry…</p>}><Entry params={params} /></Suspense>;
}

async function Entry({ params }: { params: Promise<{ id: string }> }) {
  const registration = await ownedRegistration((await params).id);
  const payment = confirmedPayment(registration);
  const valid = !!payment || (registration.status === 'PAID' && Number(registration.net_amount) === 0);
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new Error('Site URL is missing');
  const tickets = await Promise.all((registration.participants || []).filter((person) => !person.deleted_at).map(async (person) => ({ ...person,
    qr: valid ? await QRCode.toDataURL(`${origin}/tickets/verify?token=${encodeURIComponent(ticketToken(person.id))}`, { width: 280, margin: 4, errorCorrectionLevel: 'M' }) : null,
  })));
  return <main className="mx-auto min-h-screen max-w-3xl px-5 pb-16 pt-28">
    <Link href="/profile" className="mb-5 inline-flex min-h-11 items-center text-sm underline print:hidden">Back to your entries</Link>
    <header className="relative overflow-hidden bg-slate-950 p-8 text-white">
      {registration.events?.cover_image && <Image unoptimized fill src={registration.events.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
      <div className="relative"><p className="text-sm">{registration.status === 'PAID' ? 'Your race entry' : registration.status}</p><h1 className="mt-3 text-3xl font-semibold">{registration.events?.title}</h1><p className="mt-4 break-all text-sm">Registration ID: {registration.registration_number || registration.id}</p></div>
    </header>
    {!valid && <p className="mt-5 border border-amber-300 p-4">QR tickets become available after payment is confirmed. Refunded and cancelled entries are not valid.</p>}
    {payment?.metadata?.is_test === true && <p className="mt-5 border border-amber-300 p-4 text-amber-900">Test payment — these are sandbox tickets.</p>}
    <div className="mt-6 grid gap-5 sm:grid-cols-2">{tickets.map(person => <article key={person.id} className="break-inside-avoid border border-slate-300 bg-white p-5"><h2 className="text-lg font-semibold">{person.full_name}</h2><p className="mt-2 break-all text-xs text-slate-600">Unique participant ID: {person.id}</p>{person.bib_number && <p className="mt-2 font-medium">Bib: {person.bib_number}</p>}{person.qr && <Image unoptimized src={person.qr} width={280} height={280} alt={`Entry QR code for ${person.full_name}`} className="mx-auto mt-4 h-auto w-full max-w-[280px]" />}</article>)}</div>
    <div className="mt-6 flex flex-wrap gap-3 print:hidden">{valid && <PrintButton />}{payment && <Link className="btn-secondary" href={`/profile/registrations/${registration.id}/invoice`}>Print paid invoice</Link>}</div>
  </main>;
}
