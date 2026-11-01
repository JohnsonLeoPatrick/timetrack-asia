'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Users, ScrollText, BarChart3, Search, Shield, Database,
  Loader2, Trash2, Ban, CheckCircle, XCircle, Activity,
} from 'lucide-react';
import { DashboardFrame } from '@/components/layout/dashboard-frame';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { adminUpdateUserRoleAction, adminToggleUserStatusAction, adminDeleteUserAction } from '@/lib/server/actions/admin.actions';
import { toast } from 'sonner';

type Tab = 'users' | 'audit' | 'db-monitor';

const ROOT_EMAIL = 'nithyananthanimalan@gmail.com';

export default function DeveloperDashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get('tab') as Tab) || 'users';
  const setTab = (t: Tab) => router.push(`/developer/dashboard?tab=${t}`);

  return (
    <DashboardFrame variant="developer" title="Developer console" description="Review access, audit activity, and database health.">
            <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
              {(['users', 'audit', 'db-monitor'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={`min-h-11 px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-[#eef2e6] text-[#334500]' : 'text-slate-600 hover:bg-slate-100'}`}
                >{t === 'db-monitor' ? 'DB Monitor' : t === 'audit' ? 'Audit Ledger' : 'Users'}</button>
              ))}
            </div>
          {tab === 'users' && <UsersTab />}
          {tab === 'audit' && <AuditTab />}
          {tab === 'db-monitor' && <DBMonitorTab />}
    </DashboardFrame>
  );
}

function UsersTab() {
  const supabase = createSupabaseBrowserClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['dev-users'] });

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

  const handlePromote = async (u: Pick<import('@/lib/types').User, 'id' | 'role' | 'email'>) => {
    const next = u.role === 'ATHLETE' ? 'ORGANIZER' : u.role === 'ORGANIZER' ? 'ADMIN' : u.role === 'ADMIN' ? 'SUPER_ADMIN' : null;
    if (!next) {
      toast.error('This role cannot be promoted further');
      return;
    }
    try {
      await adminUpdateUserRoleAction(u.id, next);
      toast.success(`${u.email} promoted to ${next}`);
      refresh();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to promote user');
    }
  };

  const handleSuspend = async (u: Pick<import('@/lib/types').User, 'id' | 'role' | 'email'>) => {
    try {
      await adminToggleUserStatusAction(u.id, 'SUSPENDED');
      toast.success(`${u.email} suspended`);
      refresh();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to suspend user');
    }
  };

  const handleDelete = async (u: Pick<import('@/lib/types').User, 'id' | 'role' | 'email'>) => {
    if (!confirm(`Delete ${u.email} permanently? This cannot be undone.`)) return;
    try {
      await adminDeleteUserAction(u.id);
      toast.success(`${u.email} deleted`);
      refresh();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to delete user');
    }
  };

  const filtered = (users || []).filter((u) => {
    const matchesSearch = u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="relative max-w-md flex-1">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="w-full bg-slate-100 border border-slate-300 rounded-none py-3 pl-10 pr-4 text-sm outline-none focus:border-purple-500/50 transition-all" />
        </div>
        <div className="flex items-center gap-2 ml-4">
          {['ALL', 'SUPER_ADMIN', 'ADMIN', 'ORGANIZER', 'STAFF', 'ATHLETE'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 text-xs font-semibold normal-case tracking-normal rounded-none transition-all ${
                roleFilter === r ? 'bg-purple-500/10 text-purple-700 border border-purple-500/30' : 'text-slate-600 hover:text-slate-600 border border-slate-300'
              }`}
            >{r === 'ALL' ? 'All' : r}</button>
          ))}
        </div>
      </div>

      <div className="glass w-full overflow-x-auto rounded-none" role="region" aria-label="Dashboard records" tabIndex={0}>
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Email</th>
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Role</th>
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Status</th>
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Created</th>
              <th className="text-right p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-purple-700" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-xs text-slate-600">No users found</td></tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-slate-300 hover:bg-slate-100 transition-colors">
                  <td className="p-4">
                    <span className="text-sm font-bold">{u.email}</span>
                    {u.email === ROOT_EMAIL && <span className="ml-2 text-xs text-purple-700 font-semibold normal-case tracking-normal">Root</span>}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-semibold normal-case tracking-normal px-2 py-1 rounded-none ${
                      u.role === 'SUPER_ADMIN' ? 'bg-purple-500/10 text-purple-700' :
                      u.role === 'ADMIN' ? 'bg-red-500/10 text-red-700' :
                      u.role === 'ORGANIZER' ? 'bg-blue-500/10 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{u.role}</span>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-semibold normal-case tracking-normal ${u.status === 'ACTIVE' ? 'text-green-700' : 'text-red-700'}`}>{u.status}</span>
                  </td>
                  <td className="p-4 text-xs text-slate-600">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handlePromote(u)} disabled={u.email === ROOT_EMAIL} className="p-2 hover:bg-purple-500/10 rounded-none text-purple-700 hover:text-purple-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Promote" aria-label="Promote">
                        <Shield size={14} />
                      </button>
                      <button onClick={() => handleSuspend(u)} className="p-2 hover:bg-yellow-500/10 rounded-none text-yellow-700 hover:text-yellow-700" title="Suspend" aria-label="Suspend">
                        <Ban size={14} />
                      </button>
                      <button onClick={() => handleDelete(u)} disabled={u.email === ROOT_EMAIL} className="p-2 hover:bg-red-500/10 rounded-none text-red-700 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Delete" aria-label="Delete">
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-sm font-semibold normal-case tracking-normal text-slate-600">Audit Ledger</h2>
        <span className="text-xs text-slate-600 font-bold">Last 100 entries • Auto-refresh</span>
      </div>
      <div className="glass w-full overflow-x-auto rounded-none" role="region" aria-label="Dashboard records" tabIndex={0}>
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Time</th>
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">User</th>
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Action</th>
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Module</th>
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-purple-700" /></td></tr>
            ) : !logs || logs.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-xs text-slate-600">No audit logs recorded yet</td></tr>
            ) : (
              (logs || []).map((log) => (
                <tr key={log.id} className="border-b border-slate-300 hover:bg-slate-100 transition-colors tabular-nums">
                  <td className="p-4 text-xs text-slate-600">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="p-4 text-xs text-slate-600">{log.users?.email || 'System'}</td>
                  <td className="p-4 text-xs font-bold text-purple-700">{log.action}</td>
                  <td className="p-4">
                    <span className="text-xs font-semibold normal-case tracking-normal px-2 py-1 rounded-none bg-slate-100 text-slate-600">{log.module}</span>
                  </td>
                  <td className="p-4 text-xs text-slate-600 max-w-[200px] truncate">
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-sm font-semibold normal-case tracking-normal text-slate-600">Database Monitor</h2>
        <span className="text-xs text-slate-600 font-bold">Auto-refresh 30s</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-20 text-center"><Loader2 size={24} className="animate-spin mx-auto text-purple-700" /></div>
        ) : (
          (tables || []).map((t, i) => (
            <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="glass rounded-none p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database size={14} className="text-purple-700" />
                  <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">{t.name}</span>
                </div>
                <div className={`w-2 h-2 rounded-none ${t.rowCount >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
              <p className="text-2xl font-display font-semibold tracking-tight text-slate-900">
                {t.rowCount >= 0 ? t.rowCount.toLocaleString() : <span className="text-red-700 text-sm">ERR</span>}
              </p>
              <p className="text-xs text-slate-600 font-bold normal-case tracking-normal mt-1">rows</p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
