'use client';

import { BrandLogo } from '@/components/shared/brand-logo';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';
import { useNotification } from '@/providers/notification-provider';
import { signUpAction } from '@/lib/server/actions/auth.actions';
import type { Role } from '@/lib/types';

export default function SignupPage() {
  const { t } = useLanguage();
  const { showNotification } = useNotification();
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const [first, ...rest] = fullName.trim().split(/\s+/);
      const formData = new FormData();
      formData.set('email', email);
      formData.set('password', password);
      formData.set('firstName', first || '');
      formData.set('lastName', rest.join(' '));
      formData.set('role', role || 'ATHLETE');
      if (role === 'ORGANIZER') formData.set('organizerCode', secretCode);

      // Role assignment and organizer-code validation/consumption happen
      // server-side; the browser never gets a say in the resulting role.
      const result = await signUpAction(formData);
      if (result?.error) {
        showNotification(result.error, 'error');
        return;
      }

      showNotification('Account created! Please check your email to confirm.', 'success');
      router.push('/login');
    } catch (err) {
      showNotification((err instanceof Error ? err.message : '') || 'Signup failed', 'error');
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
            {t('signup.title')}
          </h1>
          <p className="text-xs font-bold normal-case tracking-normal text-slate-600">
            {t('signup.subtitle')}
          </p>
        </div>

        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setRole('ATHLETE')}
            className={`flex-1 py-4 px-4 rounded-2xl border-2 text-center transition-all ${
              role === 'ATHLETE'
                ? 'border-brand bg-brand/10 text-[#4e6500]'
                : 'border-slate-300 bg-slate-100 text-slate-600'
            }`}
          >
            <span className="text-xs font-semibold normal-case tracking-normal">
              {t('signup.role.athlete')}
            </span>
          </button>
          <button
            onClick={() => setRole('ORGANIZER')}
            className={`flex-1 py-4 px-4 rounded-2xl border-2 text-center transition-all ${
              role === 'ORGANIZER'
                ? 'border-brand bg-brand/10 text-[#4e6500]'
                : 'border-slate-300 bg-slate-100 text-slate-600'
            }`}
          >
            <span className="text-xs font-semibold normal-case tracking-normal">
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

        <p className="text-center mt-8 text-xs font-bold normal-case tracking-normal text-slate-600">
          {t('signup.already')}{' '}
          <Link href="/login" className="text-[#4e6500] hover:underline">
            {t('nav.login')}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
