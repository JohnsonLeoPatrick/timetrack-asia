const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const sharp = require('sharp');

function load(file, dependencies) {
  const filename = path.resolve(file);
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = name => Object.hasOwn(dependencies, name) ? dependencies[name] : original(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return loaded.exports;
}
const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const tickets = load('src/lib/server/tickets.ts', { '@/lib/supabase/server': {}, 'next/navigation': {} });

test('ticket signature cannot be reused for another participant or forged', () => {
  process.env.QR_SECRET = 'isolated-test-secret-32-characters-minimum';
  const token = tickets.ticketToken(id);
  assert.equal(tickets.verifyTicketToken(token), id);
  assert.equal(tickets.verifyTicketToken(token.replace(id, other)), null);
  assert.equal(tickets.verifyTicketToken(token + 'x'), null);
  assert.equal(tickets.verifyTicketToken('not-a-token'), null);
  process.env.QR_SECRET = 'short';
  assert.throws(() => tickets.ticketToken(id), /not configured/);
});

test('invoice requires matching confirmed payment, active registration, currency, and undeleted payment', () => {
  const payment = { status: 'SUCCESS', currency: 'MYR', amount: 29, deleted_at: null };
  const registration = { status: 'PAID', net_amount: 29, payments: [payment] };
  assert.equal(tickets.confirmedPayment(registration), payment);
  for (const status of ['PENDING', 'CANCELLED', 'REFUNDED']) assert.ok(!tickets.confirmedPayment({ ...registration, status }));
  for (const changes of [{ amount: 1 }, { currency: 'USD' }, { status: 'PENDING' }, { status: 'REFUNDED' }, { deleted_at: '2026-01-01' }]) {
    assert.ok(!tickets.confirmedPayment({ ...registration, payments: [{ ...payment, ...changes }] }));
  }
});

test('private entry lookup enforces owner even when caller has broader database read permissions', async () => {
  const filters = [];
  const client = { auth: { getUser: async () => ({ data: { user: { id } } }) }, from: table => {
    const chain = { select() { return this; }, eq(field, value) { filters.push([table, field, value]); return this; }, is() { return this; }, async single() { return table === 'users' ? { data: { status: 'ACTIVE' } } : { data: null }; } };
    return chain;
  } };
  const owned = load('src/lib/server/tickets.ts', { '@/lib/supabase/server': { createSupabaseServerClient: async () => client }, 'next/navigation': { notFound() { throw Error('not-found'); }, redirect() { throw Error('redirect'); } } });
  await assert.rejects(owned.ownedRegistration(other), /not-found/);
  assert.ok(filters.some(([table, field, value]) => table === 'registrations' && field === 'athlete_id' && value === id));
});

function mediaFixture(owner = id) {
  const state = { uploaded: null, saved: null, removed: false };
  const chain = { select() { return this; }, eq() { return this; }, is() { return this; }, update(value) { state.saved = value; return this; }, async single() { return { data: { id: other, organizer_id: owner } }; } };
  const bucket = { async upload(name, bytes, options) { state.uploaded = { name, bytes, options }; return {}; }, getPublicUrl(name) { return { data: { publicUrl: `https://example.test/${name}` } }; }, async remove() { state.removed = true; return {}; } };
  const action = load('src/lib/server/actions/event-media.actions.ts', {
    'next/cache': { revalidatePath() {} }, '@/lib/server/auth/require-role': { requireRole: async () => ({ user: { id }, role: 'ORGANIZER' }) },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ from: () => chain }), createSupabaseAdminClient: async () => ({ storage: { from: () => bucket } }) },
  });
  return { action, state };
}
function form(bytes, type = 'image/png') {
  const data = new FormData(); data.set('eventId', other); data.set('image', new File([bytes], 'cover.png', { type })); return data;
}

test('organizer cannot upload a cover for another owner', async () => {
  const { action, state } = mediaFixture(other);
  await assert.rejects(action.uploadEventCover(form('fake')), /Event not found/);
  assert.equal(state.uploaded, null);
});

test('invalid bytes and disguised SVG never reach public storage', async () => {
  const { action, state } = mediaFixture();
  await assert.rejects(action.uploadEventCover(form('not-an-image')));
  await assert.rejects(action.uploadEventCover(form('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20"/></svg>')), /static JPEG/);
  assert.equal(state.uploaded, null);
});

test('valid upload is re-encoded to bounded WebP and linked to event', async () => {
  const { action, state } = mediaFixture();
  const png = await sharp({ create: { width: 2200, height: 1200, channels: 3, background: '#123456' } }).png().toBuffer();
  const url = await action.uploadEventCover(form(png));
  const metadata = await sharp(state.uploaded.bytes).metadata();
  assert.equal(metadata.format, 'webp'); assert.ok(metadata.width <= 1920); assert.ok(metadata.height <= 1080);
  assert.equal(state.uploaded.options.upsert, false);
  assert.equal(state.saved.cover_image, url);
});
