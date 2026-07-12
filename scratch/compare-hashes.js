const { Client } = require('pg');

const oldConnectionString = 'postgresql://postgres:Benben1-123-@db.mmnduinqjogqmmlpmong.supabase.co:5432/postgres';
const newConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const clientOld = new Client({ connectionString: oldConnectionString });
  const clientNew = new Client({ connectionString: newConnectionString });

  await clientOld.connect();
  await clientNew.connect();

  try {
    const resOld = await clientOld.query('SELECT email, encrypted_password FROM auth.users ORDER BY email');
    const resNew = await clientNew.query('SELECT email, encrypted_password FROM auth.users ORDER BY email');

    console.log('--- OLD DATABASE ---');
    console.table(resOld.rows);

    console.log('--- NEW DATABASE ---');
    console.table(resNew.rows);
  } catch (err) {
    console.error('Failed to compare hashes:', err);
  } finally {
    await clientOld.end();
    await clientNew.end();
  }
}

run();
