const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is missing in .env.local!');
  process.exit(1);
}

const client = new Client({ connectionString });

async function sync() {
  await client.connect();
  console.log('Connected to Supabase database.');

  try {
    // 1. Clean up inconsistent public users (emails matching auth.users but with different IDs)
    const cleanQuery = `
      DELETE FROM public.users
      WHERE email IN (SELECT email FROM auth.users)
        AND id NOT IN (SELECT id FROM auth.users);
    `;
    const cleanRes = await client.query(cleanQuery);
    console.log(`Cleaned up ${cleanRes.rowCount} inconsistent rows in public.users.`);

    // 2. Synchronize all users from auth.users to public.users
    const syncQuery = `
      INSERT INTO public.users (id, email, role, first_name, last_name, phone, status)
      SELECT 
        id, 
        email, 
        COALESCE(raw_user_meta_data->>'role', 'ATHLETE'), 
        raw_user_meta_data->>'first_name', 
        raw_user_meta_data->>'last_name', 
        raw_user_meta_data->>'phone',
        'ACTIVE'
      FROM auth.users
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone;
    `;
    await client.query(syncQuery);
    console.log('Successfully synchronized all users from auth.users to public.users.');
  } catch (error) {
    console.error('Error during synchronization:', error);
  } finally {
    await client.end();
  }
}

sync();
