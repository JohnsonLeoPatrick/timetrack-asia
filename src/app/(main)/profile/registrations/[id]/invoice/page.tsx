import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ownedRegistration, confirmedPayment } from '@/lib/server/tickets';
import { PrintButton } from '@/components/events/print-button';

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="p-12 pt-32" role="status">Loading invoice…</p>}><Invoice params={params} /></Suspense>;
}

async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const registration = await ownedRegistration((await params).id);
  const payment = confirmedPayment(registration);
  if (!payment) notFound();
  const billing = Array.isArray(registration.billing_details) ? registration.billing_details[0] : registration.billing_details;
  const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
  return <main className="invoice-page mx-auto min-h-screen max-w-3xl px-5 pb-16 pt-28 text-slate-950">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden"><Link href="/profile" className="btn-secondary">Back to account</Link><PrintButton /></div>
    <article className="border border-slate-300 bg-white p-6 sm:p-10 print:border-0 print:p-0">
      <header className="flex flex-wrap justify-between gap-6 border-b border-slate-300 pb-6"><div><p className="text-xl font-semibold">TIME TRACK</p><h1 className="mt-3 text-3xl font-semibold">Paid invoice</h1></div><div className="text-sm"><p className="font-semibold break-all">INV-{registration.registration_number || registration.id}</p><p className="mt-2">{new Date(payment.created_at).toLocaleDateString('en-MY')}</p><p className="mt-2 font-medium">Paid · MYR</p></div></header>
      {payment.metadata?.is_test === true && <p className="my-5 border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">TEST PAYMENT — Sandbox invoice. No real funds collected.</p>}
      <section className="py-6"><h2 className="text-sm font-semibold">Bill to</h2><p className="mt-2">{billing?.first_name || 'Registered participant'}</p><p className="break-all text-sm">{billing?.email}</p><p className="text-sm">{billing?.phone}</p></section>
      <div className="flex justify-between gap-4 border-y border-slate-300 py-5"><div><h2 className="font-semibold">{registration.events?.title}</h2><p className="mt-2 text-sm">{registration.persons_count} participant(s)</p>{registration.participants?.map((person) => <p key={person.id} className="text-sm text-slate-600">{person.full_name}</p>)}</div><p className="shrink-0 font-medium">{money(Number(registration.total_amount))}</p></div>
      <dl className="ml-auto mt-6 max-w-sm space-y-3"><div className="flex justify-between gap-4"><dt>Subtotal</dt><dd>{money(Number(registration.total_amount))}</dd></div><div className="flex justify-between gap-4"><dt>Discount</dt><dd>−{money(Number(registration.discount_amount))}</dd></div><div className="flex justify-between gap-4 border-t border-slate-300 pt-4 text-lg font-semibold"><dt>Total paid</dt><dd>{money(Number(payment.amount))}</dd></div></dl>
      <footer className="mt-10 border-t border-slate-300 pt-5 text-xs text-slate-600"><p className="break-all">Payment reference: {payment.id}</p><p className="mt-2 break-all">Registration: {registration.id}</p></footer>
    </article>
  </main>;
}
