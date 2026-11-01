'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/server/auth/require-role';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const couponSchema = z.object({
  code: z.string().min(3).max(100).transform(v => v.toUpperCase()),
  type: z.enum(['FIXED', 'PERCENTAGE', 'EARLY_BIRD']),
  value: z.number().positive(),
  max_uses: z.number().optional(),
  max_uses_per_user: z.number().default(1),
  min_order_amount: z.number().default(0),
  is_active: z.boolean().default(true),
  starts_at: z.string().optional(),
  expires_at: z.string().optional(),
  event_id: z.string().min(1).optional(),
});

export async function createCouponAction(formData: FormData) {
  const { user } = await requireRole(['ORGANIZER', 'ADMIN', 'SUPER_ADMIN']);
  const supabase = await createSupabaseServerClient();

  const parsed = couponSchema.parse({
    code: formData.get('code'),
    type: formData.get('type'),
    value: Number(formData.get('value')),
    max_uses: formData.get('max_uses') ? Number(formData.get('max_uses')) : undefined,
    max_uses_per_user: Number(formData.get('max_uses_per_user')) || 1,
    min_order_amount: Number(formData.get('min_order_amount')) || 0,
    is_active: formData.get('is_active') !== 'false',
    starts_at: formData.get('starts_at') || undefined,
    expires_at: formData.get('expires_at') || undefined,
    event_id: formData.get('event_id') || undefined,
  });

  const { error } = await supabase.from('coupons').insert({
    ...parsed,
    organizer_id: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/organizer/dashboard', 'page');
}

export async function toggleCouponAction(couponId: string, isActive: boolean) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('coupons')
    .update({ is_active: isActive })
    .eq('id', couponId)
    .eq('organizer_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/organizer/dashboard', 'page');
}

export async function deleteCouponAction(couponId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('coupons')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', couponId)
    .eq('organizer_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/organizer/dashboard', 'page');
}
