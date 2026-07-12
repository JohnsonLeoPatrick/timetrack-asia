'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getEventAnalyticsAction(eventId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const [regs, payments, participantsData, categoryData] = await Promise.all([
    supabase.from('registrations').select('status, total_amount, created_at').eq('event_id', eventId),
    supabase.from('payments').select('amount, status, created_at')
      .in('registration_id', supabase.from('registrations').select('id').eq('event_id', eventId) as any),
    supabase.from('participants').select('gender, country, age, category_id, created_at')
      .in('registration_id', supabase.from('registrations').select('id').eq('event_id', eventId) as any),
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

  const eventIds = (events || []).map((e: any) => e.id);

  if (eventIds.length === 0) return { events: [], totalRegistrations: 0, totalRevenue: 0 };

  const { data: registrations } = await supabase
    .from('registrations')
    .select('status, total_amount, discount_amount, net_amount, created_at')
    .in('event_id', eventIds);

  const regs = registrations || [];
  const totalRevenue = regs.filter((r: any) => r.status === 'PAID').reduce((s: number, r: any) => s + Number(r.net_amount), 0);
  const totalRegistrations = regs.length;
  const pendingAmount = regs.filter((r: any) => r.status === 'PENDING').reduce((s: number, r: any) => s + Number(r.total_amount), 0);

  return {
    events: events || [],
    totalRegistrations,
    totalRevenue,
    pendingAmount,
    registrationTrend: regs,
  };
}

export async function getAdminAnalyticsAction() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const role = user.user_metadata?.role;
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') throw new Error('Forbidden');

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

export async function getSharedEventAnalyticsAction(token: string) {
  const supabase = await createSupabaseServerClient();
  
  // Find event by token
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, title, event_date, venue_name, city, country, cover_image')
    .eq('shareable_analytics_token', token)
    .is('deleted_at', null)
    .single();

  if (eventError || !event) throw new Error('Event not found or invalid token');

  const eventId = event.id;

  const [regs, participantsData, categoryData] = await Promise.all([
    supabase.from('registrations').select('status, total_amount, created_at').eq('event_id', eventId),
    supabase.from('participants').select('gender, country, age, created_at')
      .in('registration_id', supabase.from('registrations').select('id').eq('event_id', eventId) as any),
    supabase.from('event_categories').select('id, name, base_price, max_slots')
      .eq('event_id', eventId),
  ]);

  return {
    event,
    registrations: regs.data || [],
    participants: participantsData.data || [],
    categories: categoryData.data || [],
  };
}
