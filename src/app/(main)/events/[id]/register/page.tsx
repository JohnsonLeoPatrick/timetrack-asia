'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Check, Loader2, Tag, X } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { createRegistrationAction } from '@/lib/server/actions/registration.actions';
import { useValidateCoupon } from '@/hooks/use-coupons';
import { toast } from 'sonner';

interface ParticipantForm {
  category_id: string;
  full_name: string;
  bib_name: string;
  email: string;
  phone: string;
  gender: string;
  ic_passport: string;
  dob: string;
  age: number | null;
  address: string;
  postcode: string;
  country: string;
  medical_status: boolean;
  medical_details: string;
  emergency_name: string;
  emergency_phone: string;
}

const emptyParticipant = (categoryId: string): ParticipantForm => ({
  category_id: categoryId,
  full_name: '', bib_name: '', email: '', phone: '', gender: '',
  ic_passport: '', dob: '', age: null, address: '', postcode: '',
  country: 'Malaysia', medical_status: false, medical_details: '',
  emergency_name: '', emergency_phone: '',
});

export default function RegisterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const validateCoupon = useValidateCoupon();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [billing, setBilling] = useState({ first_name: '', phone: '', email: '', country: 'Malaysia', city: '', postcode: '' });
  const [participants, setParticipants] = useState<ParticipantForm[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<any>(null);
  const [couponError, setCouponError] = useState('');

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select('*, event_categories(*)')
        .eq('id', id)
        .single();
      return data;
    },
  });

  const categories = (event?.event_categories as any[]) || [];
  const totalAmount = participants.reduce((sum, p) => {
    const cat = categories.find(c => c.id === p.category_id);
    return sum + (cat ? Number(cat.base_price) : 0);
  }, 0);
  const discountAmount = couponResult?.discount_amount ? Number(couponResult.discount_amount) : 0;
  const netAmount = Math.max(0, totalAmount - discountAmount);

  const handleAddParticipant = (categoryId: string) => {
    setParticipants(prev => [...prev, emptyParticipant(categoryId)]);
  };

  const handleRemoveParticipant = (idx: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== idx));
    setCouponResult(null);
    setCouponCode('');
  };

  const handleParticipantChange = (idx: number, field: keyof ParticipantForm, value: any) => {
    setParticipants(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    setCouponResult(null);

    try {
      const result = await validateCoupon.mutateAsync({
        code: couponCode.trim(),
        eventId: id,
        orderAmount: totalAmount,
      });

      if (result?.valid) {
        setCouponResult(result);
        toast.success(`Coupon applied! You save RM${Number(result.discount_amount).toFixed(2)}`);
      } else {
        setCouponError(result?.error || 'Invalid coupon');
        toast.error(result?.error || 'Invalid coupon');
      }
    } catch (err) {
      setCouponError((err as Error).message);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('eventId', id);
      fd.append('billing', JSON.stringify(billing));
      fd.append('participants', JSON.stringify(participants));
      if (couponResult) fd.append('couponCode', couponCode);

      const result = await createRegistrationAction(fd);
      toast.success('Registration successful!');
      router.push(`/profile`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={32} className="animate-spin text-brand" /></div>;
  if (!event) return <div className="min-h-screen flex items-center justify-center"><p className="text-white/30">Event not found</p></div>;

  const totalSteps = 3;

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden pt-24 pb-6 flex flex-col justify-between bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 w-full flex-1 flex flex-col justify-between h-full min-h-0">
        
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-3 mb-6 shrink-0">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                step >= s ? 'bg-brand text-black shadow-[0_0_15px_rgba(204,255,0,0.2)]' : 'bg-white/5 text-white/30'
              }`}>{step > s ? <Check size={14} /> : s}</div>
              {s < totalSteps && <div className={`w-12 h-0.5 transition-all ${step > s ? 'bg-brand' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-0 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-stretch min-h-0"
              >
                {/* Left Side: Categories */}
                <div className="lg:col-span-7 flex flex-col justify-between min-h-0">
                  <div className="mb-4 shrink-0">
                    <h1 className="text-2xl font-display font-black uppercase tracking-tighter text-white line-clamp-1">{event.title}</h1>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Select Categories & Add Participants</p>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 min-h-0 max-h-[50vh] lg:max-h-[55vh]">
                    {categories.map(cat => {
                      const count = participants.filter(p => p.category_id === cat.id).length;
                      const isFull = cat.max_slots && count >= cat.max_slots;

                      return (
                        <div key={cat.id} className="glass rounded-xl p-4 flex items-center justify-between border border-white/5 hover:border-white/10 transition-colors">
                          <div className="pr-4">
                            <h3 className="text-xs font-black uppercase tracking-tight text-white">{cat.name}</h3>
                            <p className="text-[9px] text-white/40 mt-1">
                              {cat.description && `${cat.description} • `}
                              RM{Number(cat.base_price).toFixed(2)}
                              {cat.max_slots && ` • ${cat.max_slots - count} left`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {count > 0 && (
                              <span className="text-xs font-black text-brand">{count}x</span>
                            )}
                            <button onClick={() => handleAddParticipant(cat.id)} disabled={isFull}
                              className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-full transition-all ${
                                isFull ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-brand/10 text-brand hover:bg-brand/20'
                              }`}
                            >{isFull ? 'Full' : 'Add'}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Side: Added list */}
                <div className="lg:col-span-5 flex flex-col justify-between min-h-0">
                  <div className="flex-1 glass rounded-2xl p-5 flex flex-col justify-between min-h-0 border border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-3 shrink-0">
                      Added Participants ({participants.length})
                    </p>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0 max-h-[40vh] lg:max-h-[48vh]">
                      {participants.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-10 opacity-30">
                          <p className="text-[10px] font-black uppercase tracking-widest">No participants added</p>
                        </div>
                      ) : (
                        participants.map((p, i) => {
                          const cat = categories.find(c => c.id === p.category_id);
                          return (
                            <div key={i} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                              <div className="min-w-0 pr-2">
                                <p className="text-xs font-black uppercase tracking-tight text-white/90 truncate">{cat?.name}</p>
                                <span className="text-[9px] font-bold text-brand uppercase tracking-wider mt-0.5 block">Slot #{i + 1}</span>
                              </div>
                              <button onClick={() => handleRemoveParticipant(i)}
                                className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-500 transition-colors shrink-0"
                              ><X size={12} /></button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="mt-4 shrink-0 flex justify-end">
                    <button onClick={() => setStep(2)} disabled={participants.length === 0}
                      className="btn-primary text-[10px] !py-3.5 !px-8 disabled:opacity-30 disabled:cursor-not-allowed font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(204,255,0,0.15)]"
                    >Next: Billing <ArrowRight size={14} /></button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-stretch min-h-0"
              >
                {/* Left Side: Summary info */}
                <div className="lg:col-span-4 flex flex-col justify-between">
                  <div>
                    <h1 className="text-2xl font-display font-black uppercase tracking-tighter text-white">Billing Info</h1>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Step 2: Enter payment details</p>
                    <div className="glass rounded-xl p-5 mt-6 border border-white/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Order summary</p>
                      <div className="flex justify-between py-1">
                        <span className="text-xs text-white/50">Participants</span>
                        <span className="text-xs font-black text-white">{participants.length}</span>
                      </div>
                      <div className="flex justify-between py-1 border-t border-white/5 mt-2 pt-2">
                        <span className="text-xs text-white/50">Estimated Total</span>
                        <span className="text-xs font-black text-brand">RM{totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Form */}
                <div className="lg:col-span-8 flex flex-col justify-between min-h-0">
                  <div className="glass rounded-2xl p-6 border border-white/5 overflow-y-auto max-h-[50vh] lg:max-h-[55vh] space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="label-text text-[9px]">Full Name</label>
                        <input type="text" value={billing.first_name} onChange={e => setBilling(p => ({ ...p, first_name: e.target.value }))}
                          required className="input-field !py-2.5 text-xs" placeholder="Your full name" />
                      </div>
                      <div>
                        <label className="label-text text-[9px]">Email</label>
                        <input type="email" value={billing.email} onChange={e => setBilling(p => ({ ...p, email: e.target.value }))}
                          required className="input-field !py-2.5 text-xs" placeholder="your@email.com" />
                      </div>
                      <div>
                        <label className="label-text text-[9px]">Phone</label>
                        <input type="tel" value={billing.phone} onChange={e => setBilling(p => ({ ...p, phone: e.target.value }))}
                          required className="input-field !py-2.5 text-xs" placeholder="+60XXXXXXXXX" />
                      </div>
                      <div>
                        <label className="label-text text-[9px]">City</label>
                        <input type="text" value={billing.city} onChange={e => setBilling(p => ({ ...p, city: e.target.value }))}
                          className="input-field !py-2.5 text-xs" placeholder="City" />
                      </div>
                      <div>
                        <label className="label-text text-[9px]">Postcode</label>
                        <input type="text" value={billing.postcode} onChange={e => setBilling(p => ({ ...p, postcode: e.target.value }))}
                          className="input-field !py-2.5 text-xs" placeholder="Postcode" />
                      </div>
                      <div className="col-span-2">
                        <label className="label-text text-[9px]">Country</label>
                        <select value={billing.country} onChange={e => setBilling(p => ({ ...p, country: e.target.value }))}
                          className="input-field !py-2.5 text-xs">
                          <option value="Malaysia">Malaysia</option>
                          <option value="Singapore">Singapore</option>
                          <option value="Indonesia">Indonesia</option>
                          <option value="Thailand">Thailand</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-3 shrink-0">
                    <button onClick={() => setStep(1)} className="btn-secondary text-[10px] !py-3 !px-6 border-white/10 rounded-xl"><ArrowLeft size={12} /> Back</button>
                    <button onClick={() => setStep(3)} disabled={!billing.first_name || !billing.email || !billing.phone}
                      className="btn-primary text-[10px] !py-3 !px-6 disabled:opacity-30 disabled:cursor-not-allowed font-black rounded-xl"
                    >Next: Review <ArrowRight size={12} /></button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-stretch min-h-0"
              >
                {/* Left Side: Coupon */}
                <div className="lg:col-span-5 flex flex-col justify-between">
                  <div>
                    <h1 className="text-2xl font-display font-black uppercase tracking-tighter text-white">Review Order</h1>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Step 3: Apply Coupon & Pay</p>
                    
                    <div className="glass rounded-xl p-5 mt-6 border border-white/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-3">Apply Coupon Code</p>
                      <div className="flex items-center gap-2">
                        <input type="text" value={couponCode} onChange={e => { setCouponCode(e.target.value); setCouponResult(null); setCouponError(''); }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs outline-none focus:border-brand/40 transition-all text-white"
                          placeholder="Coupon code" />
                        <button onClick={handleApplyCoupon} disabled={!couponCode.trim() || validateCoupon.isPending}
                          className="btn-primary !py-2 !px-4 text-[9px] rounded-lg disabled:opacity-30"
                        >{validateCoupon.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Apply'}</button>
                      </div>
                      {couponResult && <p className="mt-2 text-[9px] text-green-500 font-bold">Applied! -RM{Number(couponResult.discount_amount).toFixed(2)}</p>}
                      {couponError && <p className="mt-2 text-[9px] text-red-500 font-bold">{couponError}</p>}
                    </div>

                    <div className="glass rounded-xl p-5 mt-4 border border-white/5 space-y-2.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Billing Details</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-white/40 block text-[9px] uppercase">Name</span>
                          <span className="text-white font-bold">{billing.first_name}</span>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[9px] uppercase">Phone</span>
                          <span className="text-white font-bold">{billing.phone}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-white/40 block text-[9px] uppercase">Email</span>
                          <span className="text-white font-bold break-all">{billing.email}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-white/40 block text-[9px] uppercase">Address</span>
                          <span className="text-white font-bold">
                            {billing.city && `${billing.city}, `}{billing.postcode && `${billing.postcode}, `}{billing.country}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Total Summary & Payment */}
                <div className="lg:col-span-7 flex flex-col justify-between min-h-0">
                  <div className="glass rounded-2xl p-6 border border-white/5 flex-1 flex flex-col justify-between min-h-0 max-h-[50vh] lg:max-h-[55vh]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-3 shrink-0">Order Summary</p>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 border-b border-white/5 pb-3 mb-3">
                      {participants.map((p, i) => {
                        const cat = categories.find(c => c.id === p.category_id);
                        return (
                          <div key={i} className="flex items-center justify-between py-1 text-xs">
                            <span className="text-white/60">{cat?.name} (Slot #{i + 1})</span>
                            <span className="font-bold">RM{Number(cat?.base_price || 0).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-1.5 shrink-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/40">Subtotal</span>
                        <span>RM{totalAmount.toFixed(2)}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-green-500">Discount</span>
                          <span className="text-green-500">-RM{discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between py-2 border-t border-white/10 mt-2">
                        <span className="text-xs font-black uppercase tracking-tight">Net Total</span>
                        <span className="text-base font-black text-brand">RM{netAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-3 shrink-0">
                    <button onClick={() => setStep(2)} className="btn-secondary text-[10px] !py-3 !px-6 border-white/10 rounded-xl"><ArrowLeft size={12} /> Back</button>
                    <button onClick={handleSubmit} disabled={submitting}
                      className="btn-primary text-[10px] !py-3.5 !px-8 disabled:opacity-30 rounded-xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(204,255,0,0.2)]"
                    >
                      {submitting ? <Loader2 size={12} className="animate-spin shrink-0" /> : null}
                      {submitting ? 'Processing...' : netAmount > 0 ? `Pay RM${netAmount.toFixed(2)}` : 'Complete'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
