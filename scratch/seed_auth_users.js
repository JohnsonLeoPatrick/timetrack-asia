const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is missing in .env.local!');
  process.exit(1);
}

const client = new Client({ connectionString });

async function seedUser(email, password, role, firstName, lastName, phone, fallbackId) {
  const checkQuery = `
    DO $$
    DECLARE
      user_id UUID;
    BEGIN
      SELECT id INTO user_id FROM auth.users WHERE email = '${email}';
      
      IF user_id IS NOT NULL THEN
        UPDATE auth.users 
        SET 
          encrypted_password = crypt('${password}', gen_salt('bf')),
          raw_user_meta_data = '{"role":"${role}","first_name":"${firstName}","last_name":"${lastName}","phone":"${phone}"}'::jsonb,
          email_confirmed_at = now()
        WHERE id = user_id;
        RAISE NOTICE 'Updated user %', '${email}';
      ELSE
        INSERT INTO auth.users (
          id, instance_id, email, encrypted_password, email_confirmed_at, 
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
          role, aud, confirmation_token
        )
        VALUES (
          '${fallbackId}',
          '00000000-0000-0000-0000-000000000000',
          '${email}',
          crypt('${password}', gen_salt('bf')),
          now(),
          '{"provider":"email","providers":["email"]}',
          '{"role":"${role}","first_name":"${firstName}","last_name":"${lastName}","phone":"${phone}"}',
          now(),
          now(),
          'authenticated',
          'authenticated',
          ''
        );
        RAISE NOTICE 'Inserted user %', '${email}';
      END IF;
    END $$;
  `;
  await client.query(checkQuery);
}

async function seed() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  try {
    // 1. Seed Admin User
    await seedUser(
      'admin@gmail.com',
      'admin123',
      'ADMIN',
      'System',
      'Admin',
      '+60111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
    console.log('Admin user (admin@gmail.com / admin123) verified/seeded.');

    // 2. Seed Organizer User
    await seedUser(
      'organizer@timetrack.asia',
      'organizer123',
      'ORGANIZER',
      'Race',
      'Organizer',
      '+60222222222',
      'oooooooo-oooo-oooo-oooo-oooooooooooo'
    );
    console.log('Organizer user (organizer@timetrack.asia / organizer123) verified/seeded.');

    // 3. Seed Test Athlete User
    await seedUser(
      'test@gmail.com',
      'test1234',
      'ATHLETE',
      'Test',
      'Athlete',
      '+60333333333',
      '11111111-1111-1111-1111-111111111111'
    );
    console.log('Athlete user (test@gmail.com / test1234) verified/seeded.');

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await client.end();
  }
}

seed();
