'use client';
import type { Event as TimeTrackEvent, Result } from '@/lib/types';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, Trophy, Medal, ArrowLeft, Calendar, User, Clock, X } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';

interface ResultsClientProps {
  initialEvents: TimeTrackEvent[];
}

export default function ResultsClient({ initialEvents }: ResultsClientProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedEventTitle, setSelectedEventTitle] = useState<string>('');
  const [selectedEventDate, setSelectedEventDate] = useState<string>('');
  const [results, setResults] = useState<(Result & { participants?: { full_name?: string; bib_name?: string; gender?: string; event_categories?: { name?: string } } })[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [bibSearch, setBibSearch] = useState('');

  const filteredEvents = (initialEvents || []).filter(ev =>
    ev.title.toLowerCase().includes(search.toLowerCase()) ||
    ev.venue_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredResults = results.filter(r =>
    !bibSearch ||
    r.bib_number?.toString().toLowerCase().includes(bibSearch.toLowerCase()) ||
    (r.participants?.full_name || '').toLowerCase().includes(bibSearch.toLowerCase())
  );

  const loadResults = async (eventId: string, title: string, date: string) => {
    setSelectedEvent(eventId);
    setSelectedEventTitle(title);
    setSelectedEventDate(date);
    setLoadingResults(true);
    try {
      const supabase = (await import('@/lib/supabase/client')).createSupabaseBrowserClient();
      const { data } = await supabase
        .from('public_results')
        .select('*')
        .eq('event_id', eventId)
        .order('overall_rank', { ascending: true });
      setResults(data || []);
    } catch (err) {
      setResults([]);
    } finally {
      setLoadingResults(false);
    }
  };

  if (selectedEvent) {
    return (
      <div className="pt-32 pb-24 px-6 min-h-screen bg-slate-50 text-slate-900 relative">
        <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-brand/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => { setSelectedEvent(null); setResults([]); setBibSearch(''); }}
            className="flex items-center gap-2 text-xs font-semibold normal-case tracking-normal text-slate-600 hover:text-[#4e6500] mb-8 transition-colors group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Events
          </button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-2 text-slate-600 text-xs font-bold normal-case tracking-normal">
                <Calendar size={10} />
                <span>{new Date(selectedEventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-display font-semibold normal-case tracking-tight text-slate-900">
                {selectedEventTitle}
              </h1>
            </div>

            <div className="relative w-full md:max-w-xs">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={bibSearch}
                onChange={(e) => setBibSearch(e.target.value)}
                placeholder="Search athlete or BIB..."
                className="input-field pl-12 pr-10 !py-3 !rounded-2xl text-sm"
              />
              {bibSearch && (
                <button
                  onClick={() => setBibSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {loadingResults ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 size={32} className="animate-spin text-[#4e6500]" />
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center py-32 glass rounded-3xl p-12 border-slate-300">
              <Trophy size={36} className="mx-auto text-slate-600 mb-4" />
              <p className="text-xs font-semibold normal-case tracking-normal text-slate-600">No matching results found</p>
            </div>
          ) : (
            <div className="glass rounded-3xl overflow-hidden border-slate-300 shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100">
                      <th className="p-5 text-xs font-semibold normal-case tracking-normal text-slate-600">Rank</th>
                      <th className="p-5 text-xs font-semibold normal-case tracking-normal text-slate-600">Athlete</th>
                      <th className="p-5 text-xs font-semibold normal-case tracking-normal text-slate-600">Bib</th>
                      <th className="p-5 text-xs font-semibold normal-case tracking-normal text-slate-600">Category</th>
                      <th className="p-5 text-xs font-semibold normal-case tracking-normal text-slate-600">Time</th>
                      <th className="p-5 text-xs font-semibold normal-case tracking-normal text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredResults.map((r, i) => (
                        <motion.tr
                          key={r.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.03, 0.15) }}
                          className="border-b border-slate-300 hover:bg-slate-100 transition-colors"
                        >
                          <td className="p-5">
                            <div className="flex items-center gap-2">
                              {r.overall_rank === 1 && <Medal size={16} className="text-yellow-700 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]" />}
                              {r.overall_rank === 2 && <Medal size={16} className="text-gray-400 drop-shadow-[0_0_8px_rgba(156,163,175,0.3)]" />}
                              {r.overall_rank === 3 && <Medal size={16} className="text-amber-700 drop-shadow-[0_0_8px_rgba(180,83,9,0.3)]" />}
                              <span className={`text-sm font-semibold ${r.overall_rank !== null && r.overall_rank <= 3 ? 'text-[#4e6500]' : 'text-slate-900'}`}>
                                {r.overall_rank || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-900">{r.participants?.full_name || r.participants?.bib_name || 'Unknown'}</span>
                              <span className="text-xs font-bold text-slate-600 normal-case tracking-wider">{r.participants?.gender || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="p-5">
                            <span className="text-xs font-mono font-bold bg-slate-100 border border-slate-300 px-2.5 py-1 rounded text-[#4e6500]">
                              {r.bib_number}
                            </span>
                          </td>
                          <td className="p-5">
                            <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">
                              {r.participants?.event_categories?.name || '-'}
                            </span>
                          </td>
                          <td className="p-5">
                            <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-slate-900">
                              <Clock size={12} className="text-brand/70" />
                              <span>{r.finish_time || r.gun_time || r.chip_time || '-'}</span>
                            </div>
                          </td>
                          <td className="p-5">
                            <span className={`text-xs font-semibold normal-case tracking-normal px-2.5 py-1 rounded-full ${
                              r.status === 'FINISHED' ? 'bg-green-500/10 text-green-700 border border-green-500/20' :
                              r.status === 'DNF' ? 'bg-red-500/10 text-red-700 border border-red-500/20' :
                              r.status === 'DNS' ? 'bg-yellow-500/10 text-yellow-700 border border-yellow-500/20' : 'bg-slate-100 text-slate-600'
                            }`}>{r.status}</span>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 px-6 min-h-screen bg-white text-slate-900 relative">
      <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-brand/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 mb-4"
          >
            <Trophy size={12} className="text-[#4e6500]" />
            <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Official Leaderboards</span>
          </motion.div>

          <h1 className="text-5xl md:text-8xl font-display font-semibold normal-case tracking-tight mb-4">
            <span className="text-slate-900">RACE </span>
            <span className="text-[#4e6500]">RESULTS</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-600 font-bold normal-case tracking-normal max-w-lg mx-auto">
            {t('results.desc')}
          </p>
        </div>

        <div className="max-w-md mx-auto mb-12">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('results.search')}
              className="input-field pl-12 pr-10 !py-3 !rounded-2xl text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="empty-panel text-center glass rounded-2xl border-slate-300" role="status">
            <div className="empty-symbol"><Trophy size={32} aria-hidden="true" /></div>
            <h2 className="font-bold text-slate-900">No results available yet</h2>
            <p>{search ? 'Try another event name or clear your search to see all published results.' : 'Official times and rankings will appear here after each race. Explore upcoming events while you wait.'}</p>
            {search && <button onClick={() => setSearch('')} className="btn-secondary mx-auto">Clear search</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((ev) => (
              <motion.button
                key={ev.id}
                onClick={() => loadResults(ev.id, ev.title, ev.event_date)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="glass rounded-3xl p-6 text-left hover:bg-slate-100 border-slate-300 hover:border-brand/40 transition-all duration-300 group flex flex-col justify-between h-40"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 normal-case tracking-normal mb-3">
                    <User size={10} className="text-brand/50" />
                    <span>Timed Event</span>
                  </div>
                  <h3 className="text-lg font-display font-semibold normal-case tracking-tight text-slate-900 group-hover:text-[#4e6500] transition-colors line-clamp-2 leading-tight">
                    {ev.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between w-full pt-4 border-t border-slate-300">
                  <span className="text-xs font-semibold normal-case tracking-normal text-slate-600 flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(ev.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-xs font-semibold normal-case tracking-normal text-[#4e6500] group-hover:translate-x-1.5 transition-transform">
                    View →
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
