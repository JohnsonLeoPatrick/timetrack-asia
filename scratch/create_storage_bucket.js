const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is missing in .env.local!');
  process.exit(1);
}

const client = new Client({ connectionString });

async function createBucket() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  const sql = `
    -- 1. Create the bucket
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('events', 'events', TRUE, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])
    ON CONFLICT (id) DO NOTHING;

    -- 2. Drop existing policies to avoid collisions
    DROP POLICY IF EXISTS "Allow public read access on events bucket" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to upload to events bucket" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to update events bucket" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to delete from events bucket" ON storage.objects;

    -- 3. Create policies for the 'events' bucket
    CREATE POLICY "Allow public read access on events bucket"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'events');

    CREATE POLICY "Allow authenticated users to upload to events bucket"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'events');

    CREATE POLICY "Allow authenticated users to update events bucket"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'events')
    WITH CHECK (bucket_id = 'events');

    CREATE POLICY "Allow authenticated users to delete from events bucket"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'events');
  `;

  try {
    await client.query(sql);
    console.log("Successfully created 'events' storage bucket and configured RLS policies.");
  } catch (error) {
    console.error('Error creating storage bucket/policies:', error);
  } finally {
    await client.end();
  }
}

createBucket();
