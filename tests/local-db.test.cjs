const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function fixture() {
  let database = { users: [{ id: 'user_test', email: 'test@gmail.com', password: 'test-password', role: 'ATHLETE', status: 'ACTIVE' }],
    events: [{ id: 'event', title: 'Local event' }], event_categories: [{ id: 'category', event_id: 'event', base_price: 29 }],
    registrations: [], participants: [], billing_details: [], coupons: [{ id: 'coupon', code: 'SAVE', type: 'FIXED', value: 5, current_uses: 0, max_uses: 10, is_active: true }] };
  const cookies = new Map();
  const filename = path.resolve('src/lib/supabase/local-db.ts');
  const loaded = new Module(filename, module); loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = name => name === 'fs' ? { existsSync: () => true, readFileSync: () => JSON.stringify(database),
    writeFileSync: (_file, data) => { database = JSON.parse(data); } } : name === 'next/headers' ? { cookies: async () => ({
      get: key => cookies.has(key) ? { value: cookies.get(key) } : undefined,
      set: (key, value) => cookies.set(key, value), delete: key => cookies.delete(key),
    }) } : original(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return { client: loaded.exports.createLocalSupabaseClient(), read: () => database };
}

test('typed local adapter preserves authentication and query filtering', async () => {
  const { client } = fixture();
  assert.ok((await client.auth.signInWithPassword({ email: 'test@gmail.com', password: 'wrong' })).error);
  assert.equal((await client.auth.signInWithPassword({ email: 'test@gmail.com', password: 'test-password' })).data.user.id, 'user_test');
  assert.equal((await client.auth.getUser()).data.user.id, 'user_test');
  assert.equal((await client.from('event_categories').select('*').eq('event_id', 'event')).data.length, 1);
  assert.equal((await client.from('event_categories').select('*').eq('event_id', 'other')).data.length, 0);
  await client.auth.signOut(); assert.equal((await client.auth.getUser()).data.user, null);
});

test('typed local adapter preserves registration pricing, optional bibs and coupon increments', async () => {
  const { client, read } = fixture();
  const result = await client.rpc('create_registration_atomic', { p_event_id: 'event', p_athlete_id: 'user_test',
    p_billing: { first_name: 'Buyer' }, p_participants: [{ category_id: 'category', full_name: 'Runner' }], p_coupon_code: 'SAVE' });
  assert.equal(result.error, null); assert.equal(result.data.net_amount, 24);
  assert.equal(read().participants.length, 1); assert.equal(read().participants[0].bib_number, undefined);
  assert.equal(read().billing_details[0].first_name, 'Buyer'); assert.equal(read().coupons[0].current_uses, 1);
  await client.rpc('redeem_coupon', { p_coupon_id: 'coupon', p_user_id: 'user_test', p_registration_id: result.data.registration_id, p_discount_amount: 5 });
  assert.equal(read().coupons[0].current_uses, 2);
});
