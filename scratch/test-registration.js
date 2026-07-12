const { createClient } = require('@supabase/supabase-js');

const url = 'https://boajqnifcctfqclxxqgm.supabase.co';
const anonKey = 'sb_publishable_escllkgcsYPAb651Dbd3_A_h7PzHRBX';

const email = 'user@gmail.com';
const password = 'TimeTrack2026!';

async function run() {
  const supabase = createClient(url, anonKey);
  
  console.log(`1. Logging in as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error('Auth failed:', authError.message);
    return;
  }

  const user = authData.user;
  console.log('Logged in successfully. User ID:', user.id);

  // Set the authorization header on the client manually just in case, though supabase client does it automatically
  // Now let's try to insert a registration
  console.log('2. Inserting registration for event...');
  const { data: reg, error: regError } = await supabase
    .from('registrations')
    .insert({
      event_id: '10000000-0000-0000-0000-000000000001',
      athlete_id: user.id,
      registration_number: `TEST-${Date.now().toString(36).toUpperCase()}`,
      persons_count: 1,
      status: 'PENDING',
      total_amount: 120.00,
      discount_amount: 0.00,
      net_amount: 120.00,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (regError) {
    console.error('Registration insertion failed:', regError);
    return;
  }

  console.log('Registration inserted successfully:', reg);

  console.log('3. Inserting billing details...');
  const { error: billError } = await supabase.from('billing_details').insert({
    registration_id: reg.id,
    first_name: 'Test User',
    phone: '+60123456789',
    email: 'user@gmail.com',
    country: 'Malaysia',
    city: 'Kuala Lumpur',
    postcode: '50000'
  });

  if (billError) {
    console.error('Billing details insertion failed:', billError);
    return;
  }
  console.log('Billing details inserted.');

  console.log('4. Inserting participant details...');
  const { error: partError } = await supabase.from('participants').insert({
    registration_id: reg.id,
    category_id: '20000000-0000-0000-0000-000000000001',
    full_name: 'Test User',
    gender: 'MALE',
    email: 'user@gmail.com',
    phone: '+60123456789'
  });

  if (partError) {
    console.error('Participant insertion failed:', partError);
    return;
  }
  console.log('Participant inserted.');

  // Clean up
  console.log('5. Cleaning up test data...');
  await supabase.from('registrations').delete().eq('id', reg.id);
  console.log('Test registration deleted.');
}

run();
