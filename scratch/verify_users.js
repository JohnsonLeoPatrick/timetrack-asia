const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is missing in .env.local!');
  process.exit(1);
}

const client = new Client({ connectionString });

async function verify() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT id, email, role, first_name, last_name, status 
      FROM public.users
    `);
    console.log('--- All Public Users ---');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (error) {
    console.error('Verification error:', error);
  } finally {
    await client.end();
  }
}

verify();
