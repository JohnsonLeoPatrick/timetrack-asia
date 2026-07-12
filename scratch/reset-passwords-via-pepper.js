const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const url = 'https://boajqnifcctfqclxxqgm.supabase.co';
const anonKey = 'sb_publishable_escllkgcsYPAb651Dbd3_A_h7PzHRBX';
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

const tempEmail = `temp_pepper_ref_${Math.random().toString(36).substring(2, 9)}@timetrack.asia`;
const targetPassword = 'TimeTrack2026!';

async function run() {
  const supabase = createClient(url, anonKey);
  const pgClient = new Client({ connectionString: dbConnectionString });

  console.log(`1. Signing up temporary reference user: ${tempEmail}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: tempEmail,
    password: targetPassword
  });

  if (signUpError) {
    console.error('Sign up failed:', signUpError.message);
    return;
  }

  console.log('Temporary user created. Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  await pgClient.connect();

  try {
    console.log('2. Querying password hash of temporary user from database...');
    const hashRes = await pgClient.query('SELECT encrypted_password FROM auth.users WHERE email = $1', [tempEmail]);
    
    if (hashRes.rows.length === 0) {
      throw new Error(`Could not find temporary user ${tempEmail} in auth.users`);
    }

    const correctHash = hashRes.rows[0].encrypted_password;
    console.log('Found new project hash:', correctHash);

    console.log('3. Updating all migrated user accounts with this password hash...');
    const updateRes = await pgClient.query(
      `UPDATE auth.users 
       SET encrypted_password = $1, email_confirmed_at = COALESCE(email_confirmed_at, NOW())
       WHERE email IN ('athlete@timetrack.asia', 'admin@timetrack.asia', 'organizer@timetrack.asia', 'test@gmail.com', 'user@gmail.com', 'organizer@gmail.com', 'admin@gmail.com')`,
      [correctHash]
    );
    console.log(`Updated ${updateRes.rowCount} users.`);

    console.log('4. Cleaning up temporary reference user...');
    await pgClient.query('DELETE FROM auth.users WHERE email = $1', [tempEmail]);
    console.log('Cleanup complete.');

    console.log(`\nSuccess! All pre-existing accounts are now set to the password: "${targetPassword}"`);
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await pgClient.end();
  }
}

run();
