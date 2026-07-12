const { Client } = require('pg');

const oldConnectionString = 'postgresql://postgres:Benben1-123-@db.mmnduinqjogqmmlpmong.supabase.co:5432/postgres';
const newConnectionString = 'postgresql://postgres:Benben1-1010-@db.boajqnifcctfqclxxqgm.supabase.co:5432/postgres';

const tables = [
  'auth.users',
  'auth.identities',
  'public.users',
  'public.events',
  'public.event_categories',
  'public.category_addons',
  'public.addon_options',
  'public.event_gallery',
  'public.form_templates',
  'public.registrations',
  'public.billing_details',
  'public.participants',
  'public.participant_addons',
  'public.payments',
  'public.invoices',
  'public.refunds',
  'public.payment_gateways',
  'public.results',
  'public.audit_logs',
  'public.staff_assignments',
  'public.notification_templates',
  'public.notification_logs',
  'public.user_notification_preferences',
  'public.coupons',
  'public.coupon_redemptions',
  'public.email_queue'
];

async function getWritableColumns(client, schema, tableName) {
  const query = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = $1 
      AND table_name = $2 
      AND is_generated = 'NEVER';
  `;
  const result = await client.query(query, [schema, tableName]);
  return result.rows.map(r => r.column_name);
}

async function runMigration() {
  const clientOld = new Client({ connectionString: oldConnectionString });
  const clientNew = new Client({ connectionString: newConnectionString });

  await clientOld.connect();
  await clientNew.connect();

  console.log('Connected to both databases.');

  try {
    // 1. Disable triggers and foreign keys temporarily on target database for bulk insert
    console.log('Temporarily disabling triggers/constraints on the target database...');
    await clientNew.query("SET session_replication_role = 'replica';");

    // 2. Clear out any seeded/existing data in public/auth tables in target to avoid duplicates
    console.log('Clearing existing data from target tables to prevent duplicates...');
    for (const table of [...tables].reverse()) {
      console.log(`Clearing ${table}...`);
      await clientNew.query(`TRUNCATE TABLE ${table} CASCADE;`);
    }

    // 3. Copy data table by table
    for (const table of tables) {
      console.log(`Migrating data for table: ${table}...`);
      const parts = table.split('.');
      const schema = parts[0];
      const tableName = parts[1];

      // Get columns that are writable (exclude generated columns)
      const writableColumns = await getWritableColumns(clientOld, schema, tableName);
      if (writableColumns.length === 0) {
        console.log(`No writable columns found for ${table}. Skipping.`);
        continue;
      }

      console.log(`Writable columns for ${table}:`, writableColumns.join(', '));

      // Fetch only writable columns from old database
      const selectCols = writableColumns.map(c => `"${c}"`).join(', ');
      const selectResult = await clientOld.query(`SELECT ${selectCols} FROM ${table}`);
      const rows = selectResult.rows;
      
      if (rows.length === 0) {
        console.log(`Table ${table} has no data. Skipping.`);
        continue;
      }

      console.log(`Found ${rows.length} rows in ${table}. Transferring...`);

      // Construct a parameterized bulk insert query
      for (const row of rows) {
        const colNames = writableColumns.map(c => `"${c}"`).join(', ');
        const placeholders = writableColumns.map((_, i) => `$${i + 1}`).join(', ');
        
        // Map and stringify objects/arrays to JSON strings
        const values = writableColumns.map(col => {
          const val = row[col];
          if (val !== null && typeof val === 'object') {
            if (typeof val.toPostgres === 'function') {
              return val.toPostgres();
            }
            // Check if it's an interval object
            if ('hours' in val || 'minutes' in val || 'seconds' in val || 'days' in val) {
              const parts = [];
              if (val.years) parts.push(`${val.years} years`);
              if (val.months) parts.push(`${val.months} months`);
              if (val.days) parts.push(`${val.days} days`);
              if (val.hours) parts.push(`${val.hours} hours`);
              if (val.minutes) parts.push(`${val.minutes} minutes`);
              if (val.seconds) parts.push(`${val.seconds} seconds`);
              return parts.length > 0 ? parts.join(' ') : '0';
            }
            return JSON.stringify(val);
          }
          return val;
        });

        const insertQuery = `INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`;
        await clientNew.query(insertQuery, values);
      }
      console.log(`Successfully migrated ${rows.length} rows to ${table}.`);
    }

    // 4. Re-enable triggers and foreign keys
    console.log('Re-enabling triggers/constraints on the target database...');
    await clientNew.query("SET session_replication_role = 'origin';");

    console.log('Data migration complete! All pre-existing user accounts and data have been migrated.');
  } catch (err) {
    console.error('Migration failed:', err);
    // Attempt to restore replication role in case of failure
    try {
      await clientNew.query("SET session_replication_role = 'origin';");
    } catch {}
  } finally {
    await clientOld.end();
    await clientNew.end();
  }
}

runMigration();
