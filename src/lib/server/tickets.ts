import { createHmac, timingSafeEqual } from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';

export type EntryPayment = {
  id: string; status: string; currency: string; amount: number | string; created_at: string;
  deleted_at?: string | null; metadata: { is_test?: boolean } | null;
};
export type EntryParticipant = { id: string; full_name: string; bib_number: string | null; deleted_at: string | null };
type BillingDetails = { first_name: string; email: string; phone: string };
export type OwnedRegistration = {
  id: string; status: string; registration_number: string; persons_count: number;
  net_amount: number | string; total_amount: number | string; discount_amount: number | string;
  events: { title: string; event_date: string; venue_name: string; cover_image: string | null } | null;
  participants: EntryParticipant[]; payments: EntryPayment[];
  billing_details: BillingDetails | BillingDetails[] | null;
};

export function ticketToken(participantId: string) {
  const secret = process.env.QR_SECRET;
  if (!secret || secret.length < 32) throw new Error('Ticket signing is not configured');
  return `${participantId}.${createHmac('sha256', secret).update(`ticket:v1:${participantId}`).digest('base64url')}`;
}

export function verifyTicketToken(token: string) {
  const [id] = token.split('.');
  if (!z.uuid().safeParse(id).success || token.length > 100) return null;
  const expected = Buffer.from(ticketToken(id));
  const supplied = Buffer.from(token);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied) ? id : null;
}

export async function ownedRegistration(id: string): Promise<OwnedRegistration> {
  if (!z.uuid().safeParse(id).success) notFound();
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await client.from('users').select('status, deleted_at').eq('id', user.id).single();
  if (profile?.status !== 'ACTIVE' || profile.deleted_at) notFound();
  const { data: registration, error } = await client.from('registrations')
    .select('*, events(title, event_date, venue_name, cover_image), participants(id, full_name, bib_number, deleted_at), billing_details(*), payments(id, status, amount, currency, created_at, metadata, deleted_at)')
    .eq('id', id).eq('athlete_id', user.id).is('deleted_at', null).single();
  if (error || !registration) notFound();
  return registration as OwnedRegistration;
}

export function confirmedPayment(registration: Pick<OwnedRegistration, 'status' | 'payments' | 'net_amount'>) {
  return registration.status === 'PAID' ? (registration.payments || []).find(payment =>
    !payment.deleted_at && payment.status === 'SUCCESS' && payment.currency === 'MYR' && Number(payment.amount) === Number(registration.net_amount)) : undefined;
}
