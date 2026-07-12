const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    console.log('Testing update trigger for organizer@timetrack.asia...');
    await client.query(
      `UPDATE auth.users SET updated_at = NOW() WHERE email = 'organizer@timetrack.asia'`
    );
    console.log('Update succeeded without error!');

  } catch (err) {
    console.error('Trigger execution failed with error:', err);
  } finally {
    await client.end();
  }
}

run();
