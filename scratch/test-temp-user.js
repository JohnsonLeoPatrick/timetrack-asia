const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const url = 'https://boajqnifcctfqclxxqgm.supabase.co';
const anonKey = 'sb_publishable_escllkgcsYPAb651Dbd3_A_h7PzHRBX';
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

const email = `temp_test_${Math.random().toString(36).substring(2, 9)}@timetrack.asia`;
const password = 'TimeTrack2026!';

async function run() {
  const supabase = createClient(url, anonKey);
  
  console.log(`1. Signing up ${email}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (signUpError) {
    console.error('Sign up failed:', signUpError.message);
    return;
  }
  
  console.log('Sign up response user ID:', signUpData.user?.id);

  console.log('2. Trying to log in immediately...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (loginError) {
    console.error('Login failed:', loginError.message);
  } else {
    console.log('Login successful! User ID:', loginData.user?.id);
  }

  // Query hash
  const pgClient = new Client({ connectionString: dbConnectionString });
  await pgClient.connect();
  try {
    const res = await pgClient.query('SELECT encrypted_password FROM auth.users WHERE email = $1', [email]);
    console.log('Hash in DB:', res.rows[0]?.encrypted_password);
  } catch (err) {
    console.error('DB error:', err.message);
  } finally {
    await pgClient.end();
  }
}

run();
