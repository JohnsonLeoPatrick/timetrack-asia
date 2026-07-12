const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    const result = await client.query(
      `UPDATE auth.users 
       SET instance_id = '00000000-0000-0000-0000-000000000000'
       WHERE instance_id IS NULL`
    );
    console.log(`Updated instance_id for ${result.rowCount} additional users where it was NULL.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
