'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Activity, Users, Calendar, DollarSign, Clock, AlertTriangle,
  Search, Ban, Trash2, CheckCircle, XCircle, Loader2, Key
} from 'lucide-react';
import { AdminPaymentsTab } from '@/components/layout/dashboard-data-tabs';
import { DashboardFrame, DashboardLoading } from '@/components/layout/dashboard-frame';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { adminToggleUserStatusAction, adminUpdateUserRoleAction, generateOrganizerCodeAction, adminHealthAction } from '@/lib/server/actions/admin.actions';
import { adminUpdateEventStatusAction } from '@/lib/server/actions/event.actions';
import { toast } from 'sonner';

import { AccountSettings } from '@/components/layout/account-settings';

type Tab = 'overview' | 'users' | 'events' | 'payments' | 'codes' | 'settings';

export default function AdminDashboardPage() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) || 'overview';

  const supabase = createSupabaseBrowserClient();

  const { data: stats, isLoading, error: statsError, refetch: retryStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [events, users, regs] = await Promise.all([
        supabase.from('events').select('*'),
        supabase.from('users').select('*'),
        supabase.from('registrations').select('net_amount, status, persons_count').is('deleted_at', null),
      ]);
      if (events.error || users.error || regs.error) throw new Error('Overview could not be loaded. Please try again.');
      const now = new Date();
      return {
        totalUsers: users.data?.length || 0,
        totalOrganizers: users.data?.filter((u) => u.role === 'ORGANIZER').length || 0,
        activeEvents: events.data?.filter((e) => e.status === 'LIVE').length || 0,
        upcomingEvents: events.data?.filter((e) => new Date(e.event_date) > now).length || 0,
        ticketsSold: regs.data?.filter((r) => r.status === 'PAID').reduce((sum: number, r) => sum + Number(r.persons_count), 0) || 0,
        totalRevenue: regs.data?.filter((r) => r.status === 'PAID').reduce((s: number, r) => s + Number(r.net_amount), 0) || 0,
        pendingEvents: events.data?.filter((e) => e.status === 'PENDING').length || 0,
      };
    },
    staleTime: 30_000,
  });

  const statsCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'text-blue-700' },
    { label: 'Total Organizers', value: stats?.totalOrganizers || 0, icon: Users, color: 'text-purple-700' },
    { label: 'Active Events', value: stats?.activeEvents || 0, icon: Activity, color: 'text-green-700' },
    { label: 'Upcoming Events', value: stats?.upcomingEvents || 0, icon: Calendar, color: 'text-[#4e6500]' },
    { label: 'Tickets Sold', value: stats?.ticketsSold || 0, icon: CheckCircle, color: 'text-indigo-700' },
    { label: 'Revenue (MYR)', value: `RM${(stats?.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: 'text-yellow-700' },
    { label: 'Pending Approvals', value: stats?.pendingEvents || 0, icon: AlertTriangle, color: 'text-orange-700' },
  ];

  return (
    <DashboardFrame variant="admin" title={tab === 'overview' ? 'Overview' : tab.charAt(0).toUpperCase() + tab.slice(1)} description="Manage events, people, and billing from one workspace.">
          {tab === 'overview' && (statsError ? <div role="alert" className="border border-red-200 bg-white p-6"><p className="text-red-700">{statsError.message}</p><button onClick={() => retryStats()} className="btn-secondary mt-4">Try again</button></div> : <OverviewTab stats={statsCards} loading={isLoading} />)}
          {tab === 'users' && <UsersTab />}
          {tab === 'events' && <EventsTab />}
          {tab === 'payments' && <AdminPaymentsTab />}
          {tab === 'codes' && <AccessCodesTab />}
          {tab === 'settings' && <div className="space-y-6"><AccountSettings /><SettingsTab /></div>}
    </DashboardFrame>
  );
}

function OverviewTab({ stats, loading }: { stats: { label: string; value: string | number; icon: import('lucide-react').LucideIcon; color: string }[]; loading: boolean }) {
  if (loading) return <DashboardLoading />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map((s, i) => (
        <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="glass rounded-none p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold normal-case tracking-normal text-slate-600">{s.label}</p>
            <s.icon size={18} className={s.color} />
          </div>
          {loading ? <div className="h-8 bg-slate-100 rounded animate-pulse" /> :
            <p className={`text-3xl font-display font-semibold tracking-tight ${s.color}`}>{s.value}</p>}
        </motion.div>
      ))}
    </div>
  );
}

function UsersTab() {
  const supabase = createSupabaseBrowserClient();
  const [search, setSearch] = useState('');
  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('id, email, role, status, first_name, last_name, created_at').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const handleBanUser = async (id: string) => {
    if (!confirm('Are you sure you want to ban this user?')) return;
    // The server action performs the privileged write with the service role.
    await adminToggleUserStatusAction(id, 'BANNED');
    refetch();
  };

  const handleRemoveOrganizer = async (id: string) => {
    if (!confirm('Are you sure you want to remove organizer privileges from this user?')) return;
    await adminUpdateUserRoleAction(id, 'ATHLETE');
    refetch();
  };

  const filtered = (users || []).filter((u) => u.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="relative max-w-md mb-6">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
          className="w-full bg-slate-100 border border-slate-300 rounded-none py-3 pl-10 pr-4 text-sm outline-none focus:border-red-500/50 transition-all" />
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
            {isLoading ? <tr><td colSpan={5} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-red-700" /></td></tr> :
              filtered.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-xs text-slate-600">No users found</td></tr> :
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-slate-300 hover:bg-slate-100 transition-colors">
                  <td className="p-4"><span className="text-sm font-bold">{u.email}</span></td>
                  <td className="p-4"><span className="text-xs font-semibold normal-case tracking-normal px-2 py-1 rounded-none bg-red-500/10 text-red-700">{u.role}</span></td>
                  <td className="p-4"><span className={`text-xs font-semibold normal-case tracking-normal ${u.status === 'ACTIVE' ? 'text-green-700' : 'text-red-700'}`}>{u.status}</span></td>
                  <td className="p-4 text-xs text-slate-600">{new Date(u.created_at || new Date()).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.role === 'ORGANIZER' && (
                        <button onClick={() => handleRemoveOrganizer(u.id)} title="Remove Organizer" aria-label="Remove Organizer" className="p-2 hover:bg-orange-500/10 rounded-none text-orange-700 hover:text-orange-700"><Activity size={14} /></button>
                      )}
                      <button onClick={() => handleBanUser(u.id)} title="Ban User" aria-label="Ban User" className="p-2 hover:bg-red-500/10 rounded-none text-red-700 hover:text-red-700"><Ban size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccessCodesTab() {
  const supabase = createSupabaseBrowserClient();
  const [generating, setGenerating] = useState(false);
  const { data: codes, isLoading, refetch } = useQuery({
    queryKey: ['admin-codes'],
    queryFn: async () => {
      const { data } = await supabase.from('organizer_codes').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const code = await generateOrganizerCodeAction();
      toast.success(`Generated code ${code}`);
      refetch();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to generate code');
    }
    setGenerating(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 className="text-sm font-semibold normal-case tracking-tight">Organizer Access Codes</h3>
        <button onClick={handleGenerate} disabled={generating} className="btn-primary text-xs flex items-center gap-2">
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
          Generate New Code
        </button>
      </div>
      <div className="glass w-full overflow-x-auto rounded-none" role="region" aria-label="Dashboard records" tabIndex={0}>
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Code</th>
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Status</th>
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Created At</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={3} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-red-700" /></td></tr> :
              !codes?.length ? <tr><td colSpan={3} className="p-8 text-center text-xs text-slate-600">No codes generated yet</td></tr> :
              codes.map((c) => (
                <tr key={c.id || c.code} className="border-b border-slate-300 hover:bg-slate-100 transition-colors">
                  <td className="p-4"><span className="text-sm font-bold tracking-normal">{c.code}</span></td>
                  <td className="p-4"><span className={`text-xs font-semibold normal-case tracking-normal ${c.is_active !== false ? 'text-green-700' : 'text-red-700'}`}>{c.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                  <td className="p-4 text-xs text-slate-600">{new Date(c.created_at || new Date()).toLocaleString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventsTab() {
  const supabase = createSupabaseBrowserClient();
  const { data: events, isLoading } = useQuery({
    queryKey: ['admin-events'],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*, organizer:users!events_organizer_id_fkey(email)').is('deleted_at', null).order('created_at', { ascending: false });
      return data || [];
    },
  });

  const queryClient = useQueryClient();

  const handleUpdateStatus = async (eventId: string, status: string) => {
    try {
      await adminUpdateEventStatusAction(eventId, status);
      toast.success(`Event status updated to ${status}`);
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    } catch (err) {
      toast.error((err instanceof Error ? err.message : '') || 'Failed to update event status');
    }
  };

  return (
    <div className="glass w-full overflow-x-auto rounded-none" role="region" aria-label="Dashboard records" tabIndex={0}>
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Title</th>
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Organizer</th>
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Status</th>
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Date</th>
            <th className="text-right p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? <tr><td colSpan={5} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-red-700" /></td></tr> :
            !events?.length ? <tr><td colSpan={5} className="p-8 text-center text-xs text-slate-600">No events</td></tr> :
            events.map((ev) => (
              <tr key={ev.id} className="border-b border-slate-300 hover:bg-slate-100 transition-colors">
                <td className="p-4"><span className="text-sm font-bold">{ev.title}</span></td>
                <td className="p-4 text-xs text-slate-600">{ev.organizer?.email}</td>
                <td className="p-4"><span className={`text-xs font-semibold normal-case tracking-normal px-2 py-1 rounded-none ${ev.status === 'LIVE' || ev.status === 'APPROVED' ? 'bg-green-500/10 text-green-700' : ev.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-700' : ev.status === 'ONGOING' ? 'bg-blue-500/10 text-blue-700' : ev.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' : 'bg-red-500/10 text-red-700'}`}>{ev.status}</span></td>
                <td className="p-4 text-xs text-slate-600">{new Date(ev.event_date).toLocaleDateString()}</td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {ev.status !== 'LIVE' && ev.status !== 'APPROVED' && (
                      <button onClick={() => handleUpdateStatus(ev.id, 'LIVE')} className="p-2 hover:bg-green-500/10 rounded-none text-green-700 hover:text-green-700" title="Approve/Go Live" aria-label="Approve/Go Live"><CheckCircle size={14} /></button>
                    )}
                    {ev.status !== 'DRAFT' && ev.status !== 'REJECTED' && (
                      <button onClick={() => handleUpdateStatus(ev.id, 'DRAFT')} className="p-2 hover:bg-red-500/10 rounded-none text-red-700 hover:text-red-700" title="Reject/Draft" aria-label="Reject/Draft"><XCircle size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab() {
  const query = useQuery({ queryKey: ['admin-health'], queryFn: adminHealthAction });
  return <div className="glass max-w-2xl rounded-none p-6 space-y-4">
    <h2 className="text-xl font-bold">System health</h2>
    {query.isPending && <p role="status">Checking services?</p>}
    {query.error && <p role="alert" className="text-red-700">{query.error.message}</p>}
    {query.data && <><p>Database: {query.data.database}</p><p>Storage: {query.data.storage}</p>
      <h3 className="font-bold">Storage buckets</h3>
      {!query.data.buckets.length ? <p>No storage buckets configured.</p> : query.data.buckets.map((bucket: { name: string; public: boolean }) => <p key={bucket.name}>{bucket.name}: {bucket.public ? 'Public' : 'Private'}</p>)}
    </>}
    <button className="btn-secondary" onClick={() => query.refetch()} disabled={query.isFetching}>Refresh status</button>
  </div>;
}
