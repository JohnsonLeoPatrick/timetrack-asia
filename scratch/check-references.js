const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

const badId = '11111111-1111-1111-1111-111111111111';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    const tables = [
      'public.registrations',
      'public.events',
      'public.results',
      'public.payments',
      'public.participants',
      'public.audit_logs'
    ];

    for (const table of tables) {
      // Find columns referencing UUID or text
      const columnsRes = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = $1
      `, [table.split('.')[1]]);
      
      for (const colRow of columnsRes.rows) {
        const col = colRow.column_name;
        try {
          const checkRes = await client.query(`
            SELECT count(*) FROM ${table} WHERE "${col}"::text = $1
          `, [badId]);
          const count = parseInt(checkRes.rows[0].count);
          if (count > 0) {
            console.log(`Found ${count} references in ${table}.${col}`);
          }
        } catch (e) {
          // Ignore type casting errors
        }
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
