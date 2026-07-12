const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    await client.query(
      `UPDATE auth.users 
       SET raw_user_meta_data = '{"role":"ORGANIZER","phone":"+60177777777","last_name":"Organizer","first_name":"Demo"}'::jsonb
       WHERE email = 'organizer@timetrack.asia'`
    );
    console.log('Restored metadata.');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
