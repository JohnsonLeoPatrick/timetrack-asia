'use client';

import { useState, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Calendar, Users, DollarSign, Plus, Loader2, ArrowRight, Tag, Trash2, X, FileText, Trophy, BarChart3, MoreVertical, Copy, Archive, XCircle, CheckCircle } from 'lucide-react';
import { OrganizerAnalyticsTab } from '@/components/layout/dashboard-data-tabs';
import { DashboardFrame, DashboardLoading } from '@/components/layout/dashboard-frame';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useOrganizerCoupons, useToggleCoupon } from '@/hooks/use-coupons';
import { useOrganizerEvents } from '@/hooks/use-events';
import { createCouponAction, deleteCouponAction } from '@/lib/server/actions/coupon.actions';
import { createFormTemplateAction, deleteFormTemplateAction } from '@/lib/server/actions/form-template.actions';
import { duplicateEventAction } from '@/lib/server/actions/event.actions';
import slugify from 'slugify';
import { toast } from 'sonner';
import { FieldSelect } from '@/components/ui/field-select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { AccountSettings } from '@/components/layout/account-settings';

type Tab = 'overview' | 'events' | 'registrations' | 'results' | 'coupons' | 'form-templates' | 'analytics' | 'settings';

export default function OrganizerDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-700" /></div>}>
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

  const { data: stats, isLoading, error: statsError, refetch: retryStats } = useQuery({
    queryKey: ['org-stats'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Fetch user profile for welcome message
      const { data: profile } = await supabase.from('users').select('username').eq('id', user.id).single();

      const { data: events, error: eventsError } = await supabase.from('events').select('*').eq('organizer_id', user.id).is('deleted_at', null);
      if (eventsError) throw new Error('Overview could not be loaded. Please try again.');
      const eventIds = events?.map((e) => e.id) || [];

      const { data: regs, error: registrationsError } = await supabase.from('registrations').select('net_amount, status, event_id').in('event_id', eventIds).is('deleted_at', null);
      if (registrationsError) throw new Error('Registration totals could not be loaded. Please try again.');

      const now = new Date();

      return {
        firstName: profile?.username || 'Organizer',
        totalEvents: events?.length || 0,
        draftEvents: events?.filter((e) => e.status === 'DRAFT').length || 0,
        liveEvents: events?.filter((e) => e.status === 'LIVE').length || 0,
        completedEvents: events?.filter((e) => e.status === 'COMPLETED').length || 0,
        totalRegistrations: regs?.length || 0,
        pendingApprovals: regs?.filter((r) => r.status === 'PENDING').length || 0,
        totalRevenue: regs?.filter((r) => r.status === 'PAID').reduce((s: number, r) => s + Number(r.net_amount), 0) || 0,
      };
    },
    staleTime: 30_000,
  });

  return (
    <DashboardFrame variant="organizer" title={tab === 'overview' ? 'Overview' : tab.replaceAll('-', ' ')} description="Your events, registrations, and results at a glance.">
          {tab === 'overview' && (statsError ? <div role="alert" className="border border-red-200 bg-white p-6"><p className="text-red-700">{statsError.message}</p><button onClick={() => retryStats()} className="btn-secondary mt-4">Try again</button></div> : <OverviewTab stats={stats} loading={isLoading} />)}
          {tab === 'events' && <EventsTab />}
          {tab === 'registrations' && <RegistrationsTab />}
          {tab === 'results' && <ResultsTab />}
          {tab === 'coupons' && <CouponsTab />}
          {tab === 'form-templates' && <FormTemplatesTab />}
          {tab === 'analytics' && <OrganizerAnalyticsTab />}
          {tab === 'settings' && <AccountSettings />}
    </DashboardFrame>
  );
}

function OverviewTab({ stats, loading }: { stats: { firstName?: string; totalEvents: number; draftEvents: number; liveEvents: number; completedEvents: number; totalRegistrations: number; pendingApprovals: number; totalRevenue: number } | null | undefined; loading: boolean }) {
  if (loading) return <DashboardLoading />;
  const cards = [
    { label: 'Total Events', value: stats?.totalEvents, icon: Calendar, color: 'text-blue-700' },
    { label: 'Drafts', value: stats?.draftEvents, icon: Calendar, color: 'text-slate-600' },
    { label: 'Live Events', value: stats?.liveEvents, icon: Calendar, color: 'text-green-700' },
    { label: 'Completed', value: stats?.completedEvents, icon: Trophy, color: 'text-purple-700' },
    { label: 'Total Registrations', value: stats?.totalRegistrations, icon: Users, color: 'text-green-700' },
    { label: 'Pending Approvals', value: stats?.pendingApprovals, icon: Users, color: 'text-orange-700' },
    { label: 'Paid registration value', value: `RM ${(stats?.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: 'text-[#4e6500]' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-display font-semibold tracking-tight mb-1">
          Welcome back, {loading ? '...' : stats?.firstName}
        </h2>
        <p className="text-sm text-slate-600">Here&apos;s what&apos;s happening with your events today.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-sm font-semibold normal-case tracking-normal text-slate-600">Overview Metrics</h2>
        <Link href="/organizer/dashboard/events/new" className="btn-primary text-xs !py-3">
          <Plus size={14} /> New Event
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-none p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold normal-case tracking-normal text-slate-600">{c.label}</p>
              <c.icon size={18} className={c.color} />
            </div>
            {loading ? <div className="h-8 bg-slate-100 rounded animate-pulse" /> :
              <p className={`text-3xl font-display font-semibold tracking-tight ${c.color}`}>{c.value || 0}</p>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EventsTab() {
  const supabase = createSupabaseBrowserClient();
  const { data: events, isLoading } = useQuery({
    queryKey: ['organizer-events'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('events').select('*, event_categories(*)').eq('organizer_id', user.id).is('deleted_at', null).order('created_at', { ascending: false });
      return data || [];
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-sm font-semibold normal-case tracking-normal text-slate-600">My Events</h2>
        <Link href="/organizer/dashboard/events/new" className="btn-primary text-xs !py-3">
          <Plus size={14} /> New Event
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? <div className="col-span-full py-20 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-700" /></div> :
          !events?.length ? <div className="col-span-full py-20 text-center"><p className="text-xs text-slate-600">No events yet. Create your first event!</p></div> :
          events.map((ev, i: number) => (
            <EventCard key={ev.id} ev={ev} index={i} />
          ))}
      </div>
    </div>
  );
}

function EventCard({ ev, index }: { ev: import('@/lib/types').Event; index: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  const handleAction = async (actionFn: () => Promise<unknown>, successMsg: string) => {
    try {
      setLoading(true);
      await actionFn();
      toast.success(successMsg);
      qc.invalidateQueries({ queryKey: ['organizer-events'] });
    } catch (e) {
      toast.error((e instanceof Error ? e.message : '') || 'Action failed');
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  const updateStatus = async (status: import('@/lib/types').EventStatus) => {
    const { error } = await supabase.from('events').update({ status }).eq('id', ev.id);
    if (error) throw error;
    qc.setQueryData<import('@/lib/types').Event[]>(['organizer-events'], (old) => {
      if (!old) return old;
      return old.map((e) => e.id === ev.id ? { ...e, status } : e);
    });
  };

  const deleteEvent = async () => {
    const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', ev.id);
    if (error) throw error;
    qc.setQueryData<import('@/lib/types').Event[]>(['organizer-events'], (old) => {
      if (!old) return old;
      return old.filter((e) => e.id !== ev.id);
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      className="glass rounded-none p-6 flex flex-col justify-between relative"
    >
      {loading && (
        <div className="absolute inset-0 bg-black/50 rounded-none flex items-center justify-center z-20 backdrop-blur-sm">
          <Loader2 size={24} className="animate-spin text-blue-700" />
        </div>
      )}
      <div>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-sm font-semibold normal-case tracking-tight pr-8">{ev.title}</h3>

          <div className="absolute top-6 right-6">
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger disabled={loading} aria-label={`Actions for ${ev.title}`} className="flex min-h-11 min-w-11 items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
              <MoreVertical size={16} />
            </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                  {ev.status !== 'LIVE' && (
                    <DropdownMenuItem onClick={() => handleAction(() => updateStatus('LIVE'), 'Event Published')} className="px-3 py-3">
                      <CheckCircle size={14} className="text-green-700" /> Publish
                    </DropdownMenuItem>
                  )}
                  {ev.status === 'LIVE' && (
                    <DropdownMenuItem onClick={() => handleAction(() => updateStatus('DRAFT'), 'Event Unpublished')} className="px-3 py-3">
                      <XCircle size={14} className="text-yellow-700" /> Unpublish (Draft)
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleAction(() => duplicateEventAction(ev.id), 'Event Duplicated')} className="px-3 py-3">
                    <Copy size={14} className="text-blue-700" /> Duplicate
                  </DropdownMenuItem>
                  {ev.status !== 'CANCELED' && (
                    <DropdownMenuItem onClick={() => handleAction(() => updateStatus('CANCELED'), 'Event Canceled')} className="px-3 py-3">
                      <X size={14} className="text-red-700" /> Cancel
                    </DropdownMenuItem>
                  )}
                  {ev.status !== 'ARCHIVED' && (
                    <DropdownMenuItem onClick={() => handleAction(() => updateStatus('ARCHIVED'), 'Event Archived')} className="px-3 py-3">
                      <Archive size={14} className="text-purple-700" /> Archive
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => {
                    if (confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
                      handleAction(() => deleteEvent(), 'Event Deleted');
                    }
                  }} className="flex items-center gap-2 px-4 py-3 hover:bg-red-500/10 text-red-700 text-left w-full transition-colors">
                    <Trash2 size={14} /> Delete
                  </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mb-4">
          <span className={`text-xs font-semibold normal-case tracking-normal px-2 py-1 rounded-none ${
            ev.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
            ev.status === 'LIVE' ? 'bg-green-500/10 text-green-700' :
            ev.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-700' :
            ev.status === 'CANCELED' ? 'bg-red-500/10 text-red-700' :
            ev.status === 'ARCHIVED' ? 'bg-purple-500/10 text-purple-700' :
            'bg-blue-500/10 text-blue-700'
          }`}>{ev.status}</span>
        </div>

        <p className="text-xs text-slate-600 mb-4">
          {ev.event_categories?.length || 0} categories • {new Date(ev.event_date).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-slate-300">
        <Link href={`/organizer/dashboard/events/${ev.id}`}
          className="text-xs font-semibold normal-case tracking-normal text-blue-700 hover:gap-2 transition-all flex items-center gap-1"
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
      const { data } = await supabase.from('registrations').select('*, events(title, organizer_id), participants(full_name)').order('created_at', { ascending: false });
      return (data || []).filter((r) => r.events?.organizer_id === user.id);
    },
    staleTime: 10_000,
  });

  return (
    <div className="glass rounded-none overflow-hidden overflow-x-auto w-full">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Athlete</th>
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Event</th>
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Status</th>
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Date</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? <tr><td colSpan={4} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-blue-700" /></td></tr> :
            !regs?.length ? <tr><td colSpan={4} className="p-8 text-center text-xs text-slate-600">No registrations</td></tr> :
            regs.map((r) => (
              <tr key={r.id} className="border-b border-slate-300 hover:bg-slate-100 transition-colors">
                <td className="p-4 text-sm font-bold">{(r).participants?.[0]?.full_name || 'Unknown'}</td>
                <td className="p-4 text-xs text-slate-600">{(r).events?.title}</td>
                <td className="p-4"><span className={`text-xs font-semibold normal-case tracking-normal ${r.status === 'PAID' ? 'text-green-700' : r.status === 'PENDING' ? 'text-yellow-700' : 'text-red-700'}`}>{r.status}</span></td>
                <td className="p-4 text-xs text-slate-600">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
        </tbody>
      </table>
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

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/organizer/dashboard/results/import" className="btn-secondary text-xs">Import Results</Link>
      </div>
      <div className="glass rounded-none overflow-hidden overflow-x-auto w-full">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Event</th>
              <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Finalized</th>
              <th className="text-right p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={3} className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-blue-700" /></td></tr> :
              !events?.length ? <tr><td colSpan={3} className="p-8 text-center text-xs text-slate-600">No events</td></tr> :
              events.map((ev) => (
                <tr key={ev.id} className="border-b border-slate-300 hover:bg-slate-100 transition-colors">
                  <td className="p-4 text-sm font-bold">{ev.title}</td>
                  <td className="p-4">
                    <span className={`text-xs font-semibold normal-case tracking-normal ${ev.results_finalized ? 'text-green-700' : 'text-yellow-700'}`}>
                      {ev.results_finalized ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Link href={`/organizer/dashboard/results/finalize/${ev.id}`} className="text-xs text-blue-700 hover:underline font-semibold normal-case tracking-normal">
                      Manage
                    </Link>
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
  const { data: organizerEvents } = useOrganizerEvents();
  const toggleMutation = useToggleCoupon();
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE');
  const [value, setValue] = useState(10);
  const [maxUses, setMaxUses] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [eventId, setEventId] = useState('');
  const [perUser, setPerUser] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');

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
      fd.append('event_id', eventId);
      fd.append('max_uses_per_user', perUser);
      if (expiresAt) fd.append('expires_at', expiresAt);

      await createCouponAction(fd);
      toast.success('Coupon created successfully');
      setCode('');
      setMaxUses('');
      setMinOrder('');
      setEventId('');
      setPerUser('1');
      setExpiresAt('');
      setShowAddForm(false);
      refetch();
    } catch (err) {
      toast.error((err instanceof Error ? err.message : '') || 'Failed to create coupon');
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
    } catch (err) {
      toast.error((err instanceof Error ? err.message : '') || 'Failed to delete coupon');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-sm font-semibold normal-case tracking-normal text-slate-600">Coupons</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary text-xs !py-3"
        >
          <Plus size={14} /> New Coupon
        </button>
      </div>

      {showAddForm && (
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleCreate}
          className="glass rounded-none p-6 mb-6 space-y-4"
        >
          <h3 className="text-xs font-semibold normal-case tracking-normal text-blue-700 mb-2">Create Coupon</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="coupon-event" className="label-text">Event *</label>
              <select id="coupon-event" required value={eventId} onChange={e => setEventId(e.target.value)} className="input-field">
                <option value="">Select event</option>
                {organizerEvents?.filter(event => event.coupons_allowed).map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-600">Enable coupons for this event first.</p>
            </div>
            <div>
              <label htmlFor="coupon-new-code" className="label-text">Coupon Code</label>
              <input
                id="coupon-new-code"
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. RACE20"
                required
                minLength={3}
                maxLength={100}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Discount Type</label>
              <FieldSelect id="coupon-discount-type" label="Discount type" value={type} onValueChange={value => setType(value as 'FIXED' | 'PERCENTAGE')} options={[{ value: 'PERCENTAGE', label: 'Percentage (%)' }, { value: 'FIXED', label: 'Fixed Amount (RM)' }]} />
            </div>
            <div>
              <label htmlFor="coupon-new-value" className="label-text">Discount Value</label>
              <input
                id="coupon-new-value"
                type="number"
                value={value}
                onChange={e => setValue(Number(e.target.value))}
                min="1"
                max={type === 'PERCENTAGE' ? 100 : undefined}
                required
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="coupon-max-uses" className="label-text">Maximum uses</label>
              <input
                id="coupon-max-uses"
                type="number"
                value={maxUses}
                onChange={e => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                min="1"
                step="1"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="coupon-min-order" className="label-text">Minimum order (RM)</label>
              <input
                id="coupon-min-order"
                type="number"
                value={minOrder}
                onChange={e => setMinOrder(e.target.value)}
                placeholder="None"
                min="0"
                step="0.01"
                className="input-field"
              />
            </div>
            <div><label htmlFor="coupon-per-user" className="label-text">Uses per customer</label><input id="coupon-per-user" type="number" required min="1" step="1" value={perUser} onChange={e => setPerUser(e.target.value)} className="input-field" /></div>
            <div><label htmlFor="coupon-expiry" className="label-text">Expires at</label><input id="coupon-expiry" type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="input-field" /></div>
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
        <div className="py-20 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-700" /></div>
      ) : !coupons?.length ? (
        <div className="py-20 text-center">
          <p className="text-xs text-slate-600 font-bold normal-case tracking-normal">No coupon campaigns active</p>
        </div>
      ) : (
        <div className="glass rounded-none overflow-hidden overflow-x-auto w-full">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Code</th>
                <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Type</th>
                <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Value</th>
                <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Uses</th>
                <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Per customer</th>
                <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Expires</th>
                <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Min Spend</th>
                <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Status</th>
                <th className="text-right p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id} className="border-b border-slate-300 hover:bg-slate-100 transition-colors">
                  <td className="p-4 tabular-nums font-bold text-blue-700">{c.code}</td>
                  <td className="p-4 text-xs text-slate-600">{c.type}</td>
                  <td className="p-4 text-xs font-bold">
                    {c.type === 'PERCENTAGE' ? `${c.value}%` : `RM${c.value}`}
                  </td>
                  <td className="p-4 text-xs">
                    {c.current_uses} / {c.max_uses || '∞'}
                  </td>
                  <td className="p-4 text-xs">{c.max_uses_per_user}</td>
                  <td className="p-4 text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleString('en-MY') : 'No expiry'}</td>
                  <td className="p-4 text-xs">RM{c.min_order_amount}</td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleMutation.mutate({ couponId: c.id, isActive: !c.is_active })}
                      className={`text-xs font-semibold normal-case tracking-normal px-2 py-0.5 rounded-none ${
                        c.is_active ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'
                      }`}
                    >
                      {c.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-700 hover:text-red-700 hover:bg-red-500/10 rounded-none transition-all">
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

  const handleFieldChange = (idx: number, key: string, val: string | boolean) => {
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
    } catch (err) {
      toast.error((err instanceof Error ? err.message : '') || 'Failed to create form template');
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
    } catch (err) {
      toast.error((err instanceof Error ? err.message : '') || 'Failed to delete template');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-sm font-semibold normal-case tracking-normal text-slate-600">Registration Forms</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary text-xs !py-3"
        >
          <Plus size={14} /> New Template
        </button>
      </div>

      {showAddForm && (
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleCreate}
          className="glass rounded-none p-6 mb-6 space-y-4"
        >
          <h3 className="text-xs font-semibold normal-case tracking-normal text-blue-700 mb-2">Create Registration Form Template</h3>
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
              <h4 className="text-xs font-semibold normal-case tracking-normal text-slate-600">Form Fields</h4>
              <button
                type="button"
                onClick={handleAddField}
                className="text-xs font-semibold normal-case tracking-normal px-3 py-1 bg-slate-100 hover:bg-slate-100 rounded-none text-slate-600"
              >
                + Add Field
              </button>
            </div>

            {fields.map((f, idx) => (
              <div key={idx} className="flex flex-col md:flex-row md:items-center gap-3 bg-slate-100 p-3 rounded-none border border-slate-300">
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
                  <FieldSelect id={`form-field-type-${idx}`} label={`Type for field ${idx + 1}`} value={f.type} onValueChange={value => handleFieldChange(idx, 'type', value)} options={['TEXT', 'NUMBER', 'EMAIL', 'PHONE', 'DATE', 'CHECKBOX'].map(value => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }))} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer self-start md:self-auto py-1">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={e => handleFieldChange(idx, 'required', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 bg-slate-100 text-blue-700"
                  />
                  <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Required</span>
                </label>
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveField(idx)}
                    className="p-1 hover:bg-red-500/10 rounded text-red-700 hover:text-red-700 self-end md:self-auto"
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
        <div className="py-20 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-700" /></div>
      ) : !templates?.length ? (
        <div className="py-20 text-center">
          <p className="text-xs text-slate-600 font-bold normal-case tracking-normal">No custom forms created</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="glass rounded-none p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold normal-case tracking-tight">{t.name}</h3>
                  <span className={`text-xs font-semibold normal-case tracking-normal px-2 py-0.5 rounded-none ${
                    t.is_system ? 'bg-blue-500/10 text-blue-700' : 'bg-green-500/10 text-green-700'
                  }`}>{t.is_system ? 'System' : 'Custom'}</span>
                </div>
                <p className="text-xs text-slate-600 mb-4">{t.description || 'No description provided'}</p>
                <div className="space-y-1">
                  <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Fields ({t.fields?.length || 0}):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {t.fields?.map((f: { label: string; required?: boolean }, i: number) => (
                      <span key={i} className="text-xs tabular-nums bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-none text-slate-600">
                        {f.label} {f.required && '*'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {!t.is_system && (
                <div className="flex justify-end pt-4 border-t border-slate-300 mt-4">
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 hover:bg-red-500/10 rounded-none text-red-700 hover:text-red-700 transition-colors">
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
