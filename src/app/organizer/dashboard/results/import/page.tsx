'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileDown, Loader2, ArrowLeft } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { importResultsAction } from '@/lib/server/actions/result.actions';
import { toast } from 'sonner';

export default function ImportResultsPage() {
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

      await importResultsAction(selectedEventId, fd);
      toast.success('Results imported successfully');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white/50 mb-8 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>

        <div className="mb-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 mb-2">Results</p>
          <h1 className="text-4xl font-display font-black uppercase tracking-tighter">Import Results</h1>
          <p className="text-xs text-white/30 font-bold uppercase tracking-widest mt-2">
            Upload a CSV file with bib numbers and finish times
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="glass rounded-2xl p-8">
            <label className="label-text">Select Event</label>
            <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
              required className="input-field mb-6"
            >
              <option value="">Choose an event...</option>
              {(events || []).map((ev: any) => (
                <option key={ev.id} value={ev.id} disabled={ev.results_finalized}>
                  {ev.title} {ev.results_finalized ? '(Finalized)' : ''}
                </option>
              ))}
            </select>

            <label className="label-text">CSV File</label>
            <div className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center hover:border-blue-500/30 transition-colors">
              {file ? (
                <div>
                  <FileDown size={32} className="mx-auto text-blue-500 mb-4" />
                  <p className="text-sm font-bold">{file.name}</p>
                  <p className="text-[10px] text-white/30 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  <button type="button" onClick={() => setFile(null)}
                    className="mt-4 text-[10px] text-blue-500 hover:underline font-black uppercase tracking-widest"
                  >Change file</button>
                </div>
              ) : (
                <div>
                  <Upload size={32} className="mx-auto text-white/20 mb-4" />
                  <p className="text-xs text-white/30 font-bold mb-2">Drop CSV file here or click to browse</p>
                  <label className="btn-secondary text-[10px] cursor-pointer inline-flex">
                    Browse Files
                    <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* CSV Format Guide */}
          <div className="glass rounded-2xl p-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-white/30 mb-4">CSV Format Guide</h2>
            <p className="text-[10px] text-white/40 mb-4">Your CSV file should have these columns:</p>
            <div className="bg-white/5 rounded-xl p-4 font-mono text-[10px] text-white/60">
              bib_number,status,finish_time,gun_time,chip_time,overall_rank,gender_rank,category_rank
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-[10px] text-white/40">
              <div><span className="text-white/60 font-bold">bib_number</span> - Required. Must match bib numbers in the system.</div>
              <div><span className="text-white/60 font-bold">status</span> - FINISHED, DNF, DNS, or DQ</div>
              <div><span className="text-white/60 font-bold">finish_time</span> - e.g., 01:23:45 or 1:23:45.0</div>
              <div><span className="text-white/60 font-bold">overall_rank</span> - Overall finishing position</div>
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
