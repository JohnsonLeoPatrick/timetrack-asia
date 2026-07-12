const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query('SELECT id, title, slug, status FROM public.events');
    console.log('--- remote events ---');
    console.log(res.rows);

    const catRes = await client.query('SELECT id, event_id, name FROM public.event_categories');
    console.log('--- remote event categories ---');
    console.log(catRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
