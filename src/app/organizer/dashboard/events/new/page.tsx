'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateEvent } from '@/hooks/use-events';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import slugify from 'slugify';
import { DashboardFrame } from '@/components/layout/dashboard-frame';
import { uploadEventCover } from '@/lib/server/actions/event-media.actions';

interface Category {
  id: string;
  name: string;
  description: string;
  base_price: number;
  max_slots: number | null;
  min_age: number | null;
  max_age: number | null;
}

export default function EventForgePage() { return <Suspense fallback={<p className="p-8">Loading event editor�</p>}><EventForgeContent /></Suspense>; }

function EventForgeContent() {
  const router = useRouter();
  const { mutateAsync: createEvent } = useCreateEvent();
  const [submitting, setSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    registration_open: '',
    registration_close: '',
    venue_name: '',
    address: '',
    city: '',
    postcode: '',
    country: 'Malaysia',
    max_participants: '',
    bib_format: 'RUN-####',
    terms_and_conditions: '',
    coupons_allowed: false,
  });

  const addCategory = () => {
    setCategories(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      description: '',
      base_price: 0,
      max_slots: null,
      min_age: null,
      max_age: null,
    }]);
  };

  const removeCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const updateCategory = (id: string, field: keyof Category, value: string | number | null) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const slug = slugify(formData.title, { lower: true, strict: true }) + '-' + Date.now().toString(36);
      const supabase = createSupabaseBrowserClient();
      const { data: standardForm, error: formError } = await supabase.from('form_templates')
        .select('id').eq('name', 'Standard Registration').eq('is_system', true).is('deleted_at', null).maybeSingle();
      if (formError || !standardForm) throw new Error('Standard registration form is unavailable');
      const parsedData = {
        ...formData,
        slug,
        status: 'DRAFT' as const,
        deleted_at: null,
        max_participants: formData.max_participants ? Number(formData.max_participants) : null,
        form_template_id: standardForm.id,
      };

      const event = await createEvent(parsedData);

      if (event && event.id && categories.length > 0) {
        const catsToInsert = categories.map(({ id, ...rest }) => ({ ...rest, event_id: event.id }));
        const { error: catError } = await supabase.from('event_categories').insert(catsToInsert);
        if (catError) {
          console.error('Failed to insert categories:', catError);
          toast.error('Event created but failed to save categories');
        }
      }

      if (coverFile && event?.id) {
        try { const media = new FormData(); media.set('eventId', event.id); media.set('image', coverFile); await uploadEventCover(media); }
        catch (error) { toast.error('Event saved. Cover upload failed; retry on the event overview.'); }
      }
      toast.success('Event created successfully');
      if (event && event.id) {
        router.push(`/organizer/dashboard/events/${event.id}`);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <DashboardFrame variant="organizer" title="Create event" description="Set up your event details, cover image, and entry categories.">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-xs font-semibold normal-case tracking-[0.3em] text-blue-700 mb-2">Event Forge</p>
          <h1 className="text-4xl font-display font-semibold normal-case tracking-tight">Create New Event</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <section className="glass rounded-2xl p-8">
            <h2 className="text-sm font-semibold normal-case tracking-normal text-slate-600 mb-6">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="label-text">Event Title</label>
                <input type="text" value={formData.title} onChange={e => updateField('title', e.target.value)}
                  required className="input-field" placeholder="e.g. Kuala Lumpur Marathon 2026" />
              </div>
              <div className="md:col-span-2">
                <label className="label-text">Description</label>
                <textarea value={formData.description} onChange={e => updateField('description', e.target.value)}
                  className="input-field min-h-[120px]" placeholder="Describe your event..." />
              </div>
              <div>
                <label className="label-text">Event Date</label>
                <input type="datetime-local" value={formData.event_date} onChange={e => updateField('event_date', e.target.value)}
                  required className="input-field" />
              </div>
              <div>
                <label className="label-text">Venue</label>
                <input type="text" value={formData.venue_name} onChange={e => updateField('venue_name', e.target.value)}
                  className="input-field" placeholder="Venue name" />
              </div>
              <div className="md:col-span-2">
                <label className="label-text">Address</label>
                <input type="text" value={formData.address} onChange={e => updateField('address', e.target.value)}
                  className="input-field" placeholder="Full address" />
              </div>
              <div>
                <label className="label-text">City</label>
                <input type="text" value={formData.city} onChange={e => updateField('city', e.target.value)}
                  className="input-field" placeholder="City" />
              </div>
              <div>
                <label className="label-text">Country</label>
                <input type="text" value={formData.country} onChange={e => updateField('country', e.target.value)}
                  className="input-field" placeholder="Country" />
              </div>
            </div>
          </section>

          <section className="border border-slate-300 bg-white p-6 space-y-3"><h2 className="text-lg font-semibold">Event cover</h2><label htmlFor="new-event-cover" className="block text-sm">Choose JPEG, PNG, or WebP (up to 4 MB)</label><input id="new-event-cover" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full min-h-11 text-sm" onChange={event => { const file = event.target.files?.[0] || null; if (file && file.size > 4 * 1024 * 1024) { toast.error('Choose an image smaller than 4 MB'); event.target.value = ''; setCoverFile(null); return; } setCoverFile(file); }} /><p className="text-sm text-slate-600">You can replace this image from the event overview after saving.</p></section>
          {/* Registration Window */}
          <section className="glass rounded-2xl p-8">
            <h2 className="text-sm font-semibold normal-case tracking-normal text-slate-600 mb-6">Registration Window</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label-text">Registration Opens</label>
                <input type="datetime-local" value={formData.registration_open} onChange={e => updateField('registration_open', e.target.value)}
                  required className="input-field" />
              </div>
              <div>
                <label className="label-text">Registration Closes</label>
                <input type="datetime-local" value={formData.registration_close} onChange={e => updateField('registration_close', e.target.value)}
                  required className="input-field" />
              </div>
              <div>
                <label className="label-text">Max Participants</label>
                <input type="number" value={formData.max_participants} onChange={e => updateField('max_participants', e.target.value)}
                  className="input-field" placeholder="Unlimited" min="1" />
              </div>
              <div>
                <label className="label-text">Bib Format</label>
                <input type="text" value={formData.bib_format} onChange={e => updateField('bib_format', e.target.value)}
                  className="input-field" placeholder="RUN-####" />
              </div>
            </div>
          </section>

          {/* Categories */}
          <section className="glass rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold normal-case tracking-normal text-slate-600">Categories & Pricing</h2>
              <button type="button" onClick={addCategory}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold normal-case tracking-normal bg-blue-500/10 text-blue-700 rounded-full hover:bg-blue-500/20 transition-all"
              ><Plus size={14} /> Add Category</button>
            </div>

            {categories.length === 0 ? (
              <p className="text-center py-12 text-xs text-slate-600 font-bold normal-case tracking-normal">
                No categories yet. Click &quot;Add Category&quot; to add race categories.
              </p>
            ) : (
              <div className="space-y-4">
                {categories.map((cat, idx) => (
                  <div key={cat.id} className="bg-slate-100 rounded-2xl p-6 border border-slate-300">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold normal-case tracking-normal text-blue-700">Category #{idx + 1}</span>
                      <button type="button" onClick={() => removeCategory(cat.id)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-700 transition-colors"
                      ><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="label-text">Name</label>
                        <input type="text" value={cat.name} onChange={e => updateCategory(cat.id, 'name', e.target.value)}
                          required className="input-field !py-3" placeholder="e.g. 10KM Open" />
                      </div>
                      <div>
                        <label className="label-text">Base Price (RM)</label>
                        <input type="number" value={cat.base_price} onChange={e => updateCategory(cat.id, 'base_price', Number(e.target.value))}
                          required className="input-field !py-3" min="0" step="0.01" />
                      </div>
                      <div>
                        <label className="label-text">Max Slots</label>
                        <input type="number" value={cat.max_slots || ''} onChange={e => updateCategory(cat.id, 'max_slots', e.target.value ? Number(e.target.value) : null)}
                          className="input-field !py-3" placeholder="Unlimited" />
                      </div>
                      <div>
                        <label className="label-text">Min Age</label>
                        <input type="number" value={cat.min_age || ''} onChange={e => updateCategory(cat.id, 'min_age', e.target.value ? Number(e.target.value) : null)}
                          className="input-field !py-3" placeholder="None" />
                      </div>
                      <div>
                        <label className="label-text">Max Age</label>
                        <input type="number" value={cat.max_age || ''} onChange={e => updateCategory(cat.id, 'max_age', e.target.value ? Number(e.target.value) : null)}
                          className="input-field !py-3" placeholder="None" />
                      </div>
                      <div className="md:col-span-3">
                        <label className="label-text">Description (Optional)</label>
                        <input type="text" value={cat.description} onChange={e => updateCategory(cat.id, 'description', e.target.value)}
                          className="input-field !py-3" placeholder="Category description" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Extra Settings */}
          <section className="glass rounded-2xl p-8">
            <h2 className="text-sm font-semibold normal-case tracking-normal text-slate-600 mb-6">Additional Settings</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={formData.coupons_allowed} onChange={e => updateField('coupons_allowed', e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 bg-slate-100 text-blue-700 focus:ring-blue-500" />
                <span className="text-xs font-bold normal-case tracking-normal text-slate-600">Allow coupon codes for this event</span>
              </label>
            </div>
          </section>

          {/* T&C */}
          <section className="glass rounded-2xl p-8">
            <h2 className="text-sm font-semibold normal-case tracking-normal text-slate-600 mb-6">Terms & Conditions</h2>
            <textarea value={formData.terms_and_conditions} onChange={e => updateField('terms_and_conditions', e.target.value)}
              className="input-field min-h-[200px]" placeholder="Enter terms and conditions for participants..." />
          </section>

          {/* Submit */}
          <div className="flex items-center gap-4">
            <button type="submit" disabled={submitting}
              className="btn-primary text-sm"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {submitting ? 'Creating...' : 'Create Event'}
            </button>
            <button type="button" onClick={() => router.back()}
              className="btn-secondary text-sm"
            >Cancel</button>
          </div>
        </form>
      </div>
    </DashboardFrame>
  );
}
