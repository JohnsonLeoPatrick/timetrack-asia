const { createClient } = require('@supabase/supabase-js');

const url = 'https://boajqnifcctfqclxxqgm.supabase.co';
const anonKey = 'sb_publishable_escllkgcsYPAb651Dbd3_A_h7PzHRBX';

const supabase = createClient(url, anonKey);

async function testLogin(email, password) {
  console.log(`Attempting to log in as ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`Login failed for ${email}:`, error.message);
  } else {
    console.log(`Login successful for ${email}! User ID: ${data.user.id}`);
  }
}

async function run() {
  // Let's test with the password the user might be trying (e.g. 'TimeTrack2026!' or '1234')
  await testLogin('athlete@timetrack.asia', 'TimeTrack2026!');
  await testLogin('athlete@timetrack.asia', '1234');
  await testLogin('admin@timetrack.asia', '1234');
}

run();
