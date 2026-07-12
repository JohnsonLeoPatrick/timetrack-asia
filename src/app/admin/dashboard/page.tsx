'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Activity, Users, Calendar, DollarSign, Clock, AlertTriangle,
  Search, Ban, Trash2, CheckCircle, XCircle, Loader2, Key, Plus, X
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { adminToggleUserStatusAction, adminUpdateUserRoleAction, generateOrganizerCodeAction, adminCreateUserAction } from '@/lib/server/actions/admin.actions';
import { adminUpdateEventStatusAction } from '@/lib/server/actions/event.actions';
import { toast } from 'sonner';

type Tab = 'overview' | 'users' | 'events' | 'payments' | 'codes' | 'settings';

export default function AdminDashboardPage() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) || 'overview';

  const supabase = createSupabaseBrowserClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [events, users, regs] = await Promise.all([
        supabase.from('events').select('*'),
        supabase.from('users').select('*'),
        supabase.from('registrations').select('total_amount, status'),
      ]);
      const now = new Date();
      return {
        totalUsers: users.data?.length || 0,
        totalOrganizers: users.data?.filter((u: any) => u.role === 'ORGANIZER').length || 0,
        activeEvents: events.data?.filter((e: any) => e.status === 'LIVE').length || 0,
        upcomingEvents: events.data?.filter((e: any) => new Date(e.event_date) > now).length || 0,
        ticketsSold: regs.data?.filter((r: any) => r.status === 'CONFIRMED').length || 0,
        totalRevenue: regs.data?.filter((r: any) => r.status === 'CONFIRMED' || r.status === 'PAID').reduce((s: number, r: any) => s + Number(r.total_amount), 0) || 0,
        pendingEvents: events.data?.filter((e: any) => e.status === 'PENDING').length || 0,
      };
    },
    staleTime: 30_000,
  });

  const statsCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'text-blue-500' },
    { label: 'Total Organizers', value: stats?.totalOrganizers || 0, icon: Users, color: 'text-purple-500' },
    { label: 'Active Events', value: stats?.activeEvents || 0, icon: Activity, color: 'text-green-500' },
    { label: 'Upcoming Events', value: stats?.upcomingEvents || 0, icon: Calendar, color: 'text-brand' },
    { label: 'Tickets Sold', value: stats?.ticketsSold || 0, icon: CheckCircle, color: 'text-indigo-500' },
    { label: 'Revenue (MYR)', value: `RM${(stats?.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: 'text-yellow-500' },
    { label: 'Pending Approvals', value: stats?.pendingEvents || 0, icon: AlertTriangle, color: 'text-orange-500' },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar variant="admin" />
      <div className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/10 px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-display font-black uppercase tracking-tighter">
              ADMIN <span className="text-red-500">DASHBOARD</span>
            </h1>
          </div>
        </header>
        <div className="p-8">
          {tab === 'overview' && <OverviewTab stats={statsCards} loading={isLoading} />}
          {tab === 'users' && <UsersTab />}
          {tab === 'events' && <EventsTab />}
          {tab === 'payments' && <div className="text-center py-20"><p className="text-xs text-white/20">Payment management coming soon</p></div>}
          {tab === 'codes' && <AccessCodesTab />}
          {tab === 'settings' && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ stats, loading }: { stats: any[]; loading: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map((s, i) => (
        <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">{s.label}</p>
            <s.icon size={18} className={s.color} />
          </div>
          {loading ? <div className="h-8 bg-white/5 rounded animate-pulse" /> :
            <p className={`text-3xl font-display font-black tracking-tighter ${s.color}`}>{s.value}</p>}
        </motion.div>
      ))}
    </div>
  );
}

function UsersTab() {
  const supabase = createSupabaseBrowserClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'ORGANIZER' | 'ATHLETE'>('ORGANIZER');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('id, email, role, status, first_name, last_name, created_at').order('created_at', { ascending: false });
      return data || [];
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => {
      const user = res.data?.user;
      if (user) {
        setCurrentUserRole(user.user_metadata?.role || 'ADMIN');
      }
    });
  }, []);
  
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !firstName || !lastName) {
      toast.error('Please fill in all required fields');
      return;
    }
    setCreating(true);
    try {
      await adminCreateUserAction(email, password, role, firstName, lastName, phone);
      toast.success('User created successfully');
      setShowCreate(false);
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setPhone('');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };
  
  const handleBanUser = async (id: string) => {
    if (!confirm('Are you sure you want to ban this user?')) return;
    await adminToggleUserStatusAction(id, 'BANNED');
    await supabase.from('users').eq('id', id).update({ status: 'BANNED' });
    refetch();
  };

  const handleRemoveOrganizer = async (id: string) => {
    if (!confirm('Are you sure you want to remove organizer privileges from this user?')) return;
    await adminUpdateUserRoleAction(id, 'ATHLETE');
    await supabase.from('users').eq('id', id).update({ role: 'ATHLETE' });
    refetch();
  };

  const filtered = (users || []).filter((u: any) => u.email?.toLowerCase().includes(search.toLowerCase()));

  const roleOptions = currentUserRole === 'SUPER_ADMIN'
    ? ['ATHLETE', 'ORGANIZER', 'ADMIN', 'SUPER_ADMIN']
    : ['ATHLETE', 'ORGANIZER'];

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-red-500/50 transition-all" />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary text-xs flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Plus size={14} /> Create User
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-[2rem] border border-white/10 bg-[#0f0f0f] w-full max-w-md p-8 relative">
            <button
              onClick={() => setShowCreate(false)}
              className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
            <h3 className="text-xl font-display font-black uppercase tracking-tight mb-6">Create New User</h3>
            
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="label-text">First Name *</label>
                <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="input-field" placeholder="e.g. John" />
              </div>
              
              <div>
                <label className="label-text">Last Name *</label>
                <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="input-field" placeholder="e.g. Doe" />
              </div>
              
              <div>
                <label className="label-text">Email Address *</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="e.g. user@domain.com" />
              </div>
              
              <div>
                <label className="label-text">Password *</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="••••••••" />
              </div>
              
              <div>
                <label className="label-text">Phone Number</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="input-field" placeholder="e.g. +60123456789" />
              </div>

              <div>
                <label className="label-text">Account Role *</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                  className="input-field"
                >
                  {roleOptions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button type="submit" disabled={creating} className="btn-primary text-xs flex-1">
                  {creating ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                  Create Account
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            {isLoading ? <tr><td colSpan={5} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-red-500" /></td></tr> :
              filtered.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-xs text-white/20">No users found</td></tr> :
              filtered.map((u: any) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4"><span className="text-sm font-bold">{u.email}</span></td>
                  <td className="p-4"><span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-red-500/10 text-red-500">{u.role}</span></td>
                  <td className="p-4"><span className={`text-[10px] font-black uppercase tracking-widest ${u.status === 'ACTIVE' ? 'text-green-500' : 'text-red-500'}`}>{u.status}</span></td>
                  <td className="p-4 text-[10px] text-white/30">{new Date(u.created_at || new Date()).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.role === 'ORGANIZER' && (
                        <button onClick={() => handleRemoveOrganizer(u.id)} title="Remove Organizer" className="p-2 hover:bg-orange-500/10 rounded-lg text-orange-500/50 hover:text-orange-500"><Activity size={14} /></button>
                      )}
                      <button onClick={() => handleBanUser(u.id)} title="Ban User" className="p-2 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-500"><Ban size={14} /></button>
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
      await supabase.from('organizer_codes').insert({ code, created_at: new Date().toISOString(), is_active: true });
      refetch();
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black uppercase tracking-tight">Organizer Access Codes</h3>
        <button onClick={handleGenerate} disabled={generating} className="btn-primary text-xs flex items-center gap-2">
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
          Generate New Code
        </button>
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Code</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Status</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Created At</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={3} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-red-500" /></td></tr> :
              !codes?.length ? <tr><td colSpan={3} className="p-8 text-center text-xs text-white/20">No codes generated yet</td></tr> :
              codes.map((c: any) => (
                <tr key={c.id || c.code} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4"><span className="text-sm font-bold tracking-widest">{c.code}</span></td>
                  <td className="p-4"><span className={`text-[10px] font-black uppercase tracking-widest ${c.is_active !== false ? 'text-green-500' : 'text-red-500'}`}>{c.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                  <td className="p-4 text-[10px] text-white/30">{new Date(c.created_at || new Date()).toLocaleString()}</td>
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to update event status');
    }
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Title</th>
            <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Organizer</th>
            <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Status</th>
            <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Date</th>
            <th className="text-right p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? <tr><td colSpan={5} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-red-500" /></td></tr> :
            !events?.length ? <tr><td colSpan={5} className="p-8 text-center text-xs text-white/20">No events</td></tr> :
            events.map((ev: any) => (
              <tr key={ev.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4"><span className="text-sm font-bold">{ev.title}</span></td>
                <td className="p-4 text-xs text-white/40">{ev.organizer?.email}</td>
                <td className="p-4"><span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${ev.status === 'LIVE' || ev.status === 'APPROVED' ? 'bg-green-500/10 text-green-500' : ev.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' : ev.status === 'ONGOING' ? 'bg-blue-500/10 text-blue-500' : ev.status === 'DRAFT' ? 'bg-white/10 text-white/50' : 'bg-red-500/10 text-red-500'}`}>{ev.status}</span></td>
                <td className="p-4 text-[10px] text-white/30">{new Date(ev.event_date).toLocaleDateString()}</td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {ev.status !== 'LIVE' && ev.status !== 'APPROVED' && (
                      <button onClick={() => handleUpdateStatus(ev.id, 'LIVE')} className="p-2 hover:bg-green-500/10 rounded-lg text-green-500/50 hover:text-green-500" title="Approve/Go Live"><CheckCircle size={14} /></button>
                    )}
                    {ev.status !== 'DRAFT' && ev.status !== 'REJECTED' && (
                      <button onClick={() => handleUpdateStatus(ev.id, 'DRAFT')} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-500" title="Reject/Draft"><XCircle size={14} /></button>
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
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-black uppercase tracking-tight mb-4">System Health</h3>
        {['banners', 'results', 'avatars'].map(bucket => (
          <div key={bucket} className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-xs font-bold uppercase tracking-widest text-white/40">{bucket}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-green-500">Operational</span>
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-black uppercase tracking-tight mb-4">Maintenance Mode</h3>
        <p className="text-xs text-white/30 mb-4">Enable maintenance mode to prevent user access during updates.</p>
        <button className="btn-secondary text-xs">Toggle Maintenance</button>
      </div>
    </div>
  );
}
