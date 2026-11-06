const fixture = require('./checkout-fixtures.cjs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

function load(file, dependencies = {}) {
  const filename = path.resolve(file);
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = name => Object.hasOwn(dependencies, name) ? dependencies[name] : original(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
const shared = load('src/lib/participants.ts');
const csv = load('src/lib/participant-csv.ts', { '@/lib/participants': shared });
const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const organizer = uuid(1), other = uuid(2), athlete = uuid(3), admin = uuid(4), inactive = uuid(5);
const event = uuid(10), otherEvent = uuid(11), category = uuid(20), otherCategory = uuid(21);
const registration = uuid(30), otherRegistration = uuid(31);
const p1 = uuid(40), p2 = uuid(41), p3 = uuid(42), otherPerson = uuid(43);
let db;
let originalParticipants;
async function asUser(id, sql, params = [], role = 'authenticated') {
  await db.exec(`SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub', '${id || ''}', false); SELECT set_config('request.jwt.claim.role', '${role}', false);`);
  try { return await db.query(sql, params); }
  finally { await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false); SELECT set_config('request.jwt.claim.role', '', false);"); }
}
function assign(id, bib, expected, who = organizer, target = event) {
  return asUser(who, 'SELECT assign_participant_bibs($1,$2::jsonb) AS count', [target, JSON.stringify([{ participant_id: id, bib_number: bib, expected_bib_number: expected }])]);
}
async function bib(id) { return (await db.query('SELECT bib_number FROM participants WHERE id=$1', [id])).rows[0].bib_number; }

before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;`);
  const migrations = fs.readdirSync('supabase/migrations').filter(name => name.endsWith('.sql') && !name.startsWith('003_')).sort();
  for (const name of migrations.filter(name => !name.includes('manual_bib_assignment'))) {
    await db.exec(fs.readFileSync(`supabase/migrations/${name}`, 'utf8').replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/g, ''));
  }
  await db.exec(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
    INSERT INTO users(id,email,role) VALUES ('${organizer}','org@test.example','ORGANIZER'), ('${other}','other@test.example','ORGANIZER'), ('${athlete}','athlete@test.example','ATHLETE'), ('${admin}','admin@test.example','ADMIN'), ('${inactive}','inactive@test.example','ORGANIZER');
    UPDATE users SET status='INACTIVE' WHERE id='${inactive}';
    INSERT INTO events(id,organizer_id,title,slug,status,event_date,registration_open,registration_close) VALUES
      ('${event}','${organizer}','Race','race','LIVE',now()+interval '1 month',now()-interval '1 day',now()+interval '1 week'),
      ('${otherEvent}','${other}','Other','other','LIVE',now()+interval '1 month',now()-interval '1 day',now()+interval '1 week');
    INSERT INTO event_categories(id,event_id,name,base_price) VALUES ('${category}','${event}','5K',10), ('${otherCategory}','${otherEvent}','10K',10);
    INSERT INTO registrations(id,event_id,athlete_id,registration_number,total_amount,net_amount) VALUES ('${registration}','${event}','${athlete}','ORDER-001',30,30), ('${otherRegistration}','${otherEvent}','${athlete}','ORDER-002',10,10);
    INSERT INTO participants(id,registration_id,category_id,full_name,bib_number) VALUES
      ('${p1}','${registration}','${category}','First','001'), ('${p2}','${registration}','${category}','Second',null),
      ('${p3}','${registration}','${category}','Third',null), ('${otherPerson}','${otherRegistration}','${otherCategory}','Other',null);`);
  const filename = migrations.find(name => name.includes('manual_bib_assignment'));
  // An old event may already contain duplicates; deployment must not rewrite it.
  await db.exec(`INSERT INTO participants(id,registration_id,category_id,full_name,bib_number) VALUES
    ('${uuid(44)}','${registration}','${category}','Legacy one','LEGACY-9'),
    ('${uuid(45)}','${registration}','${category}','Legacy two','LEGACY-9');`);
  originalParticipants = (await db.query('SELECT id, full_name, bib_number FROM participants ORDER BY id')).rows;
  assert.ok(filename, 'Manual bib migration must exist');
  await db.exec(fs.readFileSync(`supabase/migrations/${filename}`, 'utf8'));
});
after(async () => { await db?.close(); });

test('migration preserves existing bibs and optional registration creates no bib', async () => {
  assert.deepEqual((await db.query('SELECT id, full_name, bib_number FROM participants ORDER BY id')).rows, originalParticipants);
  assert.equal(await bib(p1), '001');
  assert.equal(await bib(p2), null);
  const created = await asUser(athlete, 'SELECT create_registration_atomic($1,$2,$3::jsonb,$4::jsonb,null) AS value', [event, athlete, JSON.stringify(fixture.billing()), JSON.stringify([fixture.person({category_id:category,full_name:'New runner',bib_number:'FORGED'})])]);
  const result = await db.query('SELECT bib_number FROM participants WHERE registration_id=$1', [created.rows[0].value.registration_id]);
  assert.equal(result.rows[0].bib_number, null);
});
test('staff assign, edit, clear, and persist bibs on the exact participant', async () => {
  await assign(p2, '  A-002  ', null); assert.equal(await bib(p2), 'A-002');
  await assign(p2, '0007', 'A-002'); assert.equal(await bib(p2), '0007');
  await db.query('UPDATE participants SET full_name=$1 WHERE id=$2', ['Renamed', p2]);
  assert.equal(await bib(p2), '0007'); assert.equal(await bib(p1), '001');
  await assign(p2, ' ', '0007'); assert.equal(await bib(p2), null);
});
test('duplicates are case insensitive within event but allowed across events', async () => {
  await assign(p2, 'A-02', null);
  await assert.rejects(assign(p3, 'a-02', null), /already assigned/);
  await assign(otherPerson, 'A-02', null, other, otherEvent);
  assert.equal(await bib(p3), null);
});
test('server rejects invalid input, stale edits, repeated participants and mismatched events', async () => {
  for (const value of ['x'.repeat(101), '<script>', 'A B', '=1+1']) await assert.rejects(assign(p3, value, null), /letters|hyphens/);
  await assert.rejects(assign(p2, 'NEW', null), /changed/);
  await assert.rejects(assign(otherPerson, 'NEW', 'A-02'), /not found in this event/);
  await assert.rejects(asUser(organizer, 'SELECT assign_participant_bibs($1,$2::jsonb)', [event, JSON.stringify([{participant_id:p3,bib_number:'P-3',expected_bib_number:null},{participant_id:p3,bib_number:'P-4',expected_bib_number:null}])]), /only once/);
});
test('athletes, outsiders, inactive users and anonymous callers cannot assign', async () => {
  for (const who of [athlete, other, inactive]) await assert.rejects(assign(p3, 'P-3', null, who), /Forbidden|access denied/);
  await assert.rejects(asUser(null, 'SELECT assign_participant_bibs($1,$2::jsonb)', [event,'[]'], 'anon'), /permission denied/);
  await assert.rejects(asUser(athlete, 'UPDATE participants SET bib_number=$1 WHERE id=$2', ['FORGED',p3]), /managed by the server/);
  await assign(p3, 'ADMIN-3', null, admin); assert.equal(await bib(p3), 'ADMIN-3');
});
test('batch changes roll back on duplicate and swaps succeed atomically', async () => {
  const batch = values => asUser(organizer, 'SELECT assign_participant_bibs($1,$2::jsonb)', [event, JSON.stringify(values)]);
  await assert.rejects(batch([{participant_id:p2,bib_number:'001',expected_bib_number:'A-02'},{participant_id:p3,bib_number:'003',expected_bib_number:'ADMIN-3'}]), /already assigned/);
  await assert.rejects(batch([{participant_id:p2,bib_number:'NEW-1',expected_bib_number:'A-02'},{participant_id:p3,bib_number:'new-1',expected_bib_number:'ADMIN-3'}]), /already assigned/);
  assert.equal(await bib(p2), 'A-02'); assert.equal(await bib(p3), 'ADMIN-3');
  await batch([{participant_id:p2,bib_number:'ADMIN-3',expected_bib_number:'A-02'},{participant_id:p3,bib_number:'A-02',expected_bib_number:'ADMIN-3'}]);
  assert.equal(await bib(p2), 'ADMIN-3'); assert.equal(await bib(p3), 'A-02');
});
test('optional generation fills blanks, skips reserved numbers, never overwrites, and is idempotent', async () => {
  await assign(p3, null, 'A-02');
  const generated = await asUser(organizer, 'SELECT generate_unassigned_bibs($1,1) AS count', [event]);
  assert.ok(generated.rows[0].count >= 1);
  assert.equal(await bib(p1), '001'); assert.equal(await bib(p2), 'ADMIN-3');
  assert.ok(await bib(p3));
  assert.equal((await asUser(organizer,'SELECT generate_unassigned_bibs($1,1) AS count',[event])).rows[0].count,0);
  await assert.rejects(asUser(other,'SELECT generate_unassigned_bibs($1,1)',[event]),/access denied/);
});
test('event moves and assigned category mismatches cannot bypass uniqueness', async () => {
  await assert.rejects(db.query('UPDATE registrations SET event_id=$1 WHERE id=$2',[otherEvent,registration]),/Clear assigned bib/);
  await assert.rejects(db.query('UPDATE participants SET category_id=$1 WHERE id=$2',[otherCategory,p1]),/does not belong/);
});
test('recorded results protect historical bib assignments', async () => {
  await db.query('INSERT INTO results(event_id,participant_id,bib_number) VALUES ($1,$2,$3)',[event,p1,'001']);
  await assert.rejects(assign(p1,null,'001'),/results have been recorded/);
  assert.equal(await bib(p1),'001');
});

const people = [
  {id:p1,full_name:'Alice, "Runner"',bib_number:'001',ic_passport:'900101123456',registration_number:'ORDER-001',category_name:'5K',registration_id:registration,status:'PAID'},
  {id:p2,full_name:'Bob',bib_number:null,ic_passport:'990202654321',registration_number:'ORDER-002',category_name:'5K',registration_id:registration,status:'PENDING'},
];
test('search supports name, full IC, order and bib; filtering and masking protect display', () => {
  for (const query of ['alice', '900101123456', 'ORDER-001','001']) assert.equal(shared.filterParticipants(people,query,'all')[0].id,p1);
  assert.equal(shared.filterParticipants(people,'','assigned').length,1);
  assert.equal(shared.filterParticipants(people,'','unassigned')[0].id,p2);
  assert.equal(shared.maskIdentity('900101123456'),'••••••••3456');
});
test('CSV round trip preserves quoted names, leading zeroes and expected assignments without full IC disclosure', () => {
  const exported = csv.participantCSV(event,people);
  assert.ok(!exported.includes('900101123456'));
  assert.equal(csv.parseBibCSV(exported,event)[0].bib_number,'001');
  assert.equal(csv.parseBibCSV(exported,event)[1].bib_number,null);
  assert.throws(() => csv.parseBibCSV(exported,otherEvent),/another event/);
  assert.throws(() => csv.parseBibCSV('event_id,participant_id,bib_number\n1,2,3',event),/headers/);
  assert.throws(() => csv.parseBibCSV(exported+'\r\n"unclosed',event),/Unclosed/);
  assert.throws(() => csv.parseBibCSV('x'.repeat(2_000_001),event),/2 MB/);
});
test('printing uses exact stored bibs for one/multiple and blocks missing/duplicate numbers', () => {
  assert.equal(shared.printableParticipants([people[0]])[0].bib_number,'001');
  assert.equal(shared.printableParticipants([people[0],{...people[1],bib_number:'002'}]).length,2);
  assert.throws(() => shared.printableParticipants(people),/Assign bib/);
  assert.throws(() => shared.printableParticipants([people[0],{...people[1],bib_number:'001'}]),/Duplicate/);
});

test('CSV import action persists assignments through the authenticated RPC and invalidates views', async () => {
  const paths = [];
  const client = { async rpc(name, args) {
    try {
      const result = await asUser(organizer, 'SELECT assign_participant_bibs($1,$2::jsonb) AS count', [args.p_event_id, JSON.stringify(args.p_assignments)]);
      return { data: result.rows[0].count, error: null };
    } catch (error) { return { data: null, error: { message: error.message } }; }
  } };
  const actions = load('src/lib/server/actions/participant.actions.ts', {
    'next/cache': { revalidatePath(value) { paths.push(value); } },
    '@/lib/participants': shared, '@/lib/participant-csv': csv,
    '@/lib/server/participants': { staffEvent: async () => ({client}), eventParticipants: async () => ({participants:people}) },
  });
  const current = await bib(p2);
  const exported = csv.participantCSV(event,[{...people[1],bib_number:current}]);
  const changed = exported.replace(`"${current}","${current}"`, `"CSV-200","${current}"`);
  const form = new FormData(); form.set('file',new File([changed],'bibs.csv',{type:'text/csv'}));
  assert.equal((await actions.importParticipantBibsAction(event,form)).count,1);
  assert.equal(await bib(p2),'CSV-200'); assert.ok(paths.some(value => value.includes(event)));
  assert.match((await actions.importParticipantBibsAction(event,form)).error,/changed/);
  assert.equal(await bib(p2),'CSV-200');
  assert.equal((await actions.assignParticipantBibsAction(event,[{participant_id:p2,bib_number:'<bad>',expected_bib_number:'CSV-200'}])).success,false);
});

test('server event access rejects outsiders and checks every data query against the event', async () => {
  const filters = [];
  const chain = { select() { return this; }, eq(field,value) { filters.push([field,value]); return this; }, is() { return this; },
    async single() { return { data:{id:event,title:'Race',organizer_id:organizer},error:null }; } };
  const unauthorized = load('src/lib/server/participants.ts', {
    '@/lib/server/auth/require-role':{requireRole:async allowed => { assert.deepEqual(allowed,['ORGANIZER','ADMIN','SUPER_ADMIN']); return {user:{id:other},role:'ORGANIZER'}; }},
    '@/lib/supabase/server':{createSupabaseServerClient:async()=>({from:()=>chain})},
  });
  await assert.rejects(unauthorized.staffEvent(event),/access denied/);
  assert.ok(filters.some(([field,value])=>field==='id' && value===event));
});

test('print page renders exact saved bibs for one/multiple without leaking IC or writing data', async () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const stored = [people[0],{...people[1],bib_number:'MANUAL-002'}];
  const page = load('src/app/organizer/dashboard/events/[id]/bibs/print/page.tsx', {
    'next/link':{default:({children,href})=>React.createElement('a',{href},children),__esModule:true},
    '@/components/events/print-button':{PrintButton:()=>React.createElement('button',null,'Print / Save PDF')},
    '@/lib/server/participants':{eventParticipants:async id=>{assert.equal(id,event);return {event:{id:event,title:'Race'},participants:stored};}},
    '@/lib/participants':shared,
  }).default;
  async function render(ids) { return renderToStaticMarkup(await page({params:Promise.resolve({id:event}),searchParams:Promise.resolve({participants:ids})})); }
  const one = await render(p1);
  assert.ok(one.includes('001')); assert.ok(!one.includes('MANUAL-002')); assert.ok(!one.includes('900101123456'));
  const bulk = await render(`${p1},${p2}`); assert.ok(bulk.includes('MANUAL-002')); assert.ok(bulk.includes('Print / Save PDF'));
  assert.ok(!(await render(otherPerson)).includes('Print / Save PDF'));
  stored[1].bib_number=null;
  const missing=await render(p2); assert.ok(missing.includes('Assign bib')); assert.ok(!missing.includes('Print / Save PDF'));
  assert.equal(stored[0].bib_number,'001');
});

test('results import only matches participants from the selected event', async () => {
  const filters = [];
  let inserted;
  const client = { auth:{getUser:async()=>({data:{user:{id:organizer}}})}, from(table) {
    const chain = { select(){return this;},eq(field,value){filters.push([table,field,value]);return this;},is(){return this;},
      async single(){return {data:{id:event,organizer_id:organizer}};},
      async in(){return {data:[{id:p1,bib_number:'001'}],error:null};},
      async upsert(values){inserted=values;return {error:null};} };
    return chain;
  } };
  const actions=load('src/lib/server/actions/result.actions.ts',{
    '@/lib/supabase/server':{createSupabaseServerClient:async()=>client},'next/cache':{revalidatePath(){}},
  });
  const form=new FormData();form.set('file',new File(['bib_number,finish_time\n001,00:30:00'],'results.csv'));
  await actions.importResultsAction(event,form);
  assert.ok(filters.some(([table,field,value])=>table==='participants' && field==='registrations.event_id' && value===event));
  assert.equal(inserted[0].participant_id,p1);assert.equal(inserted[0].event_id,event);
});
