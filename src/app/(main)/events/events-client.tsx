'use client';
import type { Event as TimeTrackEvent } from '@/lib/types';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Search, X, Compass } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';
import { EventCard } from '@/components/events/event-card';

interface EventsClientProps {
  initialEvents: TimeTrackEvent[];
}

export default function EventsClient({ initialEvents }: EventsClientProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories = ['ALL', ...Array.from(new Set((initialEvents || []).flatMap((e) => (e.event_categories || []).map((c) => c.name.toUpperCase()))))];

  const filtered = (initialEvents || []).filter((event) => {
    const q = search.toLowerCase();
    const matchesSearch = !search ||
      event.title.toLowerCase().includes(q) ||
      event.venue_name?.toLowerCase().includes(q) ||
      event.city?.toLowerCase().includes(q);

    const matchesCategory = selectedCategory === 'ALL' ||
      event.event_categories?.some((c) => c.name.toUpperCase() === selectedCategory);

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="pt-32 pb-24 px-6 min-h-screen bg-slate-50 text-slate-900 relative">
      <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-brand/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 mb-4"
          >
            <Compass size={12} className="text-[#4e6500]" />
            <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Explore Challenges</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-display font-semibold normal-case tracking-tight mb-4">
            {t('events_page.title')}
          </h1>
          <p className="text-xs md:text-sm text-slate-600 font-bold normal-case tracking-normal max-w-lg mx-auto">
            {t('events_page.desc')}
          </p>
        </div>

        <div className="filter-panel flex flex-col md:flex-row gap-4 items-center justify-between mb-8 glass p-5 rounded-2xl border-slate-300">
          <div className="relative w-full md:max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              aria-label="Search events or locations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('events.search_placeholder')}
              className="input-field pl-12 pr-10 !py-3 !rounded-2xl text-sm"
            />
            {search && (
              <button
                aria-label="Clear event search"
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat}
                aria-pressed={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold normal-case tracking-normal transition-all ${
                  selectedCategory === cat
                    ? 'bg-brand text-black font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-panel text-center glass rounded-2xl border-slate-300" role="status">
            <div className="empty-symbol"><Compass size={32} aria-hidden="true" /></div>
            <h2 className="font-bold text-slate-900">
              {t('events.no_found')}
            </h2>
            <p>{search || selectedCategory !== 'ALL' ? 'Try another event name or location, or clear your filters.' : 'Upcoming events will appear here when registration opens. Check back soon for your next challenge.'}</p>
            {(search || selectedCategory !== 'ALL') && (
              <button onClick={() => { setSearch(''); setSelectedCategory('ALL'); }} className="btn-secondary text-sm !py-3 !px-6 mx-auto">
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
                transition={{ delay: Math.min(i, 5) * 0.03, duration: 0.25 }}
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
