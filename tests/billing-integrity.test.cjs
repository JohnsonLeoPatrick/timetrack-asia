const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

let db;
const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const event = '00000000-0000-4000-8000-000000000003';
const category = '00000000-0000-4000-8000-000000000004';
let registration;

async function asUser(id, sql, params = []) {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${id}', false); SELECT set_config('request.jwt.claim.role', 'authenticated', false);`);
  try { return await db.query(sql, params); }
  finally { await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false); SELECT set_config('request.jwt.claim.role', '', false);"); }
}

before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;`);
  for (const name of fs.readdirSync(path.join(__dirname, '../supabase/migrations')).sort()) {
    if (!name.endsWith('.sql') || name.startsWith('003_')) continue;
    const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations', name), 'utf8')
      .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/g, '');
    await db.exec(sql);
  }
  await db.exec(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
    INSERT INTO public.users (id, email) VALUES ('${owner}', 'owner@example.test'), ('${other}', 'other@example.test');
    INSERT INTO public.events (id, organizer_id, title, slug, status, event_date, registration_open, registration_close)
      VALUES ('${event}', '${other}', 'Billing test', 'billing-test', 'LIVE', now() + interval '1 month', now() - interval '1 day', now() + interval '1 week');
    INSERT INTO public.event_categories (id, event_id, name, base_price, max_slots) VALUES ('${category}', '${event}', 'Entry', 29, 2);`);
});

after(async () => { await db?.close(); });

test('usernames remain unique, validated, and cannot change another account', async () => {
  await asUser(owner, 'UPDATE users SET username=$1 WHERE id=$2', ['runner_test', owner]);
  await assert.rejects(asUser(other, 'UPDATE users SET username=$1 WHERE id=$2', ['RUNNER_TEST', other]), /duplicate key/);
  await assert.rejects(asUser(owner, 'UPDATE users SET username=$1 WHERE id=$2', ['bad handle', owner]), /check constraint/);
  await asUser(other, 'UPDATE users SET username=$1 WHERE id=$2', ['hijacked', owner]);
  assert.equal((await db.query('SELECT username FROM users WHERE id=$1', [owner])).rows[0].username, 'runner_test');
  await assert.rejects(asUser(owner, "UPDATE users SET role='SUPER_ADMIN' WHERE id=$1", [owner]), /authorization|role|privileged|Forbidden/i);
});

function create(id = owner, name = 'Runner', billing = { first_name: 'Buyer', email: 'buyer@example.test', phone: '+60123456789' }) {
  return asUser(id, 'SELECT public.create_registration_atomic($1, $2, $3::jsonb, $4::jsonb, null) AS value',
    [event, id, JSON.stringify(billing), JSON.stringify([{ category_id: category, full_name: name }])]);
}

test('registration uses category price and atomically creates one participant and billing record', async () => {
  const result = await create();
  registration = result.rows[0].value.registration_id;
  assert.equal(Number(result.rows[0].value.net_amount), 29);
  const rows = await db.query('SELECT (SELECT count(*) FROM participants WHERE registration_id=$1) AS entries, (SELECT count(*) FROM billing_details WHERE registration_id=$1) AS billing', [registration]);
  assert.equal(Number(rows.rows[0].entries), 1);
  assert.equal(Number(rows.rows[0].billing), 1);
});

test('buyer cannot bypass validated registration entry point', async () => {
  await assert.rejects(asUser(owner, 'SELECT public.create_registration_priced($1,$2,$3,$4,null)', [event, owner, '{}', '[]']), /permission denied/);
});

test('buyer cannot add unpaid participants or change a priced entry', async () => {
  await assert.rejects(asUser(owner, 'INSERT INTO participants(registration_id,category_id,full_name) VALUES ($1,$2,$3)', [registration, category, 'Extra runner']), /managed by the server/);
  await assert.rejects(asUser(owner, 'UPDATE participants SET full_name=$1 WHERE registration_id=$2', ['Changed', registration]), /managed by the server/);
});

test('buyer cannot forge invoice or refund state', async () => {
  await assert.rejects(asUser(owner, 'INSERT INTO invoices(registration_id,invoice_number,total_amount) VALUES ($1,$2,1)', [registration, 'FORGED']), /managed by the server/);
  await assert.rejects(asUser(owner, "INSERT INTO refunds(payment_id,registration_id,amount,status) VALUES (gen_random_uuid(),$1,999,'REFUNDED')", [registration]), /managed by the server/);
});

test('buyer cannot extend reservation or change financial amount', async () => {
  await assert.rejects(asUser(owner, "UPDATE registrations SET expires_at=now()+interval '1 year' WHERE id=$1", [registration]), /server-managed/);
  await assert.rejects(asUser(owner, 'UPDATE registrations SET net_amount=1 WHERE id=$1', [registration]), /server-managed/);
});

test('checkout lock blocks cancellation until provider resolves payment', async () => {
  await db.query("INSERT INTO payments(registration_id,payment_gateway,amount,status) VALUES ($1,'CHIP',29,'PENDING')", [registration]);
  await assert.rejects(asUser(owner, "UPDATE registrations SET status='CANCELLED' WHERE id=$1", [registration]), /active payment/);
  await db.query("UPDATE payments SET status='FAILED' WHERE registration_id=$1", [registration]);
});

test('closed event and invalid billing/name cannot create partial records', async () => {
  await assert.rejects(create(owner, ' '), /participant name/);
  await assert.rejects(create(owner, 'Runner', { first_name: 'Buyer', email: 'bad-email', phone: '+60123456789' }), /valid billing/);
  await db.query("UPDATE events SET status='DRAFT' WHERE id=$1", [event]);
  await assert.rejects(create(), /Registration is closed/);
  await db.query("UPDATE events SET status='LIVE' WHERE id=$1", [event]);
  assert.equal(Number((await db.query('SELECT count(*) FROM registrations')).rows[0].count), 1);
});

test('category reservation capacity is enforced across orders', async () => {
  await create();
  await assert.rejects(create(), /insufficient places/);
});

test('invalid coupons fail instead of silently increasing the checkout amount', async () => {
  await db.query('UPDATE event_categories SET max_slots=3 WHERE id=$1', [category]);
  await assert.rejects(asUser(owner, 'SELECT create_registration_atomic($1,$2,$3,$4,$5)', [event, owner, JSON.stringify({ first_name: 'Buyer', email: 'buyer@example.test', phone: '+60123456789' }), JSON.stringify([{ category_id: category, full_name: 'Runner' }]), 'MISSING']), /coupon is no longer available/);
  assert.equal(Number((await db.query('SELECT count(*) FROM registrations')).rows[0].count), 2);
});

test('refund requests use verified amount, reject another owner, and are idempotent', async () => {
  await db.query("UPDATE payments SET status='SUCCESS' WHERE registration_id=$1", [registration]);
  await db.query("UPDATE registrations SET status='PAID' WHERE id=$1", [registration]);
  await assert.rejects(asUser(other, 'SELECT request_registration_refund($1,$2)', [registration, 'Cannot attend']), /Paid registration not found/);
  const first = await asUser(owner, 'SELECT request_registration_refund($1,$2) AS id', [registration, 'Cannot attend']);
  const second = await asUser(owner, 'SELECT request_registration_refund($1,$2) AS id', [registration, 'Cannot attend']);
  assert.equal(first.rows[0].id, second.rows[0].id);
  assert.equal(Number((await db.query('SELECT amount FROM refunds WHERE id=$1', [first.rows[0].id])).rows[0].amount), 29);
  await assert.rejects(asUser(owner, 'SELECT review_registration_refund($1,true)', [first.rows[0].id]), /Forbidden/);
});

test('administrative refund action cannot pretend to refund CHIP funds', async () => {
  await db.query("UPDATE users SET role='ADMIN' WHERE id=$1", [other]);
  const refund = (await db.query('SELECT id FROM refunds WHERE registration_id=$1', [registration])).rows[0].id;
  await assert.rejects(asUser(other, 'SELECT review_registration_refund($1,true)', [refund]), /merchant portal/);
  assert.equal((await db.query('SELECT status FROM refunds WHERE id=$1', [refund])).rows[0].status, 'REFUND_REQUESTED');
});

test('manual approval cannot race active CHIP checkout and refund is atomic after manual settlement', async () => {
  const pending = (await db.query('SELECT id FROM registrations WHERE id <> $1 LIMIT 1', [registration])).rows[0].id;
  const manual = (await db.query("INSERT INTO payments(registration_id,payment_gateway,amount,status,currency) VALUES ($1,'MANUAL',29,'PENDING','MYR') RETURNING id", [pending])).rows[0].id;
  const chip = (await db.query("INSERT INTO payments(registration_id,payment_gateway,amount,status,currency) VALUES ($1,'CHIP',29,'PENDING','MYR') RETURNING id", [pending])).rows[0].id;
  await assert.rejects(asUser(other, 'SELECT review_payment($1,true)', [manual]), /active CHIP checkout/);
  await db.query("UPDATE payments SET status='FAILED' WHERE id=$1", [chip]);
  await asUser(other, 'SELECT review_payment($1,true)', [manual]);
  const refund = (await asUser(owner, 'SELECT request_registration_refund($1,$2) AS id', [pending, 'Cannot attend'])).rows[0].id;
  await asUser(other, 'SELECT review_registration_refund($1,true)', [refund]);
  const result = await db.query('SELECT p.status AS payment, r.status AS registration, f.status AS refund FROM refunds f JOIN payments p ON p.id=f.payment_id JOIN registrations r ON r.id=f.registration_id WHERE f.id=$1', [refund]);
  assert.deepEqual(result.rows[0], { payment: 'REFUNDED', registration: 'REFUNDED', refund: 'REFUNDED' });
  await assert.rejects(asUser(other, 'SELECT review_registration_refund($1,true)', [refund]), /not awaiting review/);
});
