'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileDown, Loader2, ArrowLeft } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { importResultsAction } from '@/lib/server/actions/result.actions';
import { toast } from 'sonner';
import { DashboardFrame } from '@/components/layout/dashboard-frame';
import { FieldSelect } from '@/components/ui/field-select';

export default function ImportResultsPage() { return <Suspense fallback={<p className="p-8">Loading workspace�</p>}><DashboardFrame variant="organizer" title="Import results" description="Manage event results in your organizer workspace."><Content /></DashboardFrame></Suspense>; }
function Content() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: events } = useQuery({
    queryKey: ['org-events-import'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from('events')
        .select('id, title, results_finalized')
        .eq('organizer_id', user.id)
        .is('deleted_at', null);
      return data || [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !file) {
      toast.error('Please select an event and a CSV file');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);

      const result = await importResultsAction(selectedEventId, fd);
      toast.success(`Results imported successfully (${result.count} rows)`);
      router.push(`/organizer/dashboard/results/finalize/${selectedEventId}`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-semibold normal-case tracking-normal text-slate-600 hover:text-slate-600 mb-8 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>

        <div className="mb-10">
          <p className="text-xs font-semibold normal-case tracking-[0.3em] text-blue-700 mb-2">Results</p>
          <h1 className="text-4xl font-display font-semibold normal-case tracking-tight">Import Results</h1>
          <p className="text-xs text-slate-600 font-bold normal-case tracking-normal mt-2">
            Upload a CSV file with bib numbers and finish times
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="glass rounded-2xl p-8">
            <label htmlFor="import-event" className="label-text">Select Event</label>
            <div className="mb-6"><FieldSelect id="import-event" label="Select event for result import" value={selectedEventId} onValueChange={setSelectedEventId} options={[{ value: '', label: 'Choose an event...' }, ...(events || []).map((ev) => ({ value: ev.id, label: `${ev.title}${ev.results_finalized ? ' (Finalized)' : ''}`, disabled: ev.results_finalized }))]} /></div>

            <label className="label-text">CSV File</label>
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-blue-500/30 transition-colors">
              {file ? (
                <div>
                  <FileDown size={32} className="mx-auto text-blue-700 mb-4" />
                  <p className="text-sm font-bold">{file.name}</p>
                  <p className="text-xs text-slate-600 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  <button type="button" onClick={() => setFile(null)}
                    className="mt-4 text-xs text-blue-700 hover:underline font-semibold normal-case tracking-normal"
                  >Change file</button>
                </div>
              ) : (
                <div>
                  <Upload size={32} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-xs text-slate-600 font-bold mb-2">Drop CSV file here or click to browse</p>
                  <label className="btn-secondary text-xs cursor-pointer inline-flex">
                    Browse Files
                    <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* CSV Format Guide */}
          <div className="glass rounded-2xl p-8">
            <h2 className="text-sm font-semibold normal-case tracking-normal text-slate-600 mb-4">CSV Format Guide</h2>
            <p className="text-xs text-slate-600 mb-4">Your CSV file should have these columns:</p>
            <div className="bg-slate-100 rounded-xl p-4 font-mono text-xs text-slate-600">
              bib_number,status,finish_time,gun_time,chip_time,overall_rank,gender_rank,category_rank
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-slate-600">
              <div><span className="text-slate-600 font-bold">bib_number</span> - Required. Must match bib numbers in the system.</div>
              <div><span className="text-slate-600 font-bold">status</span> - FINISHED, DNF, DNS, or DQ</div>
              <div><span className="text-slate-600 font-bold">finish_time</span> - e.g., 01:23:45 or 1:23:45.0</div>
              <div><span className="text-slate-600 font-bold">overall_rank</span> - Overall finishing position</div>
            </div>
          </div>

          <button type="submit" disabled={!selectedEventId || !file || submitting}
            className="btn-primary text-sm disabled:opacity-30"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {submitting ? 'Importing...' : 'Import Results'}
          </button>
        </form>
      </div>
    </div>
  );
}
