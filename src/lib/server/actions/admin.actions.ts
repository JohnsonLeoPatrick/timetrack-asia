'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function adminUpdateUserRoleAction(userId: string, newRole: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const role = user.user_metadata?.role || (await supabase.from('users').select('role').eq('id', user.id).single()).data?.role;
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') throw new Error('Forbidden');

  // Update in public.users
  const { error } = await supabase
    .from('users')
    .eq('id', userId)
    .update({ role: newRole });

  if (error) throw new Error(error.message);

  // Update in auth.users metadata
  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { role: newRole },
  });

  revalidatePath('/admin/dashboard', 'page');
}

export async function adminToggleUserStatusAction(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const role = user.user_metadata?.role;
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') throw new Error('Forbidden');

  const { error } = await supabase
    .from('users')
    .eq('id', userId)
    .update({ status });

  if (error) throw new Error(error.message);

  if (status === 'BANNED') {
    await supabase.auth.admin.deleteUser(userId);
  }

  revalidatePath('/admin/dashboard', 'page');
}

export async function adminDeleteUserAction(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const role = user.user_metadata?.role;
  if (role !== 'SUPER_ADMIN') throw new Error('Forbidden');

  await supabase.from('users').eq('id', userId).update({ deleted_at: new Date().toISOString(), status: 'BANNED' });
  await supabase.auth.admin.deleteUser(userId);

  revalidatePath('/admin/dashboard', 'page');
}

export async function adminSystemAction(action: string, metadata?: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const role = user.user_metadata?.role;
  if (role !== 'SUPER_ADMIN') throw new Error('Forbidden');

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action,
    module: 'admin',
    metadata: metadata || null,
  });

  revalidatePath('/admin/dashboard', 'page');
}

export async function generateOrganizerCodeAction() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const role = user.user_metadata?.role || (await supabase.from('users').select('role').eq('id', user.id).single()).data?.role;
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') throw new Error('Forbidden');

  const code = 'ORG-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const { error } = await supabase.from('organizer_codes').insert({
    code,
    created_by: user.id
  });

  if (error) throw new Error(error.message);

  revalidatePath('/admin/dashboard', 'page');
  return code;
}

export async function generateCertificateAction(eventId: string, userId: string, participantName: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  const role = user.user_metadata?.role || userData?.role;
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'ORGANIZER') throw new Error('Forbidden');

  const { data, error } = await supabase.from('certificates').insert({
    event_id: eventId,
    user_id: userId,
    participant_name: participantName,
  }).select('id').single();

  if (error) throw new Error(error.message);

  return data.id;
}

export async function adminCreateUserAction(
  email: string,
  password: string,
  role: 'SUPER_ADMIN' | 'ADMIN' | 'ORGANIZER' | 'ATHLETE',
  firstName: string,
  lastName: string,
  phone?: string
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const adminRole = user.user_metadata?.role || (await supabase.from('users').select('role').eq('id', user.id).single()).data?.role;
  if (adminRole !== 'SUPER_ADMIN' && adminRole !== 'ADMIN') throw new Error('Forbidden');

  if ((role === 'ADMIN' || role === 'SUPER_ADMIN') && adminRole !== 'SUPER_ADMIN') {
    throw new Error('Only Super Admins can create Admin/Super Admin accounts');
  }

  const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role,
      first_name: firstName,
      last_name: lastName,
      phone: phone || '',
    }
  });

  if (authError) throw new Error(authError.message);

  await supabase
    .from('users')
    .update({ role, first_name: firstName, last_name: lastName, phone: phone || '' })
    .eq('id', newAuthUser.user.id);

  revalidatePath('/admin/dashboard', 'page');
  return { success: true, userId: newAuthUser.user.id };
}
