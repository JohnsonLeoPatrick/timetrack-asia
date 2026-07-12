const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to new database successfully.');
    
    const usersRes = await client.query('SELECT id, email, encrypted_password, email_confirmed_at FROM auth.users');
    console.log('--- auth.users ---');
    console.log(usersRes.rows.map(r => ({ id: r.id, email: r.email, has_password: !!r.encrypted_password, email_confirmed_at: r.email_confirmed_at })));

    const publicUsersRes = await client.query('SELECT id, email, role FROM public.users');
    console.log('--- public.users ---');
    console.log(publicUsersRes.rows);

  } catch (err) {
    console.error('Error connecting or querying:', err);
  } finally {
    await client.end();
  }
}

run();
