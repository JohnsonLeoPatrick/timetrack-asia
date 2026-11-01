'use server';

import { z } from 'zod';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/server/auth/require-role';
import { checkRateLimit } from '@/lib/server/security/rate-limit';
import { ChipRequestError, amountInSen, checkoutOrigin, chipConfig, createChipPurchase, isSettledChipPurchase, retrieveChipPurchase, safeCheckoutUrl, validateChipPurchase } from '@/lib/server/payments/chip';

export async function startChipCheckoutAction(registrationId: string) {
  z.string().uuid().parse(registrationId);
  const { user } = await requireRole(['ATHLETE', 'ORGANIZER', 'ADMIN', 'SUPER_ADMIN']);
  if (process.env.CHIP_ENABLED !== 'true') throw new Error('Online payment is temporarily unavailable');
  checkoutOrigin(); chipConfig();
  if (!checkRateLimit(`chip-checkout:${user.id}`, { windowMs: 60000, maxRequests: 5 }).allowed) throw new Error('Too many payment attempts. Please wait a minute.');
  const admin = await createSupabaseAdminClient();
  const { data, error } = await admin.rpc('prepare_chip_payment', { p_registration_id: registrationId, p_user_id: user.id });
  if (error) throw new Error('Payment could not be started. Please try again later.');
  const payment = z.object({ id: z.string().uuid(), amount: z.union([z.string(), z.number()]), checkout_url: z.string().nullable(), email: z.string().email(), title: z.string(), expires_at: z.string().nullable() }).parse(data);
  if (payment.checkout_url) return { checkoutUrl: safeCheckoutUrl(payment.checkout_url) };
  try {
    const purchase = await createChipPurchase({ paymentId: payment.id, amount: amountInSen(payment.amount), email: payment.email, title: payment.title, expiresAt: payment.expires_at });
    validateChipPurchase(purchase, { paymentId: payment.id, amount: amountInSen(payment.amount) });
    const checkoutUrl = safeCheckoutUrl(purchase.checkout_url || '');
    const { error: saveError } = await admin.from('payments').update({
      gateway_reference: purchase.id, metadata: { checkout_url: checkoutUrl, is_test: purchase.is_test },
    }).eq('id', payment.id).eq('payment_gateway', 'CHIP').is('gateway_reference', null);
    if (saveError) throw new Error('Payment is awaiting confirmation. Please check your profile before trying again.');
    return { checkoutUrl };
  } catch (error) {
    // A timeout may follow a successful provider creation. Never retry it blindly.
    await admin.from('payments').update({ status: error instanceof ChipRequestError && error.rejected ? 'FAILED' : 'PENDING_REVIEW' })
      .eq('id', payment.id).is('gateway_reference', null);
    throw new Error('Payment could not be started. Please check your profile before trying again.');
  }
}

export async function getChipPaymentStatusAction(paymentId: string) {
  z.string().uuid().parse(paymentId);
  const { user } = await requireRole(['ATHLETE', 'ORGANIZER', 'ADMIN', 'SUPER_ADMIN']);
  if (!checkRateLimit(`chip-status:${user.id}`, { windowMs: 60000, maxRequests: 30 }).allowed) throw new Error('Please wait before checking payment again');
  const supabase = await createSupabaseServerClient();
  const { data: payment, error } = await supabase.from('payments').select('id, registration_id, gateway_reference, amount, status, payment_gateway, metadata, registrations!inner(athlete_id)').eq('id', paymentId).single();
  const registration = Array.isArray(payment?.registrations) ? payment.registrations[0] : payment?.registrations;
  if (error || !payment || registration?.athlete_id !== user.id || payment.payment_gateway !== 'CHIP') throw new Error('Payment not found');
  const details = { amount: Number(payment.amount), isTest: payment.metadata?.is_test === true };
  if (payment.gateway_reference && !['SUCCESS', 'REFUNDED'].includes(payment.status)) {
    const purchase = await retrieveChipPurchase(payment.gateway_reference);
    validateChipPurchase(purchase, { id: payment.gateway_reference, paymentId, amount: amountInSen(payment.amount) });
    if (['cancelled', 'expired'].includes(purchase.status)) {
      const admin = await createSupabaseAdminClient();
      const { error: closeError } = await admin.rpc('close_chip_payment', { p_payment_id: paymentId, p_purchase_id: purchase.id });
      if (closeError) throw new Error('Payment status could not be updated. Please check again shortly.');
      return { ...details, status: 'FAILED' };
    }
    if (isSettledChipPurchase(purchase)) {
      const admin = await createSupabaseAdminClient();
      const { error: settleError } = await admin.rpc('settle_chip_payment', { p_payment_id: paymentId, p_purchase_id: purchase.id, p_amount_sen: purchase.purchase.total });
      if (settleError) throw new Error('Your payment is awaiting confirmation. Please check again shortly.');
      return { ...details, status: 'SUCCESS' };
    }
  }
  return { ...details, status: payment.status as string };
}
