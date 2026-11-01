BEGIN;
-- Audit entries are written by the server, not asserted by untrusted clients.
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
-- Public registration creation uses the ownership-checked, price-calculating RPC.
DROP POLICY IF EXISTS "Users can create registrations" ON public.registrations;
CREATE POLICY "Administrators can insert registrations" ON public.registrations
FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

CREATE OR REPLACE FUNCTION public.protect_registration_pricing()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user = 'authenticated' AND public.current_user_role() NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    IF NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.athlete_id IS DISTINCT FROM OLD.athlete_id
      OR NEW.total_amount IS DISTINCT FROM OLD.total_amount OR NEW.net_amount IS DISTINCT FROM OLD.net_amount
      OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount OR NEW.coupon_id IS DISTINCT FROM OLD.coupon_id
      OR NEW.persons_count IS DISTINCT FROM OLD.persons_count THEN
      RAISE EXCEPTION 'Registration pricing and ownership are server-managed';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'PENDING' AND NEW.status = 'CANCELLED') THEN
      RAISE EXCEPTION 'Payment status is managed by administrators';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_registration_pricing BEFORE UPDATE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.protect_registration_pricing();

DROP POLICY IF EXISTS "Users can create own payments" ON public.payments;
-- Replace every INSERT policy rather than leaving an older permissive policy active.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND cmd = 'INSERT'
  LOOP EXECUTE format('DROP POLICY %I ON public.payments', p.policyname); END LOOP;
END $$;
CREATE POLICY "Owners can submit pending payments" ON public.payments FOR INSERT TO authenticated
WITH CHECK (status IN ('PENDING', 'PENDING_REVIEW') AND EXISTS (
  SELECT 1 FROM public.registrations r WHERE r.id = payments.registration_id
    AND r.athlete_id = auth.uid() AND r.status = 'PENDING' AND r.deleted_at IS NULL
    AND payments.amount = r.net_amount AND r.net_amount > 0));

DROP POLICY IF EXISTS "Organizers can insert events" ON public.events;
CREATE POLICY "Organizers can insert events" ON public.events FOR INSERT TO authenticated
WITH CHECK (organizer_id = auth.uid() AND public.current_user_role() IN ('ORGANIZER', 'ADMIN', 'SUPER_ADMIN'));

CREATE OR REPLACE FUNCTION public.review_payment(p_payment_id uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE payment public.payments%ROWTYPE; registration public.registrations%ROWTYPE;
BEGIN
  IF public.current_user_role() NOT IN ('ADMIN', 'SUPER_ADMIN') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF payment.payment_gateway = 'CHIP' THEN RAISE EXCEPTION 'Provider verification is required for CHIP'; END IF;
  IF payment.status NOT IN ('PENDING', 'PENDING_REVIEW') THEN RAISE EXCEPTION 'Payment already reviewed'; END IF;
  SELECT * INTO registration FROM public.registrations WHERE id = payment.registration_id FOR UPDATE;
  IF NOT FOUND OR registration.deleted_at IS NOT NULL OR registration.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Registration is not awaiting payment';
  END IF;
  IF payment.amount <> registration.net_amount OR payment.amount <= 0 THEN RAISE EXCEPTION 'Payment amount mismatch'; END IF;
  UPDATE public.payments SET status = CASE WHEN p_approve THEN 'SUCCESS' ELSE 'FAILED' END WHERE id = p_payment_id;
  IF p_approve THEN UPDATE public.registrations SET status = 'PAID' WHERE id = payment.registration_id; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.review_payment(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_payment(uuid, boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
