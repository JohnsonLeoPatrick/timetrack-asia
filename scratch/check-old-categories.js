const { Client } = require('pg');
const oldConnectionString = 'postgresql://postgres:Benben1-123-@db.mmnduinqjogqmmlpmong.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: oldConnectionString });
  try {
    await client.connect();
    console.log('Connected to old database.');

    const res = await client.query(`
      SELECT e.id, e.title, count(c.id) as category_count
      FROM public.events e
      LEFT JOIN public.event_categories c ON e.id = c.event_id
      GROUP BY e.id, e.title
      ORDER BY category_count DESC;
    `);
    console.log('Old Event category counts:');
    console.log(res.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
