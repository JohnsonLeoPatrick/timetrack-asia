const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadTs(file, dependencies = {}) {
  const filename = path.resolve(file);
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = name => Object.hasOwn(dependencies, name) ? dependencies[name] : originalRequire(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return loaded.exports;
}
const chip = loadTs('src/lib/server/payments/chip.ts');
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' });
const originalFetch = global.fetch;
const brandId = '11111111-1111-4111-8111-111111111111';
const paymentId = '22222222-2222-4222-8222-222222222222';
const purchaseId = '33333333-3333-4333-8333-333333333333';
const fixture = () => ({ id: purchaseId, brand_id: brandId, reference: paymentId, is_test: true, status: 'created', marked_as_paid: false, checkout_url: `https://gate.chip-in.asia/p/${purchaseId}/`, purchase: { total: 2900, currency: 'MYR' }, payment: null });
beforeEach(() => {
  process.env.CHIP_SECRET_KEY = 'test-secret'; process.env.CHIP_PUBLIC_KEY = publicKey;
  process.env.CHIP_BRAND_ID = brandId; process.env.CHIP_MODE = 'test'; process.env.CHIP_CALLBACK_ORIGIN = 'https://timetrack.example';
  process.env.CHIP_ENABLED = 'true';
});
afterEach(() => { global.fetch = originalFetch; });

test('converts decimal MYR to exact sen and rejects invalid/oversized amounts', () => {
  assert.equal(chip.amountInSen('0.29'), 29);
  assert.equal(chip.amountInSen('1.01'), 101);
  assert.equal(chip.amountInSen('12345.67'), 1234567);
  for (const amount of ['0', '-1', '1.234', '1e3', 'NaN', '21474836.48']) assert.throws(() => chip.amountInSen(amount));
});
test('validates raw RSA signatures, rejecting whitespace/body tampering and wrong keys', () => {
  const raw = Buffer.from('{ "status": "paid" }');
  const signature = sign('RSA-SHA256', raw, keys.privateKey).toString('base64');
  assert.equal(chip.verifyChipSignature(raw, signature, publicKey), true);
  assert.equal(chip.verifyChipSignature(Buffer.from('{"status":"paid"}'), signature, publicKey), false);
  assert.equal(chip.verifyChipSignature(raw, null, publicKey), false);
  assert.equal(chip.verifyChipSignature(raw, '!!!', publicKey), false);
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' });
  assert.equal(chip.verifyChipSignature(raw, signature, other), false);
});
test('requires a public HTTPS callback origin and provider-only checkout destination', () => {
  for (const origin of ['http://timetrack.example', 'https://localhost', 'https://timetrack.example:3000', 'https://timetrack.example:443', 'https://user:pass@timetrack.example', 'https://timetrack.example/path', 'https://timetrack.example?next=bad']) {
    process.env.CHIP_CALLBACK_ORIGIN = origin; assert.throws(() => chip.checkoutOrigin());
  }
  assert.equal(chip.safeCheckoutUrl(fixture().checkout_url), fixture().checkout_url);
  for (const target of ['javascript:alert(1)', 'https://evil.example/p/test/', 'https://gate.chip-in.asia.evil.example/p/test/', 'https://user:pass@gate.chip-in.asia/p/test/']) assert.throws(() => chip.safeCheckoutUrl(target));
});
test('creates one documented purchase with integer price and top-level callback/redirects', async () => {
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++; assert.equal(url, 'https://gate.chip-in.asia/api/v1/purchases/');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    const body = JSON.parse(options.body);
    assert.equal(body.purchase.products[0].price, 2900);
    assert.equal(body.reference, paymentId);
    assert.equal(body.success_callback, 'https://timetrack.example/api/webhooks/chip');
    assert.equal(body.purchase.success_callback, undefined);
    assert.equal(body.success_redirect, `https://timetrack.example/payments/${paymentId}`);
    assert.equal(body.send_receipt, false);
    assert.deepEqual(Object.keys(body.client), ['email']);
    return Response.json(fixture());
  };
  await chip.createChipPurchase({ paymentId, amount: 2900, email: 'test@example.com', title: 'Race entry' });
  assert.equal(calls, 1);
});
test('does not retry ambiguous provider failures or expose provider errors', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('sensitive provider details'); };
  await assert.rejects(() => chip.createChipPurchase({ paymentId, amount: 2900, email: 'test@example.com', title: 'Race' }), error => error instanceof chip.ChipRequestError && !error.rejected && !error.message.includes('sensitive'));
  assert.equal(calls, 1);
  global.fetch = async () => Response.json({}, { status: 400 });
  await assert.rejects(() => chip.retrieveChipPurchase(purchaseId), error => error instanceof chip.ChipRequestError && error.rejected);
  global.fetch = async () => Response.json({}, { status: 503 });
  await assert.rejects(() => chip.retrieveChipPurchase(purchaseId), error => !error.rejected);
});
test('rejects cross-brand, wrong-mode, wrong-reference, wrong-amount and manually marked payments', () => {
  const expected = { id: purchaseId, paymentId, amount: 2900 };
  chip.validateChipPurchase(fixture(), expected);
  for (const patch of [{ brand_id: paymentId }, { reference: purchaseId }, { is_test: false }, { purchase: { total: 1, currency: 'MYR' } }, { purchase: { total: 2900, currency: 'USD' } }, { marked_as_paid: true }, { id: paymentId }]) assert.throws(() => chip.validateChipPurchase({ ...fixture(), ...patch }, expected));
});
test('only captured incoming payments qualify; redirects and preauthorization do not', () => {
  const paid = { ...fixture(), status: 'paid', payment: { amount: 2900, currency: 'MYR', is_outgoing: false } };
  for (const status of ['paid', 'cleared', 'settled']) assert.equal(chip.isSettledChipPurchase({ ...paid, status }), true);
  for (const status of ['created', 'pending', 'preauthorized', 'hold', 'refunded', 'error', 'cancelled']) assert.equal(chip.isSettledChipPurchase({ ...paid, status }), false);
  for (const payment of [null, { ...paid.payment, amount: 1 }, { ...paid.payment, currency: 'USD' }, { ...paid.payment, is_outgoing: true }]) assert.equal(chip.isSettledChipPurchase({ ...paid, payment }), false);
});

function callbackHarness(purchase = fixture(), gatewayReference = purchaseId) {
  const calls = [];
  const database = { from: () => { const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: { id: paymentId, amount: '29.00', gateway_reference: gatewayReference }, error: null }) }; return chain; }, rpc: async (...args) => { calls.push(args); return { error: null }; } };
  global.fetch = async () => Response.json(purchase);
  const route = loadTs('src/app/api/webhooks/chip/route.ts', { '@/lib/supabase/server': { createSupabaseAdminClient: async () => database }, '@/lib/server/payments/chip': chip });
  const raw = JSON.stringify(fixture());
  const signature = sign('RSA-SHA256', Buffer.from(raw), keys.privateKey).toString('base64');
  const request = () => new Request('https://timetrack.example/api/webhooks/chip', { method: 'POST', body: raw, headers: { 'x-signature': signature } });
  return { route, calls, request };
}
test('callback rejects unsigned and oversized input before settling', async () => {
  const { route, calls } = callbackHarness();
  assert.equal((await route.POST(new Request('https://timetrack.example', { method: 'POST', body: '{}' }))).status, 401);
  assert.equal((await route.POST(new Request('https://timetrack.example', { method: 'POST', body: 'x'.repeat(262145) }))).status, 413);
  assert.equal(calls.length, 0);
});
test('authentic callback retrieves current provider state and invokes atomic settlement', async () => {
  const paid = { ...fixture(), status: 'paid', payment: { amount: 2900, currency: 'MYR', is_outgoing: false } };
  const { route, calls, request } = callbackHarness(paid);
  assert.equal((await route.POST(request())).status, 200);
  assert.deepEqual(calls[0], ['settle_chip_payment', { p_payment_id: paymentId, p_purchase_id: purchaseId, p_amount_sen: 2900 }]);
  assert.equal((await route.POST(request())).status, 200);
  assert.equal(calls.length, 2); // Duplicate delivery uses the same idempotent database operation.
});
test('callback never settles a mismatched, unpaid, refunded, or not-yet-bound purchase', async () => {
  for (const provider of [fixture(), { ...fixture(), status: 'refunded' }, { ...fixture(), brand_id: paymentId }]) {
    const { route, calls, request } = callbackHarness(provider);
    await route.POST(request()); assert.equal(calls.length, 0);
  }
  const { route, calls, request } = callbackHarness(fixture(), null);
  assert.equal((await route.POST(request())).status, 503);
  assert.equal(calls.length, 0);
});

function actionsHarness(ownerId = 'owner') {
  const calls = [];
  const client = {
    rpc: async (name, params) => { calls.push([name, params]); return { data: { id: paymentId, amount: '29.00', checkout_url: null, email: 'buyer@example.com', title: 'Race entry', expires_at: null }, error: null }; },
    from: () => {
      const chain = { select: () => chain, update: value => { calls.push(['update', value]); return chain; }, eq: () => chain, is: async () => ({ error: null }), single: async () => ({ data: { id: paymentId, registration_id: brandId, gateway_reference: purchaseId, amount: '29.00', status: 'PENDING', payment_gateway: 'CHIP', registrations: { athlete_id: ownerId } }, error: null }) };
      return chain;
    },
  };
  const actions = loadTs('src/lib/server/actions/chip.actions.ts', {
    '@/lib/supabase/server': { createSupabaseAdminClient: async () => client, createSupabaseServerClient: async () => client },
    '@/lib/server/auth/require-role': { requireRole: async () => ({ user: { id: 'owner' }, role: 'ATHLETE' }) },
    '@/lib/server/security/rate-limit': { checkRateLimit: () => ({ allowed: true }) },
    '@/lib/server/payments/chip': chip,
  });
  return { actions, calls };
}
test('checkout uses database amount and claims a single attempt before contacting CHIP', async () => {
  const { actions, calls } = actionsHarness();
  global.fetch = async (url, options) => {
    assert.equal(calls[0][0], 'prepare_chip_payment');
    assert.equal(JSON.parse(options.body).purchase.products[0].price, 2900);
    return Response.json(fixture());
  };
  assert.equal((await actions.startChipCheckoutAction(brandId)).checkoutUrl, fixture().checkout_url);
  assert.deepEqual(calls[0][1], { p_registration_id: brandId, p_user_id: 'owner' });
  assert.equal(calls.find(call => call[0] === 'update')[1].gateway_reference, purchaseId);
});
test('disabled checkout cannot create a provider purchase', async () => {
  process.env.CHIP_ENABLED = 'false';
  const { actions, calls } = actionsHarness();
  global.fetch = async () => { throw new Error('Provider must not be called'); };
  await assert.rejects(() => actions.startChipCheckoutAction(brandId), /temporarily unavailable/);
  assert.equal(calls.length, 0);
});
test('payment status refuses another athlete before requesting provider data', async () => {
  const { actions, calls } = actionsHarness('someone-else');
  global.fetch = async () => { throw new Error('Provider must not be called'); };
  await assert.rejects(() => actions.getChipPaymentStatusAction(paymentId), /Payment not found/);
  assert.equal(calls.length, 0);
});
test('status refresh settles only a provider-verified paid purchase', async () => {
  const { actions, calls } = actionsHarness();
  global.fetch = async () => Response.json({ ...fixture(), status: 'paid', payment: { amount: 2900, currency: 'MYR', is_outgoing: false } });
  assert.equal((await actions.getChipPaymentStatusAction(paymentId)).status, 'SUCCESS');
  assert.equal(calls[0][0], 'settle_chip_payment');
});
