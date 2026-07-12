const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';
const url = 'https://boajqnifcctfqclxxqgm.supabase.co';
const anonKey = 'sb_publishable_escllkgcsYPAb651Dbd3_A_h7PzHRBX';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  await client.connect();
  
  try {
    console.log('Fixing NULL string columns in auth.users...');
    
    const result = await client.query(`
      UPDATE auth.users 
      SET 
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        phone_change = COALESCE(phone_change, ''),
        phone_change_token = COALESCE(phone_change_token, ''),
        reauthentication_token = COALESCE(reauthentication_token, ''),
        confirmation_token = COALESCE(confirmation_token, '')
      WHERE 
        recovery_token IS NULL OR 
        email_change_token_new IS NULL OR 
        email_change IS NULL OR 
        email_change_token_current IS NULL OR 
        phone_change IS NULL OR 
        phone_change_token IS NULL OR 
        reauthentication_token IS NULL OR
        confirmation_token IS NULL
    `);
    console.log(`Successfully updated ${result.rowCount} users in auth.users.`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }

  // Now test all logins
  const supabase = createClient(url, anonKey);
  const users = [
    'athlete@timetrack.asia',
    'admin@timetrack.asia',
    'organizer@timetrack.asia',
    'test@gmail.com',
    'user@gmail.com',
    'organizer@gmail.com',
    'admin@gmail.com'
  ];
  const password = 'TimeTrack2026!';

  console.log('Testing all logins...');
  for (const email of users) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(`Login FAILED for ${email}:`, error.message);
    } else {
      console.log(`Login SUCCESS for ${email}! ID: ${data.user.id}`);
    }
  }
}

run();
