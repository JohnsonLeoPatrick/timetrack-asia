const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';
const url = 'https://boajqnifcctfqclxxqgm.supabase.co';
const anonKey = 'sb_publishable_escllkgcsYPAb651Dbd3_A_h7PzHRBX';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    console.log('Temporarily changing raw_user_meta_data of organizer@timetrack.asia to ATHLETE role...');
    await client.query(
      `UPDATE auth.users 
       SET raw_user_meta_data = '{"role":"ATHLETE"}'::jsonb
       WHERE email = 'organizer@timetrack.asia'`
    );
    console.log('Updated in auth.users.');

  } catch (err) {
    console.error('Update failed:', err);
  } finally {
    await client.end();
  }

  // Now test login
  const supabase = createClient(url, anonKey);
  console.log('Testing login for organizer@timetrack.asia...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'organizer@timetrack.asia',
    password: 'TimeTrack2026!'
  });

  if (error) {
    console.error('Login failed:', JSON.stringify(error, null, 2));
  } else {
    console.log('Login successful! User ID:', data.user?.id);
  }
}

run();
