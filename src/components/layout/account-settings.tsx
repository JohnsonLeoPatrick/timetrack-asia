'use client';

import { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/use-auth';
import { updateProfileAction } from '@/lib/server/actions/auth.actions';

export function AccountSettings() {
  const { user } = useSupabaseAuth();
  const [editedUsername, setUsername] = useState<string | null>(null);
  const username = editedUsername ?? user?.username ?? '';
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <form className="max-w-2xl space-y-5 border border-slate-300 bg-white p-6" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { const form = new FormData(); form.set('username', username); await updateProfileAction(form); setMessage('Username saved.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save username'); }
    finally { setBusy(false); }
  }}><div><h2 className="text-xl font-semibold">Account settings</h2><p className="mt-2 text-sm text-slate-600">Your username identifies your account. Participant and invoice names remain separate.</p></div><label htmlFor="account-username" className="label-text">Username</label><input id="account-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required pattern="[A-Za-z0-9_]{3,32}" minLength={3} maxLength={32} className="input-field" /><p className="text-sm text-slate-600">3–32 letters, numbers, or underscores.</p><p className="break-all text-sm">{user?.email}</p><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save username'}</button><p role="status" className="text-sm">{message}</p></form>;
}
