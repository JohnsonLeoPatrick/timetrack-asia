const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('Testing JWT secret retrieval...');
    
    // Test 1: app.settings.jwt_secret
    try {
      const res1 = await client.query("SELECT current_setting('app.settings.jwt_secret', true) as secret");
      console.log('app.settings.jwt_secret:', res1.rows[0].secret);
    } catch (e) {
      console.error('Error reading app.settings.jwt_secret:', e.message);
    }

    // Test 2: pg_settings
    try {
      const res2 = await client.query("SELECT setting FROM pg_settings WHERE name = 'app.settings.jwt_secret'");
      console.log('pg_settings app.settings.jwt_secret:', res2.rows[0]?.setting);
    } catch (e) {
      console.error('Error reading pg_settings:', e.message);
    }

    // Test 3: check vault decrypted secrets
    try {
      const res3 = await client.query("SELECT name, decrypted_secret FROM vault.decrypted_secrets");
      console.log('Vault secrets found:', res3.rows.length);
      console.log(res3.rows);
    } catch (e) {
      console.error('Error reading vault.decrypted_secrets:', e.message);
    }
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    await client.end();
  }
}

run();
