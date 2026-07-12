const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query(`
      SELECT 
        event_object_schema as table_schema,
        event_object_table as table_name,
        trigger_name,
        action_statement,
        action_timing
      FROM information_schema.triggers
      WHERE event_object_schema = 'auth'
      ORDER BY table_name;
    `);
    console.log('Triggers in auth schema:');
    console.log(res.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
