import { Suspense } from 'react';
import { getPublicEventsCached } from '@/lib/server/actions/event.actions';
import EventsClient from './events-client';

export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
};

export default function EventsPage() {
  return (
    <Suspense fallback={<EventsLoading />}>
      <EventsData />
    </Suspense>
  );
}

async function EventsData() {
  const events = await getPublicEventsCached();
  return <EventsClient initialEvents={events} />;
}

function EventsLoading() {
  return (
    <div className="pt-32 pb-24 px-6 min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
