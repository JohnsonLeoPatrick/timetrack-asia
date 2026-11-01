'use client';

import { useState } from 'react';
import Image from 'next/image';
import { uploadEventCover } from '@/lib/server/actions/event-media.actions';

export function EventCoverUpload({ eventId, image, onSaved }: { eventId: string; image?: string | null; onSaved?: () => void }) {
  const [cover, setCover] = useState(image);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <section className="border border-slate-300 bg-white p-5 space-y-4">
    <div><h2 className="text-lg font-semibold">Event cover</h2><p className="mt-1 text-sm text-slate-600">Shown on event listings, your event page, and participants’ race entries. JPEG, PNG, or WebP; up to 4 MB.</p></div>
    {cover && <Image unoptimized width={1920} height={1080} src={cover} alt="Current event cover" className="aspect-video w-full max-w-xl object-cover" />}
    <label className="block text-sm font-medium" htmlFor={`cover-${eventId}`}>Choose a cover image</label>
    <input id={`cover-${eventId}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="block w-full min-h-11 border border-slate-300 p-2 text-sm" onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      setBusy(true); setMessage('Uploading image…');
      try { const form = new FormData(); form.set('eventId', eventId); form.set('image', file); setCover(await uploadEventCover(form)); setMessage('Cover saved.'); onSaved?.(); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Upload failed'); }
      finally { setBusy(false); e.target.value = ''; }
    }} />
    <p role="status" className="text-sm text-slate-700">{message}</p>
  </section>;
}
