const fixture = require('./checkout-fixtures.cjs');
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
    [event, id, JSON.stringify(fixture.billing(billing)), JSON.stringify([fixture.person({ category_id: category, full_name: name })])]);
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
  await assert.rejects(asUser(owner, 'SELECT create_registration_atomic($1,$2,$3,$4,$5)', [event, owner, JSON.stringify(fixture.billing()), JSON.stringify([fixture.person({ category_id: category })]), 'MISSING']), /coupon is no longer available/);
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

test('complete attendee checkout rejects missing details and stores tee, age group, consent without a bib', async () => {
  const detailedEvent = '00000000-0000-4000-8000-000000000050';
  const detailedCategory = '00000000-0000-4000-8000-000000000051';
  const form = (await db.query("INSERT INTO form_templates(name,is_system,fields) VALUES ('Detailed test form',true,'[]') RETURNING id")).rows[0].id;
  await db.query("INSERT INTO events(id,organizer_id,title,slug,status,event_date,registration_open,registration_close,form_template_id,coupons_allowed) VALUES ($1,$2,'Detailed race','detailed-race','LIVE',now()+interval '1 month',now()-interval '1 day',now()+interval '1 week',$3,true)", [detailedEvent, other, form]);
  await db.query("INSERT INTO event_categories(id,event_id,name,base_price) VALUES ($1,$2,'Adult 7K',100)", [detailedCategory, detailedEvent]);
  const billing = { first_name: 'Buyer', email: 'buyer@example.test', phone: '+60123456789', country: 'Malaysia', city: 'Kuala Lumpur', postcode: '50000', terms_accepted: true, policy_accepted: true };
  const attendee = { category_id: detailedCategory, full_name: 'Full Runner', bib_name: 'RUNNER', email: 'runner@example.test', phone: '+60123456780', gender: 'FEMALE', ic_passport: '900101-10-1234', dob: '1990-01-01', age: 36, country: 'Malaysia', category_age: 'Adult', tee_size: 'M', medical_status: false, emergency_name: 'Contact', emergency_phone: '+60123456781' };
  const register = (details, person, code = null) => asUser(owner, 'SELECT create_registration_atomic($1,$2,$3::jsonb,$4::jsonb,$5) AS value', [detailedEvent, owner, JSON.stringify(fixture.billing(details)), JSON.stringify([fixture.person(person)]), code]);
  await assert.rejects(register({ ...billing, policy_accepted: false }, attendee), /privacy policy/);
  await assert.rejects(register(billing, { ...attendee, tee_size: undefined }), /available shirt size/);
  assert.equal(Number((await db.query('SELECT count(*) FROM registrations WHERE event_id=$1', [detailedEvent])).rows[0].count), 0);
  const coupon = (await db.query("INSERT INTO coupons(code,type,value,event_id,organizer_id,max_uses,max_uses_per_user,expires_at) VALUES ('DETAILED10','FIXED',10,$1,$2,1,1,now()+interval '1 day') RETURNING id", [detailedEvent, other])).rows[0].id;
  const result = await register(billing, attendee, 'DETAILED10');
  const saved = (await db.query('SELECT r.form_data, p.bib_number, p.full_name, p.category_age, p.tee_size FROM registrations r JOIN participants p ON p.registration_id=r.id WHERE r.id=$1', [result.rows[0].value.registration_id])).rows[0];
  assert.equal(saved.full_name, attendee.full_name);
  assert.equal(saved.bib_number, null);
  assert.equal(saved.tee_size, 'M');
  assert.equal(saved.category_age, 'Adult');
  assert.equal(saved.form_data.attendee_count, 1);
  assert.equal(saved.form_data.participants, undefined);
  assert.equal(saved.form_data.policy_accepted, true);
  await assert.rejects(asUser(owner, "UPDATE registrations SET form_data='{}'::jsonb WHERE id=$1", [result.rows[0].value.registration_id]), /form data is server-managed/);
  assert.equal(Number(result.rows[0].value.net_amount), 90);
  assert.equal(Number((await db.query('SELECT current_uses FROM coupons WHERE id=$1', [coupon])).rows[0].current_uses), 1);
  await assert.rejects(register(billing, attendee, 'DETAILED10'), /maximum uses|already used/);
});

let runnerEvent, runnerCategory, runnerRegistration, safetyParticipant;
const runnerRegister = (billing, people) => asUser(owner, 'SELECT create_registration_atomic($1,$2,$3::jsonb,$4::jsonb,null) AS value', [runnerEvent, owner, JSON.stringify(billing), JSON.stringify(people)]);

test('new runner checkout keeps multiple attendees and two shirts separate under one billing account', async () => {
  runnerEvent = (await db.query("INSERT INTO events(organizer_id,title,slug,status,event_date,registration_open,registration_close,terms_and_conditions) VALUES ($1,'Runner UX','runner-ux','LIVE',now()+interval '1 month',now()-interval '1 day',now()+interval '1 week','Race terms v1') RETURNING id", [other])).rows[0].id;
  runnerCategory = (await db.query("INSERT INTO event_categories(event_id,name,base_price,event_tee_sizes,finisher_tee_sizes) VALUES ($1,'10K',30,ARRAY['S','M','2XL'],ARRAY['M','L']) RETURNING id", [runnerEvent])).rows[0].id;
  const result = await runnerRegister(fixture.billing(), [fixture.person({ category_id: runnerCategory, full_name: 'Self runner', participant_type: 'myself', tee_size: 'S', finisher_tee_size: 'L', medical_status: true, medical_details: 'Asthma' }), fixture.person({ category_id: runnerCategory, full_name: 'Other runner', tee_size: '2XL', finisher_tee_size: 'M', medical_details: 'Discard this stale condition' })]);
  runnerRegistration = result.rows[0].value.registration_id;
  const people = (await db.query('SELECT * FROM participants WHERE registration_id=$1 ORDER BY full_name', [runnerRegistration])).rows;
  assert.equal(people.length, 2); assert.equal(people[0].tee_size, '2XL'); assert.equal(people[0].finisher_tee_size, 'M'); assert.equal(people[0].medical_details, null);
  assert.equal(people[1].tee_size, 'S'); assert.equal(people[1].finisher_tee_size, 'L'); assert.equal(people[1].medical_details, 'Asthma');
  safetyParticipant = people[1].id;
  assert.ok(people[1].medical_acknowledged_at);
  assert.equal(Number((await db.query('SELECT count(*) FROM billing_details WHERE registration_id=$1', [runnerRegistration])).rows[0].count), 1);
  assert.equal(Number(result.rows[0].value.net_amount), 60);
  assert.equal(Number((await db.query('SELECT count(*) FROM runner_profiles WHERE user_id=$1', [owner])).rows[0].count), 0);
  const consent = (await db.query('SELECT form_data FROM registrations WHERE id=$1', [runnerRegistration])).rows[0].form_data;
  assert.equal(consent.terms_version, '1'); assert.equal(consent.terms_text, 'Race terms v1'); assert.ok(consent.terms_accepted_at);
});

test('missing emergency contact, medical details, acknowledgement, agreement, and unavailable shirts roll back atomically', async () => {
  const person = fixture.person({ category_id: runnerCategory, finisher_tee_size: 'M' });
  for (const invalid of [{ emergency_name: '' }, { emergency_phone: '' }, { emergency_relationship: '' }, { medical_acknowledged: false }, { medical_status: true, medical_details: '' }, { finisher_tee_size: 'XS' }, { tee_size: '3XL' }]) {
    await assert.rejects(runnerRegister(fixture.billing(), [{ ...person, ...invalid }]));
  }
  await assert.rejects(runnerRegister(fixture.billing({ terms_accepted: false }), [person]), /privacy policy/);
  await assert.rejects(runnerRegister(fixture.billing({ terms_version: 'old' }), [person]), /terms changed/);
  assert.equal(Number((await db.query('SELECT count(*) FROM registrations WHERE event_id=$1', [runnerEvent])).rows[0].count), 1);
});

test('explicit profile save stores reusable fields only; billing can save without copying another runner', async () => {
  await runnerRegister(fixture.billing({ save_billing: true, save_runner: true }), [fixture.person({ category_id: runnerCategory, participant_type: 'myself', full_name: 'Saved runner', finisher_tee_size: 'L', medical_status: true, medical_details: 'Private condition' })]);
  const saved = (await asUser(owner, 'SELECT personal,billing FROM runner_profiles')).rows[0];
  assert.equal(saved.personal.full_name, 'Saved runner'); assert.equal(saved.personal.emergency_relationship, 'Sibling');
  for (const field of ['medical_status','medical_details','medical_acknowledged','tee_size','finisher_tee_size','category_id']) assert.equal(saved.personal[field], undefined);
  assert.equal(saved.billing.terms_accepted, undefined); assert.equal(saved.billing.checkout_key, undefined);
  await runnerRegister(fixture.billing({ first_name: 'Updated buyer', save_billing: true }), [fixture.person({ category_id: runnerCategory, full_name: 'Someone else', finisher_tee_size: 'M' })]);
  const updated = (await asUser(owner, 'SELECT personal,billing FROM runner_profiles')).rows[0];
  assert.equal(updated.personal.full_name, 'Saved runner'); assert.equal(updated.billing.first_name, 'Updated buyer');
  await runnerRegister(fixture.billing(), [fixture.person({ category_id: runnerCategory, participant_type: 'myself', full_name: 'Unsaved edit', finisher_tee_size: 'M' })]);
  assert.equal((await asUser(owner, 'SELECT personal FROM runner_profiles')).rows[0].personal.full_name, 'Saved runner');
});

test('profiles and draft medical information are private to their account, including against event organizers', async () => {
  await asUser(owner, 'INSERT INTO runner_checkout_drafts(user_id,event_id,payload) VALUES ($1,$2,$3)', [owner, runnerEvent, JSON.stringify({ medical_details: 'Draft condition' })]);
  assert.equal((await asUser(other, 'SELECT * FROM runner_profiles WHERE user_id=$1', [owner])).rows.length, 0);
  assert.equal((await asUser(other, 'SELECT * FROM runner_checkout_drafts WHERE user_id=$1', [owner])).rows.length, 0);
  await assert.rejects(asUser(other, "INSERT INTO runner_profiles(user_id,personal) VALUES ($1,'{}')", [owner]), /row-level security/);
  await asUser(other, "UPDATE runner_profiles SET personal='{}' WHERE user_id=$1", [owner]);
  assert.equal((await asUser(owner, 'SELECT personal FROM runner_profiles')).rows[0].personal.full_name, 'Saved runner');
  await asUser(other, 'DELETE FROM runner_checkout_drafts WHERE user_id=$1', [owner]);
  assert.equal((await asUser(owner, 'SELECT * FROM runner_checkout_drafts')).rows.length, 1);
  await db.exec('SET ROLE anon');
  try { await assert.rejects(db.query('SELECT * FROM runner_profiles'), /permission denied/); await assert.rejects(db.query('SELECT * FROM runner_checkout_drafts'), /permission denied/); }
  finally { await db.exec('RESET ROLE'); }
});

test('refresh and payment retry reuse the same checkout and do not duplicate profile or participant records', async () => {
  const billing = fixture.billing(); const person = fixture.person({ category_id: runnerCategory, finisher_tee_size: 'M' });
  const first = (await runnerRegister(billing, [person])).rows[0].value;
  const retry = (await runnerRegister(billing, [person])).rows[0].value;
  assert.equal(first.registration_id, retry.registration_id);
  await db.query("INSERT INTO payments(registration_id,payment_gateway,amount,status) VALUES ($1,'CHIP',30,'FAILED')", [first.registration_id]);
  assert.equal((await runnerRegister(billing, [person])).rows[0].value.registration_id, first.registration_id);
  assert.equal(Number((await db.query('SELECT count(*) FROM participants WHERE registration_id=$1', [first.registration_id])).rows[0].count), 1);
  await assert.rejects(asUser(owner, 'UPDATE registrations SET checkout_key=gen_random_uuid() WHERE id=$1', [first.registration_id]), /server-managed/);
  assert.equal((await asUser(owner, 'SELECT * FROM runner_checkout_drafts')).rows.length, 0);
});

test('owners can update the exact participant safety details before close; outsiders cannot', async () => {
  const details = { emergency_name: 'New contact', emergency_phone: '+60123456780', emergency_relationship: 'Parent', medical_status: false, medical_details: 'Must be cleared', medical_acknowledged: true };
  await assert.rejects(asUser(other, 'SELECT update_participant_safety($1,$2)', [safetyParticipant, details]), /cannot be updated/);
  await asUser(owner, 'SELECT update_participant_safety($1,$2)', [safetyParticipant, details]);
  const person = (await db.query('SELECT * FROM participants WHERE id=$1', [safetyParticipant])).rows[0];
  assert.equal(person.emergency_relationship, 'Parent'); assert.equal(person.medical_details, null); assert.equal(person.tee_size, 'S');
  await db.query("UPDATE events SET registration_close=now()-interval '1 second' WHERE id=$1", [runnerEvent]);
  await assert.rejects(asUser(owner, 'SELECT update_participant_safety($1,$2)', [safetyParticipant, details]), /cannot be updated/);
  await db.query("UPDATE events SET registration_close=now()+interval '1 week' WHERE id=$1", [runnerEvent]);
});

test('categories without shirts accept no sizes, terms edits invalidate stale acceptance', async () => {
  const category = (await db.query("INSERT INTO event_categories(event_id,name,base_price,event_tee_sizes,finisher_tee_sizes) VALUES ($1,'No shirts',0,'{}','{}') RETURNING id", [runnerEvent])).rows[0].id;
  const person = fixture.person({ category_id: category, tee_size: '' });
  await assert.rejects(runnerRegister(fixture.billing(), [{ ...person, tee_size: 'M' }]), /available shirt size/);
  const result = (await runnerRegister(fixture.billing(), [person])).rows[0].value;
  assert.equal(Number(result.net_amount), 0); assert.equal((await db.query('SELECT status FROM registrations WHERE id=$1', [result.registration_id])).rows[0].status, 'PAID');
  await db.query("UPDATE events SET terms_and_conditions='Updated race terms' WHERE id=$1", [runnerEvent]);
  await assert.rejects(runnerRegister(fixture.billing(), [person]), /terms changed/);
  const version = (await db.query('SELECT terms_version FROM events WHERE id=$1', [runnerEvent])).rows[0].terms_version;
  assert.notEqual(version, '1');
  await runnerRegister(fixture.billing({ terms_version: version }), [person]);
});

test('participant medical details remain hidden from unrelated accounts and public leaderboards', async () => {
  const stranger = '00000000-0000-4000-8000-000000000099';
  await db.query("INSERT INTO users(id,email) VALUES ($1,'stranger@example.test')", [stranger]);
  assert.equal((await asUser(stranger, 'SELECT medical_details FROM participants WHERE registration_id=$1', [runnerRegistration])).rows.length, 0);
  await db.query('UPDATE events SET results_finalized=true WHERE id=$1', [runnerEvent]);
  assert.equal((await asUser(stranger, 'SELECT medical_details FROM participants WHERE registration_id=$1', [runnerRegistration])).rows.length, 0);
  assert.equal((await asUser(other, 'SELECT medical_details FROM participants WHERE registration_id=$1', [runnerRegistration])).rows.length, 2);
});
