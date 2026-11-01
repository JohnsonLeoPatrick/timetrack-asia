import { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import Link from 'next/link';
import { MapPin, Calendar, Tag } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';
import type { Event } from '@/lib/types';

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const { t } = useLanguage();
  const bounds = useRef<DOMRect | null>(null);
  const reducedMotion = useReducedMotion();
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rotateX = useSpring(tiltX, { stiffness: 240, damping: 28 });
  const rotateY = useSpring(tiltY, { stiffness: 240, damping: 28 });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || e.pointerType !== 'mouse' || !bounds.current) return;
    const rect = bounds.current;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateXValue = ((y - centerY) / centerY) * -4; // degrees max tilt
    const rotateYValue = ((x - centerX) / centerX) * 4;
    tiltX.set(rotateXValue);
    tiltY.set(rotateYValue);
  };

  const resetTilt = () => {
    bounds.current = null;
    tiltX.set(0);
    tiltY.set(0);
  };

  const categories = event.event_categories || [];
  const minPrice = categories.length > 0
    ? Math.min(...categories.map(c => Number(c.base_price)))
    : 0;
  const maxPrice = categories.length > 0
    ? Math.max(...categories.map(c => Number(c.base_price)))
    : 0;

  const statusColor = {
    DRAFT: 'bg-yellow-500/20 text-yellow-700',
    PENDING: 'bg-blue-500/20 text-blue-700',
    APPROVED: 'bg-green-500/20 text-green-700',
    REJECTED: 'bg-red-500/20 text-red-700',
    LIVE: 'bg-brand/20 text-[#4e6500]',
    ONGOING: 'bg-blue-500/20 text-blue-700',
    ENDED: 'bg-slate-100 text-slate-600',
    COMPLETED: 'bg-green-500/20 text-green-700',
    CANCELED: 'bg-red-500/20 text-red-700',
    ARCHIVED: 'bg-purple-500/20 text-purple-500',
  }[event.status] || 'bg-slate-100 text-slate-600';

  return (
    <Link href={`/events/${event.id}`}>
      <motion.div
        onPointerEnter={(e) => {
          if (!reducedMotion && e.pointerType === 'mouse') {
            bounds.current = e.currentTarget.getBoundingClientRect();
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetTilt}
        onPointerCancel={resetTilt}
        style={{
          transformPerspective: 1000,
          rotateX: reducedMotion ? 0 : rotateX,
          rotateY: reducedMotion ? 0 : rotateY,
        }}
        className="group glass rounded-2xl overflow-hidden hover:bg-slate-100 hover:border-brand/35 transition-colors duration-150 h-full"
      >
        <div className="aspect-[16/9] relative overflow-hidden bg-slate-100">
          {event.cover_image ? (
            <img
              src={event.cover_image}
              alt={event.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand/10 to-transparent">
              <Tag size={32} className="text-slate-600" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <span className={`text-xs font-semibold normal-case tracking-normal px-2.5 py-1 rounded-full ${statusColor}`}>
              {event.status}
            </span>
          </div>
        </div>

        <div className="p-5">
          <h3 className="text-base font-display font-semibold normal-case tracking-tight text-slate-900 mb-3 line-clamp-2 group-hover:text-[#4e6500] transition-colors">
            {event.title}
          </h3>

          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-2 text-xs font-bold normal-case tracking-normal text-slate-600">
              <MapPin size={10} />
              <span>{event.venue_name || event.city || 'TBA'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold normal-case tracking-normal text-slate-600">
              <Calendar size={10} />
              <span>{new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-300">
            <span className="text-xs font-semibold tracking-tight">
              {minPrice === 0 && maxPrice === 0
                ? 'FREE'
                : `RM${minPrice}${maxPrice > minPrice ? ` - RM${maxPrice}` : ''}`}
            </span>
            <span className="text-xs font-semibold normal-case tracking-normal text-[#4e6500] flex items-center gap-1">
              {event.status === 'LIVE' ? t('card.reg_now') : t('card.reg_closed')}
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
