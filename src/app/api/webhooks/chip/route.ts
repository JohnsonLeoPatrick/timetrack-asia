import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { amountInSen, chipConfig, chipPurchaseSchema, isSettledChipPurchase, retrieveChipPurchase, validateChipPurchase, verifyChipSignature } from '@/lib/server/payments/chip';

export async function POST(request: Request) {
  const maxBytes = 262144;
  if (Number(request.headers.get('content-length')) > maxBytes) return new Response('Payload too large', { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response('Missing payload', { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); return new Response('Payload too large', { status: 413 }); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks);
  try {
    if (!verifyChipSignature(raw, request.headers.get('x-signature'), chipConfig().publicKey)) return new Response('Invalid signature', { status: 401 });
    let parsed: unknown;
    try { parsed = JSON.parse(raw.toString('utf8')); } catch { return new Response('Invalid JSON', { status: 400 }); }
    const payload = chipPurchaseSchema.safeParse(parsed);
    if (!payload.success) return new Response('Invalid payload', { status: 400 });
    const admin = await createSupabaseAdminClient();
    const { data: payment, error } = await admin.from('payments').select('id, amount, gateway_reference').eq('id', payload.data.reference).eq('payment_gateway', 'CHIP').single();
    if (error || !payment) return new Response('Payment not found', { status: 404 });
    if (!payment.gateway_reference) return new Response('Payment binding pending', { status: 503 });
    // Fetch current state: authentic but delayed/replayed callbacks are only snapshots.
    const purchase = await retrieveChipPurchase(payload.data.id);
    validateChipPurchase(purchase, { id: payment.gateway_reference, paymentId: payment.id, amount: amountInSen(payment.amount) });
    if (!isSettledChipPurchase(purchase)) return new Response('Acknowledged', { status: 200 });
    const { error: settleError } = await admin.rpc('settle_chip_payment', { p_payment_id: payment.id, p_purchase_id: purchase.id, p_amount_sen: purchase.purchase.total });
    if (settleError) return new Response('Confirmation unavailable', { status: 503 });
    return new Response('Acknowledged', { status: 200 });
  } catch { return new Response('Confirmation unavailable', { status: 503 }); }
}
