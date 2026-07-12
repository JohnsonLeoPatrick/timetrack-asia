'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Users, ScrollText, BarChart3, Search, Shield, Database,
  Loader2, Trash2, Ban, CheckCircle, XCircle, Activity,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Tab = 'users' | 'audit' | 'db-monitor';

const ROOT_EMAIL = 'nithyananthanimalan@gmail.com';

export default function DeveloperDashboardPage() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div className="flex min-h-screen">
      <Sidebar variant="developer" />
      <div className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/10 px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-display font-black uppercase tracking-tighter">
              DEVELOPER <span className="text-purple-500">CONSOLE</span>
            </h1>
            <div className="flex items-center gap-2">
              {['users', 'audit', 'db-monitor'].map(t => (
                <button key={t} onClick={() => setTab(t as Tab)}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${tab === t ? 'bg-purple-500/10 text-purple-500' : 'text-white/30 hover:text-white/50'}`}
                >{t === 'db-monitor' ? 'DB Monitor' : t === 'audit' ? 'Audit Ledger' : 'Users'}</button>
              ))}
            </div>
          </div>
        </header>
        <div className="p-8">
          {tab === 'users' && <UsersTab />}
          {tab === 'audit' && <AuditTab />}
          {tab === 'db-monitor' && <DBMonitorTab />}
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const supabase = createSupabaseBrowserClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const { data: users, isLoading } = useQuery({
    queryKey: ['dev-users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('id, email, role, status, first_name, last_name, created_at')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const filtered = (users || []).filter((u: any) => {
    const matchesSearch = u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="relative max-w-md flex-1">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-purple-500/50 transition-all" />
        </div>
        <div className="flex items-center gap-2 ml-4">
          {['ALL', 'SUPER_ADMIN', 'ADMIN', 'ORGANIZER', 'STAFF', 'ATHLETE'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-full transition-all ${
                roleFilter === r ? 'bg-purple-500/10 text-purple-500 border border-purple-500/30' : 'text-white/30 hover:text-white/50 border border-white/10'
              }`}
            >{r === 'ALL' ? 'All' : r}</button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Email</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Role</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Status</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Created</th>
              <th className="text-right p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-purple-500" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-xs text-white/20">No users found</td></tr>
            ) : (
              filtered.map((u: any) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <span className="text-sm font-bold">{u.email}</span>
                    {u.email === ROOT_EMAIL && <span className="ml-2 text-[9px] text-purple-500 font-black uppercase tracking-widest">Root</span>}
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                      u.role === 'SUPER_ADMIN' ? 'bg-purple-500/10 text-purple-500' :
                      u.role === 'ADMIN' ? 'bg-red-500/10 text-red-500' :
                      u.role === 'ORGANIZER' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-white/10 text-white/50'
                    }`}>{u.role}</span>
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${u.status === 'ACTIVE' ? 'text-green-500' : 'text-red-500'}`}>{u.status}</span>
                  </td>
                  <td className="p-4 text-[10px] text-white/30">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-purple-500/10 rounded-lg text-purple-500/50 hover:text-purple-500" title="Promote">
                        <Shield size={14} />
                      </button>
                      <button className="p-2 hover:bg-yellow-500/10 rounded-lg text-yellow-500/50 hover:text-yellow-500" title="Suspend">
                        <Ban size={14} />
                      </button>
                      <button className="p-2 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-500" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab() {
  const supabase = createSupabaseBrowserClient();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*, users(email)')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
    refetchInterval: 15_000,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-white/30">Audit Ledger</h2>
        <span className="text-[10px] text-white/20 font-bold">Last 100 entries • Auto-refresh</span>
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Time</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">User</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Action</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Module</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-purple-500" /></td></tr>
            ) : !logs || logs.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-xs text-white/20">No audit logs recorded yet</td></tr>
            ) : (
              (logs || []).map((log: any) => (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors font-mono">
                  <td className="p-4 text-[10px] text-white/30">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="p-4 text-[10px] text-white/50">{log.users?.email || 'System'}</td>
                  <td className="p-4 text-[10px] font-bold text-purple-400">{log.action}</td>
                  <td className="p-4">
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-white/5 text-white/40">{log.module}</span>
                  </td>
                  <td className="p-4 text-[9px] text-white/20 max-w-[200px] truncate">
                    {log.metadata ? JSON.stringify(log.metadata).slice(0, 60) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DBMonitorTab() {
  const supabase = createSupabaseBrowserClient();

  const { data: tables, isLoading } = useQuery({
    queryKey: ['db-monitor'],
    queryFn: async () => {
      const tables = [
        'users', 'events', 'event_categories', 'event_gallery', 'category_addons', 'addon_options',
        'registrations', 'billing_details', 'participants', 'participant_addons',
        'payments', 'invoices', 'refunds', 'payment_gateways',
        'results', 'audit_logs', 'staff_assignments',
        'notification_templates', 'notification_logs', 'user_notification_preferences',
        'coupons', 'coupon_redemptions', 'form_templates', 'email_queue',
      ];

      const results = await Promise.all(
        tables.map(async (table) => {
          const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          return { name: table, rowCount: error ? -1 : count || 0 };
        })
      );
      return results;
    },
    refetchInterval: 30_000,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-white/30">Database Monitor</h2>
        <span className="text-[10px] text-white/20 font-bold">Auto-refresh 30s</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-20 text-center"><Loader2 size={24} className="animate-spin mx-auto text-purple-500" /></div>
        ) : (
          (tables || []).map((t, i) => (
            <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="glass rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database size={14} className="text-purple-500" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/70">{t.name}</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${t.rowCount >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
              <p className="text-2xl font-display font-black tracking-tighter text-white">
                {t.rowCount >= 0 ? t.rowCount.toLocaleString() : <span className="text-red-400 text-sm">ERR</span>}
              </p>
              <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-1">rows</p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
