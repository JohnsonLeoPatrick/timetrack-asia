'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getOrganizerAnalyticsAction } from '@/lib/server/actions/analytics.actions';
import { adminApprovePaymentAction, adminRejectPaymentAction } from '@/lib/server/actions/payment.actions';
import { FieldSelect } from '@/components/ui/field-select';
import { Check, CreditCard, Loader2, RefreshCw } from 'lucide-react';

const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
type PaymentActivity = { id: string; amount: number; status: string; payment_gateway: string; created_at: string; metadata: { is_test?: boolean } | null };

export function OrganizerAnalyticsTab() {
  const query = useQuery({ queryKey: ['organizer-analytics'], queryFn: getOrganizerAnalyticsAction });
  if (query.isPending) return <p role="status">Loading analytics…</p>;
  if (query.error) return <p role="alert">{query.error.message}</p>;
  const data = query.data;
  return <div className="space-y-6">
    <h2 className="text-2xl font-bold">Event analytics</h2>
    <div className="grid gap-4 sm:grid-cols-3">
      {[
        ['Events', data.events.length], ['Registrations', data.totalRegistrations],
        ['Paid revenue', money(data.totalRevenue)],
      ].map(([label, value]) => <div key={label} className="glass rounded-2xl p-6"><p className="text-sm text-slate-600">{label}</p><p className="mt-3 text-3xl font-bold">{value}</p></div>)}
    </div>
    <div className="glass rounded-2xl p-6"><h3 className="mb-4 text-lg font-bold">Your events</h3>
      {!data.events.length ? <p>No events yet. Create an event to start tracking registrations.</p> : data.events.map((event: { id: string; title: string; status: string }) => <div key={event.id} className="flex justify-between gap-4 border-b py-4"><span>{event.title}</span><span>{event.status}</span></div>)}
    </div>
  </div>;
}

export function AdminPaymentsTab() {
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const labels: Record<string, string> = { SUCCESS: 'Confirmed', PENDING: 'Awaiting payment', PENDING_REVIEW: 'Needs confirmation', FAILED: 'Checkout closed', REFUNDED: 'Refunded' };
  const query = useQuery({ queryKey: ['admin-payments', status, page], queryFn: async () => {
    let request = createSupabaseBrowserClient().from('payments').select('id, registration_id, amount, status, payment_gateway, metadata, created_at', { count: 'exact' }).is('deleted_at', null).order('created_at', { ascending: false }).range(page * 20, page * 20 + 19);
    if (status !== 'ALL') request = request.eq('status', status);
    const { data, error, count } = await request;
    if (error) throw new Error('Payment records could not be loaded. Please try again.');
    return { records: (data || []) as PaymentActivity[], count: count || 0 };
  } });
  async function update(id: string, approve: boolean) {
    setBusy(id); setError('');
    try {
      await (approve ? adminApprovePaymentAction(id) : adminRejectPaymentAction(id));
      await Promise.all(['admin-payments', 'admin-stats'].map(key => client.invalidateQueries({ queryKey: [key] })));
    } catch (error) { setError(error instanceof Error ? error.message : 'Payment update failed'); }
    finally { setBusy(null); }
  }
  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-semibold">Payments</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">Review payment activity. CHIP payments update through provider verification.</p></div><div className="w-full sm:w-56"><label htmlFor="admin-payment-filter" className="label-text">Status</label><FieldSelect id="admin-payment-filter" label="Filter payment records" value={status} onValueChange={value => { setStatus(value); setPage(0); }} options={[{ value: 'ALL', label: 'All payments' }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]} /></div></div>
    {(error || query.error) && <div role="alert" className="border border-red-200 bg-white p-4"><p className="text-red-700">{error || query.error?.message}</p>{query.error && <button className="btn-secondary mt-3" onClick={() => query.refetch()}><RefreshCw size={16} aria-hidden="true" />Try again</button>}</div>}
    {query.isPending ? <div role="status" className="space-y-3"><span className="sr-only">Loading payments</span>{[0, 1, 2].map(index => <div aria-hidden="true" key={index} className="h-28 animate-pulse border border-slate-200 bg-white" />)}</div> : !query.error && !query.data?.records.length ? <div className="border border-slate-200 bg-white p-10 text-center"><CreditCard size={28} className="mx-auto mb-3 text-slate-400" aria-hidden="true" /><h3 className="font-medium">No matching payments</h3><p className="mt-2 text-sm text-slate-600">Payment activity appears here when checkout starts.</p></div> : <div className="divide-y divide-slate-200 border border-slate-200 bg-white">
      {query.data?.records.map((payment) => <article key={payment.id} className="grid min-w-0 items-start gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_9rem_11rem_minmax(0,14rem)]">
        <div className="min-w-0"><p className="break-all text-sm font-medium">{payment.id}</p><p className="mt-1 text-sm text-slate-500">{payment.payment_gateway} · {new Date(payment.created_at).toLocaleDateString('en-MY')}</p>{payment.metadata?.is_test === true && <span className="mt-2 inline-block border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">Test payment</span>}</div>
        <p className="text-xl font-semibold tabular-nums">{money(Number(payment.amount))}</p>
        <span className={`inline-flex w-fit items-center gap-1.5 border px-2 py-1 text-xs font-medium ${payment.status === 'SUCCESS' ? 'border-[#bac99b] bg-[#f0f4e8] text-[#425a0c]' : 'border-slate-300 bg-slate-50 text-slate-700'}`}>{payment.status === 'SUCCESS' && <Check size={13} aria-hidden="true" />}{labels[payment.status] || payment.status}</span>
        <div>{payment.payment_gateway === 'CHIP' ? <p className="text-sm leading-relaxed text-slate-500">Provider managed</p> : ['PENDING', 'PENDING_REVIEW'].includes(payment.status) ? <div className="flex flex-wrap gap-2"><button disabled={!!busy} onClick={() => update(payment.id, true)} className="btn-secondary !px-3">{busy === payment.id && <Loader2 size={15} aria-hidden="true" className="animate-spin" />}Approve</button><button disabled={!!busy} onClick={() => update(payment.id, false)} className="btn-secondary !px-3">Reject</button></div> : <span className="text-sm text-slate-500">Review complete</span>}</div>
      </article>)}
    </div>}
    {!!query.data?.count && <nav aria-label="Payment record pages" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{page * 20 + 1}–{Math.min((page + 1) * 20, query.data.count)} of {query.data.count}</p><div className="flex gap-2"><button disabled={page === 0 || query.isFetching} onClick={() => setPage(page - 1)} className="btn-secondary !px-4">Previous</button><button disabled={(page + 1) * 20 >= query.data.count || query.isFetching} onClick={() => setPage(page + 1)} className="btn-secondary !px-4">Next</button></div></nav>}
  </div>;
}
