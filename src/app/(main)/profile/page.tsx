'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { User, Mail, Shield, Save, Loader2, Calendar, Ticket, MapPin, ExternalLink } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/use-auth';
import { useNotification } from '@/providers/notification-provider';
import { useLanguage } from '@/providers/language-provider';
import { updateProfileAction } from '@/lib/server/actions/auth.actions';
import { ChipPayButton } from '@/components/events/chip-pay-button';
import { BillingHistory } from '@/components/events/billing-history';
import { RunnerProfileSettings } from '@/components/events/runner-profile-settings';
import { useQuery } from '@tanstack/react-query';

export default function ProfilePage() {
  const { user, loading } = useSupabaseAuth();
  const router = useRouter();
  const { showNotification } = useNotification();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'registrations' | 'billing' | 'settings'>('registrations');
  const [usernameDraft, setUsername] = useState<string | null>(null);
  const username = usernameDraft ?? user?.username ?? '';
  const [saving, setSaving] = useState(false);


  // Sync profile values when user loads

  // Fetch registrations
  const { data: registrations = [], isPending: loadingRegs, error: registrationsError, refetch: retryRegistrations } = useQuery({
    queryKey: ['my-registrations', user?.id],
    enabled: !!user,
    queryFn: async () => {
        const supabase = (await import('@/lib/supabase/client')).createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from('registrations')
          .select('*, events(*)')
          .eq('athlete_id', user!.id).is('deleted_at', null).order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as (import('@/lib/types').Registration & { events: import('@/lib/types').Event })[];
    },
  });

  const handleSave = async () => {
    if (!username.trim()) {
      showNotification('Please enter your username', 'error');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('username', username.trim());
      await updateProfileAction(fd);
      showNotification('Profile updated!', 'success');
      router.refresh();
    } catch (err) {
      showNotification((err instanceof Error ? err.message : '') || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#4e6500]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xs font-semibold normal-case tracking-normal text-slate-600">Please log in</p>
      </div>
    );
  }

  return (
    <div className="pt-28 pb-24 px-6 min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 pb-6 border-b border-slate-300">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-brand/10 rounded-2xl flex items-center justify-center border border-brand/20">
                <User size={24} className="text-[#4e6500]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-display font-semibold normal-case tracking-tight">
                  {username || user.username || 'Your account'}
                </h1>
                <p className="break-all text-sm text-slate-600">{user.email}</p>
              </div>
            </div>

            {/* Tab Selectors */}
            <nav aria-label="Account sections" className="flex flex-wrap items-center gap-1 border border-slate-300 bg-white p-1">
              <button
                onClick={() => setActiveTab('registrations')}
                aria-current={activeTab === 'registrations' ? 'page' : undefined}
                className={`px-4 py-2 text-xs font-semibold normal-case tracking-normal rounded-lg transition-all ${
                  activeTab === 'registrations' ? 'bg-brand text-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Registrations
              </button>
              <button onClick={() => setActiveTab('billing')} aria-current={activeTab === 'billing' ? 'page' : undefined} className={`min-h-11 px-4 py-2 text-sm font-medium ${activeTab === 'billing' ? 'bg-brand text-black' : 'text-slate-600 hover:bg-slate-100'}`}>Billing</button>
              <button
                onClick={() => setActiveTab('settings')}
                aria-current={activeTab === 'settings' ? 'page' : undefined}
                className={`px-4 py-2 text-xs font-semibold normal-case tracking-normal rounded-lg transition-all ${
                  activeTab === 'settings' ? 'bg-brand text-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Settings
              </button>
            </nav>
          </div>

          {/* Active Tab Panels */}
          {activeTab === 'registrations' ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight mb-4">Your race entries</h2>

              {loadingRegs ? (
                <div className="py-12 flex justify-center">
                  <Loader2 size={24} className="animate-spin text-[#4e6500]" />
                </div>
              ) : registrationsError ? <div role="alert" className="border border-red-200 bg-white p-6"><p className="text-red-700">Your registrations could not be loaded.</p><button onClick={() => retryRegistrations()} className="btn-secondary mt-4">Try again</button></div> : registrations.length === 0 ? (
                <div className="glass rounded-2xl p-12 text-center border border-slate-300">
                  <Ticket size={36} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-xs font-semibold normal-case tracking-normal text-slate-600">No active registrations found</p>
                  <p className="text-xs text-slate-600 mt-1 normal-case">Browse events to join your first race!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {registrations.map((reg) => (
                    <div key={reg.id} className="border border-slate-300 bg-white transition-all flex flex-col justify-between p-5">
                      <div>
                        <a href={`/profile/registrations/${reg.id}`} className="relative -mx-5 -mt-5 mb-5 flex min-h-48 items-end overflow-hidden bg-slate-950 p-5 text-white focus-visible:outline-4 focus-visible:outline-blue-600">
                          {reg.events?.cover_image && <img src={reg.events.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                          <span className="absolute inset-0 bg-gradient-to-t from-black/90 to-black/20" />
                          <span className="relative"><span className="block text-lg font-semibold">{reg.events?.title || 'Event'}</span><span className="mt-2 block text-sm">Open your entry & QR tickets</span></span>
                        </a>
                        <div className="flex items-center justify-between mb-4">
                          <span className={`text-xs font-medium px-2.5 py-1 border ${reg.status === 'PAID' ? 'bg-[#edf3df] text-[#425a0c] border-[#bac99b]' : 'bg-slate-50 text-slate-700 border-slate-300'}`}>
                            {reg.status === 'PAID' ? 'Ready to race' : reg.status === 'PENDING' ? 'Payment pending' : reg.status || 'Status unavailable'}
                          </span>
                          <span className="text-xs font-mono text-slate-600">#{reg.id.slice(0, 8)}</span>
                        </div>

                        <h3 className="text-base font-display font-semibold normal-case tracking-tight text-slate-900 mb-2 line-clamp-1">
                          {reg.events?.title || 'Unknown Event'}
                        </h3>

                        <div className="space-y-1.5 mb-6 text-xs font-bold normal-case tracking-normal text-slate-600">
                          {reg.events?.event_date && (
                            <div className="flex items-center gap-2">
                              <Calendar size={12} className="text-slate-600" />
                              <span>{new Date(reg.events.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                          )}
                          {reg.events?.venue_name && (
                            <div className="flex items-center gap-2">
                              <MapPin size={12} className="text-slate-600" />
                              <span>{reg.events.venue_name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-slate-300 pt-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-xs text-slate-600 block normal-case">{reg.status === 'PENDING' ? 'Amount due' : 'Registration total'}</span>
                          <span className="text-xs font-semibold text-slate-900">RM{Number(reg.net_amount || 0).toFixed(2)}</span>
                        </div>
                        <a href={`/events/${reg.event_id}`} className="text-xs font-semibold normal-case tracking-normal text-[#4e6500] flex items-center gap-1 hover:underline">
                          View Event <ExternalLink size={10} />
                        </a>
                      </div>
                      {reg.status === 'PAID' && Number(reg.net_amount) > 0 && <a href={`/profile/registrations/${reg.id}/invoice`} className="btn-secondary mt-4">Print invoice</a>}
                      {reg.status === 'PENDING' && Number(reg.net_amount) > 0 && <ChipPayButton registrationId={reg.id} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'billing' ? <BillingHistory userId={user.id} /> : (
            <div className="space-y-6">
              <RunnerProfileSettings />
              <div className="glass rounded-2xl p-8 space-y-6 border border-slate-300">
                <div>
                  <label htmlFor="profile-name" className="label-text">Username</label>
                  <input
                    id="profile-name"
                    autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">{t('login.email')}</label>
                    <div className="input-field flex items-center gap-2 opacity-50">
                      <Mail size={14} className="text-slate-600" />
                      <span className="min-w-0 break-all text-sm">{user.email}</span>
                    </div>
                  </div>
                  <div>
                    <label className="label-text">Role</label>
                    <div className="input-field flex items-center gap-2 opacity-50">
                      <Shield size={14} className="text-[#4e6500]" />
                      <span className="text-sm">{user.role}</span>
                    </div>
                  </div>
                </div>

                <button onClick={handleSave} disabled={saving} className="btn-primary w-full text-sm">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Changes
                </button>
              </div>

              <div className="glass rounded-2xl p-6 border border-slate-300">
                <p className="text-xs font-semibold normal-case tracking-normal text-slate-600 mb-2">Account ID</p>
                <p className="text-xs font-mono text-slate-600 break-all">{user.id}</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
