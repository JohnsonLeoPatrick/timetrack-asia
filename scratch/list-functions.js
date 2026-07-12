const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    const query = `
      SELECT 
        n.nspname as schema_name,
        p.proname as function_name,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND (p.proname LIKE '%jwt%' OR p.proname LIKE '%hook%' OR p.proname LIKE '%claim%' OR p.proname LIKE '%role%')
      ORDER BY schema_name, function_name;
    `;
    const res = await client.query(query);
    console.log('Matching functions:');
    for (const row of res.rows) {
      console.log(`--- Function: ${row.schema_name}.${row.function_name} ---`);
      console.log(row.definition);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
