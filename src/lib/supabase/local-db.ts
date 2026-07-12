// Dynamic server-only imports
const getFs = () => (typeof window === 'undefined' ? require('fs') : null);
const getPath = () => (typeof window === 'undefined' ? require('path') : null);

// Local DB file path
const getDbFilePath = () => {
  const p = getPath();
  return p ? p.join(process.cwd(), 'src/lib/supabase/db-store.json') : '';
};

// Helper to load database
function loadDb(): any {
  try {
    const fs = getFs();
    const filePath = getDbFilePath();
    if (fs && filePath && fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const db = JSON.parse(data);
      let updated = false;
      if (db.users) {
        if (!db.users.some((u: any) => u.email === 'root@gmail.com')) {
          db.users.push({ id: 'admin_test', email: 'root@gmail.com', role: 'ADMIN', status: 'ACTIVE' });
          updated = true;
        }
        if (!db.users.some((u: any) => u.email === 'admin@gmail.com')) {
          db.users.push({ id: 'admin_test_2', email: 'admin@gmail.com', role: 'ADMIN', status: 'ACTIVE' });
          updated = true;
        }
        if (!db.users.some((u: any) => u.email === 'test@gmail.com')) {
          db.users.push({ id: 'user_test', email: 'test@gmail.com', role: 'ATHLETE', status: 'ACTIVE' });
          updated = true;
        }
      }
      if (updated) {
        saveDb(db);
      }
      return db;
    }
  } catch (e) {
    console.error('Error loading local DB file, using memory:', e);
  }
  
  // Seed initial mock database structure if not exists
  const initialDb = {
    events: [
      {
        id: 'evt_1',
        title: 'Kuala Lumpur Marathon 2026',
        slug: 'kl-marathon-2026',
        description: 'The premier marathon event in Malaysia.',
        event_date: '2026-10-12T07:00:00Z',
        registration_open: '2026-06-01T00:00:00Z',
        registration_close: '2026-09-30T23:59:59Z',
        venue_name: 'Dataran Merdeka',
        city: 'Kuala Lumpur',
        status: 'LIVE',
        deleted_at: null,
        organizer_id: 'org_1',
        cover_image: 'https://images.unsplash.com/photo-1502224562085-639556652f33?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: 'evt_2',
        title: 'Penang Bridge International Bridge Run',
        slug: 'penang-bridge-run-2026',
        description: 'Run across the iconic Penang Bridge.',
        event_date: '2026-11-22T06:00:00Z',
        registration_open: '2026-06-15T00:00:00Z',
        registration_close: '2026-10-31T23:59:59Z',
        venue_name: 'Queensbay Mall',
        city: 'Penang',
        status: 'LIVE',
        deleted_at: null,
        organizer_id: 'org_1',
        cover_image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: 'evt_3',
        title: 'Melaka Ultra Challenge',
        slug: 'melaka-ultra-2026',
        description: 'Test your limits in historical Melaka.',
        event_date: '2026-05-15T05:00:00Z',
        registration_open: '2026-01-01T00:00:00Z',
        registration_close: '2026-04-30T23:59:59Z',
        venue_name: 'Stadthuys',
        city: 'Melaka',
        status: 'COMPLETED',
        deleted_at: null,
        organizer_id: 'org_1',
        cover_image: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?q=80&w=600&auto=format&fit=crop'
      }
    ],
    event_categories: [
      { id: 'cat_1', event_id: 'evt_1', name: 'Full Marathon (42km)', base_price: '120.00', max_slots: 1000 },
      { id: 'cat_2', event_id: 'evt_1', name: 'Half Marathon (21km)', base_price: '80.00', max_slots: 1500 },
      { id: 'cat_3', event_id: 'evt_2', name: '10K Fun Run', base_price: '50.00', max_slots: 2000 },
      { id: 'cat_4', event_id: 'evt_3', name: '50K Ultra', base_price: '220.00', max_slots: 300 }
    ],
    registrations: [
      { id: 'reg_1', event_id: 'evt_1', athlete_id: 'user_test', category_id: 'cat_1', bib_number: '1004', total_amount: '120.00', status: 'CONFIRMED', created_at: '2026-06-18T10:00:00Z' },
      { id: 'reg_2', event_id: 'evt_2', athlete_id: 'user_test', category_id: 'cat_3', bib_number: '2055', total_amount: '50.00', status: 'CONFIRMED', created_at: '2026-06-19T14:30:00Z' },
      { id: 'reg_3', event_id: 'evt_1', athlete_id: 'user_1', category_id: 'cat_2', bib_number: '2001', total_amount: '80.00', status: 'CONFIRMED', created_at: '2026-06-18T11:00:00Z' }
    ],
    payments: [],
    participants: [],
    results: [
      { id: 'res_1', event_id: 'evt_3', bib_number: '5001', athlete_name: 'John Doe', finish_time: '04:12:35', overall_rank: 1, category_name: '50K Ultra', age_group: 'Men Open' },
      { id: 'res_2', event_id: 'evt_3', bib_number: '5002', athlete_name: 'Jane Smith', finish_time: '04:25:12', overall_rank: 2, category_name: '50K Ultra', age_group: 'Women Open' },
      { id: 'res_3', event_id: 'evt_3', bib_number: '5003', athlete_name: 'Ahmad bin Ali', finish_time: '04:38:40', overall_rank: 3, category_name: '50K Ultra', age_group: 'Men Open' }
    ],
    coupons: [],
    users: [
      { id: 'org_1', email: 'organizer@timetrack.asia', role: 'ORGANIZER', status: 'ACTIVE' },
      { id: 'user_1', email: 'athlete@timetrack.asia', role: 'ATHLETE', status: 'ACTIVE' },
      { id: 'user_test', email: 'test@gmail.com', role: 'ATHLETE', status: 'ACTIVE' },
      { id: 'admin_test', email: 'root@gmail.com', role: 'ADMIN', status: 'ACTIVE' },
      { id: 'admin_test_2', email: 'admin@gmail.com', role: 'ADMIN', status: 'ACTIVE' }
    ],
    organizer_codes: [],
    audit_logs: [],
    email_queue: []
  };

  saveDb(initialDb);
  return initialDb;
}

// Helper to save database
function saveDb(db: any) {
  try {
    const fs = getFs();
    const path = getPath();
    const filePath = getDbFilePath();
    if (fs && path && filePath) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf8');
    }
  } catch (e) {
    console.error('Error saving local DB file:', e);
  }
}

// In-Memory fallback for client-side usage (since FS is not available in browser)
let clientMemoryDb: any = null;
function getClientDb(): any {
  if (typeof window === 'undefined') {
    return loadDb();
  }
  if (!clientMemoryDb) {
    // Attempt to load from localStorage, fallback to default seed
    try {
      const stored = localStorage.getItem('timetrack_local_db');
      if (stored) {
        clientMemoryDb = JSON.parse(stored);
      }
    } catch {}
    if (!clientMemoryDb) {
      clientMemoryDb = {
        events: [
          {
            id: 'evt_1',
            title: 'Kuala Lumpur Marathon 2026',
            slug: 'kl-marathon-2026',
            description: 'The premier marathon event in Malaysia.',
            event_date: '2026-10-12T07:00:00Z',
            registration_open: '2026-06-01T00:00:00Z',
            registration_close: '2026-09-30T23:59:59Z',
            venue_name: 'Dataran Merdeka',
            city: 'Kuala Lumpur',
            status: 'LIVE',
            deleted_at: null,
            organizer_id: 'org_1',
            cover_image: 'https://images.unsplash.com/photo-1502224562085-639556652f33?q=80&w=600&auto=format&fit=crop'
          },
          {
            id: 'evt_2',
            title: 'Penang Bridge International Bridge Run',
            slug: 'penang-bridge-run-2026',
            description: 'Run across the iconic Penang Bridge.',
            event_date: '2026-11-22T06:00:00Z',
            registration_open: '2026-06-15T00:00:00Z',
            registration_close: '2026-10-31T23:59:59Z',
            venue_name: 'Queensbay Mall',
            city: 'Penang',
            status: 'LIVE',
            deleted_at: null,
            organizer_id: 'org_1',
            cover_image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?q=80&w=600&auto=format&fit=crop'
          },
          {
            id: 'evt_3',
            title: 'Melaka Ultra Challenge',
            slug: 'melaka-ultra-2026',
            description: 'Test your limits in historical Melaka.',
            event_date: '2026-05-15T05:00:00Z',
            registration_open: '2026-01-01T00:00:00Z',
            registration_close: '2026-04-30T23:59:59Z',
            venue_name: 'Stadthuys',
            city: 'Melaka',
            status: 'COMPLETED',
            deleted_at: null,
            organizer_id: 'org_1',
            cover_image: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?q=80&w=600&auto=format&fit=crop'
          }
        ],
        event_categories: [
          { id: 'cat_1', event_id: 'evt_1', name: 'Full Marathon (42km)', base_price: '120.00', max_slots: 1000 },
          { id: 'cat_2', event_id: 'evt_1', name: 'Half Marathon (21km)', base_price: '80.00', max_slots: 1500 },
          { id: 'cat_3', event_id: 'evt_2', name: '10K Fun Run', base_price: '50.00', max_slots: 2000 },
          { id: 'cat_4', event_id: 'evt_3', name: '50K Ultra', base_price: '220.00', max_slots: 300 }
        ],
        registrations: [
          { id: 'reg_1', event_id: 'evt_1', athlete_id: 'user_test', category_id: 'cat_1', bib_number: '1004', total_amount: '120.00', status: 'CONFIRMED', created_at: '2026-06-18T10:00:00Z' },
          { id: 'reg_2', event_id: 'evt_2', athlete_id: 'user_test', category_id: 'cat_3', bib_number: '2055', total_amount: '50.00', status: 'CONFIRMED', created_at: '2026-06-19T14:30:00Z' },
          { id: 'reg_3', event_id: 'evt_1', athlete_id: 'user_1', category_id: 'cat_2', bib_number: '2001', total_amount: '80.00', status: 'CONFIRMED', created_at: '2026-06-18T11:00:00Z' }
        ],
        payments: [],
        participants: [],
        results: [
          { id: 'res_1', event_id: 'evt_3', bib_number: '5001', athlete_name: 'John Doe', finish_time: '04:12:35', overall_rank: 1, category_name: '50K Ultra', age_group: 'Men Open' },
          { id: 'res_2', event_id: 'evt_3', bib_number: '5002', athlete_name: 'Jane Smith', finish_time: '04:25:12', overall_rank: 2, category_name: '50K Ultra', age_group: 'Women Open' },
          { id: 'res_3', event_id: 'evt_3', bib_number: '5003', athlete_name: 'Ahmad bin Ali', finish_time: '04:38:40', overall_rank: 3, category_name: '50K Ultra', age_group: 'Men Open' }
        ],
        coupons: [],
        users: [
          { id: 'org_1', email: 'organizer@timetrack.asia', role: 'ORGANIZER', status: 'ACTIVE' },
          { id: 'user_1', email: 'athlete@timetrack.asia', role: 'ATHLETE', status: 'ACTIVE' },
          { id: 'user_test', email: 'test@gmail.com', role: 'ATHLETE', status: 'ACTIVE' },
          { id: 'admin_test', email: 'root@gmail.com', role: 'ADMIN', status: 'ACTIVE' },
          { id: 'admin_test_2', email: 'admin@gmail.com', role: 'ADMIN', status: 'ACTIVE' }
        ],
        organizer_codes: [],
        audit_logs: [],
        email_queue: []
      };
      saveClientDb(clientMemoryDb);
    }
  }
  
  let clientUpdated = false;
  if (clientMemoryDb) {
    if (!clientMemoryDb.users.some((u: any) => u.email === 'root@gmail.com')) {
      clientMemoryDb.users.push({ id: 'admin_test', email: 'root@gmail.com', role: 'ADMIN', status: 'ACTIVE' });
      clientUpdated = true;
    }
    if (!clientMemoryDb.users.some((u: any) => u.email === 'admin@gmail.com')) {
      clientMemoryDb.users.push({ id: 'admin_test_2', email: 'admin@gmail.com', role: 'ADMIN', status: 'ACTIVE' });
      clientUpdated = true;
    }
    if (!clientMemoryDb.users.some((u: any) => u.email === 'test@gmail.com')) {
      clientMemoryDb.users.push({ id: 'user_test', email: 'test@gmail.com', role: 'ATHLETE', status: 'ACTIVE' });
      clientUpdated = true;
    }
  }
  if (clientUpdated) {
    saveClientDb(clientMemoryDb);
  }
  
  return clientMemoryDb;
}

function saveClientDb(db: any) {
  if (typeof window === 'undefined') {
    saveDb(db);
    return;
  }
  clientMemoryDb = db;
  try {
    localStorage.setItem('timetrack_local_db', JSON.stringify(db));
  } catch {}
}

class LocalQueryBuilder {
  private filters: ((row: any) => boolean)[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private isSingle = false;
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private opData: any = null;

  constructor(private table: string) {}

  select(fields?: string) {
    return this;
  }

  is(col: string, val: any) {
    if (val === null) {
      this.filters.push((row) => row[col] === null || row[col] === undefined);
    } else {
      this.filters.push((row) => row[col] === val);
    }
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((row) => row[col] == val);
    return this;
  }

  in(col: string, vals: any[]) {
    this.filters.push((row) => vals.includes(row[col]));
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  // Execute Query
  async then(resolve: any, reject: any) {
    if (this.operation === 'insert') {
      try {
        const db = getClientDb();
        if (!db[this.table]) db[this.table] = [];
        const toInsert = Array.isArray(this.opData) ? this.opData : [this.opData];
        const inserted = toInsert.map((item) => ({
          id: item.id || `${this.table.slice(0, 3)}_${Math.random().toString(36).substring(2, 9)}`,
          created_at: new Date().toISOString(),
          ...item
        }));
        db[this.table].push(...inserted);
        saveClientDb(db);

        if (this.isSingle) {
          return resolve({ data: inserted[0], error: null });
        }
        return resolve({ data: Array.isArray(this.opData) ? inserted : inserted[0], error: null });
      } catch (e: any) {
        return resolve({ data: null, error: { message: e.message } });
      }
    }

    if (this.operation === 'update') {
      try {
        const db = getClientDb();
        const rows = db[this.table] || [];
        db[this.table] = rows.map((row: any) => {
          if (this.filters.every((f) => f(row))) {
            return { ...row, ...this.opData, updated_at: new Date().toISOString() };
          }
          return row;
        });
        saveClientDb(db);
        return resolve({ data: null, error: null });
      } catch (e: any) {
        return resolve({ data: null, error: { message: e.message } });
      }
    }

    if (this.operation === 'delete') {
      try {
        const db = getClientDb();
        const rows = db[this.table] || [];
        db[this.table] = rows.filter((row: any) => {
          return !this.filters.every((f) => f(row));
        });
        saveClientDb(db);
        return resolve({ data: null, error: null });
      } catch (e: any) {
        return resolve({ data: null, error: { message: e.message } });
      }
    }

    try {
      const db = getClientDb();
      const rows = db[this.table] || [];
      let result = [...rows].filter((row) => {
        return this.filters.every((f) => f(row));
      });

      // Handle order
      if (this.orderCol) {
        result.sort((a, b) => {
          const valA = a[this.orderCol!];
          const valB = b[this.orderCol!];
          if (valA < valB) return this.orderAsc ? -1 : 1;
          if (valA > valB) return this.orderAsc ? 1 : -1;
          return 0;
        });
      }

      // Handle relations (e.g. event_categories on events)
      if (this.table === 'events') {
        const categories = db.event_categories || [];
        result = result.map((evt) => ({
          ...evt,
          event_categories: categories.filter((c: any) => c.event_id === evt.id)
        }));
      }

      if (this.table === 'registrations') {
        const events = db.events || [];
        const categories = db.event_categories || [];
        result = result.map((reg) => ({
          ...reg,
          events: events.find((e: any) => e.id === reg.event_id) || null,
          event_categories: categories.find((c: any) => c.id === reg.category_id) || null
        }));
      }

      if (this.limitCount !== null) {
        result = result.slice(0, this.limitCount);
      }

      if (this.isSingle) {
        return resolve({ data: result[0] || null, error: null });
      }

      return resolve({ data: result, error: null });
    } catch (e: any) {
      return resolve({ data: null, error: { message: e.message } });
    }
  }

  // Execute Insert Query
  insert(data: any) {
    this.operation = 'insert';
    this.opData = data;
    return this;
  }

  // Execute Update Query
  update(data: any) {
    this.operation = 'update';
    this.opData = data;
    return this;
  }

  // Execute Delete Query
  delete() {
    this.operation = 'delete';
    return this;
  }
}

// Active user session helpers
async function getActiveUser(): Promise<any> {
  if (typeof window === 'undefined') {
    try {
      const nextCookies = require('next/headers').cookies;
      const cookieStore = typeof nextCookies === 'function' ? await nextCookies() : nextCookies;
      const cookieVal = cookieStore.get('timetrack_local_session')?.value;
      if (cookieVal) {
        return JSON.parse(decodeURIComponent(cookieVal));
      }
    } catch (e) {
      // cookies() might not be available in some server contexts
    }
  } else {
    try {
      const stored = localStorage.getItem('timetrack_local_session');
      if (stored) return JSON.parse(stored);
    } catch {}
    
    try {
      const match = document.cookie.match(/(^| )timetrack_local_session=([^;]+)/);
      if (match) {
        return JSON.parse(decodeURIComponent(match[2]));
      }
    } catch {}
  }
  return null;
}

async function saveActiveUser(user: any) {
  const userStr = encodeURIComponent(JSON.stringify(user));
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('timetrack_local_session', JSON.stringify(user));
      document.cookie = `timetrack_local_session=${userStr}; path=/; max-age=604800`;
    } catch {}
  } else {
    try {
      const nextCookies = require('next/headers').cookies;
      const cookieStore = typeof nextCookies === 'function' ? await nextCookies() : nextCookies;
      cookieStore.set('timetrack_local_session', userStr, { path: '/', maxAge: 604800 });
    } catch {}
  }
}

async function clearActiveUser() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('timetrack_local_session');
      document.cookie = 'timetrack_local_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    } catch {}
  } else {
    try {
      const nextCookies = require('next/headers').cookies;
      const cookieStore = typeof nextCookies === 'function' ? await nextCookies() : nextCookies;
      cookieStore.delete('timetrack_local_session');
    } catch {}
  }
}

// Mock Supabase Client Object
export function createLocalSupabaseClient() {
  return {
    from: (table: string) => {
      return new LocalQueryBuilder(table);
    },
    auth: {
      getUser: async () => {
        const user = await getActiveUser();
        return { data: { user }, error: null };
      },
      getSession: async () => {
        const user = await getActiveUser();
        if (!user) return { data: { session: null }, error: null };
        return {
          data: {
            session: {
              access_token: 'local-token',
              refresh_token: 'local-refresh-token',
              expires_in: 3600,
              token_type: 'bearer',
              user: user
            }
          },
          error: null
        };
      },
      signUp: async ({ email, password, options }: any) => {
        const newUser = {
          id: `usr_${Math.random().toString(36).substring(2, 9)}`,
          email,
          user_metadata: options?.data || { role: 'ATHLETE' }
        };
        const db = getClientDb();
        db.users.push({
          id: newUser.id,
          email: newUser.email,
          role: newUser.user_metadata.role || 'ATHLETE',
          status: 'ACTIVE'
        });
        saveClientDb(db);
        
        await saveActiveUser(newUser);
        return { data: { user: newUser, session: { access_token: 'local-token', user: newUser } }, error: null };
      },
      signInWithPassword: async ({ email }: any) => {
        const db = getClientDb();
        const found = db.users.find((u: any) => u.email === email);
        const loggedInUser = found ? {
          id: found.id,
          email: found.email,
          user_metadata: { role: found.role }
        } : {
          id: 'user_1',
          email,
          user_metadata: { role: 'ATHLETE' }
        };
        
        await saveActiveUser(loggedInUser);
        return { data: { user: loggedInUser, session: { access_token: 'local-token', user: loggedInUser } }, error: null };
      },
      signOut: async () => {
        await clearActiveUser();
        return { error: null };
      },
      onAuthStateChange: (callback: any) => {
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
    }
  } as any;
}

