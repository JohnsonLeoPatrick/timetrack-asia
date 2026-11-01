import { Suspense } from 'react';
import { getPublicEventsCached } from '@/lib/server/actions/event.actions';
import HomeClient from './home-client';

export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
};

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeData />
    </Suspense>
  );
}

async function HomeData() {
  const events = await getPublicEventsCached();
  return <HomeClient initialEvents={events} />;
}

function HomeLoading() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
