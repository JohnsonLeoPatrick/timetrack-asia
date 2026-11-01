'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Globe, Clock, Shield, Loader2 } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';
import { useNotification } from '@/providers/notification-provider';
import { sendContactMessageAction } from '@/lib/server/actions/contact.actions';

export default function ContactPage() {
  const { t } = useLanguage();
  const { showNotification } = useNotification();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('email', email);
      fd.append('message', message);
      await sendContactMessageAction(fd);
      showNotification('Message sent! We will get back to you soon.', 'success');
      setName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      showNotification((err as Error).message || 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pt-36 pb-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold normal-case tracking-[0.3em] text-[#4e6500] mb-4">{t('contact.title')}</p>
          <h1 className="text-5xl md:text-7xl font-display font-semibold normal-case tracking-tight mb-4">
            GET IN <span className="text-[#4e6500]">TOUCH</span>
          </h1>
          <p className="text-sm text-slate-600 font-bold normal-case tracking-normal max-w-lg mx-auto">
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
                <Mail size={18} className="text-[#4e6500]" />
              </div>
              <div>
                <p className="text-xs font-semibold normal-case tracking-normal text-slate-600 mb-1">
                  Email Us
                </p>
                <a href="mailto:info@timetrack.asia" className="text-sm font-semibold tracking-tight hover:text-[#4e6500] transition-colors">
                  info@timetrack.asia
                </a>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
                <Globe size={18} className="text-[#4e6500]" />
              </div>
              <div>
                <p className="text-xs font-semibold normal-case tracking-normal text-slate-600 mb-1">
                  Location
                </p>
                <p className="text-sm font-semibold tracking-tight">Malaysia / Singapore / SEA</p>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
                <Clock size={18} className="text-[#4e6500]" />
              </div>
              <div>
                <p className="text-xs font-semibold normal-case tracking-normal text-slate-600 mb-1">
                  Working Hours
                </p>
                <p className="text-sm font-semibold tracking-tight">Mon-Fri 0900-1800 (MYT)</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-8"
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label-text">{t('contact.name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div>
                <label className="label-text">{t('contact.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="Enter your email address"
                  required
                />
              </div>
              <div>
                <label className="label-text">{t('contact.message')}</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="input-field min-h-[120px] resize-none"
                  placeholder="Type your message here..."
                  required
                />
              </div>
              <button type="submit" disabled={sending} className="btn-primary w-full text-sm">
                {sending && <Loader2 size={16} className="animate-spin mr-2" />}
                {t('contact.send')}
              </button>
            </form>
            <div className="flex items-center gap-2 mt-4 justify-center">
              <Shield size={10} className="text-slate-600" />
              <span className="text-xs font-bold normal-case tracking-normal text-slate-600">
                SSL Encrypted • 256-bit Secure
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
