'use client';

import { useState } from 'react';
import { SHIRT_SIZES, DEFAULT_SHIRT_SIZES } from '@/lib/runner-checkout';
import { updateCategoryShirtsAction } from '@/lib/server/actions/event.actions';

export function CategoryShirts({ category, saved }: { category: { id: string; event_id: string; name: string; event_tee_sizes?: string[]; finisher_tee_sizes?: string[] }; saved: () => void }) {
  const [eventSizes, setEventSizes] = useState(category.event_tee_sizes ?? DEFAULT_SHIRT_SIZES);
  const [finisherSizes, setFinisherSizes] = useState(category.finisher_tee_sizes ?? []);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  return <details className="rounded-xl border border-slate-300 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">{category.name}: shirt eligibility and sizes</summary><form className="mt-4 space-y-4" onSubmit={async event => { event.preventDefault(); setBusy(true); setMessage(''); try { await updateCategoryShirtsAction(category.event_id, category.id, { event_tee_sizes: eventSizes, finisher_tee_sizes: finisherSizes }); setMessage('Shirt options saved.'); saved(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save shirt options'); } finally { setBusy(false); } }}>
    <p className="text-sm text-slate-600">Select available sizes for each included shirt. Clear every size to exclude that shirt from this category.</p>
    {([['Event T-Shirt', eventSizes, setEventSizes], ['Finisher Tee', finisherSizes, setFinisherSizes]] as const).map(([label, sizes, setSizes]) => <fieldset key={label}><legend className="mb-2 text-sm font-semibold">{label}</legend><div className="flex flex-wrap gap-4">{SHIRT_SIZES.map(size => <label key={size} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={sizes.includes(size)} onChange={event => setSizes(previous => event.target.checked ? [...previous, size] : previous.filter(value => value !== size))} />{size}</label>)}</div></fieldset>)}
    <button className="btn-secondary" disabled={busy}>{busy ? 'Saving…' : 'Save shirt options'}</button>{message && <p role="status" className="text-sm">{message}</p>}
  </form></details>;
}
