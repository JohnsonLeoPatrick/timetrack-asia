const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    const query = `
      SELECT 
        event_object_schema as table_schema,
        event_object_table as table_name,
        trigger_name,
        action_statement,
        action_timing
      FROM information_schema.triggers
      ORDER BY table_schema, table_name;
    `;
    const res = await client.query(query);
    console.log('Database triggers:');
    console.log(res.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
