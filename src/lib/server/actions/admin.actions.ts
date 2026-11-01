'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/server/auth/require-role';
import { revalidatePath } from 'next/cache';

export async function adminUpdateUserRoleAction(userId: string, newRole: string) {
  const caller = await requireRole(['SUPER_ADMIN', 'ADMIN']);

  const allowedRoles = ['ATHLETE', 'ORGANIZER', 'ADMIN', 'SUPER_ADMIN', 'DEVELOPER'];
  if (!allowedRoles.includes(newRole)) throw new Error('Invalid role');

  const admin = await createSupabaseAdminClient();
  const { data: target, error: targetError } = await admin.from('users').select('role').eq('id', userId).single();
  if (targetError || !target) throw new Error('User not found');
  if (caller.user.id === userId) throw new Error('You cannot change your own role');
  if (caller.role !== 'SUPER_ADMIN' &&
      (['ADMIN', 'SUPER_ADMIN'].includes(target.role) || ['ADMIN', 'SUPER_ADMIN'].includes(newRole))) {
    throw new Error('Only super admins can manage administrator roles');
  }

  const { error } = await admin
    .from('users')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) throw new Error(error.message);

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: newRole },
  });
  if (authError) throw new Error(authError.message);

  revalidatePath('/admin/dashboard', 'page');
}

export async function adminToggleUserStatusAction(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') {
  const caller = await requireRole(['SUPER_ADMIN', 'ADMIN']);
  if (!['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) throw new Error('Invalid status');
  if (caller.user.id === userId) throw new Error('You cannot disable your own account');

  const admin = await createSupabaseAdminClient();
  const { data: target, error: targetError } = await admin.from('users').select('role').eq('id', userId).single();
  if (targetError || !target) throw new Error('User not found');
  if (caller.role !== 'SUPER_ADMIN' && ['ADMIN', 'SUPER_ADMIN'].includes(target.role)) throw new Error('Forbidden');

  const { error } = await admin
    .from('users')
    .update({ status })
    .eq('id', userId);

  if (error) throw new Error(error.message);

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: status === 'ACTIVE' ? 'none' : '876000h',
  });
  if (authError) throw new Error(authError.message);

  revalidatePath('/admin/dashboard', 'page');
}

export async function adminDeleteUserAction(userId: string) {
  const caller = await requireRole(['SUPER_ADMIN']);
  if (caller.user.id === userId) throw new Error('You cannot delete your own account');

  const admin = await createSupabaseAdminClient();

  await admin
    .from('users')
    .update({ deleted_at: new Date().toISOString(), status: 'BANNED' })
    .eq('id', userId);

  await admin.auth.admin.deleteUser(userId);

  revalidatePath('/admin/dashboard', 'page');
}

export async function adminSystemAction(action: string, metadata?: Record<string, unknown>) {
  const { user } = await requireRole(['SUPER_ADMIN']);

  const admin = await createSupabaseAdminClient();

  await admin.from('audit_logs').insert({
    user_id: user.id,
    action,
    module: 'admin',
    metadata: metadata || null,
  });

  revalidatePath('/admin/dashboard', 'page');
}

export async function adminHealthAction() {
  await requireRole(['ADMIN', 'SUPER_ADMIN']);
  const admin = await createSupabaseAdminClient();
  const [database, storage] = await Promise.all([
    admin.from('events').select('id', { count: 'exact', head: true }),
    admin.storage.listBuckets(),
  ]);
  return {
    database: database.error ? database.error.message : 'Connected',
    storage: storage.error ? storage.error.message : 'Connected',
    buckets: (storage.data || []).map((bucket: { name: string; public: boolean }) => ({ name: bucket.name, public: bucket.public })),
  };
}

export async function generateOrganizerCodeAction() {
  const { user } = await requireRole(['SUPER_ADMIN', 'ADMIN']);

  const admin = await createSupabaseAdminClient();

  // Cryptographically random, unambiguous code.
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const code = 'ORG-' + Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 8)
    .toUpperCase();

  const { error } = await admin.from('organizer_codes').insert({
    code,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath('/admin/dashboard', 'page');
  return code;
}

export async function generateCertificateAction(eventId: string, userId: string, participantName: string) {
  const caller = await requireRole(['SUPER_ADMIN', 'ADMIN', 'ORGANIZER']);

  const admin = await createSupabaseAdminClient();
  if (caller.role === 'ORGANIZER') {
    const { data: event, error } = await admin.from('events').select('organizer_id').eq('id', eventId).single();
    if (error || event?.organizer_id !== caller.user.id) throw new Error('Forbidden');
  }

  const { data, error } = await admin.from('certificates').insert({
    event_id: eventId,
    user_id: userId,
    participant_name: participantName,
  }).select('id').single();

  if (error) throw new Error(error.message);

  return data.id;
}
