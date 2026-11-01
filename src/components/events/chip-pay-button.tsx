'use client';

import { useRef, useState } from 'react';
import { ArrowUpRight, Loader2, LockKeyhole } from 'lucide-react';
import { startChipCheckoutAction } from '@/lib/server/actions/chip.actions';

export function ChipPayButton({ registrationId }: { registrationId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  async function pay() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      const { checkoutUrl } = await startChipCheckoutAction(registrationId);
      window.location.assign(checkoutUrl);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to open checkout. Please try again.');
      setBusy(false);
      inFlight.current = false;
    }
  }
  return (
    <div className="mt-4 space-y-3">
      <button type="button" disabled={busy} aria-busy={busy} onClick={pay} className="btn-primary min-h-12 w-full !rounded-none disabled:cursor-wait disabled:opacity-60">
        {busy ? <Loader2 size={17} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <LockKeyhole size={17} aria-hidden="true" />}
        {busy ? 'Opening checkout…' : 'Continue to payment'}
        {!busy && <ArrowUpRight size={17} aria-hidden="true" />}
      </button>
      {busy && <p role="status" className="text-sm text-slate-600">Connecting to CHIP. Keep this page open.</p>}
      {error && <p role="alert" className="border-l-2 border-red-700 pl-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
