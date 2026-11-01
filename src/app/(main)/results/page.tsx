import { Suspense } from 'react';
import { getCompletedEventsCached } from '@/lib/server/actions/event.actions';
import ResultsClient from './results-client';

export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
};

export default function ResultsPage() {
  return (
    <Suspense fallback={<ResultsLoading />}>
      <ResultsData />
    </Suspense>
  );
}

async function ResultsData() {
  const events = await getCompletedEventsCached();
  return <ResultsClient initialEvents={events} />;
}

function ResultsLoading() {
  return (
    <div className="pt-32 pb-24 px-6 min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
