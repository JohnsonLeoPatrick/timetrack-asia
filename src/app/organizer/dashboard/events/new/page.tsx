'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateEvent } from '@/hooks/use-events';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import slugify from 'slugify';

interface Category {
  id: string;
  name: string;
  description: string;
  base_price: number;
  max_slots: number | null;
  min_age: number | null;
  max_age: number | null;
}

export default function EventForgePage() {
  const router = useRouter();
  const { mutateAsync: createEvent } = useCreateEvent();
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

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

  const updateCategory = (id: string, field: keyof Category, value: any) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let cover_image = null;
      
      if (coverFile) {
        const supabase = createSupabaseBrowserClient();
        const fileExt = coverFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('events')
          .upload(fileName, coverFile);
          
        if (uploadError) {
          throw new Error(`Failed to upload cover image: ${uploadError.message}`);
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('events')
          .getPublicUrl(fileName);
          
        cover_image = publicUrl;
      }

      const slug = slugify(formData.title, { lower: true, strict: true }) + '-' + Date.now().toString(36);
      const parsedData = {
        ...formData,
        slug,
        cover_image,
        status: 'DRAFT' as const,
        deleted_at: null,
        max_participants: formData.max_participants ? Number(formData.max_participants) : null,
      };

      const event = await createEvent(parsedData);
      
      if (event && event.id && categories.length > 0) {
        const supabase = createSupabaseBrowserClient();
        const catsToInsert = categories.map(({ id, ...rest }) => ({ ...rest, event_id: event.id }));
        const { error: catError } = await supabase.from('event_categories').insert(catsToInsert);
        if (catError) {
          console.error('Failed to insert categories:', catError);
          toast.error('Event created but failed to save categories');
        }
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
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 mb-2">Event Forge</p>
          <h1 className="text-4xl font-display font-black uppercase tracking-tighter">Create New Event</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <section className="glass rounded-2xl p-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-white/30 mb-6">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="label-text">Event Cover Image</label>
                <div className="mt-2 flex items-center gap-6">
                  {coverPreview ? (
                    <div className="relative w-40 h-24 rounded-lg overflow-hidden border border-white/10 bg-white/5">
                      <img src={coverPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setCoverFile(null); setCoverPreview(''); }}
                        className="absolute top-1 right-1 p-1 bg-black/80 rounded-full hover:bg-black text-red-400 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-40 h-24 rounded-lg border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-white/40 hover:text-white hover:border-blue-500/50 transition-all cursor-pointer relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Plus size={16} className="mb-1" />
                      <span className="text-[9px] font-black uppercase tracking-wider">Upload Cover</span>
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Select a banner or cover photo</p>
                    <p className="text-[8px] text-white/30 uppercase tracking-widest mt-1">PNG, JPG, or WEBP up to 5MB</p>
                  </div>
                </div>
              </div>
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

          {/* Registration Window */}
          <section className="glass rounded-2xl p-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-white/30 mb-6">Registration Window</h2>
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
              <h2 className="text-sm font-black uppercase tracking-widest text-white/30">Categories & Pricing</h2>
              <button type="button" onClick={addCategory}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 rounded-full hover:bg-blue-500/20 transition-all"
              ><Plus size={14} /> Add Category</button>
            </div>

            {categories.length === 0 ? (
              <p className="text-center py-12 text-xs text-white/20 font-bold uppercase tracking-widest">
                No categories yet. Click "Add Category" to add race categories.
              </p>
            ) : (
              <div className="space-y-4">
                {categories.map((cat, idx) => (
                  <div key={cat.id} className="bg-white/5 rounded-2xl p-6 border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Category #{idx + 1}</span>
                      <button type="button" onClick={() => removeCategory(cat.id)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-500 transition-colors"
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
            <h2 className="text-sm font-black uppercase tracking-widest text-white/30 mb-6">Additional Settings</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={formData.coupons_allowed} onChange={e => updateField('coupons_allowed', e.target.checked)}
                  className="w-5 h-5 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-white/70">Allow coupon codes for this event</span>
              </label>
            </div>
          </section>

          {/* T&C */}
          <section className="glass rounded-2xl p-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-white/30 mb-6">Terms & Conditions</h2>
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
    </div>
  );
}
