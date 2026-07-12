const { Client } = require('pg');
const dbConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

const oldId = '11111111-1111-1111-1111-111111111111';
const newId = '380ef310-54f7-4398-8314-c3f7d8a78ee2'; // test@gmail.com ID in auth.users
const hash = '$2a$10$.JvM36FvERS6XXKObPWB6O1aG.3JeOrcLlWhBP5CZbgzBZ/szTafG'; // hash for 'TimeTrack2026!'

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  try {
    await client.connect();
    console.log('Connected to database.');

    await client.query('BEGIN');
    
    // 1. Disable constraints
    console.log('Disabling triggers and constraints...');
    await client.query("SET session_replication_role = 'replica';");

    // 2. Update public.users id
    console.log(`Updating public.users id from ${oldId} to ${newId}...`);
    const userUpdateRes = await client.query(
      'UPDATE public.users SET id = $1 WHERE id = $2',
      [newId, oldId]
    );
    console.log(`Updated ${userUpdateRes.rowCount} user rows.`);

    // 3. Update referencing tables
    const refUpdates = [
      { table: 'public.events', col: 'organizer_id' },
      { table: 'public.form_templates', col: 'organizer_id' },
      { table: 'public.registrations', col: 'athlete_id' },
      { table: 'public.participants', col: 'checked_in_by' },
      { table: 'public.audit_logs', col: 'user_id' },
      { table: 'public.staff_assignments', col: 'user_id' },
      { table: 'public.staff_assignments', col: 'assigned_by' },
      { table: 'public.notification_logs', col: 'user_id' },
      { table: 'public.user_notification_preferences', col: 'user_id' },
      { table: 'public.coupons', col: 'organizer_id' },
      { table: 'public.coupon_redemptions', col: 'user_id' },
      { table: 'public.organizer_codes', col: 'created_by' },
      { table: 'public.certificates', col: 'user_id' }
    ];

    for (const ref of refUpdates) {
      try {
        const res = await client.query(
          `UPDATE ${ref.table} SET "${ref.col}" = $1 WHERE "${ref.col}" = $2`,
          [newId, oldId]
        );
        if (res.rowCount > 0) {
          console.log(`Updated ${res.rowCount} rows in ${ref.table}.${ref.col}`);
        }
      } catch (err) {
        console.warn(`Could not update references in ${ref.table}.${ref.col}:`, err.message);
      }
    }

    // 4. Re-enable constraints
    console.log('Re-enabling triggers and constraints...');
    await client.query("SET session_replication_role = 'origin';");

    // 5. Update auth.users passwords
    console.log('Updating passwords in auth.users...');
    const authUpdateRes = await client.query(
      `UPDATE auth.users 
       SET encrypted_password = $1, email_confirmed_at = COALESCE(email_confirmed_at, NOW())
       WHERE email IN ('athlete@timetrack.asia', 'admin@timetrack.asia', 'organizer@timetrack.asia', 'test@gmail.com', 'user@gmail.com', 'organizer@gmail.com', 'admin@gmail.com')`,
      [hash]
    );
    console.log(`Updated ${authUpdateRes.rowCount} users in auth.users.`);

    // 6. Clean up temporary reference users
    const deleteResult = await client.query(
      `DELETE FROM auth.users WHERE email LIKE 'temp_pepper_ref_%'`
    );
    console.log(`Cleaned up ${deleteResult.rowCount} temporary users.`);

    await client.query('COMMIT');
    console.log('Transaction committed successfully.');

  } catch (err) {
    console.error('Transaction failed, rolling back:', err);
    try {
      await client.query('ROLLBACK');
    } catch {}
  } finally {
    await client.end();
  }
}

run();
