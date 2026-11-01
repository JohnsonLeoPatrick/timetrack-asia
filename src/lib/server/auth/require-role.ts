import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Resolve the caller's role from public.users (the source of truth), never from
 * user-editable auth metadata, and assert it against an allow-list.
 */
export async function requireRole(allowed: string[]) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('users')
    .select('role, status, deleted_at')
    .eq('id', user.id)
    .single();

  if (error) throw new Error(error.message);
  if (data?.status !== 'ACTIVE' || data?.deleted_at) throw new Error('Account is inactive');

  const role = data?.role as string | undefined;
  if (!role || !allowed.includes(role)) throw new Error('Forbidden');

  return { user, role };
}
