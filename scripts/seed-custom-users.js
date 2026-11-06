const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const { v4: uuidv4 } = require('uuid');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const client = new Client({
  connectionString
});

async function seedUsers() {
  await client.connect();

  const usersToCreate = [
    { email: 'user@gmail.com', password: '1234', role: 'USER' },
    { email: 'organizer@gmail.com', password: '1234', role: 'ORGANIZER' },
    { email: 'admin@gmail.com', password: '1234', role: 'ADMIN' }
  ];

  try {
    for (const u of usersToCreate) {
      console.log(`Creating user ${u.email} with role ${u.role}...`);
      
      const res = await client.query(`SELECT id FROM auth.users WHERE email = '${u.email}'`);
      let userId;
      
      if (res.rows.length > 0) {
        userId = res.rows[0].id;
        await client.query(`
          UPDATE auth.users 
          SET encrypted_password = crypt('${u.password}', gen_salt('bf')),
              raw_user_meta_data = '{"role":"${u.role}"}',
              email_confirmed_at = now()
          WHERE id = '${userId}'
        `);
      } else {
        userId = uuidv4();
        await client.query(`
          INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token)
          VALUES (
            '${userId}',
            '00000000-0000-0000-0000-000000000000',
            '${u.email}',
            crypt('${u.password}', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"role":"${u.role}"}',
            now(),
            now(),
            'authenticated',
            'authenticated',
            ''
          )
        `);
      }

      // Upsert into public.users
      const publicUserQuery = `
        INSERT INTO users (id, email, role, status)
        VALUES ('${userId}', '${u.email}', '${u.role}', 'ACTIVE')
        ON CONFLICT (id) DO UPDATE SET
          role = '${u.role}',
          status = 'ACTIVE';
      `;
      await client.query(publicUserQuery);
      console.log(`User ${u.email} seeded successfully.`);
    }
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await client.end();
  }
}

seedUsers();
