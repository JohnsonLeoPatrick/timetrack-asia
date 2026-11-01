'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Shield, Users, CalendarCheck, Trophy, BarChart3, Zap, Lock, Globe } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';

const services = [
  { icon: Zap, title: 'Passionate Innovation', desc: 'Simplifying sports event registration with cutting-edge technology.' },
  { icon: Shield, title: 'Scalable Solutions', desc: 'Built for everything from local tournaments to international events.' },
  { icon: CalendarCheck, title: 'Seamless Registration', desc: 'Effortless online registration and secure payment processing.' },
  { icon: Globe, title: 'Real-Time Management', desc: 'Instant access to participant information and data management.' },
  { icon: BarChart3, title: 'Dynamic Scheduling', desc: 'Automated notifications and real-time schedule tracking.' },
  { icon: Trophy, title: 'Insights & Analytics', desc: 'Powerful tools for analyzing registration trends and performance.' },
];

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <div className="pt-24 pb-24">
      <section className="px-6 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold normal-case tracking-[0.3em] text-[#4e6500] mb-4">Our Story</p>
          <h1 className="text-5xl md:text-7xl font-display font-semibold normal-case tracking-tight mb-6">
            DRIVING <span className="text-[#4e6500]">PERFORMANCE</span>
          </h1>
          <p className="text-sm text-slate-600 font-bold normal-case tracking-normal max-w-2xl mx-auto leading-relaxed">
            {t('about.hero.desc')}
          </p>
        </div>
      </section>

      <section className="px-6 py-24 bg-slate-100">
        <div className="max-w-4xl mx-auto">
          <div className="glass rounded-3xl p-8 md:p-12 text-center">
            <h2 className="text-4xl md:text-5xl font-display font-semibold normal-case tracking-tight mb-6">
              {t('about.mission.title')}
            </h2>
            <p className="text-sm text-slate-600 font-bold normal-case tracking-normal leading-relaxed max-w-2xl mx-auto">
              {t('about.mission.desc')}
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-24 bg-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold normal-case tracking-[0.3em] text-[#4e6500] mb-4">{t('about.features.subtitle')}</p>
            <h2 className="text-3xl md:text-5xl font-display font-semibold normal-case tracking-tight">{t('about.features.title')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((svc, i) => (
              <motion.div
                key={svc.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                viewport={{ once: true }}
                className="glass rounded-2xl p-6"
              >
                <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center mb-4">
                  <svc.icon size={20} className="text-[#4e6500]" />
                </div>
                <h3 className="text-sm font-semibold normal-case tracking-tight mb-2">{svc.title}</h3>
                <p className="text-xs font-bold normal-case tracking-normal text-slate-600 leading-relaxed">{svc.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-32 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-7xl font-display font-semibold normal-case tracking-tight mb-8">
            SCALABLE. SECURE. <span className="text-[#4e6500]">UNRELENTING.</span>
          </h2>
          <Link href="/signup" className="btn-primary text-lg">
            JOIN THE TRACK
          </Link>
        </div>
      </section>
    </div>
  );
}
