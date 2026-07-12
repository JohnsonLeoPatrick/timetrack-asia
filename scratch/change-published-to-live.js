const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query(
      `UPDATE public.events 
       SET status = 'LIVE' 
       WHERE status = 'PUBLISHED'`
    );
    console.log(`Successfully updated ${res.rowCount} events from status 'PUBLISHED' to 'LIVE'.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
