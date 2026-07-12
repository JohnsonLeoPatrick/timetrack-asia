const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query(`
      SELECT pg_get_triggerdef(oid) 
      FROM pg_trigger 
      WHERE tgname = 'on_auth_user_created';
    `);
    console.log('Trigger definitions:');
    for (const row of res.rows) {
      console.log(row.pg_get_triggerdef);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
