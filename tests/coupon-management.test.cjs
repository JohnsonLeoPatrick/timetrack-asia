const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function actions(eventOwner = 'organizer') {
  const inserts = [];
  const client = { from(table) {
    if (table === 'events') return { select() { return this; }, eq() { return this; }, is() { return this; }, async single() { return { data: { id: '00000000-0000-4000-8000-000000000010', organizer_id: eventOwner, coupons_allowed: true } }; } };
    if (table === 'coupons') return { async insert(value) { inserts.push(value); return { error: null }; } };
    throw new Error(`Unexpected table ${table}`);
  } };
  const filename = path.resolve('src/lib/server/actions/coupon.actions.ts');
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  const mocks = {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => client },
    '@/lib/server/auth/require-role': { requireRole: async () => ({ user: { id: 'organizer' }, role: 'ORGANIZER' }) },
    'next/cache': { revalidatePath() {} },
  };
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return { ...loaded.exports, inserts };
}

function couponForm(overrides = {}) {
  const form = new FormData();
  const values = { code: 'race20', type: 'PERCENTAGE', value: '20', max_uses: '50', max_uses_per_user: '2', event_id: '00000000-0000-4000-8000-000000000010', expires_at: '2030-01-01T00:00', ...overrides };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

test('organizer coupon stores event scope, use limits and expiry', async () => {
  const action = actions();
  await action.createCouponAction(couponForm());
  assert.equal(action.inserts.length, 1);
  assert.equal(action.inserts[0].code, 'RACE20');
  assert.equal(action.inserts[0].max_uses, 50);
  assert.equal(action.inserts[0].max_uses_per_user, 2);
  assert.equal(action.inserts[0].event_id, '00000000-0000-4000-8000-000000000010');
  assert.ok(Date.parse(action.inserts[0].expires_at) > Date.now());
});

test('organizer cannot create coupon for another organizer event', async () => {
  const action = actions('other');
  await assert.rejects(action.createCouponAction(couponForm()), /Event not found/);
  assert.equal(action.inserts.length, 0);
});

test('coupon rejects excess percentage, zero uses and past expiry', async () => {
  const action = actions();
  await assert.rejects(action.createCouponAction(couponForm({ value: '101' })));
  await assert.rejects(action.createCouponAction(couponForm({ max_uses: '0' })));
  await assert.rejects(action.createCouponAction(couponForm({ expires_at: '2020-01-01T00:00' })));
  assert.equal(action.inserts.length, 0);
});
