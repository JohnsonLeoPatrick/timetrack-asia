const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('Creating athlete...');
  const { data: athlete, error: aErr } = await supabase.auth.signUp({
    email: 'athlete2@timetrack.asia',
    password: 'TimeTrack2026!',
    options: {
      data: {
        role: 'ATHLETE',
        first_name: 'Demo',
        last_name: 'Athlete'
      }
    }
  });
  if (aErr) console.error('Athlete err:', aErr.message);
  else console.log('Athlete created:', athlete.user?.id);

  console.log('Creating admin...');
  const { data: admin, error: adErr } = await supabase.auth.signUp({
    email: 'admin2@timetrack.asia',
    password: 'TimeTrack2026!',
    options: {
      data: {
        role: 'SUPER_ADMIN',
        first_name: 'Admin',
        last_name: 'User'
      }
    }
  });
  if (adErr) console.error('Admin err:', adErr.message);
  else console.log('Admin created:', admin.user?.id);
}

main();
