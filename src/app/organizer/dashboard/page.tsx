'use client';

import { useState, Suspense, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Calendar, Users, DollarSign, Plus, Loader2, ArrowRight, Tag, Trash2, X, FileText, Trophy, BarChart3, MoreVertical, Copy, Archive, XCircle, CheckCircle } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useOrganizerCoupons, useToggleCoupon } from '@/hooks/use-coupons';
import { createCouponAction, deleteCouponAction } from '@/lib/server/actions/coupon.actions';
import { createFormTemplateAction, deleteFormTemplateAction } from '@/lib/server/actions/form-template.actions';
import { duplicateEventAction } from '@/lib/server/actions/event.actions';
import { getEventAnalyticsAction } from '@/lib/server/actions/analytics.actions';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import slugify from 'slugify';
import { toast } from 'sonner';

type Tab = 'overview' | 'events' | 'registrations' | 'results' | 'coupons' | 'form-templates' | 'analytics';

export default function OrganizerDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-500" /></div>}>
      <OrganizerDashboardContent />
    </Suspense>
  );
}

function OrganizerDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get('tab') as Tab) || 'overview';
  const supabase = createSupabaseBrowserClient();

  const setTab = (newTab: Tab) => {
    router.push(`/organizer/dashboard?tab=${newTab}`);
  };

  const { data: stats, isLoading } = useQuery({
    queryKey: ['org-stats'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      // Fetch user profile for welcome message
      const { data: profile } = await supabase.from('users').select('first_name').eq('id', user.id).single();
      
      const { data: events } = await supabase.from('events').select('*').eq('organizer_id', user.id).is('deleted_at', null);
      const eventIds = events?.map((e: any) => e.id) || [];
      
      const { data: regs } = await supabase.from('registrations').select('total_amount, status, event_id').in('event_id', eventIds);
      
      const now = new Date();
      
      return {
        firstName: profile?.first_name || 'Organizer',
        totalEvents: events?.length || 0,
        draftEvents: events?.filter((e: any) => e.status === 'DRAFT').length || 0,
        liveEvents: events?.filter((e: any) => e.status === 'LIVE').length || 0,
        completedEvents: events?.filter((e: any) => e.status === 'COMPLETED').length || 0,
        totalRegistrations: regs?.length || 0,
        pendingApprovals: regs?.filter((r: any) => r.status === 'PENDING').length || 0,
        totalRevenue: regs?.filter((r: any) => r.status === 'PAID').reduce((s: number, r: any) => s + Number(r.total_amount), 0) || 0,
      };
    },
    staleTime: 30_000,
  });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-black">
      <Sidebar variant="organizer" />
      <div className="flex-1 overflow-auto w-full">
        <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/10 pl-14 lg:pl-8 pr-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-lg font-display font-black uppercase tracking-tighter">
              ORGANIZER <span className="text-blue-500">HUB</span>
            </h1>
          </div>
        </header>
        <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {tab === 'overview' && <OverviewTab stats={stats} loading={isLoading} />}
          {tab === 'events' && <EventsTab />}
          {tab === 'registrations' && <RegistrationsTab />}
          {tab === 'results' && <ResultsTab />}
          {tab === 'coupons' && <CouponsTab />}
          {tab === 'form-templates' && <FormTemplatesTab />}
          {tab === 'analytics' && <AnalyticsTab />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ stats, loading }: { stats: any; loading: boolean }) {
  const cards = [
    { label: 'Total Events', value: stats?.totalEvents, icon: Calendar, color: 'text-blue-500' },
    { label: 'Drafts', value: stats?.draftEvents, icon: Calendar, color: 'text-white/50' },
    { label: 'Live Events', value: stats?.liveEvents, icon: Calendar, color: 'text-green-500' },
    { label: 'Completed', value: stats?.completedEvents, icon: Trophy, color: 'text-purple-500' },
    { label: 'Total Registrations', value: stats?.totalRegistrations, icon: Users, color: 'text-green-500' },
    { label: 'Pending Approvals', value: stats?.pendingApprovals, icon: Users, color: 'text-orange-500' },
    { label: 'Gross Revenue', value: `RM ${(stats?.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: 'text-brand' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-display font-black tracking-tighter mb-1">
          Welcome back, {loading ? '...' : stats?.firstName}
        </h2>
        <p className="text-sm text-white/50">Here's what's happening with your events today.</p>
      </div>
      
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-white/30">Overview Metrics</h2>
        <Link href="/organizer/dashboard/events/new" className="btn-primary text-xs !py-3">
          <Plus size={14} /> New Event
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">{c.label}</p>
              <c.icon size={18} className={c.color} />
            </div>
            {loading ? <div className="h-8 bg-white/5 rounded animate-pulse" /> :
              <p className={`text-3xl font-display font-black tracking-tighter ${c.color}`}>{c.value || 0}</p>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EventsTab() {
  const supabase = createSupabaseBrowserClient();
  const { data: events, isLoading } = useQuery({
    queryKey: ['org-events'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('events').select('*, event_categories(*)').eq('organizer_id', user.id).is('deleted_at', null).order('created_at', { ascending: false });
      return data || [];
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-white/30">My Events</h2>
        <Link href="/organizer/dashboard/events/new" className="btn-primary text-xs !py-3">
          <Plus size={14} /> New Event
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? <div className="col-span-full py-20 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-500" /></div> :
          !events?.length ? <div className="col-span-full py-20 text-center"><p className="text-xs text-white/20">No events yet. Create your first event!</p></div> :
          events.map((ev: any, i: number) => (
            <EventCard key={ev.id} ev={ev} index={i} />
          ))}
      </div>
    </div>
  );
}

function EventCard({ ev, index }: { ev: any; index: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  const handleAction = async (actionFn: () => Promise<any>, successMsg: string) => {
    try {
      setLoading(true);
      await actionFn();
      toast.success(successMsg);
      qc.invalidateQueries({ queryKey: ['organizer-events'] });
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from('events').update({ status }).eq('id', ev.id);
    if (error) throw error;
    qc.setQueryData(['organizer-events'], (old: any) => {
      if (!old) return old;
      return old.map((e: any) => e.id === ev.id ? { ...e, status } : e);
    });
  };

  const deleteEvent = async () => {
    const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', ev.id);
    if (error) throw error;
    qc.setQueryData(['organizer-events'], (old: any) => {
      if (!old) return old;
      return old.filter((e: any) => e.id !== ev.id);
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      className="glass rounded-2xl p-6 flex flex-col justify-between relative"
    >
      {loading && (
        <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center z-20 backdrop-blur-sm">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      )}
      <div>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-tight pr-8">{ev.title}</h3>
          
          <div className="absolute top-6 right-6">
            <button onClick={() => setMenuOpen(!menuOpen)} className="text-white/30 hover:text-white transition-colors">
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 w-48 glass rounded-xl border border-white/10 shadow-xl overflow-hidden z-30">
                <div className="flex flex-col text-xs font-bold">
                  {ev.status !== 'LIVE' && (
                    <button onClick={() => handleAction(() => updateStatus('LIVE'), 'Event Published')} className="flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-left w-full transition-colors">
                      <CheckCircle size={14} className="text-green-500" /> Publish
                    </button>
                  )}
                  {ev.status === 'LIVE' && (
                    <button onClick={() => handleAction(() => updateStatus('DRAFT'), 'Event Unpublished')} className="flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-left w-full transition-colors">
                      <XCircle size={14} className="text-yellow-500" /> Unpublish (Draft)
                    </button>
                  )}
                  <button onClick={() => handleAction(() => duplicateEventAction(ev.id), 'Event Duplicated')} className="flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-left w-full transition-colors">
                    <Copy size={14} className="text-blue-500" /> Duplicate
                  </button>
                  {ev.status !== 'CANCELED' && (
                    <button onClick={() => handleAction(() => updateStatus('CANCELED'), 'Event Canceled')} className="flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-left w-full transition-colors">
                      <X size={14} className="text-red-500" /> Cancel
                    </button>
                  )}
                  {ev.status !== 'ARCHIVED' && (
                    <button onClick={() => handleAction(() => updateStatus('ARCHIVED'), 'Event Archived')} className="flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-left w-full transition-colors">
                      <Archive size={14} className="text-purple-500" /> Archive
                    </button>
                  )}
                  <div className="h-px bg-white/10 w-full" />
                  <button onClick={() => {
                    if (confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
                      handleAction(() => deleteEvent(), 'Event Deleted');
                    }
                  }} className="flex items-center gap-2 px-4 py-3 hover:bg-red-500/10 text-red-500 text-left w-full transition-colors">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="mb-4">
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
            ev.status === 'DRAFT' ? 'bg-white/10 text-white/50' :
            ev.status === 'LIVE' ? 'bg-green-500/10 text-green-500' :
            ev.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' :
            ev.status === 'CANCELED' ? 'bg-red-500/10 text-red-500' :
            ev.status === 'ARCHIVED' ? 'bg-purple-500/10 text-purple-500' :
            'bg-blue-500/10 text-blue-500'
          }`}>{ev.status}</span>
        </div>
        
        <p className="text-[10px] text-white/30 mb-4">
          {ev.event_categories?.length || 0} categories • {new Date(ev.event_date).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <Link href={`/organizer/dashboard/events/${ev.id}`}
          className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:gap-2 transition-all flex items-center gap-1"
        >Manage <ArrowRight size={12} /></Link>
      </div>
      
      {/* Click outside overlay to close menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
      )}
    </motion.div>
  );
}

function RegistrationsTab() {
  const supabase = createSupabaseBrowserClient();
  const { data: regs, isLoading } = useQuery({
    queryKey: ['org-registrations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('registrations').select('*, events(title), participants(full_name)').order('created_at', { ascending: false });
      return (data || []).filter((r: any) => r.events?.organizer_id === user.id);
    },
    staleTime: 10_000,
  });

  const exportFinancialCSV = () => {
    if (!regs || regs.length === 0) return;
    const headers = ['Registration Number', 'Attendee Name', 'Event Title', 'Total Amount (RM)', 'Discount (RM)', 'Net Amount (RM)', 'Status', 'Registration Date'];
    const rows = regs.map((r: any) => [
      r.registration_number,
      r.participants?.[0]?.full_name || 'Unknown',
      r.events?.title || 'Unknown',
      Number(r.total_amount).toFixed(2),
      Number(r.discount_amount).toFixed(2),
      Number(r.net_amount).toFixed(2),
      r.status,
      new Date(r.created_at).toLocaleDateString()
    ]);
    
    const csvContent = [headers.join(','), ...rows.map((e: string[]) => e.map((val: string) => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `financial-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Financial report CSV downloaded');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-black uppercase tracking-widest text-white/30 font-display">Registrations & Financials</h2>
        <button
          onClick={exportFinancialCSV}
          disabled={!regs || regs.length === 0}
          className="btn-primary text-[10px] !py-2.5 flex items-center gap-1.5"
        >
          <FileText size={12} /> Export Financial CSV
        </button>
      </div>

      <div className="glass rounded-2xl overflow-hidden overflow-x-auto w-full">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Athlete</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Event</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Status</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={4} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-blue-500" /></td></tr> :
              !regs?.length ? <tr><td colSpan={4} className="p-8 text-center text-xs text-white/20">No registrations</td></tr> :
              regs.map((r: any) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 text-sm font-bold">{(r as any).participants?.[0]?.full_name || 'Unknown'}</td>
                  <td className="p-4 text-xs text-white/40">{(r as any).events?.title}</td>
                  <td className="p-4"><span className={`text-[10px] font-black uppercase tracking-widest ${r.status === 'PAID' ? 'text-green-500' : r.status === 'PENDING' ? 'text-yellow-500' : 'text-red-500'}`}>{r.status}</span></td>
                  <td className="p-4 text-[10px] text-white/30">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultsTab() {
  const supabase = createSupabaseBrowserClient();
  const { data: events, isLoading } = useQuery({
    queryKey: ['org-results-events'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('events').select('id, title, results_finalized').eq('organizer_id', user.id).is('deleted_at', null);
      return data || [];
    },
  });

  const exportResultsCSV = async (eventId: string, eventTitle: string) => {
    try {
      const { data: results, error } = await supabase
        .from('results')
        .select('*')
        .eq('event_id', eventId)
        .order('rank_overall', { ascending: true });

      if (error) throw error;
      if (!results || results.length === 0) {
        toast.error('No results found for this event');
        return;
      }

      const headers = ['Rank Overall', 'Rank Category', 'Bib Number', 'Participant Name', 'Category Name', 'Gun Time', 'Net Time'];
      const rows = results.map((r: any) => [
        String(r.rank_overall || ''),
        String(r.rank_category || ''),
        String(r.bib_number || ''),
        String(r.participant_name || ''),
        String(r.category_name || ''),
        String(r.gun_time || ''),
        String(r.net_time || '')
      ]);

      const csvContent = [headers.join(','), ...rows.map((e: string[]) => e.map((val: string) => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `results-${eventTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Results CSV exported');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export results');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/organizer/dashboard/results/import" className="btn-secondary text-xs">Import Results</Link>
      </div>
      <div className="glass rounded-2xl overflow-hidden overflow-x-auto w-full">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Event</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Finalized</th>
              <th className="text-right p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={3} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-blue-500" /></td></tr> :
              !events?.length ? <tr><td colSpan={3} className="p-8 text-center text-xs text-white/20">No events</td></tr> :
              events.map((ev: any) => (
                <tr key={ev.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 text-sm font-bold">{ev.title}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${ev.results_finalized ? 'text-green-500' : 'text-yellow-500'}`}>
                      {ev.results_finalized ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-3 items-center">
                      <button
                        onClick={() => exportResultsCSV(ev.id, ev.title)}
                        className="text-[10px] text-blue-500 hover:underline font-black uppercase tracking-widest"
                      >
                        Export CSV
                      </button>
                      <Link href={`/organizer/dashboard/results/finalize/${ev.id}`} className="text-[10px] text-blue-500 hover:underline font-black uppercase tracking-widest">
                        Manage
                      </Link>
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

function CouponsTab() {
  const { data: coupons, isLoading, refetch } = useOrganizerCoupons();
  const toggleMutation = useToggleCoupon();
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE');
  const [value, setValue] = useState(10);
  const [maxUses, setMaxUses] = useState('');
  const [minOrder, setMinOrder] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setAdding(true);
    try {
      const fd = new FormData();
      fd.append('code', code);
      fd.append('type', type);
      fd.append('value', String(value));
      if (maxUses) fd.append('max_uses', maxUses);
      if (minOrder) fd.append('min_order_amount', minOrder);
      
      await createCouponAction(fd);
      toast.success('Coupon created successfully');
      setCode('');
      setMaxUses('');
      setMinOrder('');
      setShowAddForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create coupon');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await deleteCouponAction(id);
      toast.success('Coupon deleted successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete coupon');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-white/30">Coupons</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary text-xs !py-3"
        >
          <Plus size={14} /> New Coupon
        </button>
      </div>

      {showAddForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleCreate}
          className="glass rounded-2xl p-6 mb-6 space-y-4"
        >
          <h3 className="text-xs font-black uppercase tracking-widest text-blue-500 mb-2">Create Coupon</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label-text">Coupon Code</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. RACE20"
                required
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Discount Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as 'FIXED' | 'PERCENTAGE')}
                className="input-field"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (RM)</option>
              </select>
            </div>
            <div>
              <label className="label-text">Discount Value</label>
              <input
                type="number"
                value={value}
                onChange={e => setValue(Number(e.target.value))}
                min="1"
                required
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Max Total Uses (Optional)</label>
              <input
                type="number"
                value={maxUses}
                onChange={e => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Min Order Amount (RM, Optional)</label>
              <input
                type="number"
                value={minOrder}
                onChange={e => setMinOrder(e.target.value)}
                placeholder="None"
                className="input-field"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={adding} className="btn-primary text-xs">
              {adding ? <Loader2 size={12} className="animate-spin" /> : null}
              {adding ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary text-xs">
              Cancel
            </button>
          </div>
        </motion.form>
      )}

      {isLoading ? (
        <div className="py-20 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-500" /></div>
      ) : !coupons?.length ? (
        <div className="py-20 text-center">
          <p className="text-xs text-white/20 font-bold uppercase tracking-widest">No coupon campaigns active</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden overflow-x-auto w-full">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Code</th>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Type</th>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Value</th>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Uses</th>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Min Spend</th>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Status</th>
                <th className="text-right p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono font-bold text-blue-500">{c.code}</td>
                  <td className="p-4 text-[10px] text-white/40">{c.type}</td>
                  <td className="p-4 text-xs font-bold">
                    {c.type === 'PERCENTAGE' ? `${c.value}%` : `RM${c.value}`}
                  </td>
                  <td className="p-4 text-xs">
                    {c.current_uses} / {c.max_uses || '∞'}
                  </td>
                  <td className="p-4 text-xs">
                    RM{c.min_order_amount}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleMutation.mutate({ couponId: c.id, isActive: !c.is_active })}
                      className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        c.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {c.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FormTemplatesTab() {
  const supabase = createSupabaseBrowserClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<{ id: string; type: string; label: string; required: boolean }[]>([
    { id: 'full_name', type: 'TEXT', label: 'Full Name', required: true }
  ]);

  const { data: templates, isLoading, refetch } = useQuery({
    queryKey: ['form-templates-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const handleAddField = () => {
    setFields(prev => [...prev, {
      id: `field_${Math.random().toString(36).substr(2, 9)}`,
      type: 'TEXT',
      label: '',
      required: false
    }]);
  };

  const handleRemoveField = (idx: number) => {
    setFields(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFieldChange = (idx: number, key: string, val: any) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setAdding(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('description', description);
      
      const cleanedFields = fields.map(f => ({
        ...f,
        id: f.label ? slugify(f.label, { lower: true, strict: true }).replace(/-/g, '_') : f.id
      }));
      fd.append('fields', JSON.stringify(cleanedFields));

      await createFormTemplateAction(fd);
      toast.success('Form template created successfully');
      setName('');
      setDescription('');
      setFields([{ id: 'full_name', type: 'TEXT', label: 'Full Name', required: true }]);
      setShowAddForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create form template');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await deleteFormTemplateAction(id);
      toast.success('Template deleted successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-white/30">Registration Forms</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary text-xs !py-3"
        >
          <Plus size={14} /> New Template
        </button>
      </div>

      {showAddForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleCreate}
          className="glass rounded-2xl p-6 mb-6 space-y-4"
        >
          <h3 className="text-xs font-black uppercase tracking-widest text-blue-500 mb-2">Create Registration Form Template</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Standard Marathon Entry"
                required
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="General description..."
                className="input-field"
              />
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Form Fields</h4>
              <button
                type="button"
                onClick={handleAddField}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-white/5 hover:bg-white/10 rounded-full text-white/70"
              >
                + Add Field
              </button>
            </div>

            {fields.map((f, idx) => (
              <div key={idx} className="flex flex-col md:flex-row md:items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="flex-1">
                  <input
                    type="text"
                    value={f.label}
                    onChange={e => handleFieldChange(idx, 'label', e.target.value)}
                    placeholder="Field Label (e.g. Emergency Contact Number)"
                    required
                    className="input-field !py-2 !text-xs"
                  />
                </div>
                <div className="w-full md:w-36">
                  <select
                    value={f.type}
                    onChange={e => handleFieldChange(idx, 'type', e.target.value)}
                    className="input-field !py-2 !text-xs"
                  >
                    <option value="TEXT">Text</option>
                    <option value="NUMBER">Number</option>
                    <option value="EMAIL">Email</option>
                    <option value="PHONE">Phone Number</option>
                    <option value="DATE">Date</option>
                    <option value="CHECKBOX">Checkbox</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer self-start md:self-auto py-1">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={e => handleFieldChange(idx, 'required', e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500"
                  />
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Required</span>
                </label>
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveField(idx)}
                    className="p-1 hover:bg-red-500/10 rounded text-red-500/50 hover:text-red-500 self-end md:self-auto"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button type="submit" disabled={adding} className="btn-primary text-xs">
              {adding ? <Loader2 size={12} className="animate-spin" /> : null}
              {adding ? 'Creating...' : 'Create Template'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary text-xs">
              Cancel
            </button>
          </div>
        </motion.form>
      )}

      {isLoading ? (
        <div className="py-20 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-500" /></div>
      ) : !templates?.length ? (
        <div className="py-20 text-center">
          <p className="text-xs text-white/20 font-bold uppercase tracking-widest">No custom forms created</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t: any) => (
            <div key={t.id} className="glass rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-black uppercase tracking-tight">{t.name}</h3>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    t.is_system ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'
                  }`}>{t.is_system ? 'System' : 'Custom'}</span>
                </div>
                <p className="text-[10px] text-white/40 mb-4">{t.description || 'No description provided'}</p>
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Fields ({t.fields?.length || 0}):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {t.fields?.map((f: any, i: number) => (
                      <span key={i} className="text-[9px] font-mono bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg text-white/60">
                        {f.label} {f.required && '*'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {!t.is_system && (
                <div className="flex justify-end pt-4 border-t border-white/5 mt-4">
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsTab() {
  const supabase = createSupabaseBrowserClient();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [shareableToken, setShareableToken] = useState<string>('');

  useEffect(() => {
    async function loadEvents() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('events')
        .select('id, title, shareable_analytics_token')
        .eq('organizer_id', user.id)
        .is('deleted_at', null)
        .order('event_date', { ascending: false });

      if (data && data.length > 0) {
        setEvents(data);
        setSelectedEventId(data[0].id);
        setShareableToken(data[0].shareable_analytics_token);
      }
      setLoadingEvents(false);
    }
    loadEvents();
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    async function loadAnalytics() {
      setLoadingData(true);
      try {
        const res = await getEventAnalyticsAction(selectedEventId);
        setAnalyticsData(res);
        
        const ev = events.find(e => e.id === selectedEventId);
        if (ev) {
          setShareableToken(ev.shareable_analytics_token);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load analytics');
      } finally {
        setLoadingData(false);
      }
    }
    loadAnalytics();
  }, [selectedEventId]);

  if (loadingEvents) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={24} />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
        <BarChart3 className="mx-auto text-white/20 mb-3" size={32} />
        <p className="text-xs font-black uppercase tracking-widest text-white/30">No events found for analytics</p>
      </div>
    );
  }

  const participants = analyticsData?.participants || [];
  const registrations = analyticsData?.registrations || [];

  const COLORS = ['#0088FE', '#FF8042', '#00C49F', '#FFBB28', '#8884d8'];

  // 1. Gender breakdown
  const genderCounts: Record<string, number> = {};
  participants.forEach((p: any) => {
    const g = (p.gender || 'Unknown').toUpperCase();
    genderCounts[g] = (genderCounts[g] || 0) + 1;
  });
  const genderData = Object.entries(genderCounts).map(([name, value]) => ({ name, value }));

  // 2. Country breakdown
  const countryCounts: Record<string, number> = {};
  participants.forEach((p: any) => {
    const c = p.country || 'Malaysia';
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });
  const countryData = Object.entries(countryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // 3. Age breakdown
  const ageGroups = [
    { name: 'Under 18', min: 0, max: 17, count: 0 },
    { name: '18 - 29', min: 18, max: 29, count: 0 },
    { name: '30 - 45', min: 30, max: 45, count: 0 },
    { name: '46+', min: 46, max: 200, count: 0 },
  ];
  participants.forEach((p: any) => {
    const age = p.age || 0;
    const group = ageGroups.find(g => age >= g.min && age <= g.max);
    if (group) group.count += 1;
  });
  const ageData = ageGroups.map(g => ({ name: g.name, value: g.count }));

  const totalAttendees = participants.length;
  const totalRevenue = registrations
    .filter((r: any) => r.status === 'CONFIRMED' || r.status === 'PAID')
    .reduce((sum: number, r: any) => sum + Number(r.total_amount), 0);

  const copyShareableLink = () => {
    const link = `${window.location.origin}/events/analytics/${shareableToken}`;
    navigator.clipboard.writeText(link);
    toast.success('Shareable analytics link copied to clipboard!');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <label className="label-text">Select Event</label>
          <select
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            className="input-field min-w-[280px]"
          >
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>
        
        {shareableToken && (
          <button
            onClick={copyShareableLink}
            className="btn-primary text-xs flex items-center justify-center gap-2 whitespace-nowrap self-end sm:self-center"
          >
            <Copy size={14} /> Copy Shareable Link
          </button>
        )}
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-500" size={24} />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass rounded-2xl p-6 border border-white/5">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Total Participants</p>
              <div className="flex items-center gap-3">
                <Users className="text-blue-500" size={24} />
                <p className="text-3xl font-display font-black tracking-tight">{totalAttendees}</p>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 border border-white/5">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Registrations Confirmed</p>
              <div className="flex items-center gap-3">
                <CheckCircle className="text-green-500" size={24} />
                <p className="text-3xl font-display font-black tracking-tight">
                  {registrations.filter((r: any) => r.status === 'CONFIRMED' || r.status === 'PAID').length}
                </p>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 border border-white/5">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Revenue (MYR)</p>
              <div className="flex items-center gap-3">
                <DollarSign className="text-yellow-500" size={24} />
                <p className="text-3xl font-display font-black tracking-tight font-mono">RM{totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-[2rem] p-6 border border-white/5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/30">Gender Distribution</h3>
              <div className="h-64 flex items-center justify-center">
                {genderData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {genderData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-white/20">No gender demographic data available</p>
                )}
              </div>
            </div>

            <div className="glass rounded-[2rem] p-6 border border-white/5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/30">Age Demographics</h3>
              <div className="h-64">
                {participants.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageData}>
                      <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Bar dataKey="value" fill="#0088FE" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-white/20">No age demographic data available</p>
                )}
              </div>
            </div>

            <div className="glass rounded-[2rem] p-6 border border-white/5 space-y-4 lg:col-span-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/30">Country Distribution</h3>
              <div className="h-64">
                {countryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={countryData} layout="vertical">
                      <XAxis type="number" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} width={100} />
                      <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Bar dataKey="value" fill="#00C49F" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-white/20">No country demographic data available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
