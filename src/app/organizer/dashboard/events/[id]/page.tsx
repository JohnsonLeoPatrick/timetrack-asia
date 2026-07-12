'use client';

import { useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Calendar, MapPin, Users, DollarSign, Plus, Trash2, Edit2, Loader2, ArrowLeft, Check, X, ShieldAlert, Layers } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useEvent } from '@/hooks/use-events';
import { useOrganizerRegistrations } from '@/hooks/use-registrations';
import { updateEventStatusAction, deleteEventAction } from '@/lib/server/actions/event.actions';
import { toast } from 'sonner';
import { Award } from 'lucide-react';

type EventTab = 'overview' | 'categories' | 'registrations';

export default function EventDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-500" /></div>}>
      <EventDetailContent />
    </Suspense>
  );
}

function EventDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();
  const [tab, setTab] = useState<EventTab>('overview');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingCerts, setGeneratingCerts] = useState(false);

  // Fetch Event
  const { data: event, isLoading: eventLoading, refetch: refetchEvent } = useEvent(id);

  // Fetch Registrations for this specific event
  const { data: regs, isLoading: regsLoading } = useOrganizerRegistrations(id);

  // Mutations for categories
  const addCategoryMutation = useMutation({
    mutationFn: async (cat: { name: string; base_price: number; max_slots: number | null }) => {
      const { error } = await supabase.from('event_categories').insert({
        ...cat,
        event_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Category added successfully');
      refetchEvent();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add category');
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (catId: string) => {
      const { error } = await supabase.from('event_categories').delete().eq('id', catId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Category removed successfully');
      refetchEvent();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove category');
    }
  });

  // Handle Event Status change
  const handleStatusChange = async (newStatus: string) => {
    setStatusUpdating(true);
    try {
      const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success(`Event status updated to ${newStatus}`);
      qc.invalidateQueries({ queryKey: ['organizer-events'] });
      refetchEvent();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle Event Deletion
  const handleDeleteEvent = async () => {
    if (!confirm('Are you sure you want to delete this event? This action is irreversible.')) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.success('Event deleted successfully');
      qc.setQueryData(['organizer-events'], (old: any) => {
        if (!old) return old;
        return old.filter((e: any) => e.id !== id);
      });
      qc.invalidateQueries({ queryKey: ['organizer-events'] });
      router.push('/organizer/dashboard?tab=events');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  // Handle Certificate Generation
  const handleGenerateCertificates = async () => {
    setGeneratingCerts(true);
    try {
      const { data: results, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('event_id', id);

      if (resultsError) throw new Error(resultsError.message);
      
      const count = results?.length || 0;
      if (count > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const certificates = results.map((result: any) => ({
          event_id: id,
          user_id: result.participant_id || user?.id,
          participant_name: result.athlete_name,
        }));

        const { error: insertError } = await supabase
          .from('certificates')
          .insert(certificates);

        if (insertError) throw new Error(insertError.message);
      }
      
      toast.success(`Successfully generated ${count} certificates!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate certificates');
    } finally {
      setGeneratingCerts(false);
    }
  };

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert size={48} className="text-red-500 mb-4 animate-bounce" />
        <h1 className="text-2xl font-display font-black uppercase tracking-tight text-white mb-2">Event Not Found</h1>
        <p className="text-xs text-white/40 uppercase tracking-widest max-w-sm mb-6">
          The event you are trying to manage does not exist or has been deleted.
        </p>
        <button onClick={() => router.push('/organizer/dashboard?tab=events')} className="btn-primary text-xs">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-black">
      <Sidebar variant="organizer" />
      <div className="flex-1 overflow-auto w-full">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/10 pl-14 lg:pl-8 pr-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/organizer/dashboard?tab=events')}
                className="p-2 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h1 className="text-lg font-display font-black uppercase tracking-tighter line-clamp-1">
                  {event.title}
                </h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
                  Manage Event Details & Participants
                </p>
              </div>
            </div>
            
            {/* Action Badges / Status */}
            <div className="flex flex-wrap items-center gap-3">
              {event.status === 'COMPLETED' && (
                <button
                  onClick={handleGenerateCertificates}
                  disabled={generatingCerts}
                  className="px-3 py-1.5 text-[9px] bg-purple-500/10 text-purple-400 font-black uppercase tracking-widest rounded-lg hover:bg-purple-500/20 transition-all flex items-center gap-2"
                >
                  {generatingCerts ? <Loader2 size={12} className="animate-spin" /> : <Award size={12} />}
                  Generate Certificates
                </button>
              )}

              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                event.status === 'DRAFT' ? 'bg-white/10 text-white/50' :
                event.status === 'LIVE' ? 'bg-green-500/10 text-green-500' :
                event.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' :
                'bg-blue-500/10 text-blue-500'
              }`}>{event.status}</span>
              
              <div className="flex items-center gap-2">
                {event.status === 'DRAFT' && (
                  <button
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange('LIVE')}
                    className="px-3 py-1.5 text-[9px] bg-green-500/10 text-green-500 font-black uppercase tracking-widest rounded-lg hover:bg-green-500/20 transition-all"
                  >
                    Go Live
                  </button>
                )}
                {event.status === 'LIVE' && (
                  <button
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange('COMPLETED')}
                    className="px-3 py-1.5 text-[9px] bg-blue-500/10 text-blue-500 font-black uppercase tracking-widest rounded-lg hover:bg-blue-500/20 transition-all"
                  >
                    Mark Completed
                  </button>
                )}
                <button
                  disabled={deleting}
                  onClick={handleDeleteEvent}
                  className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Inner Content Area */}
        <div className="p-4 lg:p-8 max-w-6xl mx-auto w-full">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-white/5 mb-8 pb-px overflow-x-auto no-scrollbar whitespace-nowrap">
            {['overview', 'categories', 'registrations'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t as EventTab)}
                className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${
                  tab === t ? 'border-blue-500 text-blue-500' : 'border-transparent text-white/30 hover:text-white/50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab Rendering */}
          <div className="space-y-6">
            {tab === 'overview' && <OverviewSection event={event} refetchEvent={refetchEvent} />}
            {tab === 'categories' && (
              <CategoriesSection
                event={event}
                onAdd={(cat) => addCategoryMutation.mutate(cat)}
                onDelete={(catId) => deleteCategoryMutation.mutate(catId)}
                adding={addCategoryMutation.isPending}
              />
            )}
            {tab === 'registrations' && (
              <RegistrationsSection regs={regs} loading={regsLoading} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewSection({ event, refetchEvent }: { event: any; refetchEvent: () => void }) {
  const [uploading, setUploading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${event.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('events')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('events')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('events')
        .update({ cover_image: publicUrl })
        .eq('id', event.id);

      if (updateError) throw updateError;

      toast.success('Cover image updated successfully');
      refetchEvent();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update cover image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Cover Image Card */}
        <div className="glass rounded-2xl p-6 space-y-4 relative overflow-hidden">
          <h3 className="text-xs font-black uppercase tracking-widest text-white/30">Event Cover Image</h3>
          
          <div className="relative w-full h-64 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
            {event.cover_image ? (
              <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-white/20">
                <p className="text-xs font-bold uppercase tracking-wider">No Cover Image Uploaded</p>
                <p className="text-[10px] mt-1">Upload a photo to display on the event details page.</p>
              </div>
            )}
            
            {uploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                <Loader2 className="animate-spin text-blue-500" size={24} />
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-start gap-4">
            <div className="relative btn-primary text-[10px] cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              {event.cover_image ? 'Change Cover Image' : 'Upload Cover Image'}
            </div>
            {event.cover_image && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Are you sure you want to remove the cover image?')) return;
                  setUploading(true);
                  try {
                    const { error } = await supabase
                      .from('events')
                      .update({ cover_image: null })
                      .eq('id', event.id);
                    if (error) throw error;
                    toast.success('Cover image removed');
                    refetchEvent();
                  } catch (error: any) {
                    toast.error(error.message || 'Failed to remove cover image');
                  } finally {
                    setUploading(false);
                  }
                }}
                disabled={uploading}
                className="btn-secondary text-[10px] text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-500/40"
              >
                Remove Image
              </button>
            )}
          </div>
        </div>

        {/* Details Card */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-white/30">Event Description</h3>
          <p className="text-sm text-white/70 leading-relaxed font-medium">
            {event.description || 'No description provided.'}
          </p>
        </div>

        {/* Venue/Info Card */}
        <div className="glass rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Venue</span>
            <p className="text-sm font-bold flex items-center gap-1.5"><MapPin size={14} className="text-blue-500" />{event.venue_name || 'TBA'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Event Date</span>
            <p className="text-sm font-bold flex items-center gap-1.5"><Calendar size={14} className="text-blue-500" />{new Date(event.event_date).toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Address</span>
            <p className="text-xs text-white/60 leading-relaxed">{event.address || '—'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">City / Country</span>
            <p className="text-xs text-white/60 leading-relaxed">{event.city ? `${event.city}, ` : ''}{event.country || 'Malaysia'}</p>
          </div>
        </div>

        {/* Terms Card */}
        {event.terms_and_conditions && (
          <div className="glass rounded-2xl p-6 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/30">Terms & Conditions</h3>
            <div className="text-xs text-white/50 whitespace-pre-wrap max-h-48 overflow-y-auto no-scrollbar font-medium leading-relaxed">
              {event.terms_and_conditions}
            </div>
          </div>
        )}
      </div>

      {/* Side Meta Widgets */}
      <div className="space-y-6">
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-white/30">Registration Windows</h3>
          <div className="space-y-3">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Opens</span>
              <p className="text-xs font-bold">{new Date(event.registration_open).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Closes</span>
              <p className="text-xs font-bold">{new Date(event.registration_close).toLocaleString()}</p>
            </div>
            <div className="pt-2 border-t border-white/5">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Bib Format</span>
              <p className="text-xs font-mono font-bold text-blue-400">{event.bib_format || 'RUN-####'}</p>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Max Participants</span>
              <p className="text-xs font-bold">{event.max_participants ? `${event.max_participants} entries` : 'Unlimited'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoriesSection({
  event,
  onAdd,
  onDelete,
  adding
}: {
  event: any;
  onAdd: (cat: { name: string; base_price: number; max_slots: number | null }) => void;
  onDelete: (id: string) => void;
  adding: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('50.00');
  const [slots, setSlots] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onAdd({
      name,
      base_price: Number(price) || 0,
      max_slots: slots ? Number(slots) : null
    });
    setName('');
    setSlots('');
    setShowAdd(false);
  };

  const categories = event.event_categories || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white/30">Race Categories</h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] bg-blue-500/10 text-blue-500 font-black uppercase tracking-widest rounded-full hover:bg-blue-500/20 transition-all"
        >
          <Plus size={12} /> Add Category
        </button>
      </div>

      {showAdd && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleSubmit}
          className="glass rounded-2xl p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div>
            <label className="label-text">Category Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="input-field" placeholder="e.g. 5KM Fun Run" />
          </div>
          <div>
            <label className="label-text">Base Price (RM)</label>
            <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required className="input-field" />
          </div>
          <div>
            <label className="label-text">Max Slots (Optional)</label>
            <input type="number" value={slots} onChange={e => setSlots(e.target.value)} className="input-field" placeholder="Unlimited" />
          </div>
          <div className="md:col-span-3 flex gap-2 pt-2">
            <button type="submit" disabled={adding} className="btn-primary text-[10px]">
              {adding ? <Loader2 size={12} className="animate-spin" /> : null}
              Add Category
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-[10px]">Cancel</button>
          </div>
        </motion.form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <p className="text-xs text-white/20 font-bold uppercase tracking-widest">No categories defined yet</p>
          </div>
        ) : (
          categories.map((cat: any) => (
            <div key={cat.id} className="glass rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <h4 className="text-sm font-black uppercase tracking-tight">{cat.name}</h4>
                  <button
                    onClick={() => onDelete(cat.id)}
                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500/40 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Price</span>
                    <p className="text-sm font-bold text-blue-500">RM{Number(cat.base_price).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Max Slots</span>
                    <p className="text-sm font-bold">{cat.max_slots || 'Unlimited'}</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RegistrationsSection({ regs, loading }: { regs: any[] | undefined; loading: boolean }) {
  return (
    <div className="glass rounded-2xl overflow-hidden overflow-x-auto w-full">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Reg Number</th>
            <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Athlete Name</th>
            <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Billing Email</th>
            <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Total Amount</th>
            <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Status</th>
            <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Date</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="p-8 text-center">
                <Loader2 size={20} className="animate-spin mx-auto text-blue-500" />
              </td>
            </tr>
          ) : !regs?.length ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-xs text-white/20 font-bold uppercase tracking-widest">
                No athletes registered for this event yet
              </td>
            </tr>
          ) : (
            regs.map(r => (
              <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 font-mono text-xs font-bold text-blue-500">{r.registration_number}</td>
                <td className="p-4 text-xs font-bold">
                  {r.participants?.[0]?.full_name || 'Unknown'}
                  {r.participants?.length > 1 && ` (+${r.participants.length - 1} more)`}
                </td>
                <td className="p-4 text-xs text-white/40">{r.billing_details?.email || '—'}</td>
                <td className="p-4 text-xs font-bold">RM{Number(r.total_amount).toFixed(2)}</td>
                <td className="p-4">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    r.status === 'PAID' ? 'bg-green-500/10 text-green-500' :
                    r.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' :
                    'bg-red-500/10 text-red-500'
                  }`}>{r.status}</span>
                </td>
                <td className="p-4 text-[10px] text-white/30">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
