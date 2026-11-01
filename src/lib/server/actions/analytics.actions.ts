'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/server/auth/require-role';

export async function getEventAnalyticsAction(eventId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // PostgREST cannot nest a query builder inside `.in(...)`; resolve the
  // registration ids first, then filter the child tables by those ids.
  const { data: eventRegs } = await supabase
    .from('registrations')
    .select('id')
    .eq('event_id', eventId);
  const registrationIds = (eventRegs || []).map((r) => r.id);

  const [regs, payments, participantsData, categoryData] = await Promise.all([
    supabase.from('registrations').select('status, total_amount, created_at').eq('event_id', eventId),
    registrationIds.length
      ? supabase.from('payments').select('amount, status, created_at').in('registration_id', registrationIds)
      : Promise.resolve({ data: [] }),
    registrationIds.length
      ? supabase.from('participants').select('gender, category_id').in('registration_id', registrationIds)
      : Promise.resolve({ data: [] }),
    supabase.from('event_categories').select('id, name, base_price, max_slots')
      .eq('event_id', eventId),
  ]);

  return {
    registrations: regs.data || [],
    payments: payments.data || [],
    participants: participantsData.data || [],
    categories: categoryData.data || [],
  };
}

export async function getOrganizerAnalyticsAction() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: events } = await supabase
    .from('events')
    .select('id, title, event_date, status')
    .eq('organizer_id', user.id)
    .is('deleted_at', null);

  const eventIds = (events || []).map((e) => e.id);

  if (eventIds.length === 0) return { events: [], totalRegistrations: 0, totalRevenue: 0 };

  const { data: registrations } = await supabase
    .from('registrations')
    .select('status, total_amount, discount_amount, net_amount, created_at')
    .in('event_id', eventIds);

  const regs = registrations || [];
  const totalRevenue = regs.filter((r) => r.status === 'PAID').reduce((s: number, r) => s + Number(r.net_amount), 0);
  const totalRegistrations = regs.length;
  const pendingAmount = regs.filter((r) => r.status === 'PENDING').reduce((s: number, r) => s + Number(r.total_amount), 0);

  return {
    events: events || [],
    totalRegistrations,
    totalRevenue,
    pendingAmount,
    registrationTrend: regs,
  };
}

export async function getAdminAnalyticsAction() {
  await requireRole(['ADMIN', 'SUPER_ADMIN']);
  const supabase = await createSupabaseServerClient();

  const [events, users, regs, payments] = await Promise.all([
    supabase.from('events').select('id, status, event_date').is('deleted_at', null),
    supabase.from('users').select('id, role, status').is('deleted_at', null),
    supabase.from('registrations').select('status, net_amount'),
    supabase.from('payments').select('amount, status, created_at'),
  ]);

  return {
    totalEvents: events.data?.length || 0,
    totalUsers: users.data?.length || 0,
    eventsByStatus: events.data || [],
    usersByRole: users.data || [],
    registrations: regs.data || [],
    payments: payments.data || [],
  };
}
