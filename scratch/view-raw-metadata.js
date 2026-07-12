const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query('SELECT email, raw_user_meta_data, raw_app_meta_data FROM auth.users');
    console.log('--- auth.users metadata ---');
    for (const r of res.rows) {
      console.log(`${r.email}:`);
      console.log('  raw_user_meta_data:', r.raw_user_meta_data);
      console.log('  raw_app_meta_data:', r.raw_app_meta_data);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
