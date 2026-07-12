const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';
const url = 'https://boajqnifcctfqclxxqgm.supabase.co';
const anonKey = 'sb_publishable_escllkgcsYPAb651Dbd3_A_h7PzHRBX';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  await client.connect();
  
  try {
    console.log('Copying fields from athlete@timetrack.asia to organizer@timetrack.asia...');
    
    // Fetch athlete row
    const res = await client.query(
      "SELECT * FROM auth.users WHERE email = 'athlete@timetrack.asia'"
    );
    const athlete = res.rows[0];

    // Let's set columns of organizer@timetrack.asia
    await client.query(`
      UPDATE auth.users 
      SET 
        recovery_token = $1,
        email_change_token_new = $2,
        email_change = $3,
        email_change_token_current = $4,
        phone_change = $5,
        phone_change_token = $6,
        reauthentication_token = $7
      WHERE email = 'organizer@timetrack.asia'
    `, [
      athlete.recovery_token || '',
      athlete.email_change_token_new || '',
      athlete.email_change || '',
      athlete.email_change_token_current || '',
      athlete.phone_change || '',
      athlete.phone_change_token || '',
      athlete.reauthentication_token || ''
    ]);
    console.log('Fields copied.');

  } catch (err) {
    console.error('Error:', err.message);
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
