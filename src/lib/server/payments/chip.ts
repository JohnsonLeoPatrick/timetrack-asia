import { constants, createPublicKey, verify } from 'node:crypto';
import { z } from 'zod';

const api = 'https://gate.chip-in.asia/api/v1';
export const chipPurchaseSchema = z.object({
  id: z.string().uuid(), brand_id: z.string().uuid(), reference: z.string().uuid(),
  status: z.string(), is_test: z.boolean(), marked_as_paid: z.boolean().optional(),
  checkout_url: z.string().url().nullable().optional(),
  purchase: z.object({ total: z.number().int().nonnegative(), currency: z.string() }),
  payment: z.object({ amount: z.number().int(), currency: z.string(), is_outgoing: z.boolean() }).nullable().optional(),
});
export type ChipPurchase = z.infer<typeof chipPurchaseSchema>;

export class ChipRequestError extends Error {
  constructor(public readonly rejected: boolean) { super('Unable to contact the payment provider. Please try again later.'); }
}

export function amountInSen(amount: string | number): number {
  const value = String(amount);
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Invalid payment amount');
  const [whole, fraction = ''] = value.split('.');
  const sen = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(sen) || sen < 1 || sen > 2147483647) throw new Error('Invalid payment amount');
  return sen;
}

export function chipConfig() {
  const secret = process.env.CHIP_SECRET_KEY;
  const brandId = process.env.CHIP_BRAND_ID;
  const publicKey = process.env.CHIP_PUBLIC_KEY?.replace(/\\n/g, '\n');
  const mode = process.env.CHIP_MODE;
  if (!secret || !brandId || !publicKey || !['test', 'live'].includes(mode || '')) throw new Error('Online payment is temporarily unavailable');
  z.string().uuid().parse(brandId);
  createPublicKey(publicKey);
  return { secret, brandId, publicKey, isTest: mode === 'test' };
}

export function checkoutOrigin(): string {
  const raw = process.env.CHIP_CALLBACK_ORIGIN;
  if (!raw) throw new Error('Online payment is temporarily unavailable');
  const url = new URL(raw);
  // URL.port normalizes an explicit :443 away, but CHIP rejects explicit default ports too.
  const authority = raw.split('://')[1]?.split(/[/?#]/)[0] || '';
  const explicitPort = /:\d+$/.test(authority);
  if (url.protocol !== 'https:' || explicitPort || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('A public HTTPS origin is required for payments');
  }
  return url.origin;
}

async function chipRequest(path: string, body?: unknown): Promise<ChipPurchase> {
  const { secret } = chipConfig();
  let response: Response;
  try {
    response = await fetch(`${api}${path}`, {
      method: body ? 'POST' : 'GET', redirect: 'error', cache: 'no-store',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
    });
  } catch { throw new ChipRequestError(false); }
  if (!response.ok) throw new ChipRequestError(response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429);
  return chipPurchaseSchema.parse(await response.json());
}

export function retrieveChipPurchase(id: string) {
  return chipRequest(`/purchases/${z.string().uuid().parse(id)}/`);
}

export async function createChipPurchase(input: { paymentId: string; amount: number; email: string; title: string; expiresAt?: string | null }) {
  const { brandId } = chipConfig();
  const origin = checkoutOrigin();
  const statusUrl = `${origin}/payments/${input.paymentId}`;
  const now = Math.floor(Date.now() / 1000);
  const due = input.expiresAt ? Math.min(now + 900, Math.floor(Date.parse(input.expiresAt) / 1000)) : now + 900;
  if (!Number.isSafeInteger(due) || due <= now) throw new Error('Registration payment window expired');
  return chipRequest('/purchases/', {
    brand_id: brandId, reference: input.paymentId,
    due,
    client: { email: input.email },
    purchase: { currency: 'MYR', products: [{ name: input.title.slice(0, 200), price: input.amount }], due_strict: true },
    success_callback: `${origin}/api/webhooks/chip`,
    success_redirect: statusUrl, failure_redirect: statusUrl, cancel_redirect: statusUrl,
    send_receipt: false, skip_capture: false,
  });
}

export function safeCheckoutUrl(raw: string): string {
  const url = new URL(raw);
  if (url.origin !== 'https://gate.chip-in.asia' || url.username || url.password || !url.pathname.startsWith('/p/')) throw new Error('Invalid provider checkout URL');
  return url.href;
}

export function verifyChipSignature(raw: Uint8Array, signature: string | null, publicKey: string): boolean {
  if (!signature || signature.length > 2048 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) return false;
  try {
    return verify('RSA-SHA256', raw, { key: publicKey, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(signature, 'base64'));
  } catch { return false; }
}

export function validateChipPurchase(purchase: ChipPurchase, expected: { id?: string; paymentId: string; amount: number }) {
  const config = chipConfig();
  if ((expected.id && purchase.id !== expected.id) || purchase.reference !== expected.paymentId || purchase.brand_id !== config.brandId ||
      purchase.is_test !== config.isTest || purchase.purchase.currency !== 'MYR' || purchase.purchase.total !== expected.amount || purchase.marked_as_paid) {
    throw new Error('Payment verification failed');
  }
}

export function isSettledChipPurchase(purchase: ChipPurchase): boolean {
  return ['paid', 'cleared', 'settled'].includes(purchase.status) && !!purchase.payment &&
    purchase.payment.currency === 'MYR' && purchase.payment.amount === purchase.purchase.total && purchase.payment.is_outgoing === false;
}
