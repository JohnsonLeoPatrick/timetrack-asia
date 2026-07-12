const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query(`
      SELECT 
        conname AS constraint_name, 
        pg_get_constraintdef(c.oid) AS constraint_definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'users';
    `);
    console.log('Constraints on public.users:');
    console.log(res.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
