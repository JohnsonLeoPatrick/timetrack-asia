const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query(
      `SELECT * FROM auth.users WHERE email IN ('athlete@timetrack.asia', 'organizer@timetrack.asia', 'user@gmail.com')`
    );
    
    for (const row of res.rows) {
      console.log(`=== User: ${row.email} ===`);
      for (const [key, value] of Object.entries(row)) {
        console.log(`${key}: ${JSON.stringify(value)}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
