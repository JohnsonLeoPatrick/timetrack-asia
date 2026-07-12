'use client';

import { motion } from 'motion/react';
import { Mail, Globe, Clock, Shield } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';

export default function ContactPage() {
  const { t } = useLanguage();

  return (
    <div className="pt-24 pb-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand mb-4">{t('contact.title')}</p>
          <h1 className="text-5xl md:text-7xl font-display font-black uppercase tracking-tighter mb-4">
            GET IN <span className="text-brand">TOUCH</span>
          </h1>
          <p className="text-sm text-white/30 font-bold uppercase tracking-widest max-w-lg mx-auto">
            {t('contact.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="glass rounded-2xl p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
                <Mail size={18} className="text-brand" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">
                  Email Us
                </p>
                <a href="mailto:info@timetrack.asia" className="text-sm font-black tracking-tight hover:text-brand transition-colors">
                  info@timetrack.asia
                </a>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
                <Globe size={18} className="text-brand" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">
                  Location
                </p>
                <p className="text-sm font-black tracking-tight">Malaysia / Singapore / SEA</p>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
                <Clock size={18} className="text-brand" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">
                  Working Hours
                </p>
                <p className="text-sm font-black tracking-tight">Mon-Fri 0900-1800 (MYT)</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-8"
          >
            <div className="space-y-5">
              <div>
                <label className="label-text">{t('contact.name')}</label>
                <input type="text" className="input-field" placeholder="Enter your full name" />
              </div>
              <div>
                <label className="label-text">{t('contact.email')}</label>
                <input type="email" className="input-field" placeholder="Enter your email address" />
              </div>
              <div>
                <label className="label-text">{t('contact.message')}</label>
                <textarea
                  className="input-field min-h-[120px] resize-none"
                  placeholder="Type your message here..."
                />
              </div>
              <button className="btn-primary w-full text-sm">
                {t('contact.send')}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-4 justify-center">
              <Shield size={10} className="text-white/20" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-white/20">
                SSL Encrypted • 256-bit Secure
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
