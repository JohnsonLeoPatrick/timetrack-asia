const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const fixture = require('./checkout-fixtures.cjs');

function load(file, dependencies = {}) {
  const filename = path.resolve(file); const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = name => Object.hasOwn(dependencies, name) ? dependencies[name] : original(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return loaded.exports;
}
const checkout = load('src/lib/runner-checkout.ts');

test('reusable runner data cannot copy medical conditions, category, shirts, or consent into future entries', () => {
  const saved = checkout.reusableRunner(fixture.person({ medical_status: true, medical_details: 'Asthma', category_id: 'category', finisher_tee_size: 'L' }));
  assert.equal(saved.emergency_name, 'Contact'); assert.equal(saved.full_name, 'Runner');
  for (const field of ['medical_status','medical_details','medical_acknowledged','category_id','tee_size','finisher_tee_size','participant_type']) assert.equal(saved[field], undefined);
  assert.equal(checkout.participantSchema.safeParse({ ...saved, category_id: 'next-category', participant_type: 'myself' }).success, false);
});

test('server action validates fresh agreements and medical declarations before calling the registration transaction', async () => {
  let calls = 0;
  const actions = load('src/lib/server/actions/registration.actions.ts', {
    '@/lib/runner-checkout': checkout, 'next/cache': { revalidatePath() {} },
    '@/lib/server/security/rate-limit': { checkRateLimit: () => ({ allowed: true }) },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, rpc: async (_name, args) => {
      calls++; assert.equal(args.p_athlete_id, 'owner'); assert.equal(args.p_participants[0].medical_details, '');
      assert.equal(args.p_participants[0].client_id, undefined);
      return { data: { registration_id: 'registration', net_amount: 30 }, error: null };
    } }) },
  });
  function form(billing = fixture.billing(), person = fixture.person()) {
    const data = new FormData(); data.set('eventId', 'event'); data.set('billing', JSON.stringify(billing)); data.set('participants', JSON.stringify([{ category_id: 'category', ...person, client_id: 'client-only-id' }])); return data;
  }
  await assert.rejects(actions.createRegistrationAction(form(fixture.billing({ terms_accepted: false }))));
  await assert.rejects(actions.createRegistrationAction(form(fixture.billing(), fixture.person({ medical_status: true, medical_details: '' }))));
  await assert.rejects(actions.createRegistrationAction(form(fixture.billing(), fixture.person({ emergency_relationship: '' }))));
  assert.equal(calls, 0);
  const result = await actions.createRegistrationAction(form(fixture.billing(), fixture.person({ medical_status: false, medical_details: 'Stale detail' })));
  assert.equal(calls, 1); assert.equal(result.registrationId, 'registration');
});

test('draft persistence strips agreements and unacknowledged medical details and always uses authenticated owner', async () => {
  let saved;
  const actions = load('src/lib/server/actions/runner-profile.actions.ts', {
    'next/cache': { revalidatePath() {} },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from: table => ({ upsert: async (row, options) => { saved = row; assert.equal(table, 'runner_checkout_drafts'); assert.equal(options.onConflict, 'user_id,event_id'); return { error: null }; } }) }) },
  });
  const payload = { checkout_key: fixture.billing().checkout_key, participants: [fixture.person({ medical_status: true, medical_details: 'Not yet consented', medical_acknowledged: false })], billing: fixture.billing(), step: 1 };
  await actions.saveRunnerDraftAction('event', payload);
  assert.equal(saved.user_id, 'owner'); assert.equal(saved.event_id, 'event');
  assert.equal(saved.payload.billing.terms_accepted, false); assert.equal(saved.payload.billing.policy_accepted, false);
  assert.equal(saved.payload.participants[0].medical_details, undefined); assert.equal(saved.payload.participants[0].medical_status, null);
  payload.participants[0] = fixture.person({ medical_status: true, medical_details: 'Acknowledged condition' });
  await actions.saveRunnerDraftAction('event', payload);
  assert.equal(saved.payload.participants[0].medical_details, 'Acknowledged condition');
  assert.equal(saved.payload.participants[0].medical_acknowledged, false);
  assert.ok(new Date(saved.expires_at) > new Date());
});

test('staff medical disclosure requires event authorization and an exact participant within that event', async () => {
  const filters = [];
  const actions = load('src/lib/server/actions/participant.actions.ts', {
    'next/cache': { revalidatePath() {} }, '@/lib/participants': {}, '@/lib/participant-csv': {},
    '@/lib/server/participants': { staffEvent: async event => { assert.equal(event, 'event'); return { client: { from: table => {
      assert.equal(table, 'participants'); return { select() { return this; }, eq(field, value) { filters.push([field, value]); return this; }, is() { return this; }, async single() { return { data: { emergency_name: 'Contact', medical_details: 'Private condition' }, error: null }; } };
    } } }; } },
  });
  const id = '00000000-0000-4000-8000-000000000001';
  assert.equal((await actions.getParticipantSafetyAction('event', id)).medical_details, 'Private condition');
  assert.deepEqual(filters, [['id', id], ['registrations.event_id', 'event']]);
});
