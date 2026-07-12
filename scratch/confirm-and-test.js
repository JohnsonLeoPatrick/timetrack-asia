const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const url = 'https://boajqnifcctfqclxxqgm.supabase.co';
const anonKey = 'sb_publishable_escllkgcsYPAb651Dbd3_A_h7PzHRBX';
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

const email = 'temp_test_m7x7qta@timetrack.asia';
const password = 'TimeTrack2026!';

async function run() {
  const pgClient = new Client({ connectionString: dbConnectionString });
  await pgClient.connect();
  try {
    console.log('Confirming email in database...');
    await pgClient.query(
      'UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = $1',
      [email]
    );
    console.log('Email confirmed.');
  } catch (err) {
    console.error('DB error:', err.message);
  } finally {
    await pgClient.end();
  }

  const supabase = createClient(url, anonKey);
  console.log('Trying to log in after email confirmation...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (loginError) {
    console.error('Login failed:', loginError.message);
  } else {
    console.log('Login successful! User ID:', loginData.user?.id);
  }
}

run();
