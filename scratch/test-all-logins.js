const { createClient } = require('@supabase/supabase-js');

const url = 'https://boajqnifcctfqclxxqgm.supabase.co';
const anonKey = 'sb_publishable_escllkgcsYPAb651Dbd3_A_h7PzHRBX';

const users = [
  'athlete@timetrack.asia',
  'admin@timetrack.asia',
  'organizer@timetrack.asia',
  'test@gmail.com',
  'user@gmail.com',
  'organizer@gmail.com',
  'admin@gmail.com'
];
const password = 'TimeTrack2026!';

async function run() {
  const supabase = createClient(url, anonKey);
  for (const email of users) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(`Login FAILED for ${email}:`, JSON.stringify(error, null, 2));
    } else {
      console.log(`Login SUCCESS for ${email}! ID: ${data.user.id}`);
    }
  }
}

run();
