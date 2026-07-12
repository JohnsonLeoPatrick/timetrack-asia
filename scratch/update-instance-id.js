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

    console.log('Updating instance_id for migrated users...');
    const result = await client.query(
      `UPDATE auth.users 
       SET instance_id = '00000000-0000-0000-0000-000000000000'
       WHERE email IN ('athlete@timetrack.asia', 'admin@timetrack.asia', 'organizer@timetrack.asia', 'test@gmail.com', 'user@gmail.com', 'organizer@gmail.com', 'admin@gmail.com')`
    );
    console.log(`Successfully updated instance_id for ${result.rowCount} users.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }

  // Now test login
  const supabase = createClient(url, anonKey);
  console.log('Testing login for athlete@timetrack.asia...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'athlete@timetrack.asia',
    password: 'TimeTrack2026!'
  });

  if (error) {
    console.error('Login failed:', error.message);
  } else {
    console.log('Login successful! User ID:', data.user?.id);
  }
}

run();
