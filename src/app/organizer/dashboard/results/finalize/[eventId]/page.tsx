'use client';

import { Suspense, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, Loader2, ArrowLeft, Trophy, Download } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { finalizeResultsAction, deleteResultAction } from '@/lib/server/actions/result.actions';
import { toast } from 'sonner';
import { DashboardFrame } from '@/components/layout/dashboard-frame';

export default function FinalizeResultsPage() { return <Suspense fallback={<p className="p-8">Loading workspace�</p>}><DashboardFrame variant="organizer" title="Finalize results" description="Manage event results in your organizer workspace."><Content /></DashboardFrame></Suspense>; }
function Content() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [finalizing, setFinalizing] = useState(false);

  const { data: event } = useQuery({
    queryKey: ['event-finalize', eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select('*, event_categories(*)')
        .eq('id', eventId)
        .single();
      return data;
    },
  });

  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ['results-finalize', eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from('results')
        .select('*, participants(full_name, bib_number, gender, event_categories(name))')
        .eq('event_id', eventId)
        .is('deleted_at', null)
        .order('overall_rank', { ascending: true, nullsFirst: false });
      return data || [];
    },
  });

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await finalizeResultsAction(eventId);
      toast.success('Results finalized!');
      refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setFinalizing(false);
    }
  };

  const handleDelete = async (resultId: string) => {
    try {
      await deleteResultAction(resultId);
      toast.success('Result removed');
      refetch();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleExportCSV = () => {
    if (!results || results.length === 0) return;

    const headers = ['Bib #', 'Name', 'Category', 'Gender', 'Status', 'Finish Time', 'Overall Rank', 'Gender Rank', 'Category Rank'];
    const csvRows = results.map((r) => [
      r.bib_number,
      r.participants?.full_name || '',
      r.participants?.event_categories?.name || '',
      r.participants?.gender || '',
      r.status,
      r.finish_time || '',
      r.overall_rank || '',
      r.gender_rank || '',
      r.category_rank || '',
    ].join(','));

    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event?.title || 'results'}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-semibold normal-case tracking-normal text-slate-600 hover:text-slate-600 mb-8 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>

        <div className="flex items-start justify-between mb-10">
          <div>
            <p className="text-xs font-semibold normal-case tracking-[0.3em] text-blue-700 mb-2">Results Management</p>
            <h1 className="text-4xl font-display font-semibold normal-case tracking-tight">{event?.title || 'Loading...'}</h1>
            {event?.results_finalized && (
              <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold normal-case tracking-normal text-green-700">
                <CheckCircle size={12} /> Finalized
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExportCSV} disabled={!results?.length}
              className="btn-secondary text-xs disabled:opacity-30"
            ><Download size={14} /> Export CSV</button>
            {!event?.results_finalized && (
              <button onClick={handleFinalize} disabled={finalizing || !results?.length}
                className="btn-primary text-xs disabled:opacity-30"
              >
                {finalizing ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                {finalizing ? 'Finalizing...' : 'Finalize Results'}
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-700" /></div>
        ) : !results?.length ? (
          <div className="py-20 text-center">
            <p className="text-xs text-slate-600 font-bold normal-case tracking-normal">No results imported yet</p>
            <p className="text-xs text-slate-600 mt-2">Import results from the results dashboard first</p>
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Bib</th>
                  <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Name</th>
                  <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Category</th>
                  <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Status</th>
                  <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Finish Time</th>
                  <th className="text-center p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Overall</th>
                  <th className="text-center p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Gender</th>
                  <th className="text-center p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Category</th>
                  <th className="text-right p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i: number) => (
                  <motion.tr key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-slate-300 hover:bg-slate-100 transition-colors"
                  >
                    <td className="p-4 font-mono text-sm font-bold text-blue-700">{r.bib_number}</td>
                    <td className="p-4 text-sm font-bold">{r.participants?.full_name}</td>
                    <td className="p-4 text-xs text-slate-600">{r.participants?.event_categories?.name}</td>
                    <td className="p-4">
                      <span className={`text-xs font-semibold normal-case tracking-normal ${
                        r.status === 'FINISHED' ? 'text-green-700' : r.status === 'DNF' ? 'text-yellow-700' : r.status === 'DNS' ? 'text-slate-600' : 'text-red-700'
                      }`}>{r.status}</span>
                    </td>
                    <td className="p-4 font-mono text-xs">{r.finish_time || '—'}</td>
                    <td className="p-4 text-center font-mono text-xs font-bold">{r.overall_rank || '—'}</td>
                    <td className="p-4 text-center font-mono text-xs">{r.gender_rank || '—'}</td>
                    <td className="p-4 text-center font-mono text-xs">{r.category_rank || '—'}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleDelete(r.id)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-700 transition-colors"
                      ><XCircle size={14} /></button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
