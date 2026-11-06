'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

async function account() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Please sign in to register');
  return { client, user };
}

export async function getRunnerCheckoutAction(eventId: string) {
  const { client, user } = await account();
  await client.from('runner_checkout_drafts').delete().eq('user_id', user.id).lt('expires_at', new Date().toISOString());
  const [profile, draft] = await Promise.all([
    client.from('runner_profiles').select('personal, billing').eq('user_id', user.id).maybeSingle(),
    client.from('runner_checkout_drafts').select('payload').eq('user_id', user.id).eq('event_id', eventId).gt('expires_at', new Date().toISOString()).maybeSingle(),
  ]);
  if (profile.error || draft.error) throw new Error('Saved details could not be loaded. Please retry.');
  return { personal: profile.data?.personal || {}, billing: profile.data?.billing || {}, draft: draft.data?.payload || null };
}

export async function saveRunnerDraftAction(eventId: string, payload: unknown) {
  const { client, user } = await account();
  const parsed = z.object({ checkout_key: z.uuid(), participants: z.array(z.record(z.string(), z.unknown())).max(100), billing: z.record(z.string(), z.unknown()), step: z.number().int().min(1).max(3) }).parse(payload);
  if (JSON.stringify(parsed).length > 300000) throw new Error('Checkout draft is too large');
  // Consent is always fresh, including after a refresh. Medical information stays in the private database.
  parsed.billing.terms_accepted = false; parsed.billing.policy_accepted = false;
  for (const person of parsed.participants) {
    if (!person.medical_acknowledged) { delete person.medical_details; person.medical_status = null; }
    person.medical_acknowledged = false;
  }
  const { error } = await client.from('runner_checkout_drafts').upsert({ user_id: user.id, event_id: eventId, payload: parsed, expires_at: new Date(Date.now() + 86400000).toISOString() }, { onConflict: 'user_id,event_id' });
  if (error) throw new Error('Draft could not be saved');
}

export async function clearRunnerDataAction() {
  const { client, user } = await account();
  const { error } = await client.from('runner_profiles').delete().eq('user_id', user.id);
  const { error: draftError } = await client.from('runner_checkout_drafts').delete().eq('user_id', user.id);
  if (error || draftError) throw new Error('Saved details could not be removed');
  revalidatePath('/profile');
}

export async function updateParticipantSafetyAction(participantId: string, input: unknown) {
  const { client } = await account();
  const parsed = z.object({ emergency_name: z.string().trim().min(1).max(255), emergency_phone: z.string().trim().min(8).max(50), emergency_relationship: z.string().trim().min(1).max(100), medical_status: z.boolean(), medical_details: z.string().trim().max(2000), medical_acknowledged: z.literal(true) }).parse(input);
  if (parsed.medical_status && !parsed.medical_details) throw new Error('Describe the medical condition');
  if (!parsed.medical_status) parsed.medical_details = '';
  const { error } = await client.rpc('update_participant_safety', { p_participant_id: z.uuid().parse(participantId), p_details: parsed });
  if (error) throw new Error(error.message);
  revalidatePath('/profile');
}
