'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Coupon } from '@/lib/types';
import { toggleCouponAction } from '@/lib/server/actions/coupon.actions';

export function useOrganizerCoupons() {
  return useQuery({
    queryKey: ['organizer-coupons'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('organizer_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Coupon[];
    },
    staleTime: 10_000,
  });
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: async ({
      code,
      eventId,
      orderAmount,
    }: {
      code: string;
      eventId: string;
      orderAmount: number;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please login first');

      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: code,
        p_user_id: user.id,
        p_event_id: eventId,
        p_order_amount: orderAmount,
      });

      if (error) throw error;
      return data;
    },
  });
}

export function useEventCoupons(eventId: string) {
  return useQuery({
    queryKey: ['event-coupons', eventId],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Coupon[];
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

export function useToggleCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ couponId, isActive }: { couponId: string; isActive: boolean }) => {
      await toggleCouponAction(couponId, isActive);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizer-coupons'] });
    },
  });
}
