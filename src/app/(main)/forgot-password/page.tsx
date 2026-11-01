'use client';

import { BrandLogo } from '@/components/shared/brand-logo';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNotification } from '@/providers/notification-provider';
import { useSupabaseAuth } from '@/hooks/use-auth';

export default function ForgotPasswordPage() {
  const { showNotification } = useNotification();
  const { supabase } = { supabase: null };
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabaseClient = (await import('@/lib/supabase/client')).createSupabaseBrowserClient();
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      showNotification('Password reset email sent!', 'success');
    } catch (err) {
      showNotification((err instanceof Error ? err.message : '') || 'Failed to send reset email', 'error');
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
          <h1 className="text-3xl font-display font-semibold normal-case tracking-tight mb-2">RESET PASSWORD</h1>
          <p className="text-xs font-bold normal-case tracking-normal text-slate-600">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-[#4e6500] text-2xl">✓</span>
            </div>
            <p className="text-sm font-bold tracking-tight text-[#4e6500] mb-4">Email Sent!</p>
            <p className="text-xs font-bold normal-case tracking-normal text-slate-600 mb-6">
              Check your inbox for the password reset link.
            </p>
            <button onClick={() => router.push('/login')} className="btn-secondary text-xs">
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-text">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="athlete@example.com"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full text-sm">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Send Reset Link
            </button>
          </form>
        )}

        <div className="text-center mt-8">
          <button onClick={() => router.push('/login')} className="text-xs font-semibold normal-case tracking-normal text-slate-600 hover:text-[#4e6500] transition-colors">
            Back to Login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
