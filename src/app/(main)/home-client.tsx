'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, CalendarCheck, Trophy, ArrowRight, Zap, Target, Star, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';
import { EventCard } from '@/components/events/event-card';
import { Marquee } from '@/components/shared/marquee';

interface HomeClientProps {
  initialEvents: any[];
}

export default function HomeClient({ initialEvents }: HomeClientProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-sans">
      <HeroSection />
      <Marquee text={t('marquee.text')} />
      <StatsSection eventsCount={initialEvents?.length || 0} />
      <FeatureSection />
      <UpcomingEventsSection events={initialEvents} />
      <CTASection />
    </div>
  );
}

function HeroSection() {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[85vh] flex items-center justify-start pb-20 pt-24 px-6 md:px-12">
      <div className="relative z-10 text-left max-w-5xl mx-auto w-full flex flex-col items-start">
        {/* Action Badge */}
        <div className="inline-flex items-center gap-2.5 px-4.5 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 cursor-pointer group">
          <span className="flex h-2 w-2 relative">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/80 group-hover:text-brand transition-colors">
            {t('hero.subtitle')}
          </span>
          <ChevronRight size={10} className="text-white/40" />
        </div>

        {/* Headers */}
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-display font-black uppercase tracking-tighter leading-[0.85] mb-10 text-white">
          {t('hero.title1')}{' '}
          <span className="text-brand">{t('hero.title2')}</span>
          <br />
          {t('hero.title3')}
        </h1>

        {/* Subtext */}
        <p className="text-sm sm:text-base text-white/50 font-medium max-w-xl mb-12 leading-relaxed tracking-wide">
          {t('hero.desc')}
        </p>

        {/* Action Button Grid */}
        <div className="flex flex-col sm:flex-row items-center justify-start gap-4 w-full sm:w-auto">
          <Link href="/events" className="btn-primary text-xs !py-4.5 !px-10 w-full sm:w-auto text-black font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2">
            {t('hero.cta1')}
            <ArrowRight size={14} />
          </Link>
          <Link href="/login" className="btn-secondary text-xs !py-4.5 !px-10 w-full sm:w-auto border-white/10 bg-white/5 text-white font-black uppercase tracking-widest rounded-xl flex items-center justify-center">
            {t('hero.cta2')}
          </Link>
        </div>
      </div>
    </section>
  );
}

function StatsSection({ eventsCount }: { eventsCount: number }) {
  return (
    <section className="py-12 relative z-10">
      <div className="max-w-5xl mx-auto px-6">
        <div className="glass rounded-[2rem] border border-white/10 bg-[#0f0f0f] p-8 md:p-12 relative overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 relative z-10">
            <div className="text-center relative md:after:content-[''] md:after:absolute md:after:right-0 md:after:top-1/4 md:after:h-1/2 md:after:w-[1px] md:after:bg-white/10">
              <h4 className="text-3xl md:text-4xl lg:text-5xl font-display font-black text-brand mb-2">
                {eventsCount || '12'}
              </h4>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Active Events</p>
            </div>
            
            <div className="text-center relative md:after:content-[''] md:after:absolute md:after:right-0 md:after:top-1/4 md:after:h-1/2 md:after:w-[1px] md:after:bg-white/10">
              <h4 className="text-3xl md:text-4xl lg:text-5xl font-display font-black text-white mb-2">
                99.9%
              </h4>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">RFID Precision</p>
            </div>
            
            <div className="text-center relative md:after:content-[''] md:after:absolute md:after:right-0 md:after:top-1/4 md:after:h-1/2 md:after:w-[1px] md:after:bg-white/10">
              <h4 className="text-3xl md:text-4xl lg:text-5xl font-display font-black text-white mb-2">
                15k+
              </h4>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Athletes Registered</p>
            </div>
            
            <div className="text-center">
              <h4 className="text-3xl md:text-4xl lg:text-5xl font-display font-black text-brand mb-2">
                50+
              </h4>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Event Organizers</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureSection() {
  const { t } = useLanguage();

  const features = [
    { 
      icon: Zap, 
      title: t('home.precision'), 
      desc: t('home.precision_desc'), 
      iconBg: 'bg-brand/10 text-brand' 
    },
    { 
      icon: CalendarCheck, 
      title: t('home.mgmt'), 
      desc: t('home.mgmt_desc'), 
      iconBg: 'bg-brand/10 text-brand' 
    },
    { 
      icon: Trophy, 
      title: t('home.results'), 
      desc: t('home.results_desc'), 
      iconBg: 'bg-brand/10 text-brand' 
    },
  ];

  return (
    <section className="py-16 px-6 relative z-10">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="glass rounded-[2rem] p-8 md:p-10 border border-white/10 bg-[#0f0f0f]"
            >
              {/* Feature Icon Container */}
              <div className={`w-14 h-14 ${feature.iconBg} rounded-2xl flex items-center justify-center mb-8`}>
                <feature.icon size={26} />
              </div>
              
              {/* Feature Text */}
              <h3 className="text-2xl font-display font-black uppercase tracking-tighter text-white mb-4">
                {feature.title}
              </h3>
              
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40 leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UpcomingEventsSection({ events }: { events?: any[] }) {
  const { t } = useLanguage();
  const displayEvents = events?.slice(0, 3) || [];

  return (
    <section className="py-20 px-6 relative bg-white/[0.005] border-y border-white/5 z-10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span className="px-3 py-1 rounded-full bg-brand/10 text-brand text-[9px] font-black uppercase tracking-[0.2em] mb-4 inline-block border border-brand/20">
            {t('events.reg_open')}
          </span>
          
          <h2 className="text-4xl md:text-6xl font-display font-black uppercase tracking-tighter mb-4">
            <span className="text-white">{t('events.upcoming')} </span>
            <span className="text-brand">{t('events.events')}</span>
          </h2>
          
          <p className="text-[10px] font-bold uppercase tracking-widest max-w-lg mx-auto text-white/30 leading-relaxed">
            {t('events.desc')}
          </p>
        </div>

        {displayEvents.length === 0 ? (
          <div className="text-center py-20 glass rounded-[2.5rem] p-12 border border-white/10 bg-[#0f0f0f]">
            <Target size={42} className="mx-auto text-white/10 mb-5" />
            <p className="text-xs font-black uppercase tracking-widest text-white/20">
              {t('events.no_found')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {displayEvents.map((event) => (
              <div key={event.id}>
                <EventCard event={event} />
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-16">
          <Link href="/events" className="btn-secondary text-xs !py-4 !px-9 bg-white/5 text-white font-black uppercase tracking-widest border border-white/10 rounded-xl inline-flex items-center gap-2">
            {t('events.view_more')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const { t } = useLanguage();

  return (
    <section className="py-24 px-6 relative overflow-hidden text-center bg-black z-10 border-t border-white/5">
      <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
        <div className="w-12 h-12 rounded-full border border-brand/20 bg-brand/5 flex items-center justify-center mb-8">
          <Star size={18} className="text-brand" />
        </div>

        <h2 className="text-4xl md:text-6xl font-display font-black uppercase tracking-tighter mb-8 leading-[0.85] text-white">
          {t('home.ready')}
        </h2>
        
        <p className="text-xs sm:text-sm text-white/50 max-w-md mx-auto mb-12 leading-relaxed uppercase tracking-wider font-semibold">
          Create an account to track your speed records, print certified race timings, and register for regional sports tournaments.
        </p>
        
        <Link href="/signup" className="btn-primary text-xs !py-4.5 !px-11 text-black font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2.5">
          {t('home.join')}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
