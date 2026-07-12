const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query(`
      SELECT routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'handle_new_user';
    `);
    console.log('Function definition:');
    console.log(res.rows[0]?.routine_definition);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
