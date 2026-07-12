const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    // 1. Get events with 0 categories
    const res = await client.query(`
      SELECT e.id, e.title 
      FROM public.events e
      LEFT JOIN public.event_categories c ON e.id = c.event_id
      GROUP BY e.id, e.title
      HAVING count(c.id) = 0
    `);
    
    const eventsWithoutCats = res.rows;
    console.log(`Found ${eventsWithoutCats.length} events without categories.`);

    if (eventsWithoutCats.length > 0) {
      const crypto = require('crypto');
      console.log('Adding default category "General Entry" for each event...');
      for (const event of eventsWithoutCats) {
        const catId = crypto.randomUUID();
        await client.query(`
          INSERT INTO public.event_categories (id, event_id, name, description, base_price, max_slots)
          VALUES ($1, $2, 'General Entry', 'General admission for the event.', 50.00, 500)
        `, [catId, event.id]);
        console.log(`Added default category for event: "${event.title}" (${event.id})`);
      }
      console.log('Finished inserting default categories.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
