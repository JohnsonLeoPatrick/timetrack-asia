const { Client } = require('pg');

require('dotenv').config({ path: '.env.local' });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const client = new Client({
  connectionString
});

async function seed() {
  await client.connect();

  try {
    // 1. Insert into auth.users using pgcrypto for password
    const authUserQuery = `
      INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token)
      VALUES (
        '11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'test@gmail.com',
        crypt('test', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"role":"ATHLETE","first_name":"Test","last_name":"User","phone":"+60123456789"}',
        now(),
        now(),
        'authenticated',
        'authenticated',
        ''
      )
      ON CONFLICT (id) DO UPDATE SET 
        encrypted_password = crypt('test', gen_salt('bf')),
        email_confirmed_at = now();
    `;
    await client.query(authUserQuery);
    console.log('Test user created in auth.users.');

    // 2. Create an event (needs to be organizer or admin - database trigger populated public.users for us)
    const eventQuery = `
      INSERT INTO events (id, organizer_id, status, title, slug, description, event_date, registration_open, registration_close, venue_name, city, country, max_participants)
      VALUES (
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        'LIVE',
        'Kuala Lumpur Marathon 2026',
        'kl-marathon-2026',
        'The biggest marathon in Southeast Asia.',
        '2026-10-10T00:00:00Z',
        '2026-01-01T00:00:00Z',
        '2026-09-30T00:00:00Z',
        'Dataran Merdeka',
        'Kuala Lumpur',
        'Malaysia',
        50000
      )
      ON CONFLICT (id) DO NOTHING;
    `;
    await client.query(eventQuery);
    console.log('Event created.');
    
    // 3. Create categories
    const catQuery = `
      INSERT INTO event_categories (id, event_id, name, base_price, max_slots)
      VALUES 
        ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Full Marathon 42KM', 120.00, 10000)
      ON CONFLICT (id) DO NOTHING;
    `;
    await client.query(catQuery);
    console.log('Event category created.');

    // 4. Create registration
    const regQuery = `
      INSERT INTO registrations (id, event_id, athlete_id, registration_number, status, total_amount, net_amount)
      VALUES (
        '55555555-5555-5555-5555-555555555555',
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        'TT-KLM26-0001',
        'CONFIRMED',
        120.00,
        120.00
      )
      ON CONFLICT (id) DO NOTHING;
    `;
    await client.query(regQuery);
    console.log('Registration created.');

    // 5. Create participant
    const partQuery = `
      INSERT INTO participants (id, registration_id, category_id, full_name, email, phone, gender, dob, ic_passport, country)
      VALUES (
        '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555555',
        '33333333-3333-3333-3333-333333333333',
        'Test User',
        'test@gmail.com',
        '+60123456789',
        'MALE',
        '1990-01-01',
        '900101-14-1234',
        'Malaysia'
      )
      ON CONFLICT (id) DO NOTHING;
    `;
    await client.query(partQuery);
    console.log('Participant created.');

    console.log('Dummy data seeded successfully.');
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await client.end();
  }
}

seed();
