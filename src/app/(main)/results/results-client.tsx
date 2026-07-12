'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Trophy, Medal, ArrowLeft, Calendar, User, Clock, ShieldAlert, X } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';

interface ResultsClientProps {
  initialEvents: any[];
}

export default function ResultsClient({ initialEvents }: ResultsClientProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedEventTitle, setSelectedEventTitle] = useState<string>('');
  const [selectedEventDate, setSelectedEventDate] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);
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
        .from('results')
        .select('*, participants(full_name, bib_name, gender, event_categories(name))')
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
      <div className="pt-32 pb-24 px-6 min-h-screen bg-black text-white relative">
        <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-brand/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => { setSelectedEvent(null); setResults([]); setBibSearch(''); }}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-brand mb-8 transition-colors group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Events
          </button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-2 text-white/30 text-[10px] font-bold uppercase tracking-widest">
                <Calendar size={10} />
                <span>{new Date(selectedEventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-display font-black uppercase tracking-tighter text-white">
                {selectedEventTitle}
              </h1>
            </div>

            <div className="relative w-full md:max-w-xs">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/65"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {loadingResults ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 size={32} className="animate-spin text-brand" />
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center py-32 glass rounded-3xl p-12 border-white/5">
              <Trophy size={36} className="mx-auto text-white/10 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest text-white/20">No matching results found</p>
            </div>
          ) : (
            <div className="glass rounded-3xl overflow-hidden border-white/5 shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-white/40">Rank</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-white/40">Athlete</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-white/40">Bib</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-white/40">Category</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-white/40">Time</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-white/40">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredResults.map((r, i) => (
                        <motion.tr
                          key={r.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.03, 0.5) }}
                          className="border-b border-white/5 hover:bg-white/[0.04] transition-colors"
                        >
                          <td className="p-5">
                            <div className="flex items-center gap-2">
                              {r.overall_rank === 1 && <Medal size={16} className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]" />}
                              {r.overall_rank === 2 && <Medal size={16} className="text-gray-400 drop-shadow-[0_0_8px_rgba(156,163,175,0.3)]" />}
                              {r.overall_rank === 3 && <Medal size={16} className="text-amber-700 drop-shadow-[0_0_8px_rgba(180,83,9,0.3)]" />}
                              <span className={`text-sm font-black ${r.overall_rank <= 3 ? 'text-brand' : 'text-white'}`}>
                                {r.overall_rank || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-white">{r.participants?.full_name || r.participants?.bib_name || 'Unknown'}</span>
                              <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">{r.participants?.gender || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="p-5">
                            <span className="text-xs font-mono font-bold bg-white/5 border border-white/10 px-2.5 py-1 rounded text-brand">
                              {r.bib_number}
                            </span>
                          </td>
                          <td className="p-5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                              {r.participants?.event_categories?.name || '-'}
                            </span>
                          </td>
                          <td className="p-5">
                            <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-white">
                              <Clock size={12} className="text-brand/70" />
                              <span>{r.finish_time || r.gun_time || r.chip_time || '-'}</span>
                            </div>
                          </td>
                          <td className="p-5">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                              r.status === 'FINISHED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                              r.status === 'DNF' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                              r.status === 'DNS' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-white/5 text-white/40'
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
    <div className="pt-32 pb-24 px-6 min-h-screen bg-black text-white relative">
      <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-brand/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-4"
          >
            <Trophy size={12} className="text-brand" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Official Leaderboards</span>
          </motion.div>
          
          <h1 className="text-5xl md:text-8xl font-display font-black uppercase tracking-tighter mb-4">
            <span className="text-white">RACE </span>
            <span className="text-brand">RESULTS</span>
          </h1>
          <p className="text-xs md:text-sm text-white/30 font-bold uppercase tracking-widest max-w-lg mx-auto">
            {t('results.desc')}
          </p>
        </div>

        <div className="max-w-md mx-auto mb-12">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/65"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-32 glass rounded-3xl border-white/5 p-12">
            <ShieldAlert size={40} className="mx-auto text-brand mb-4 opacity-50" />
            <p className="text-xs font-black uppercase tracking-widest text-white/20">No results available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((ev) => (
              <motion.button
                key={ev.id}
                onClick={() => loadResults(ev.id, ev.title, ev.event_date)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="glass rounded-3xl p-6 text-left hover:bg-white/[0.06] border-white/10 hover:border-brand/40 transition-all duration-300 group flex flex-col justify-between h-40"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-white/30 uppercase tracking-widest mb-3">
                    <User size={10} className="text-brand/50" />
                    <span>Timed Event</span>
                  </div>
                  <h3 className="text-lg font-display font-black uppercase tracking-tight text-white group-hover:text-brand transition-colors line-clamp-2 leading-tight">
                    {ev.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between w-full pt-4 border-t border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(ev.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand group-hover:translate-x-1.5 transition-transform">
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
