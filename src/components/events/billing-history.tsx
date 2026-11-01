'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Check, CreditCard, RefreshCw, TriangleAlert } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { FieldSelect } from '@/components/ui/field-select';

const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
const statuses: Record<string, string> = { SUCCESS: 'Confirmed', PENDING: 'Awaiting payment', PENDING_REVIEW: 'Needs confirmation', FAILED: 'Checkout closed', REFUNDED: 'Refunded' };
type BillingRegistration = { events: { title: string } | { title: string }[] | null };
type BillingPayment = {
  id: string; registration_id: string; amount: number; status: string; payment_gateway: string; created_at: string;
  metadata: { is_test?: boolean } | null;
  registrations: BillingRegistration | BillingRegistration[] | null;
};

export function BillingHistory({ userId }: { userId: string }) {
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ['my-billing', userId, status, page],
    queryFn: async () => {
      let request = createSupabaseBrowserClient().from('payments')
        .select('id, registration_id, amount, status, payment_gateway, metadata, created_at, registrations!inner(athlete_id, registration_number, events(title))', { count: 'exact' })
        .eq('registrations.athlete_id', userId).is('deleted_at', null)
        .order('created_at', { ascending: false }).range(page * 10, page * 10 + 9);
      if (status !== 'ALL') request = request.eq('status', status);
      const { data, error, count } = await request;
      if (error) throw new Error('Your billing history could not be loaded. Please try again.');
      return { records: (data || []) as BillingPayment[], count: count || 0 };
    },
  });

  return <section aria-labelledby="billing-heading" className="space-y-5">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="mb-2 text-sm text-[#4e6500]">Account / Billing</p><h2 id="billing-heading" className="text-2xl font-semibold">Payment activity</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">Track checkout attempts and confirmed payments in one place.</p></div>
      <div className="w-full sm:w-56"><label htmlFor="billing-status" className="label-text">Payment status</label><FieldSelect id="billing-status" label="Filter payment status" value={status} onValueChange={value => { setStatus(value); setPage(0); }} options={[{ value: 'ALL', label: 'All payments' }, ...Object.entries(statuses).map(([value, label]) => ({ value, label }))]} /></div>
    </div>
    {query.error ? <div role="alert" className="border border-red-200 bg-white p-6"><p className="text-red-700">{query.error.message}</p><button onClick={() => query.refetch()} className="btn-secondary mt-4"><RefreshCw size={16} aria-hidden="true" />Try again</button></div> : query.isPending ? <div role="status" className="space-y-3"><span className="sr-only">Loading payment history</span>{[0, 1, 2].map(index => <div key={index} aria-hidden="true" className="h-32 animate-pulse border border-slate-200 bg-white" />)}</div> : !query.data?.records.length ? <div className="border border-slate-300 bg-white px-6 py-12 text-center"><CreditCard size={28} aria-hidden="true" className="mx-auto mb-4 text-slate-500" /><h3 className="text-lg font-medium">{status === 'ALL' ? 'No payments yet' : 'No matching payments'}</h3><p className="mt-2 text-sm text-slate-600">{status === 'ALL' ? 'Your checkout activity will appear here when you register for a paid event.' : 'Choose a different status to see more activity.'}</p></div> : <div className="divide-y divide-slate-200 border border-slate-300 bg-white">
      {query.data.records.map((record) => {
        const registration = Array.isArray(record.registrations) ? record.registrations[0] : record.registrations;
        const event = Array.isArray(registration?.events) ? registration.events[0] : registration?.events;
        const paid = record.status === 'SUCCESS';
        const test = record.metadata?.is_test === true;
        return <article key={record.id} className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1"><div className="mb-3 flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium ${paid ? 'border-[#bac99b] bg-[#f0f4e8] text-[#425a0c]' : 'border-slate-300 bg-slate-50 text-slate-700'}`}>{paid && <Check size={13} aria-hidden="true" />}{statuses[record.status] || record.status}</span>{test && <span className="border border-amber-300 px-2 py-1 text-xs text-amber-900">Test payment</span>}</div><h3 className="break-words text-base font-semibold">{event?.title || 'Event registration'}</h3><p className="mt-1 text-sm text-slate-500">{new Date(record.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })} · {record.payment_gateway}</p></div>
            <p className="text-xl font-semibold tabular-nums">{money(Number(record.amount))}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-slate-100 pt-3"><p className="min-w-0 break-all text-xs text-slate-500">Reference: {record.id}</p>{record.payment_gateway === 'CHIP' && <Link href={`/payments/${record.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#425a0c] hover:underline">{paid ? 'View confirmation' : 'Check payment'}<ArrowUpRight size={16} aria-hidden="true" /></Link>}</div>
          {paid && <Link href={`/profile/registrations/${record.registration_id}/invoice`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline">Print invoice / Save PDF</Link>}
          {record.status === 'PENDING_REVIEW' && <p className="mt-2 flex items-start gap-2 text-sm text-amber-900"><TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />Confirmation is pending. Check this payment before paying again.</p>}
        </article>;
      })}
    </div>}
    {!!query.data?.count && <nav aria-label="Billing history pages" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">{page * 10 + 1}–{Math.min((page + 1) * 10, query.data.count)} of {query.data.count}</p><div className="flex gap-2"><button disabled={page === 0 || query.isFetching} onClick={() => setPage(page - 1)} className="btn-secondary !px-4">Previous</button><button disabled={(page + 1) * 10 >= query.data.count || query.isFetching} onClick={() => setPage(page + 1)} className="btn-secondary !px-4">Next</button></div></nav>}
  </section>;
}
