'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowLeft, Check, Loader2, X, ShieldCheck, Landmark, CreditCard, Wallet } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { createRegistrationAction } from '@/lib/server/actions/registration.actions';
import { startChipCheckoutAction } from '@/lib/server/actions/chip.actions';
import { useValidateCoupon } from '@/hooks/use-coupons';
import { toast } from 'sonner';
import { FieldSelect } from '@/components/ui/field-select';
import { PageLoading } from '@/components/layout/page-loading';
import styles from './registration.module.css';

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
  category_age: string;
  tee_size: string;
  medical_status: boolean | null;
  medical_details: string;
  emergency_name: string;
  emergency_phone: string;
}

const emptyParticipant = (categoryId: string): ParticipantForm => ({
  category_id: categoryId,
  full_name: '', bib_name: '', email: '', phone: '', gender: '',
  ic_passport: '', dob: '', age: null, address: '', postcode: '',
  country: 'Malaysia', category_age: '', tee_size: '', medical_status: null, medical_details: '',
  emergency_name: '', emergency_phone: '',
});

export default function RegisterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const validateCoupon = useValidateCoupon();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const submission = useRef(false);
  const [submitError, setSubmitError] = useState('');
  const [billing, setBilling] = useState({ first_name: '', phone: '', email: '', country: 'Malaysia', city: '', postcode: '', terms_accepted: false, policy_accepted: false });
  const [participants, setParticipants] = useState<ParticipantForm[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<{ discount_amount?: number; valid?: boolean; error?: string } | null>(null);
  const [couponError, setCouponError] = useState('');

  const { data: event, isLoading, error: eventError, refetch } = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, event_categories(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const categories = ((event?.event_categories as import('@/lib/types').EventCategory[]) || []).filter(category => !category.deleted_at);
  const totalAmount = participants.reduce((sum, p) => {
    const cat = categories.find(c => c.id === p.category_id);
    return sum + (cat ? Number(cat.base_price) : 0);
  }, 0);
  const discountAmount = couponResult?.discount_amount ? Number(couponResult.discount_amount) : 0;
  const netAmount = Math.max(0, totalAmount - discountAmount);
  const participantComplete = (p: ParticipantForm) => Boolean(
    p.full_name.trim() && p.bib_name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) && p.phone.trim().length >= 8 &&
    p.gender && p.ic_passport.trim().length >= 4 && p.dob && p.age !== null && p.age >= 0 && p.country &&
    p.category_age && p.tee_size && p.medical_status !== null && p.emergency_name.trim() && p.emergency_phone.trim().length >= 8 &&
    (!p.medical_status || p.medical_details.trim())
  );

  const handleAddParticipant = (categoryId: string) => {
    if (participants.length >= 100) return;
    setParticipants(prev => [...prev, emptyParticipant(categoryId)]);
    setCouponResult(null);
  };

  const handleRemoveParticipant = (idx: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== idx));
    setCouponResult(null);
    setCouponCode('');
  };

  const handleParticipantChange = (idx: number, field: keyof ParticipantForm, value: ParticipantForm[keyof ParticipantForm]) => {
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
    if (submission.current) return;
    if (!participants.length || participants.some(p => !participantComplete(p)) || !billing.terms_accepted || !billing.policy_accepted) {
      setSubmitError('Complete every attendee and accept both agreements before continuing.');
      return;
    }
    submission.current = true;
    setSubmitError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('eventId', id);
      fd.append('billing', JSON.stringify(billing));
      fd.append('participants', JSON.stringify(participants));
      if (couponResult) fd.append('couponCode', couponCode);

      const result = await createRegistrationAction(fd);
      if (result.netAmount > 0) {
        try {
          const { checkoutUrl } = await startChipCheckoutAction(result.registrationId);
          window.location.assign(checkoutUrl);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Payment is unavailable. Your registration is saved in your profile.');
          router.push('/profile');
        }
      } else {
        toast.success('Registration successful!');
        router.push('/profile');
      }
    } catch (error) {
      setSubmitError((error as Error).message);
      submission.current = false;
      toast.error((error as Error).message);
      setSubmitting(false);
    }
  };

  if (isLoading) return <PageLoading label="Loading registration" />;
  if (eventError) return <div role="alert" className="mx-auto max-w-xl px-6 py-36"><h1 className="text-2xl">Registration could not be loaded</h1><p className="my-4 text-slate-600">Please check your connection and try again.</p><button className="btn-secondary" onClick={() => refetch()}>Try again</button></div>;
  if (!event) return <div className="min-h-screen flex items-center justify-center"><p className="text-slate-600">Event not found</p></div>;

  const totalSteps = 3;

  return (
    <div className={`${styles.checkout} min-h-dvh pt-28 pb-16 flex flex-col bg-[#f8f9f5] text-slate-900 sm:pt-32`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 w-full flex-1 flex flex-col gap-6">

        {/* Steps indicator */}
        <div aria-label={`Registration step ${step} of 3`} className="flex flex-wrap items-center justify-center gap-3 mb-6 shrink-0">
          {[1, 2, 3].map(s => (
            <div key={s} aria-current={step === s ? 'step' : undefined} className="flex items-center gap-2 sm:gap-3">
              <motion.div layout animate={step > s && !reduceMotion ? { scale: [1, 1.22, 1] } : { scale: 1 }} transition={{ type: 'tween', duration: 0.35 }} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                step >= s ? 'bg-brand text-black shadow-[0_0_15px_rgba(204,255,0,0.2)]' : 'bg-slate-100 text-slate-600'
              }`}>{step > s ? <Check size={14} /> : s}</motion.div>
              <span className="text-sm font-medium">{['Participants', 'Billing', 'Review'][s - 1]}</span>
              {s < totalSteps && <div aria-hidden="true" className={`hidden sm:block w-8 h-px ${step > s ? 'bg-[#4e6500]' : 'bg-slate-300'}`} />}
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-0 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={reduceMotion ? false : { opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-stretch min-h-0"
              >
                {/* Left Side: Categories */}
                <div className="lg:col-span-7 flex flex-col justify-between min-h-0">
                  <div className="mb-4 shrink-0">
                    <h1 className="text-2xl font-display font-semibold normal-case tracking-tight text-slate-900 line-clamp-1">{event.title}</h1>
                    <p className="text-sm text-slate-600 mt-1">Choose tickets, then complete one form for each attendee.</p>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 min-h-0 ">
                    {categories.map(cat => {
                      const count = participants.filter(p => p.category_id === cat.id).length;
                      const isFull = cat.max_slots && count >= cat.max_slots;

                      return (
                        <div key={cat.id} className="glass rounded-xl p-4 flex items-center justify-between border border-slate-300 hover:border-slate-300 transition-colors">
                          <div className="pr-4">
                            <h3 className="text-xs font-semibold normal-case tracking-tight text-slate-900">{cat.name}</h3>
                            <p className="text-xs text-slate-600 mt-1">
                              {cat.description && `${cat.description} • `}
                              RM{Number(cat.base_price).toFixed(2)}
                              {cat.max_slots && ` • Up to ${cat.max_slots} places`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {count > 0 && (
                              <span className="text-xs font-semibold text-[#4e6500]">{count}x</span>
                            )}
                            <button onClick={() => handleAddParticipant(cat.id)} disabled={isFull || participants.length >= 100}
                              className={`px-4 py-2 text-xs font-semibold normal-case tracking-normal rounded-full transition-all ${
                                isFull ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : 'bg-brand/10 text-[#4e6500] hover:bg-brand/20'
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
                  <div className="flex-1 glass rounded-2xl p-5 flex flex-col justify-between min-h-0 border border-slate-300">
                    <p className="text-xs font-semibold normal-case tracking-normal text-slate-600 mb-3 shrink-0">
                      Added Participants ({participants.length})
                    </p>

                    <form id="participants-form" onSubmit={e => { e.preventDefault(); setStep(2); }} className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
                      {participants.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-10 opacity-30">
                          <p className="text-xs font-semibold normal-case tracking-normal">No participants added</p>
                        </div>
                      ) : (
                        participants.map((p, i) => {
                          const cat = categories.find(c => c.id === p.category_id);
                          return (
                            <div key={i} className="p-4 sm:p-5 bg-white border border-slate-300 rounded-xl">
                              <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 pr-2">
                                <p className="text-xs font-semibold normal-case tracking-tight text-slate-800 truncate">{cat?.name}</p>
                                <span className="text-xs font-bold text-[#4e6500] normal-case tracking-wider mt-0.5 block">Attendee {i + 1}</span>
                              </div>
                              <button aria-label={`Remove participant ${i + 1}`} onClick={() => handleRemoveParticipant(i)}
                                className="min-h-11 min-w-11 flex items-center justify-center hover:bg-red-50 text-red-700 transition-colors shrink-0"
                              ><X size={12} /></button>
                              </div>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {([['full_name', 'Full name as on IC / passport', 'name'], ['ic_passport', 'IC / passport number', 'off'], ['bib_name', 'Name printed on bib', 'nickname'], ['email', 'Email', 'email'], ['phone', 'Phone number', 'tel'], ['emergency_name', 'Emergency contact name', 'off'], ['emergency_phone', 'Emergency contact phone', 'tel']] as const).map(([field, label, autocomplete]) => <div key={field}>
                                  <label htmlFor={`${field}-${i}`} className="label-text">{label} *</label>
                                  <input id={`${field}-${i}`} name={`${field}-${i}`} type={field === 'email' ? 'email' : field.includes('phone') ? 'tel' : 'text'} autoComplete={autocomplete} required minLength={field.includes('phone') ? 8 : undefined} maxLength={field === 'full_name' ? 255 : field === 'email' ? 255 : field.includes('phone') ? 50 : 100} value={p[field]} onChange={e => handleParticipantChange(i, field, e.target.value)} className="input-field" />
                                </div>)}
                                <div><label htmlFor={`gender-${i}`} className="label-text">Gender *</label><select id={`gender-${i}`} required value={p.gender} onChange={e => handleParticipantChange(i, 'gender', e.target.value)} className="input-field"><option value="">Select gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select></div>
                                <div><label htmlFor={`dob-${i}`} className="label-text">Date of birth *</label><input id={`dob-${i}`} type="date" required max={new Date().toISOString().slice(0, 10)} value={p.dob} onChange={e => { const dob = e.target.value; const date = new Date(`${dob}T00:00:00Z`); const today = new Date(); const age = dob ? today.getUTCFullYear() - date.getUTCFullYear() - (today.getUTCMonth() < date.getUTCMonth() || (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate()) ? 1 : 0) : null; setParticipants(prev => prev.map((entry, index) => index === i ? { ...entry, dob, age } : entry)); }} className="input-field" /></div>
                                <div><label htmlFor={`age-${i}`} className="label-text">Age</label><output id={`age-${i}`} className="input-field block">{p.age === null ? 'From date of birth' : `${p.age} years`}</output></div>
                                <div><label htmlFor={`category-age-${i}`} className="label-text">Category by age *</label><select id={`category-age-${i}`} required value={p.category_age} onChange={e => handleParticipantChange(i, 'category_age', e.target.value)} className="input-field"><option value="">Select age group</option><option value="Junior">Junior</option><option value="Adult">Adult</option><option value="Senior">Senior</option></select></div>
                                <div><label htmlFor={`tee-${i}`} className="label-text">Event tee size *</label><select id={`tee-${i}`} required value={p.tee_size} onChange={e => handleParticipantChange(i, 'tee_size', e.target.value)} className="input-field"><option value="">Select size</option>{['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map(size => <option key={size} value={size}>{size}</option>)}</select></div>
                                <div><label htmlFor={`country-${i}`} className="label-text">Country *</label><input id={`country-${i}`} required maxLength={100} value={p.country} onChange={e => handleParticipantChange(i, 'country', e.target.value)} className="input-field" /></div>
                                <div><label htmlFor={`medical-${i}`} className="label-text">Medical condition? *</label><select id={`medical-${i}`} required value={p.medical_status === null ? '' : p.medical_status ? 'yes' : 'no'} onChange={e => handleParticipantChange(i, 'medical_status', e.target.value === 'yes')} className="input-field"><option value="">Select</option><option value="no">No</option><option value="yes">Yes</option></select></div>
                                {p.medical_status && <div className="sm:col-span-2"><label htmlFor={`medical-details-${i}`} className="label-text">Describe medical condition *</label><textarea id={`medical-details-${i}`} required maxLength={2000} value={p.medical_details} onChange={e => handleParticipantChange(i, 'medical_details', e.target.value)} className="input-field" /></div>}
                              </div>
                              <motion.p role="status" aria-live="polite" initial={false} animate={participantComplete(p) && !reduceMotion ? { scale: [1, 1.04, 1] } : { scale: 1 }} transition={{ type: 'tween', duration: 0.35 }} className={`mt-4 flex items-center gap-2 text-sm font-semibold ${participantComplete(p) ? 'text-[#4e6500]' : 'text-slate-500'}`}>{participantComplete(p) ? <><Check size={18} aria-hidden="true" />Attendee ready</> : <>Complete this attendee to continue</>}</motion.p>
                            </div>
                          );
                        })
                      )}
                    </form>
                  </div>

                  <div className="mt-4 shrink-0 flex justify-end">
                    <button type="submit" form="participants-form" disabled={participants.length === 0 || participants.some(p => !participantComplete(p))}
                      className="btn-primary text-xs !py-3.5 !px-8 disabled:opacity-30 disabled:cursor-not-allowed font-semibold normal-case tracking-normal rounded-xl transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(204,255,0,0.15)]"
                    >Next: Billing <ArrowRight size={14} /></button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={reduceMotion ? false : { opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-stretch min-h-0"
              >
                {/* Left Side: Summary info */}
                <div className="lg:col-span-4 flex flex-col justify-between">
                  <div>
                    <h1 className="text-2xl font-display font-semibold normal-case tracking-tight text-slate-900">Billing Info</h1>
                    <p className="text-xs text-slate-600 font-bold normal-case tracking-normal mt-1">Step 2: Enter payment details</p>
                    {event.coupons_allowed && <div className="glass rounded-xl p-5 mt-6 border border-slate-300">
                      <p className="text-xs font-semibold normal-case tracking-normal text-slate-600 mb-2">Order summary</p>
                      <div className="flex justify-between py-1">
                        <span className="text-xs text-slate-600">Participants</span>
                        <span className="text-xs font-semibold text-slate-900">{participants.length}</span>
                      </div>
                      <div className="flex justify-between py-1 border-t border-slate-300 mt-2 pt-2">
                        <span className="text-xs text-slate-600">Estimated Total</span>
                        <span className="text-xs font-semibold text-[#4e6500]">RM{totalAmount.toFixed(2)}</span>
                      </div>
                    </div>}
                  </div>
                </div>

                {/* Right Side: Form */}
                <div className="lg:col-span-8 flex flex-col justify-between min-h-0">
                  <form id="billing-form" onSubmit={e => { e.preventDefault(); setStep(3); }} className="glass p-5 sm:p-6 border border-slate-300 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label htmlFor="billing-name" className="label-text text-xs">Full Name</label>
                        <input id="billing-name" autoComplete="name" maxLength={100} type="text" value={billing.first_name} onChange={e => setBilling(p => ({ ...p, first_name: e.target.value }))}
                          required className="input-field !py-2.5 text-xs" placeholder="Your full name" />
                      </div>
                      <div>
                        <label htmlFor="billing-email" className="label-text text-xs">Email</label>
                        <input id="billing-email" autoComplete="email" maxLength={255} type="email" value={billing.email} onChange={e => setBilling(p => ({ ...p, email: e.target.value }))}
                          required className="input-field !py-2.5 text-xs" placeholder="your@email.com" />
                      </div>
                      <div>
                        <label htmlFor="billing-phone" className="label-text text-xs">Phone</label>
                        <input id="billing-phone" autoComplete="tel" minLength={8} maxLength={50} type="tel" value={billing.phone} onChange={e => setBilling(p => ({ ...p, phone: e.target.value }))}
                          required className="input-field !py-2.5 text-xs" placeholder="+60XXXXXXXXX" />
                      </div>
                      <div>
                        <label htmlFor="billing-city" className="label-text text-xs">City</label>
                        <input id="billing-city" autoComplete="address-level2" maxLength={100} type="text" value={billing.city} onChange={e => setBilling(p => ({ ...p, city: e.target.value }))}
                          required className="input-field !py-2.5 text-xs" placeholder="City" />
                      </div>
                      <div>
                        <label htmlFor="billing-postcode" className="label-text text-xs">Postcode</label>
                        <input id="billing-postcode" autoComplete="postal-code" maxLength={20} type="text" value={billing.postcode} onChange={e => setBilling(p => ({ ...p, postcode: e.target.value }))}
                          required className="input-field !py-2.5 text-xs" placeholder="Postcode" />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="billing-country" className="label-text text-xs">Country</label>
                        <FieldSelect id="billing-country" label="Billing country" value={billing.country} onValueChange={country => setBilling(p => ({ ...p, country }))} options={['Malaysia', 'Singapore', 'Indonesia', 'Thailand', 'Other'].map(value => ({ value, label: value }))} />
                      </div>
                    </div>
                  </form>

                  <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 shrink-0">
                    <button onClick={() => setStep(1)} className="btn-secondary text-xs !py-3 !px-6 border-slate-300 rounded-xl"><ArrowLeft size={12} /> Back</button>
                    <button type="submit" form="billing-form" disabled={!billing.first_name.trim() || !billing.email || !billing.phone}
                      className="btn-primary text-xs !py-3 !px-6 disabled:opacity-30 disabled:cursor-not-allowed font-semibold rounded-xl"
                    >Next: Review <ArrowRight size={12} /></button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={reduceMotion ? false : { opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-stretch min-h-0"
              >
                {/* Left Side: Coupon */}
                <div className="lg:col-span-5 flex flex-col justify-between">
                  <div>
                    <h1 className="text-2xl font-display font-semibold normal-case tracking-tight text-slate-900">Review Order</h1>
                    <p className="text-xs text-slate-600 font-bold normal-case tracking-normal mt-1">Step 3: Apply Coupon & Pay</p>

                    <div className="glass rounded-xl p-5 mt-6 border border-slate-300">
                      <label htmlFor="coupon-code" className="label-text">Apply coupon code</label>
                      <div className="flex items-center gap-2">
                        <input id="coupon-code" maxLength={100} type="text" value={couponCode} onChange={e => { setCouponCode(e.target.value); setCouponResult(null); setCouponError(''); }}
                          className="min-w-0 flex-1 bg-white border border-slate-400 py-2 px-3 text-base outline-none focus:border-[#4e6500] transition-colors text-slate-900"
                          placeholder="Coupon code" />
                        <button onClick={handleApplyCoupon} disabled={!couponCode.trim() || validateCoupon.isPending}
                          className="btn-primary !py-2 !px-4 text-xs rounded-lg disabled:opacity-30"
                        >{validateCoupon.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Apply'}</button>
                      </div>
                      {couponResult && <p className="mt-2 text-xs text-green-700 font-bold">Applied! -RM{Number(couponResult.discount_amount).toFixed(2)}</p>}
                      {couponError && <p className="mt-2 text-xs text-red-700 font-bold">{couponError}</p>}
                    </div>

                    <div className="glass rounded-xl p-5 mt-4 border border-slate-300 space-y-2.5">
                      <p className="text-xs font-semibold normal-case tracking-normal text-slate-600">Billing Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600 block text-xs normal-case">Name</span>
                          <span className="text-slate-900 font-bold">{billing.first_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-600 block text-xs normal-case">Phone</span>
                          <span className="text-slate-900 font-bold">{billing.phone}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-600 block text-xs normal-case">Email</span>
                          <span className="text-slate-900 font-bold break-all">{billing.email}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-600 block text-xs normal-case">Address</span>
                          <span className="text-slate-900 font-bold">
                            {billing.city && `${billing.city}, `}{billing.postcode && `${billing.postcode}, `}{billing.country}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-300 bg-white p-5 space-y-4">
                      <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={18} aria-hidden="true" />Before you finish</p>
                      <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed"><input type="checkbox" checked={billing.terms_accepted} onChange={e => setBilling(previous => ({ ...previous, terms_accepted: e.target.checked }))} className="mt-1 size-5 shrink-0 accent-[#4e6500]" /><span>I agree to the event registration rules and regulations.</span></label>
                      {event.terms_and_conditions && <details className="rounded-lg bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-semibold">Read event rules</summary><p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-700">{event.terms_and_conditions}</p></details>}
                      <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed"><input type="checkbox" checked={billing.policy_accepted} onChange={e => setBilling(previous => ({ ...previous, policy_accepted: e.target.checked }))} className="mt-1 size-5 shrink-0 accent-[#4e6500]" /><span>I accept the <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Time Track privacy policy</a>.</span></label>
                    </div>
                  </div>
                </div>

                {/* Right Side: Total Summary & Payment */}
                <div className="lg:col-span-7 flex flex-col justify-between min-h-0">
                  <div className="glass rounded-2xl p-6 border border-slate-300 flex-1 flex flex-col justify-between min-h-0 ">
                    <p className="text-xs font-semibold normal-case tracking-normal text-slate-600 mb-3 shrink-0">Order Summary</p>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 border-b border-slate-300 pb-3 mb-3">
                      {participants.map((p, i) => {
                        const cat = categories.find(c => c.id === p.category_id);
                        return (
                          <div key={i} className="flex items-center justify-between py-1 text-xs">
                            <span className="text-slate-600">{p.full_name} <span className="block text-sm">{cat?.name}</span></span>
                            <span className="font-bold">RM{Number(cat?.base_price || 0).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-1.5 shrink-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">Subtotal</span>
                        <span>RM{totalAmount.toFixed(2)}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-green-700">Discount</span>
                          <span className="text-green-700">-RM{discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between py-2 border-t border-slate-300 mt-2">
                        <span className="text-xs font-semibold normal-case tracking-tight">Net Total</span>
                        <span className="text-base font-semibold text-[#4e6500]">RM{netAmount.toFixed(2)}</span>
                      </div>
                    </div>
                    {netAmount > 0 && <div className="mt-5 border-t border-slate-200 pt-4"><p className="text-sm font-semibold">Choose how to pay on secure checkout</p><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">{([[Landmark, 'Online banking'], [CreditCard, 'Card'], [Wallet, 'E-wallet / QR']] as const).map(([Icon, label]) => <div key={label} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm"><Icon size={18} aria-hidden="true" />{label}</div>)}</div><p className="mt-2 text-xs text-slate-600">Available methods depend on the event payment account and appear on CHIP checkout.</p></div>}
                  </div>

                  <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 shrink-0">
                    <button onClick={() => setStep(2)} disabled={submitting} className="btn-secondary text-xs !py-3 !px-6 border-slate-300 rounded-xl"><ArrowLeft size={12} /> Back</button>
                    <button onClick={handleSubmit} disabled={submitting || !billing.terms_accepted || !billing.policy_accepted} aria-busy={submitting}
                      className="btn-primary text-xs !py-3.5 !px-8 disabled:opacity-30 rounded-xl font-semibold normal-case tracking-normal shadow-[0_0_20px_rgba(204,255,0,0.2)]"
                    >
                      {submitting ? <Loader2 size={12} className="animate-spin shrink-0" /> : null}
                      {submitting ? 'Processing...' : netAmount > 0 ? `Pay RM${netAmount.toFixed(2)}` : 'Complete'}
                    </button>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">{submitting ? 'Saving your registration and opening checkout. Keep this page open.' : 'Final pricing is verified when you continue. Payment details are entered on CHIP.'}</p>
                  {submitError && <p role="alert" className="mt-3 border-l-2 border-red-700 pl-3 text-sm text-red-700">{submitError}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
