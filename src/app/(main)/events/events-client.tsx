'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Compass, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';
import { EventCard } from '@/components/events/event-card';

interface EventsClientProps {
  initialEvents: any[];
}

export default function EventsClient({ initialEvents }: EventsClientProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const categories = ['ALL', ...Array.from(new Set((initialEvents || []).flatMap((e: any) => (e.event_categories || []).map((c: any) => c.name.toUpperCase()))))];

  const filtered = (initialEvents || []).filter((event) => {
    const q = search.toLowerCase();
    const matchesSearch = !search ||
      event.title.toLowerCase().includes(q) ||
      event.venue_name?.toLowerCase().includes(q) ||
      event.city?.toLowerCase().includes(q);

    const matchesCategory = selectedCategory === 'ALL' ||
      event.event_categories?.some((c: any) => c.name.toUpperCase() === selectedCategory);

    const now = new Date();
    const isOpen = new Date(event.registration_open) <= now && now <= new Date(event.registration_close);
    const matchesStatus = statusFilter === 'ALL' ||
      (statusFilter === 'OPEN' && isOpen) ||
      (statusFilter === 'CLOSED' && !isOpen);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="pt-32 pb-24 px-6 min-h-screen bg-black text-white relative">
      <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-brand/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-4"
          >
            <Compass size={12} className="text-brand" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Explore Challenges</span>
          </motion.div>
          
          <h1 className="text-5xl md:text-8xl font-display font-black uppercase tracking-tighter mb-4">
            <span className="text-white">THE </span>
            <span className="text-brand">EVENTS</span>
          </h1>
          <p className="text-xs md:text-sm text-white/30 font-bold uppercase tracking-widest max-w-lg mx-auto">
            {t('events_page.desc')}
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-12 glass p-4 rounded-3xl border-white/5">
          <div className="relative w-full md:max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('events.search_placeholder')}
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

          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/70 outline-none focus:border-brand/50 cursor-pointer"
            >
              <option value="ALL" className="bg-black text-white">All Statuses</option>
              <option value="OPEN" className="bg-black text-white">Registration Open</option>
              <option value="CLOSED" className="bg-black text-white">Registration Closed</option>
            </select>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              {categories.slice(0, 5).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedCategory === cat
                      ? 'bg-brand text-black font-black'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-32 glass rounded-3xl border-white/5 p-12">
            <ShieldAlert size={40} className="mx-auto text-brand mb-4 opacity-50" />
            <p className="text-xs font-black uppercase tracking-widest text-white/20 mb-6">
              {t('events.no_found')}
            </p>
            {search && (
              <button onClick={() => setSearch('')} className="btn-secondary text-xs !py-3 !px-6 mx-auto">
                {t('events.reset')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <EventCard event={event} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
