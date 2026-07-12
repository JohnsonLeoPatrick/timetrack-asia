const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

const sql = `
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR(50)
LANGUAGE SQL SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.users WHERE id = auth.uid()),
    'ATHLETE'
  );
$$;
`;

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('Updating public.current_user_role()...');
    await client.query(sql);
    console.log('Successfully updated function with SECURITY DEFINER!');
  } catch (err) {
    console.error('Update failed:', err);
  } finally {
    await client.end();
  }
}

run();
