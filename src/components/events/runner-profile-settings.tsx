'use client';

import { useState } from 'react';
import { clearRunnerDataAction } from '@/lib/server/actions/runner-profile.actions';

export function RunnerProfileSettings() {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  return <section className="mt-6 rounded-xl border border-slate-300 p-5"><h2 className="font-semibold">Saved registration details</h2><p className="mt-2 text-sm text-slate-600">Review and edit saved personal, emergency contact, and billing details during checkout. Select the save checkbox to update your profile. Medical information and event agreements are always collected separately.</p><button type="button" disabled={busy} className="btn-secondary mt-4" onClick={async () => { setBusy(true); try { await clearRunnerDataAction(); setMessage('Saved profile and checkout drafts removed. Existing entries are unchanged.'); } catch { setMessage('Could not remove saved details. Please retry.'); } finally { setBusy(false); } }}>Remove saved details and drafts</button><p role="status" className="mt-2 text-sm">{message}</p></section>;
}
