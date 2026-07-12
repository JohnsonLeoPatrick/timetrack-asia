const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is missing in .env.local!');
  process.exit(1);
}

const client = new Client({ connectionString });

async function check() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT id, email, raw_user_meta_data 
      FROM auth.users
    `);
    console.log('--- Auth Users Table ---');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (error) {
    console.error('Check error:', error);
  } finally {
    await client.end();
  }
}

check();
