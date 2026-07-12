'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';
import { useNotification } from '@/providers/notification-provider';
import { useSupabaseAuth } from '@/hooks/use-auth';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Role } from '@/lib/types';

export default function SignupPage() {
  const { t } = useLanguage();
  const { showNotification } = useNotification();
  const { signUp } = useSupabaseAuth();
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'ORGANIZER') {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.from('organizer_codes').select('code').eq('code', secretCode).eq('is_active', true).single();
      if (!data) {
        showNotification('Invalid or expired organizer access code', 'error');
        return;
      }
    }
    setLoading(true);
    try {
      await signUp(email, password, {
        role: role || 'ATHLETE',
        full_name: fullName,
        status: 'ACTIVE',
      });
      
      if (role === 'ORGANIZER') {
        const supabase = createSupabaseBrowserClient();
        await supabase.from('organizer_codes').update({ is_active: false }).eq('code', secretCode);
      }
      
      showNotification('Account created! Please check your email to confirm.', 'success');
      router.push('/login');
    } catch (err: any) {
      showNotification(err.message || 'Signup failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-black font-black text-xl">TT</span>
          </div>
          <h1 className="text-3xl font-display font-black uppercase tracking-tighter mb-2">
            {t('signup.title')}
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-white/30">
            {t('signup.subtitle')}
          </p>
        </div>

        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setRole('ATHLETE')}
            className={`flex-1 py-4 px-4 rounded-2xl border-2 text-center transition-all ${
              role === 'ATHLETE'
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-white/10 bg-white/5 text-white/50'
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-widest">
              {t('signup.role.athlete')}
            </span>
          </button>
          <button
            onClick={() => setRole('ORGANIZER')}
            className={`flex-1 py-4 px-4 rounded-2xl border-2 text-center transition-all ${
              role === 'ORGANIZER'
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-white/10 bg-white/5 text-white/50'
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-widest">
              {t('signup.role.organizer')}
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label-text">{t('signup.name')}</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field"
              placeholder="Nithya Nimalan"
              required
            />
          </div>

          <div>
            <label className="label-text">{t('login.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="athlete@example.com"
              required
            />
          </div>

          <div>
            <label className="label-text">{t('login.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {role === 'ORGANIZER' && (
            <div>
              <label className="label-text">{t('signup.secret')}</label>
              <input
                type="text"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
                className="input-field"
                placeholder={t('signup.secret_placeholder')}
                required
              />
            </div>
          )}

          <button type="submit" disabled={loading || !role} className="btn-primary w-full text-sm">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {t('signup.button')}
          </button>
        </form>

        <p className="text-center mt-8 text-xs font-bold uppercase tracking-widest text-white/30">
          {t('signup.already')}{' '}
          <Link href="/login" className="text-brand hover:underline">
            {t('nav.login')}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
