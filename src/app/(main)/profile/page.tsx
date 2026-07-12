'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Mail, Shield, Save, Loader2, Calendar, Ticket, MapPin, ExternalLink } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/use-auth';
import { useNotification } from '@/providers/notification-provider';
import { useLanguage } from '@/providers/language-provider';

export default function ProfilePage() {
  const { user, loading } = useSupabaseAuth();
  const { showNotification } = useNotification();
  const { t } = useLanguage();
  
  const [activeTab, setActiveTab] = useState<'registrations' | 'settings'>('registrations');
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(true);

  // Sync profile values when user loads
  useEffect(() => {
    if (user) {
      setFullName((user.firstName || '') + ' ' + (user.lastName || ''));
    }
  }, [user]);

  // Fetch registrations
  useEffect(() => {
    if (!user) return;
    const fetchRegs = async () => {
      try {
        const supabase = (await import('@/lib/supabase/client')).createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from('registrations')
          .select('*, events(*)')
          .eq('athlete_id', user.id);
        if (error) throw error;
        setRegistrations(data || []);
      } catch (err) {
        console.error('Error fetching registrations:', err);
      } finally {
        setLoadingRegs(false);
      }
    };
    fetchRegs();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = (await import('@/lib/supabase/client')).createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName, first_name: fullName.split(' ')[0], last_name: fullName.split(' ').slice(1).join(' ') },
      });
      if (error) throw error;
      showNotification('Profile updated!', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xs font-black uppercase tracking-widest text-white/20">Please log in</p>
      </div>
    );
  }

  return (
    <div className="pt-28 pb-24 px-6 min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 pb-6 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-brand/10 rounded-2xl flex items-center justify-center border border-brand/20">
                <User size={24} className="text-brand" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-black uppercase tracking-tighter">
                  {user.firstName || 'User'} {user.lastName || ''}
                </h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">{user.email}</p>
              </div>
            </div>
            
            {/* Tab Selectors */}
            <div className="flex items-center gap-2 bg-white/[0.02] p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setActiveTab('registrations')}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  activeTab === 'registrations' ? 'bg-brand text-black' : 'text-white/60 hover:text-white'
                }`}
              >
                My Registrations
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  activeTab === 'settings' ? 'bg-brand text-black' : 'text-white/60 hover:text-white'
                }`}
              >
                Settings
              </button>
            </div>
          </div>

          {/* Active Tab Panels */}
          {activeTab === 'registrations' ? (
            <div className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-white/30 mb-4">Purchased Races & Events</h2>
              
              {loadingRegs ? (
                <div className="py-12 flex justify-center">
                  <Loader2 size={24} className="animate-spin text-brand" />
                </div>
              ) : registrations.length === 0 ? (
                <div className="glass rounded-2xl p-12 text-center border border-white/5">
                  <Ticket size={36} className="mx-auto text-white/10 mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest text-white/30">No active registrations found</p>
                  <p className="text-[10px] text-white/20 mt-1 uppercase">Browse events to join your first race!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {registrations.map((reg) => (
                    <div key={reg.id} className="glass rounded-2xl p-6 border border-white/5 hover:border-brand/20 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[9px] font-black uppercase tracking-widest bg-brand/10 text-brand px-2.5 py-1 rounded-full border border-brand/20">
                            {reg.status || 'CONFIRMED'}
                          </span>
                          <span className="text-[10px] font-mono text-white/30">#{reg.id.slice(0, 8)}</span>
                        </div>
                        
                        <h3 className="text-base font-display font-black uppercase tracking-tight text-white mb-2 line-clamp-1">
                          {reg.events?.title || 'Unknown Event'}
                        </h3>
                        
                        <div className="space-y-1.5 mb-6 text-[10px] font-bold uppercase tracking-widest text-white/40">
                          {reg.events?.event_date && (
                            <div className="flex items-center gap-2">
                              <Calendar size={12} className="text-white/20" />
                              <span>{new Date(reg.events.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                          )}
                          {reg.events?.venue_name && (
                            <div className="flex items-center gap-2">
                              <MapPin size={12} className="text-white/20" />
                              <span>{reg.events.venue_name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                        <div>
                          <span className="text-[8px] text-white/30 block uppercase">Paid Amount</span>
                          <span className="text-xs font-black text-white">RM{Number(reg.total_amount || 0).toFixed(2)}</span>
                        </div>
                        <a href={`/events/${reg.event_id}`} className="text-[9px] font-black uppercase tracking-widest text-brand flex items-center gap-1 hover:underline">
                          View Event <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="glass rounded-2xl p-8 space-y-6 border border-white/5">
                <div>
                  <label className="label-text">{t('signup.name')}</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">{t('login.email')}</label>
                    <div className="input-field flex items-center gap-2 opacity-50">
                      <Mail size={14} className="text-white/30" />
                      <span className="text-sm">{user.email}</span>
                    </div>
                  </div>
                  <div>
                    <label className="label-text">Role</label>
                    <div className="input-field flex items-center gap-2 opacity-50">
                      <Shield size={14} className="text-brand" />
                      <span className="text-sm">{user.role}</span>
                    </div>
                  </div>
                </div>

                <button onClick={handleSave} disabled={saving} className="btn-primary w-full text-sm">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Changes
                </button>
              </div>

              <div className="glass rounded-2xl p-6 border border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Account ID</p>
                <p className="text-xs font-mono text-white/20 break-all">{user.id}</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
