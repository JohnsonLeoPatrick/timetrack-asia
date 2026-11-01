export function PageLoading({ label = 'Loading your page' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="min-h-[70dvh] bg-background px-4 pb-16 pt-32 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 text-sm font-medium text-slate-600">{label}</p>
        <div aria-hidden="true" className="loading-bar mb-10 h-1 w-32" />
        <div aria-hidden="true" className="space-y-6">
          <div className="h-9 w-3/5 max-w-sm animate-pulse bg-slate-200" />
          <div className="h-4 w-4/5 max-w-md animate-pulse bg-slate-100" />
          <div className="grid gap-4 pt-4 md:grid-cols-3">
            {[0, 1, 2].map(index => <div key={index} className="min-h-56 space-y-5 border border-slate-200 bg-white p-6">
              <div className="h-5 w-3/5 animate-pulse bg-slate-100" />
              <div className="h-24 animate-pulse bg-slate-100" />
              <div className="h-4 w-4/5 animate-pulse bg-slate-100" />
            </div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
