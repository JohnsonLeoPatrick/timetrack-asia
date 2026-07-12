const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('Querying migrated user emails from auth.users...');
    const res = await client.query('SELECT id, email, created_at, email_confirmed_at FROM auth.users');
    console.log(`Found ${res.rows.length} users:`);
    console.table(res.rows);
  } catch (err) {
    console.error('Query failed:', err);
  } finally {
    await client.end();
  }
}

run();
