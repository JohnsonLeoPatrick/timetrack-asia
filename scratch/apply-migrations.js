const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

const migrationFiles = [
  '001_schema.sql',
  '002_rls_policies.sql',
  '003_seed_data.sql',
  '004_coupons.sql',
  '005_organizer_codes.sql',
  '006_certificates.sql'
];

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  console.log('Connected to the database. Running migrations...');

  try {
    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, '..', 'supabase', 'migrations', file);
      console.log(`Reading migration: ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`Executing migration: ${file}...`);
      await client.query(sql);
      console.log(`Successfully completed migration: ${file}`);
    }
    console.log('All migrations executed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
