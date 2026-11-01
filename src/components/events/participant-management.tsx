'use client';

import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { filterParticipants, maskIdentity, type BibFilter, type ManagedParticipant } from '@/lib/participants';
import { assignParticipantBibsAction, exportEventParticipantsAction, generateUnassignedBibsAction,
  getEventParticipantsAction, importParticipantBibsAction } from '@/lib/server/actions/participant.actions';

export function ParticipantManagement({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['event-participants', eventId], queryFn: () => getEventParticipantsAction(eventId), gcTime: 0 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<BibFilter>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<ManagedParticipant | null>(null);
  const [bib, setBib] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [generate, setGenerate] = useState(false);
  const [start, setStart] = useState('1');
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const participants = query.data?.participants || [];
  const visible = filterParticipants(participants, search, filter);
  const assigned = participants.filter(person => person.bib_number).length;
  const printable = visible.filter(person => selected.includes(person.id) && person.bib_number);
  const unassignedSelected = visible.some(person => selected.includes(person.id) && !person.bib_number);

  async function run(work: () => Promise<{ success: true; count: number } | { success: false; error: string }>, message: string) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await work();
      if (!result.success) throw new Error(result.error);
      await queryClient.invalidateQueries({ queryKey: ['event-participants', eventId] });
      await queryClient.invalidateQueries({ queryKey: ['org-registrations', eventId] });
      setEditing(null); setGenerate(false); setImporting(false); setSelected([]);
      toast.success(message);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Could not update bib numbers';
      setError(message); toast.error(message);
    } finally { setBusy(false); }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (editing) void run(() => assignParticipantBibsAction(eventId, [{ participant_id: editing.id,
      bib_number: bib, expected_bib_number: editing.bib_number }]), bib.trim() ? 'Bib number saved' : 'Bib number cleared');
  }

  async function exportCSV() {
    setBusy(true);
    try {
      const csv = await exportEventParticipantsAction(eventId);
      const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `participants-${eventId}.csv`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Participant list exported');
    } catch (failure) { toast.error(failure instanceof Error ? failure.message : 'Export failed'); }
    finally { setBusy(false); }
  }

  if (query.isPending) return <p role="status">Loading participants…</p>;
  if (query.isError) return <div role="alert"><p>{query.error.message}</p><button className="btn-secondary" onClick={() => query.refetch()}>Retry</button></div>;

  return <section className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-60 flex-1 text-sm">Search participants
        <input className="input-field mt-2" placeholder="Name, IC/passport, order number, or bib" value={search} onChange={event => setSearch(event.target.value)} />
      </label>
      <label className="text-sm">Bib status
        <select className="input-field mt-2" value={filter} onChange={event => { setFilter(event.target.value as BibFilter); setSelected([]); }}>
          <option value="all">All participants</option><option value="assigned">Assigned bibs</option><option value="unassigned">Missing bibs</option>
        </select>
      </label>
      <button className="btn-secondary" disabled={busy} onClick={exportCSV}>Export CSV</button>
      <button className="btn-secondary" disabled={busy || query.isFetching} onClick={() => query.refetch()}>Refresh</button>
      <button className="btn-secondary" disabled={busy} onClick={() => { setError(''); setFile(null); setImporting(true); }}>Import bib CSV</button>
      <button className="btn-secondary" disabled={busy || assigned === participants.length} onClick={() => { setError(''); setGenerate(true); }}>Generate unassigned bibs</button>
    </div>
    <p className="text-sm text-slate-600">{visible.length} shown · {assigned} assigned · {participants.length - assigned} missing. IC/passport values are masked.</p>
    <div className="flex flex-wrap items-center gap-3">
      {printable.length > 0 && !unassignedSelected && printable.length <= 200 && <Link className="btn-secondary" target="_blank" href={`/organizer/dashboard/events/${eventId}/bibs/print?participants=${printable.map(person => person.id).join(',')}`}>Print selected ({printable.length})</Link>}
      {unassignedSelected && <p role="status" className="text-sm">Assign bib numbers to every selected participant before printing.</p>}
      {printable.length > 200 && <p role="status" className="text-sm">Select at most 200 participants per print batch.</p>}
      <p className="text-xs text-slate-600">Printing reloads saved bib numbers. Search and filters apply to selection.</p>
    </div>
    {error && !editing && !generate && !importing && <p role="alert" className="text-red-700">{error}</p>}
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead><tr className="border-b border-slate-300">
          <th className="p-4"><input type="checkbox" aria-label="Select all shown participants" checked={visible.length > 0 && visible.every(person => selected.includes(person.id))}
            onChange={event => setSelected(event.target.checked ? visible.map(person => person.id) : [])} /></th>
          {['Order number', 'Participant', 'IC / Passport', 'Category', 'Bib number', 'Status', 'Actions'].map(label => <th key={label} className="p-4">{label}</th>)}
        </tr></thead>
        <tbody>{visible.map(person => <tr key={person.id} className="border-b border-slate-300 hover:bg-slate-100">
          <td className="p-4"><input type="checkbox" aria-label={`Select ${person.full_name}`} checked={selected.includes(person.id)} onChange={event => setSelected(current => event.target.checked ? [...current, person.id] : current.filter(id => id !== person.id))} /></td>
          <td className="p-4 font-mono text-xs">{person.registration_number}</td><td className="p-4 font-semibold">{person.full_name}</td>
          <td className="p-4">{maskIdentity(person.ic_passport)}</td><td className="p-4">{person.category_name}</td>
          <td className="p-4 font-mono">{person.bib_number || <span className="font-sans text-amber-800">Not assigned</span>}</td><td className="p-4">{person.status}</td>
          <td className="p-4"><button className="text-blue-700 underline" disabled={busy} onClick={() => { setEditing(person); setBib(person.bib_number || ''); setError(''); }}>{person.bib_number ? 'Edit bib number' : 'Assign bib number'}</button></td>
        </tr>)}{!visible.length && <tr><td colSpan={8} className="p-8 text-center">No matching participants</td></tr>}</tbody>
      </table>
    </div>
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !busy) setEditing(null); }}>
      <DialogContent showCloseButton={!busy}>
        <DialogTitle>{editing?.bib_number ? 'Edit bib number' : 'Assign bib number'}</DialogTitle>
        <DialogDescription>{editing?.full_name}. Use up to 100 letters, numbers, or hyphens. Leave blank to clear the assignment.</DialogDescription>
        <form onSubmit={save} className="space-y-4">
          <label htmlFor="participant-bib">Bib number</label><input id="participant-bib" className="input-field" maxLength={100} value={bib} onChange={event => setBib(event.target.value)} autoFocus disabled={busy} />
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <div className="flex gap-3"><button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel</button></div>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={generate} onOpenChange={open => { if (!busy) setGenerate(open); }}>
      <DialogContent showCloseButton={!busy}>
        <DialogTitle>Generate unassigned bibs</DialogTitle><DialogDescription>Only participants without bibs receive numbers. Existing assignments remain unchanged. Used numbers are skipped.</DialogDescription>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); void run(() => generateUnassignedBibsAction(eventId, Number(start)), 'Unassigned bib numbers generated'); }}>
          <label htmlFor="bib-start">Starting number</label><input id="bib-start" className="input-field" type="number" min={1} max={999999999} required value={start} onChange={event => setStart(event.target.value)} disabled={busy} />
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <div className="flex gap-3"><button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Generating…' : 'Generate'}</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => setGenerate(false)}>Cancel</button></div>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={importing} onOpenChange={open => { if (!busy) setImporting(open); }}>
      <DialogContent showCloseButton={!busy}>
        <DialogTitle>Import bib assignments</DialogTitle><DialogDescription>Edit bib_number in the exported CSV. Keep event_id, participant_id, and expected_bib_number unchanged. Blank bib_number clears an assignment. Keep bib columns as text to preserve leading zeroes. All rows save together.</DialogDescription>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!file) return; const data = new FormData(); data.set('file', file); void run(() => importParticipantBibsAction(eventId, data), 'Bib assignments imported'); }}>
          <label htmlFor="bib-file">CSV file (maximum 2 MB)</label><input id="bib-file" type="file" accept=".csv,text/csv" required disabled={busy} onChange={event => setFile(event.target.files?.[0] || null)} />
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <div className="flex gap-3"><button type="submit" className="btn-primary" disabled={busy || !file}>{busy ? 'Importing…' : 'Import and save'}</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => setImporting(false)}>Cancel</button></div>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
