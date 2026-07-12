const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is missing in .env.local!');
  process.exit(1);
}

const client = new Client({ connectionString });

async function applyMigration() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  const sql = `
    ALTER TABLE events ADD COLUMN IF NOT EXISTS shareable_analytics_token UUID DEFAULT gen_random_uuid();
  `;

  try {
    await client.query(sql);
    console.log("Successfully added shareable_analytics_token column to events table.");
  } catch (error) {
    console.error('Error executing database migration:', error);
  } finally {
    await client.end();
  }
}

applyMigration();
