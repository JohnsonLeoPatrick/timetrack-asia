'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sendRegistrationConfirmation, sendPaymentConfirmation } from '@/lib/server/email/sender';

const billingSchema = z.object({
  first_name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  country: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
});

const participantSchema = z.object({
  category_id: z.string().uuid(),
  full_name: z.string().min(1),
  bib_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  ic_passport: z.string().optional(),
  dob: z.string().optional(),
  age: z.number().optional(),
  address: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  medical_status: z.boolean().optional(),
  medical_details: z.string().optional(),
  emergency_name: z.string().optional(),
  emergency_phone: z.string().optional(),
});

export async function createRegistrationAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const eventId = formData.get('eventId') as string;
  const couponCode = formData.get('couponCode') as string || null;
  const billingJson = formData.get('billing') as string;
  const participantsJson = formData.get('participants') as string;

  const billing = billingJson ? JSON.parse(billingJson) : {};
  const participants: any[] = participantsJson ? JSON.parse(participantsJson) : [];

  // Get event with categories
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*, event_categories(*)')
    .eq('id', eventId)
    .single();

  if (eventError || !event) throw new Error('Event not found');

  // Calculate total
  let totalAmount = 0;
  for (const p of participants) {
    const cat = event.event_categories?.find((c: any) => c.id === p.category_id);
    if (cat) totalAmount += Number(cat.base_price);
  }

  // Apply coupon if provided
  let discountAmount = 0;
  let couponId: string | null = null;

  if (couponCode) {
    const { data: couponResult } = await supabase.rpc('validate_coupon', {
      p_code: couponCode,
      p_user_id: user.id,
      p_event_id: eventId,
      p_order_amount: totalAmount,
      p_category_id: participants[0]?.category_id || null,
    });

    if (couponResult?.valid) {
      discountAmount = Number(couponResult.discount_amount);
      couponId = couponResult.coupon_id;
    } else {
      throw new Error(couponResult?.error || 'Invalid coupon code');
    }
  }

  const netAmount = Math.max(0, totalAmount - discountAmount);

  // Generate registration number
  const { data: regNumber } = await supabase.rpc('generate_registration_number');
  const registrationNumber = regNumber || `TT-${Date.now().toString(36).toUpperCase()}`;

  // Create registration
  const { data: registration, error: regError } = await supabase
    .from('registrations')
    .insert({
      event_id: eventId,
      athlete_id: user.id,
      registration_number: registrationNumber,
      persons_count: participants.length,
      status: 'PAID',
      total_amount: totalAmount,
      discount_amount: discountAmount,
      net_amount: netAmount,
      coupon_id: couponId,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (regError) throw new Error(regError.message);

  // Insert billing details
  const parsedBilling = billingSchema.parse(billing);
  const { error: billError } = await supabase.from('billing_details').insert({
    registration_id: registration.id,
    ...parsedBilling,
  });
  if (billError) throw new Error(billError.message);

  // Insert participants
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const cleanedP = { ...p };

    if (!cleanedP.full_name || cleanedP.full_name.trim() === '') {
      cleanedP.full_name = i === 0 ? billing.first_name : `${billing.first_name} (Guest ${i + 1})`;
    }

    const optionalStringFields = [
      'bib_name', 'email', 'phone', 'gender', 'ic_passport', 
      'dob', 'address', 'postcode', 'country', 'medical_details', 
      'emergency_name', 'emergency_phone'
    ];

    for (const field of optionalStringFields) {
      if (cleanedP[field] === '') {
        delete cleanedP[field];
      }
    }

    if (cleanedP.age === null || cleanedP.age === undefined) {
      delete cleanedP.age;
    }

    const parsedP = participantSchema.parse(cleanedP);
    const { error: partError } = await supabase.from('participants').insert({
      registration_id: registration.id,
      ...parsedP,
    });
    if (partError) throw new Error(partError.message);
  }

  // Redeem coupon if used
  if (couponId) {
    await supabase.rpc('redeem_coupon', {
      p_coupon_id: couponId,
      p_registration_id: registration.id,
      p_user_id: user.id,
      p_discount_amount: discountAmount,
    });
  }

  // 1. Create a successful mock payment record automatically to auto-complete the transaction
  await supabase.from('payments').insert({
    registration_id: registration.id,
    payment_gateway: 'MOCK_GATEWAY',
    amount: netAmount,
    currency: 'MYR',
    status: 'SUCCESS',
  });

  // 2. Trigger automated SMTP emails
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await sendRegistrationConfirmation(user.email!, {
      eventName: event.title,
      registrationNumber: registration.registration_number,
      participantName: `${billing.first_name} ${billing.last_name || ''}`,
      eventDate: new Date(event.event_date).toLocaleDateString(),
      dashboardUrl: `${appUrl}/profile`,
    });

    await sendPaymentConfirmation(user.email!, {
      eventName: event.title,
      amount: netAmount.toString(),
      invoiceUrl: `${appUrl}/api/receipt/${registration.id}`,
    });
  } catch (emailErr) {
    console.error('SMTP Automated email error:', emailErr);
  }

  revalidatePath(`/events/${eventId}`, 'page');
  revalidatePath('/profile', 'page');

  return { registrationId: registration.id, netAmount };
}

export async function cancelRegistrationAction(registrationId: string) {
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

  const { error } = await supabase
    .from('registrations')
    .update({ status: 'CANCELLED', deleted_at: new Date().toISOString() })
    .eq('id', registrationId);

  if (error) throw new Error(error.message);
  revalidatePath('/profile', 'page');
}

export async function requestRefundAction(registrationId: string, reason: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: reg } = await supabase
    .from('registrations')
    .select('id')
    .eq('id', registrationId)
    .eq('athlete_id', user.id)
    .single();

  if (!reg) throw new Error('Registration not found');

  const { data: payment } = await supabase
    .from('payments')
    .select('id, amount')
    .eq('registration_id', registrationId)
    .eq('status', 'SUCCESS')
    .single();

  if (!payment) throw new Error('No paid payment found');

  const { error } = await supabase.from('refunds').insert({
    payment_id: payment.id,
    registration_id: registrationId,
    amount: payment.amount,
    reason,
    status: 'REFUND_REQUESTED',
  });

  if (error) throw new Error(error.message);
  revalidatePath('/profile', 'page');
}
