'use client';

import { useState } from 'react';
import { getParticipantSafetyAction } from '@/lib/server/actions/participant.actions';

export function ParticipantMedicalReview({ eventId, participantId }: { eventId: string; participantId: string }) {
  const [details, setDetails] = useState<Awaited<ReturnType<typeof getParticipantSafetyAction>> | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <div className="mt-3"><button type="button" disabled={busy} className="text-sm text-blue-700 underline" onClick={async () => {
    if (details) { setDetails(null); return; }
    setBusy(true); setError('');
    try { setDetails(await getParticipantSafetyAction(eventId, participantId)); }
    catch { setError('Safety details could not be loaded. Please retry.'); }
    finally { setBusy(false); }
  }}>{busy ? 'Loading…' : details ? 'Hide safety details' : 'View safety details'}</button>
    {details && <div className="mt-2 max-w-xs whitespace-normal text-sm"><p>{details.emergency_name || 'No emergency contact'} ({details.emergency_relationship || 'Relationship not recorded'})</p><p>{details.emergency_phone}</p><p className="mt-2">Medical: {details.medical_status === null ? 'Not declared' : details.medical_status ? details.medical_details || 'Details not recorded' : 'No existing conditions'}</p></div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
