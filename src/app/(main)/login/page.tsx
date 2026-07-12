'use client';

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
      const role = loggedInUser?.user_metadata?.role;
      if (role === 'ADMIN' || role === 'SUPER_ADMIN') router.push('/admin/dashboard');
      else if (role === 'ORGANIZER') router.push('/organizer/dashboard');
      else router.push('/profile');
    } catch (err: any) {
      showNotification(err.message || 'Login failed', 'error');
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
            {t('login.title')}
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-white/30">
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
            <Link href="/forgot-password" className="text-white/30 hover:text-brand transition-colors">
              {t('login.forgot')}
            </Link>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full text-sm">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {t('login.signin')}
          </button>
        </form>

        <p className="text-center mt-8 text-xs font-bold uppercase tracking-widest text-white/30">
          {t('login.no_account')}{' '}
          <Link href="/signup" className="text-brand hover:underline">
            {t('login.signup')}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
