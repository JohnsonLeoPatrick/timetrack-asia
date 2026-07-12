const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Supabase URL or Service Role Key missing, skipping seeding.");
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedAdmins() {
  const admins = [
    { email: 'root@gmail.com', password: '1234' },
    { email: 'admin@gmail.com', password: '1234' }
  ];

  console.log(`Checking existing users...`);
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error("Error listing users:", listError.message);
  }

  for (const admin of admins) {
    let adminId;
    const existingAdmin = users?.users?.find(u => u.email === admin.email);

    if (existingAdmin) {
      console.log(`Admin user ${admin.email} already exists.`);
      adminId = existingAdmin.id;
    } else {
      console.log(`Creating admin user ${admin.email}...`);
      const { data: user, error: createError } = await supabase.auth.admin.createUser({
        email: admin.email,
        password: admin.password,
        email_confirm: true,
        user_metadata: { role: 'ADMIN' }
      });

      if (createError) {
        console.error("Error creating admin user:", createError.message);
        continue;
      }
      
      adminId = user.user.id;
      console.log(`Admin user ${admin.email} created successfully in Auth.`);
    }

    // Ensure user is in the public.users table with ADMIN role
    console.log(`Ensuring ${admin.email} is in the public.users table...`);
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: adminId,
        email: admin.email,
        role: 'ADMIN',
        status: 'ACTIVE'
      });

    if (upsertError) {
      console.error(`Error upserting admin user ${admin.email} in public.users:`, upsertError.message);
    } else {
      console.log(`Admin user ${admin.email} successfully upserted in public.users.`);
    }
  }
}

seedAdmins();
