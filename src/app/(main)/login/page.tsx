'use client';

import { BrandLogo } from '@/components/shared/brand-logo';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';
import { useNotification } from '@/providers/notification-provider';
import { useSupabaseAuth } from '@/hooks/use-auth';

export default function LoginPage() {
  const { t } = useLanguage();
  const { showNotification } = useNotification();
  const { signIn, user } = useSupabaseAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedInUser = await signIn(email, password);
      showNotification('Login successful!', 'success');
      const next = new URLSearchParams(window.location.search).get('redirectTo');
      if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) { router.push(next); return; }
      const role = loggedInUser?.app_metadata?.role;
      if (role === 'ADMIN' || role === 'SUPER_ADMIN') router.push('/admin/dashboard');
      else if (role === 'ORGANIZER') router.push('/organizer/dashboard');
      else router.push('/profile');
    } catch (err) {
      showNotification((err instanceof Error ? err.message : '') || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="auth-card w-full max-w-md"
      >
        <div className="text-center mb-10">
          <BrandLogo className="mx-auto mb-6 h-auto w-44" />
          <h1 className="text-3xl font-display font-semibold normal-case tracking-tight mb-2">
            {t('login.title')}
          </h1>
          <p className="text-xs font-bold normal-case tracking-normal text-slate-600">
            {t('login.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pr-12"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-bold normal-case tracking-normal">
            <Link href="/forgot-password" className="text-slate-600 hover:text-[#4e6500] transition-colors">
              {t('login.forgot')}
            </Link>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full text-sm">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {t('login.signin')}
          </button>
        </form>

        <p className="text-center mt-8 text-xs font-bold normal-case tracking-normal text-slate-600">
          {t('login.no_account')}{' '}
          <Link href="/signup" className="text-[#4e6500] hover:underline">
            {t('login.signup')}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
