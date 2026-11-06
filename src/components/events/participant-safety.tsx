'use client';

import { useState } from 'react';
import type { EntryParticipant } from '@/lib/server/tickets';
import { updateParticipantSafetyAction } from '@/lib/server/actions/runner-profile.actions';

export function ParticipantSafety({ person }: { person: EntryParticipant }) {
  const [details, setDetails] = useState({ emergency_name: person.emergency_name || '', emergency_phone: person.emergency_phone || '', emergency_relationship: person.emergency_relationship || '', medical_status: person.medical_status === true, medical_details: person.medical_details || '', medical_acknowledged: false });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return <details className="mt-4 print:hidden"><summary className="cursor-pointer text-sm underline">Review or update safety details</summary>
    <form className="mt-3 space-y-3" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setMessage('');
      try { await updateParticipantSafetyAction(person.id, details); setMessage('Safety details saved.'); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save details'); }
      finally { setBusy(false); }
    }}>
      <p className="text-xs text-slate-600">Updates are available until registration closes.</p>
      {([['emergency_name', 'Emergency contact name'], ['emergency_relationship', 'Relationship'], ['emergency_phone', 'Emergency phone']] as const).map(([field, label]) => <label key={field} className="block text-sm">{label}<input className="input-field" required maxLength={field === 'emergency_name' ? 255 : field === 'emergency_phone' ? 50 : 100} minLength={field === 'emergency_phone' ? 8 : 1} type={field === 'emergency_phone' ? 'tel' : 'text'} value={details[field]} onChange={event => setDetails(previous => ({ ...previous, [field]: event.target.value }))} /></label>)}
      <label className="block text-sm">Existing medical conditions?<select className="input-field" value={details.medical_status ? 'yes' : 'no'} onChange={event => setDetails(previous => ({ ...previous, medical_status: event.target.value === 'yes', medical_details: event.target.value === 'yes' ? previous.medical_details : '' }))}><option value="no">No</option><option value="yes">Yes</option></select></label>
      {details.medical_status && <label className="block text-sm">Medical condition<textarea className="input-field" required maxLength={2000} value={details.medical_details} onChange={event => setDetails(previous => ({ ...previous, medical_details: event.target.value }))} /></label>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={details.medical_acknowledged} onChange={event => setDetails(previous => ({ ...previous, medical_acknowledged: event.target.checked }))} />I confirm this information is accurate and consent to its use for event safety.</label>
      <button className="btn-secondary" disabled={busy}>{busy ? 'Saving…' : 'Save safety details'}</button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  </details>;
}
