'use server';

import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const requestedRedirect = String(formData.get('redirectTo') || '/');
  const redirectTo = requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//') && !requestedRedirect.includes('\\') ? requestedRedirect : '/';

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  revalidatePath('/', 'layout');
  redirect(redirectTo);
}

export async function signUpAction(formData: FormData): Promise<{ error?: string }> {
  const email = ((formData.get('email') as string | null) || '').trim();
  const password = (formData.get('password') as string | null) || '';
  const firstName = (formData.get('firstName') as string | null) || '';
  const lastName = (formData.get('lastName') as string | null) || '';
  const requestedRole = formData.get('role') as string | null;
  const organizerCode = ((formData.get('organizerCode') as string | null) || '').trim();

  if (!email || !password) return { error: 'Email and password are required' };

  // Public signups can never self-assign a privileged role. The only way to
  // become an ORGANIZER is a valid access code validated here, server-side.
  const wantsOrganizer = requestedRole === 'ORGANIZER';
  let organizerCodeId: string | null = null;

  if (wantsOrganizer) {
    if (!organizerCode) return { error: 'An organizer access code is required' };
    const admin = await createSupabaseAdminClient();
    const { data: codeRow } = await admin
      .from('organizer_codes')
      .select('id')
      .eq('code', organizerCode)
      .eq('is_active', true)
      .maybeSingle();
    if (!codeRow) return { error: 'Invalid or expired organizer access code' };
    organizerCodeId = codeRow.id;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Role is intentionally omitted: handle_new_user() creates every account
      // as ATHLETE and never trusts client-supplied metadata.
      data: { first_name: firstName, last_name: lastName },
    },
  });

  if (error) return { error: error.message };

  // Only a validated, still-active code can promote the account, and only
  // through the service-role client. The code is consumed atomically after use.
  if (wantsOrganizer && organizerCodeId && data.user) {
    const admin = await createSupabaseAdminClient();
    const { error: roleError } = await admin.rpc('claim_organizer_code', {
      p_code_id: organizerCodeId, p_user_id: data.user.id,
    });
    if (roleError) return { error: roleError.message };

  }

  revalidatePath('/', 'layout');
  return {};
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function resetPasswordAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = formData.get('email') as string;

  const host = (await headers()).get('x-forwarded-host') || (await headers()).get('host') || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${protocol}://${host}/reset-password`,
  });

  if (error) throw new Error(error.message);
}

export async function updateProfileAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const username = String(formData.get('username') || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(username)) throw new Error('Use 3–32 letters, numbers, or underscores');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data, error } = await supabase.from('users').update({ username }).eq('id', user.id).eq('status', 'ACTIVE').is('deleted_at', null).select('id').single();
  if (error?.code === '23505') throw new Error('That username is already taken');
  if (error || !data) throw new Error('Could not update your username');
  revalidatePath('/', 'layout');
}
