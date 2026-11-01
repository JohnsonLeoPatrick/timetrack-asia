'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, Clock3, CreditCard, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { getChipPaymentStatusAction } from '@/lib/server/actions/chip.actions';

const money = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);

export default function PaymentStatusPage() {
  const { id } = useParams<{ id: string }>();
  const reducedMotion = useReducedMotion();
  const [checks, setChecks] = useState(0);
  const query = useQuery({
    queryKey: ['chip-payment', id],
    queryFn: async () => { setChecks(count => count + 1); return getChipPaymentStatusAction(id); },
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: current => {
      const status = current.state.data?.status;
      return !current.state.error && checks < 12 && (!status || ['PENDING', 'PENDING_REVIEW'].includes(status)) ? 5000 : false;
    },
    refetchIntervalInBackground: false,
  });
  const paid = query.data?.status === 'SUCCESS';
  const failed = query.data?.status === 'FAILED';
  const review = query.data?.status === 'PENDING_REVIEW';
  const refunded = query.data?.status === 'REFUNDED';
  const stopped = checks >= 12;
  const heading = query.isPending ? 'Checking your payment' : query.error ? 'Unable to check payment' : paid ? 'You’re all set.' : failed ? 'Checkout closed' : refunded ? 'Payment refunded' : review ? 'Confirmation in progress' : 'Waiting for confirmation';
  const description = query.isPending ? 'We’re checking the latest status with CHIP.' : query.error ? query.error.message : paid ? 'Payment confirmed. Your registration is ready in your account.' : failed ? 'This checkout expired or was cancelled. You can return to your registrations to try again.' : refunded ? 'This payment is marked as refunded. Contact support if you need help.' : review ? 'Your payment needs confirmation. Please do not pay again while we check.' : 'If you completed checkout, confirmation may take a moment. Please do not pay again.';
  const Icon = paid ? Check : failed || query.error ? TriangleAlert : refunded ? CreditCard : Clock3;

  return (
    <div className="min-h-[75dvh] bg-[#f8f9f5] px-4 pb-20 pt-28 sm:px-6 sm:pt-36">
      <div className="mx-auto max-w-2xl">
        <Link href="/profile" className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm text-slate-600 hover:text-slate-950">Account / Billing</Link>
        <section className="border border-slate-300 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-8">
            <span className="flex items-center gap-2 text-sm font-medium"><CreditCard size={17} aria-hidden="true" /> Payment status</span>
            {query.data?.isTest === true && <span className="border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">Test payment</span>}
          </div>
          <div className="px-5 py-10 sm:px-10 sm:py-12">
            <motion.div key={paid ? 'confirmed' : 'waiting'} initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
              className={`mb-6 flex size-16 items-center justify-center border ${paid ? 'border-[#647c26] bg-[#eaf0dc] text-[#425a0c]' : failed || query.error ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-300 bg-slate-50 text-slate-700'}`}>
              {query.isPending ? <Loader2 size={28} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Icon size={30} strokeWidth={1.7} aria-hidden="true" />}
            </motion.div>
            <div role="status" aria-live="polite" aria-atomic="true">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-600">{description}</p>
            </div>
            {query.data && <dl className="mt-8 grid gap-5 border-y border-slate-200 py-5 sm:grid-cols-2">
              <div><dt className="text-sm text-slate-500">Payment total</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{money(query.data.amount)}</dd></div>
              <div><dt className="text-sm text-slate-500">Payment reference</dt><dd className="mt-1 break-all text-sm text-slate-800">{id}</dd></div>
            </dl>}
            {!paid && !failed && !refunded && !query.error && <p className="mt-5 flex items-start gap-2 text-sm text-slate-600"><RefreshCw size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{stopped ? 'Automatic checks paused. You can check again below.' : 'This page checks automatically for about one minute.'}</p>}
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link className="btn-primary min-h-12 !rounded-none text-center" href="/profile">{paid ? 'View my registration' : 'My registrations'}<ArrowRight size={17} aria-hidden="true" /></Link>
              {!paid && !refunded && <button type="button" className="btn-secondary min-h-12 !rounded-none" disabled={query.isFetching} onClick={() => query.refetch()}>
                {query.isFetching ? <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <RefreshCw size={16} aria-hidden="true" />}
                {query.isFetching ? 'Checking…' : 'Check again'}
              </button>}
            </div>
          </div>
          <div className="flex items-start gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 sm:px-8">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>Confirmation comes from CHIP. Need help? <Link className="font-medium text-slate-950 underline underline-offset-4" href="/contact">Contact support</Link> with your payment reference.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
