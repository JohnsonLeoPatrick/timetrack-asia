'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/server/security/rate-limit';
import { billingSchema as runnerBillingSchema, participantSchema as runnerParticipantSchema } from '@/lib/runner-checkout';

// Category ids are opaque primary keys. The previous `.uuid()` check rejected
// valid non-UUID ids (e.g. seeded/local ids such as `cat_1`).
const OPTIONAL_STRING_FIELDS = [
  'address', 'postcode', 'medical_details',
  'emergency_name', 'emergency_phone',
];

export async function createRegistrationAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  if (!checkRateLimit(`registration:${user.id}`, { windowMs: 60000, maxRequests: 5 }).allowed) throw new Error('Please wait a minute before creating another registration');

  const eventId = formData.get('eventId') as string;
  const couponCode = z.string().trim().max(100).parse(formData.get('couponCode') || '') || null;
  const billingJson = formData.get('billing') as string;
  const participantsJson = formData.get('participants') as string;

  const billing = billingJson ? JSON.parse(billingJson) : {};
  const participants = z.array(z.record(z.string(), z.unknown())).min(1).max(100).parse(participantsJson ? JSON.parse(participantsJson) : []);

  if (!eventId) throw new Error('Event is required');
  if (participants.length === 0) throw new Error('At least one participant is required');

  // Parse/clean client input before handing it to the database function.
  const parsedBilling = runnerBillingSchema.parse(billing);

  const parsedParticipants = participants.map((p) => {
    const cleaned: Record<string, unknown> = { ...p };

    for (const field of OPTIONAL_STRING_FIELDS) {
      if (cleaned[field] === '') delete cleaned[field];
    }
    if (cleaned.age === null || cleaned.age === undefined) delete cleaned.age;
    if (cleaned.medical_status === null || cleaned.medical_status === undefined) delete cleaned.medical_status;

    const person = runnerParticipantSchema.parse(cleaned);
    if (!person.medical_status) person.medical_details = '';
    return person;
  });

  // One transaction: registration + billing + participants + coupon redemption.
  // If any step fails nothing is written, so there are no partial registrations
  // and a coupon can never be redeemed past its limits.
  const { data, error } = await supabase.rpc('create_registration_atomic', {
    p_event_id: eventId,
    p_athlete_id: user.id,
    p_billing: parsedBilling,
    p_participants: parsedParticipants,
    p_coupon_code: couponCode,
  });

  if (error) throw new Error(error.message);

  const result = typeof data === 'string' ? JSON.parse(data) : data;

  revalidatePath(`/events/${eventId}`, 'page');
  revalidatePath('/profile', 'page');

  return { registrationId: result.registration_id, netAmount: Number(result.net_amount) };
}

export async function cancelRegistrationAction(registrationId: string) {
  z.string().uuid().parse(registrationId);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: reg } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', registrationId)
    .eq('athlete_id', user.id)
    .single();

  if (!reg) throw new Error('Registration not found');
  if (reg.status === 'PAID') throw new Error('Please request a refund instead');

  const { data: cancelled, error } = await supabase
    .from('registrations')
    .update({ status: 'CANCELLED', deleted_at: new Date().toISOString() })
    .eq('id', registrationId)
    .eq('athlete_id', user.id)
    .eq('status', 'PENDING')
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!cancelled) throw new Error('Registration status changed. Please refresh before cancelling.');
  revalidatePath('/profile', 'page');
}

export async function requestRefundAction(registrationId: string, reason: string) {
  z.string().uuid().parse(registrationId);
  reason = z.string().trim().min(3).max(2000).parse(reason);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase.rpc('request_registration_refund', { p_registration_id: registrationId, p_reason: reason });

  if (error) throw new Error(error.message);
  revalidatePath('/profile', 'page');
}
