import { useState, useRef } from 'react';
import Link from 'next/link';
import { MapPin, Calendar, Tag } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';
import type { Event } from '@/lib/types';

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const { t } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateXValue = ((y - centerY) / centerY) * -12; // degrees max tilt
    const rotateYValue = ((x - centerX) / centerX) * 12;
    setRotateX(rotateXValue);
    setRotateY(rotateYValue);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  const categories = event.event_categories || [];
  const minPrice = categories.length > 0
    ? Math.min(...categories.map(c => Number(c.base_price)))
    : 0;
  const maxPrice = categories.length > 0
    ? Math.max(...categories.map(c => Number(c.base_price)))
    : 0;

  const statusColor = {
    DRAFT: 'bg-yellow-500/20 text-yellow-500',
    PENDING: 'bg-blue-500/20 text-blue-500',
    APPROVED: 'bg-green-500/20 text-green-500',
    REJECTED: 'bg-red-500/20 text-red-500',
    LIVE: 'bg-brand/20 text-brand',
    ENDED: 'bg-white/10 text-white/50',
    COMPLETED: 'bg-green-500/20 text-green-500',
  }[event.status] || 'bg-white/10 text-white/50';

  return (
    <Link href={`/events/${event.id}`}>
      <div 
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`,
          transition: 'transform 0.1s ease-out, box-shadow 0.1s ease-out',
        }}
        className="group glass rounded-2xl overflow-hidden hover:bg-white/[0.07] hover:border-brand/35 hover:shadow-[0_20px_50px_rgba(204,255,0,0.15)] transition-all h-full"
      >
        <div className="aspect-[16/9] relative overflow-hidden bg-white/5">
          {event.cover_image ? (
            <img
              src={event.cover_image}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand/10 to-transparent">
              <Tag size={32} className="text-white/10" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${statusColor}`}>
              {event.status}
            </span>
          </div>
        </div>

        <div className="p-5">
          <h3 className="text-base font-display font-black uppercase tracking-tighter text-white mb-3 line-clamp-2 group-hover:text-brand transition-colors">
            {event.title}
          </h3>

          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
              <MapPin size={10} />
              <span>{event.venue_name || event.city || 'TBA'}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
              <Calendar size={10} />
              <span>{new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <span className="text-xs font-black tracking-tight">
              {minPrice === 0 && maxPrice === 0
                ? 'FREE'
                : `RM${minPrice}${maxPrice > minPrice ? ` - RM${maxPrice}` : ''}`}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-brand group-hover:gap-2 transition-all flex items-center gap-1">
              {event.status === 'LIVE' ? t('card.reg_now') : t('card.reg_closed')}
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
