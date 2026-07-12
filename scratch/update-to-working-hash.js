const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

const workingHash = '$2a$10$8GlZ4gcWghunenF.D7FMSOp7q8tr9U4bZ80arp6Yf63eex6Yxm5Oa'; // Known to work for 'TimeTrack2026!'

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    console.log('Updating all users to working hash...');
    const result = await client.query(
      `UPDATE auth.users 
       SET encrypted_password = $1, email_confirmed_at = COALESCE(email_confirmed_at, NOW())
       WHERE email IN ('athlete@timetrack.asia', 'admin@timetrack.asia', 'organizer@timetrack.asia', 'test@gmail.com', 'user@gmail.com', 'organizer@gmail.com', 'admin@gmail.com')`,
      [workingHash]
    );
    console.log(`Successfully updated ${result.rowCount} users in auth.users.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
