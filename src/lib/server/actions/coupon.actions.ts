'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/server/auth/require-role';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const couponSchema = z.object({
  code: z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9_-]+$/).transform(v => v.toUpperCase()),
  type: z.enum(['FIXED', 'PERCENTAGE']),
  value: z.number().finite().positive(),
  max_uses: z.number().int().positive().optional(),
  max_uses_per_user: z.number().int().positive().default(1),
  min_order_amount: z.number().finite().min(0).default(0),
  is_active: z.boolean().default(true),
  starts_at: z.iso.datetime({ offset: true }).optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  event_id: z.uuid(),
}).superRefine((coupon, context) => {
  if (coupon.type === 'PERCENTAGE' && coupon.value > 100) context.addIssue({ code: 'custom', path: ['value'], message: 'Percentage cannot exceed 100' });
  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) context.addIssue({ code: 'custom', path: ['expires_at'], message: 'Expiry must be in the future' });
  if (coupon.starts_at && coupon.expires_at && new Date(coupon.starts_at) >= new Date(coupon.expires_at)) context.addIssue({ code: 'custom', path: ['expires_at'], message: 'Expiry must follow start date' });
});

export async function createCouponAction(formData: FormData) {
  const { user } = await requireRole(['ORGANIZER', 'ADMIN', 'SUPER_ADMIN']);
  const supabase = await createSupabaseServerClient();

  const parsed = couponSchema.parse({
    code: formData.get('code'),
    type: formData.get('type'),
    value: Number(formData.get('value')),
    max_uses: formData.get('max_uses') ? Number(formData.get('max_uses')) : undefined,
    max_uses_per_user: Number(formData.get('max_uses_per_user') || 1),
    min_order_amount: Number(formData.get('min_order_amount')) || 0,
    is_active: formData.get('is_active') !== 'false',
    starts_at: formData.get('starts_at') ? new Date(String(formData.get('starts_at'))).toISOString() : undefined,
    expires_at: formData.get('expires_at') ? new Date(String(formData.get('expires_at'))).toISOString() : undefined,
    event_id: formData.get('event_id'),
  });

  const { data: event } = await supabase.from('events').select('id, organizer_id, coupons_allowed')
    .eq('id', parsed.event_id).is('deleted_at', null).single();
  if (!event || event.organizer_id !== user.id) throw new Error('Event not found');
  if (!event.coupons_allowed) throw new Error('Enable coupons for this event before creating a code');

  const { error } = await supabase.from('coupons').insert({
    ...parsed,
    organizer_id: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/organizer/dashboard', 'page');
}

export async function toggleCouponAction(couponId: string, isActive: boolean) {
  const { user } = await requireRole(['ORGANIZER', 'ADMIN', 'SUPER_ADMIN']);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('coupons')
    .update({ is_active: isActive })
    .eq('id', couponId)
    .eq('organizer_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/organizer/dashboard', 'page');
}

export async function deleteCouponAction(couponId: string) {
  const { user } = await requireRole(['ORGANIZER', 'ADMIN', 'SUPER_ADMIN']);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('coupons')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', couponId)
    .eq('organizer_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/organizer/dashboard', 'page');
}
