'use client';

import { BrandLogo } from '@/components/shared/brand-logo';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Eye, EyeOff, Loader2, Info } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useNotification } from '@/providers/notification-provider';

function ResetPasswordContent() {
  const router = useRouter();
  const { showNotification } = useNotification();
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);
  const [exchanging, setExchanging] = useState(true);
  const [exchangeError, setExchangeError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const recoveryParsed = useRef(false);

  useEffect(() => {
    if (recoveryParsed.current) return;
    recoveryParsed.current = true;
    const params = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (fragment.has('token_hash')) {
      params.set('token_hash', fragment.get('token_hash')!);
      params.set('type', fragment.get('type') || '');
      window.history.replaceState(null, '', window.location.pathname);
    }
    setSearchParams(params);
  }, []);

  useEffect(() => {
    if (!searchParams) return;
    const code = searchParams.get('code');
    const type = searchParams.get('type');
    const tokenHash = searchParams.get('token_hash');

    if (tokenHash && type === 'recovery') {
      createSupabaseBrowserClient().auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        .then(({ error }: { error: { message: string } | null }) => {
          if (error) setExchangeError(error.message);
        })
        .catch(() => setExchangeError('Unable to verify your recovery link. Request a new link.'))
        .finally(() => setExchanging(false));
      return;
    }

    if (searchParams.get('verified') === '1') {
      createSupabaseBrowserClient().auth.getUser()
        .then(({ data, error }: { data: { user: unknown }; error: { message: string } | null }) => {
          if (error || !data.user) setExchangeError('Your session expired. Request a new password reset link.');
        })
        .catch(() => setExchangeError('Unable to verify your session. Request a new password reset link.'))
        .finally(() => setExchanging(false));
      return;
    }

    if (!code) {
      queueMicrotask(() => {
        setExchangeError('No recovery code found. Please request a new password reset link.');
        setExchanging(false);
      });
      return;
    }

    createSupabaseBrowserClient()
      .auth.exchangeCodeForSession(code)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) setExchangeError(error.message);
      })
      .catch((err: unknown) => setExchangeError((err as Error)?.message || 'Failed to verify reset link'))
      .finally(() => setExchanging(false));
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      showNotification('Password must be at least 8 characters', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    setSaving(true);
    try {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({ password });
      if (error) throw error;
      showNotification('Password updated! Please sign in.', 'success');
      router.push('/login');
    } catch (err) {
      showNotification((err instanceof Error ? err.message : '') || 'Failed to update password', 'error');
    } finally {
      setSaving(false);
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
          <h1 className="text-3xl font-display font-semibold normal-case tracking-tight mb-2">SET NEW PASSWORD</h1>
          <p className="text-xs font-bold normal-case tracking-normal text-slate-600">
            {exchanging ? 'Verifying your reset link...' : 'Choose a strong new password.'}
          </p>
        </div>

        {exchanging ? (
          <div className="flex justify-center py-10">
            <Loader2 size={28} className="animate-spin text-[#4e6500]" />
          </div>
        ) : exchangeError ? (
          <div className="glass rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Info size={20} className="text-red-700" />
            </div>
            <p className="text-xs font-bold text-slate-600">{exchangeError}</p>
            <button onClick={() => router.push('/forgot-password')} className="btn-secondary text-xs mt-6">
              Request New Link
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-text">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-12"
                  placeholder="••••••••"
                  autoComplete="new-password"
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

            <div>
              <label className="label-text">Confirm New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>

            <button type="submit" disabled={saving} className="btn-primary w-full text-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Update Password
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#4e6500]" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
