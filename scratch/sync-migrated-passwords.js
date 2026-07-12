const { Client } = require('pg');

const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const pgClient = new Client({ connectionString: dbConnectionString });
  await pgClient.connect();

  try {
    console.log('Searching for a newly signed-up user to get the reference password hash...');
    const res = await pgClient.query(
      `SELECT email, encrypted_password FROM auth.users 
       WHERE email NOT IN ('athlete@timetrack.asia', 'admin@timetrack.asia', 'organizer@timetrack.asia', 'test@gmail.com')
       ORDER BY created_at DESC LIMIT 1`
    );

    if (res.rows.length === 0) {
      console.log('No new user found. Please go to http://localhost:3000/signup and sign up a new account first!');
      return;
    }

    const newUser = res.rows[0].email;
    const correctHash = res.rows[0].encrypted_password;
    console.log(`Found newly signed-up reference user: ${newUser}`);
    console.log('Hash:', correctHash);

    console.log('Updating migrated user accounts...');
    const updateRes = await pgClient.query(
      `UPDATE auth.users 
       SET encrypted_password = $1, email_confirmed_at = COALESCE(email_confirmed_at, NOW())
       WHERE email IN ('athlete@timetrack.asia', 'admin@timetrack.asia', 'organizer@timetrack.asia', 'test@gmail.com')`,
      [correctHash]
    );

    console.log(`Successfully updated ${updateRes.rowCount} migrated user accounts!`);
    console.log('\nYou can now log in to the migrated accounts using the password: "TimeTrack2026!"');
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await pgClient.end();
  }
}

run();
