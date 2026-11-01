BEGIN;

-- Billing and priced entries may only be created by the validated transaction.
-- This also prevents a buyer adding participants after paying for one entry.
CREATE FUNCTION public.protect_billing_rows()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Billing records are managed by the server';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_priced_participants BEFORE INSERT OR UPDATE OR DELETE ON public.participants
FOR EACH ROW EXECUTE FUNCTION public.protect_billing_rows();
CREATE TRIGGER protect_billing_details BEFORE INSERT OR UPDATE OR DELETE ON public.billing_details
FOR EACH ROW EXECUTE FUNCTION public.protect_billing_rows();
CREATE TRIGGER protect_priced_addons BEFORE INSERT OR UPDATE OR DELETE ON public.participant_addons
FOR EACH ROW EXECUTE FUNCTION public.protect_billing_rows();
CREATE TRIGGER protect_invoice_rows BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.protect_billing_rows();
CREATE TRIGGER protect_refund_rows BEFORE INSERT OR UPDATE OR DELETE ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.protect_billing_rows();

CREATE OR REPLACE FUNCTION public.protect_registration_pricing()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user = 'authenticated' AND public.current_user_role() NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    IF NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.athlete_id IS DISTINCT FROM OLD.athlete_id
      OR NEW.total_amount IS DISTINCT FROM OLD.total_amount OR NEW.net_amount IS DISTINCT FROM OLD.net_amount
      OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount OR NEW.coupon_id IS DISTINCT FROM OLD.coupon_id
      OR NEW.persons_count IS DISTINCT FROM OLD.persons_count OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
      OR NEW.registration_number IS DISTINCT FROM OLD.registration_number THEN
      RAISE EXCEPTION 'Registration pricing and ownership are server-managed';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'PENDING' AND NEW.status = 'CANCELLED') THEN
      RAISE EXCEPTION 'Payment status is managed by the server';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NOT (OLD.status = 'PENDING' AND NEW.status = 'CANCELLED') THEN
      RAISE EXCEPTION 'Only an unpaid registration can be cancelled';
    END IF;
  END IF;
  -- An UPDATE already holds the registration lock, matching checkout/settlement.
  IF OLD.status = 'PENDING' AND (NEW.status = 'CANCELLED' OR NEW.deleted_at IS NOT NULL)
    AND EXISTS (SELECT 1 FROM public.payments WHERE registration_id = OLD.id
      AND payment_gateway = 'CHIP' AND status IN ('PENDING', 'PENDING_REVIEW') AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Check your active payment before cancelling this registration';
  END IF;
  RETURN NEW;
END;
$$;

-- Preserve the existing atomic pricing/coupon transaction behind a checked entry point.
ALTER FUNCTION public.create_registration_atomic(uuid, uuid, jsonb, jsonb, text) RENAME TO create_registration_priced;
REVOKE ALL ON FUNCTION public.create_registration_priced(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.create_registration_atomic(p_event_id uuid, p_athlete_id uuid, p_billing jsonb, p_participants jsonb, p_coupon_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event public.events%ROWTYPE; category public.event_categories%ROWTYPE; coupon public.coupons%ROWTYPE; entry jsonb; requested int; reserved int; order_total numeric;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_athlete_id OR NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'ACTIVE' AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'Unauthorized registration owner'; END IF;
  IF p_participants IS NULL OR jsonb_typeof(p_participants) <> 'array' THEN RAISE EXCEPTION 'Invalid participants'; END IF;
  IF jsonb_array_length(p_participants) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Choose between 1 and 100 participants'; END IF;
  SELECT * INTO event FROM public.events WHERE id = p_event_id FOR SHARE;
  IF NOT FOUND OR event.deleted_at IS NOT NULL OR event.status <> 'LIVE'
    OR now() < event.registration_open OR now() >= event.registration_close THEN
    RAISE EXCEPTION 'Registration is closed for this event';
  END IF;
  IF coalesce(length(btrim(p_billing->>'first_name')), 0) NOT BETWEEN 1 AND 100
    OR coalesce(length(p_billing->>'phone'), 0) NOT BETWEEN 8 AND 50
    OR coalesce(length(p_billing->>'email'), 0) NOT BETWEEN 3 AND 255
    OR p_billing->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Enter a valid billing name, phone, and email';
  END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_participants) LOOP
    IF coalesce(length(btrim(entry->>'full_name')), 0) NOT BETWEEN 1 AND 255 THEN
      RAISE EXCEPTION 'Enter each participant name';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.event_categories WHERE id = (entry->>'category_id')::uuid
      AND event_id = p_event_id AND deleted_at IS NULL AND base_price >= 0) THEN
      RAISE EXCEPTION 'Invalid category for this event';
    END IF;
  END LOOP;
  -- Lock categories in a stable order so simultaneous orders cannot oversell.
  FOR category IN SELECT * FROM public.event_categories WHERE event_id = p_event_id
    AND id IN (SELECT (value->>'category_id')::uuid FROM jsonb_array_elements(p_participants)) ORDER BY id FOR UPDATE LOOP
    IF category.max_slots IS NOT NULL THEN
      SELECT count(*) INTO requested FROM jsonb_array_elements(p_participants) WHERE (value->>'category_id')::uuid = category.id;
      SELECT count(*) INTO reserved FROM public.participants p JOIN public.registrations r ON r.id = p.registration_id
      WHERE p.category_id = category.id AND p.deleted_at IS NULL AND r.deleted_at IS NULL
        AND (r.status = 'PAID' OR (r.status = 'PENDING' AND (r.expires_at IS NULL OR r.expires_at > now())));
      IF requested + reserved > category.max_slots THEN RAISE EXCEPTION 'This category has insufficient places'; END IF;
    END IF;
  END LOOP;
  p_coupon_code := nullif(upper(btrim(p_coupon_code)), '');
  IF p_coupon_code IS NOT NULL THEN
    SELECT * INTO coupon FROM public.coupons WHERE code = p_coupon_code FOR UPDATE;
    SELECT sum(c.base_price) INTO order_total FROM jsonb_array_elements(p_participants) p
      JOIN public.event_categories c ON c.id = (p.value->>'category_id')::uuid;
    IF coupon.id IS NULL OR NOT coupon.is_active OR coupon.deleted_at IS NOT NULL
      OR (coupon.event_id IS NOT NULL AND coupon.event_id <> p_event_id)
      OR (coupon.starts_at IS NOT NULL AND coupon.starts_at >= now())
      OR (coupon.expires_at IS NOT NULL AND coupon.expires_at <= now()) OR order_total < coupon.min_order_amount THEN
      RAISE EXCEPTION 'This coupon is no longer available. Please review your total';
    END IF;
  END IF;
  RETURN public.create_registration_priced(p_event_id, p_athlete_id, p_billing, p_participants, p_coupon_code);
END;
$$;
REVOKE ALL ON FUNCTION public.create_registration_atomic(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_registration_atomic(uuid, uuid, jsonb, jsonb, text) TO authenticated;

CREATE FUNCTION public.request_registration_refund(p_registration_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE registration public.registrations%ROWTYPE; payment public.payments%ROWTYPE; refund_id uuid;
BEGIN
  SELECT * INTO registration FROM public.registrations WHERE id = p_registration_id AND athlete_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR registration.status <> 'PAID' OR registration.deleted_at IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'ACTIVE' AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'Paid registration not found'; END IF;
  IF coalesce(length(btrim(p_reason)), 0) NOT BETWEEN 3 AND 2000 THEN RAISE EXCEPTION 'Enter a refund reason (3–2000 characters)'; END IF;
  SELECT * INTO payment FROM public.payments WHERE registration_id = registration.id AND status = 'SUCCESS' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR payment.amount <= 0 OR payment.amount <> registration.net_amount THEN RAISE EXCEPTION 'Verified payment not found'; END IF;
  SELECT id INTO refund_id FROM public.refunds WHERE payment_id = payment.id AND status IN ('REFUND_REQUESTED', 'REFUNDED') AND deleted_at IS NULL LIMIT 1;
  IF FOUND THEN RETURN refund_id; END IF;
  INSERT INTO public.refunds (payment_id, registration_id, amount, reason, status)
  VALUES (payment.id, registration.id, payment.amount, btrim(p_reason), 'REFUND_REQUESTED') RETURNING id INTO refund_id;
  RETURN refund_id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_registration_refund(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_registration_refund(uuid, text) TO authenticated;

CREATE FUNCTION public.review_registration_refund(p_refund_id uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE refund public.refunds%ROWTYPE; payment public.payments%ROWTYPE; registration public.registrations%ROWTYPE;
BEGIN
  IF public.current_user_role() NOT IN ('ADMIN', 'SUPER_ADMIN') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT r.* INTO registration FROM public.registrations r JOIN public.refunds f ON f.registration_id = r.id WHERE f.id = p_refund_id FOR UPDATE OF r;
  SELECT p.* INTO payment FROM public.payments p JOIN public.refunds f ON f.payment_id = p.id WHERE f.id = p_refund_id FOR UPDATE OF p;
  SELECT * INTO refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND OR refund.status <> 'REFUND_REQUESTED' OR refund.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Refund is not awaiting review'; END IF;
  IF payment.payment_gateway = 'CHIP' THEN RAISE EXCEPTION 'Process CHIP refunds through the merchant portal'; END IF;
  IF registration.id IS NULL OR registration.status <> 'PAID' OR payment.status <> 'SUCCESS'
    OR payment.registration_id <> refund.registration_id OR payment.amount <> refund.amount THEN RAISE EXCEPTION 'Refund verification mismatch'; END IF;
  UPDATE public.refunds SET status = CASE WHEN p_approve THEN 'REFUNDED' ELSE 'REFUND_REJECTED' END, processed_at = now() WHERE id = refund.id;
  IF p_approve THEN
    UPDATE public.payments SET status = 'REFUNDED' WHERE id = payment.id;
    UPDATE public.registrations SET status = 'REFUNDED' WHERE id = registration.id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.review_registration_refund(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_registration_refund(uuid, boolean) TO authenticated;

-- Manual reviews use the same registration-first lock order as CHIP checkout.
CREATE OR REPLACE FUNCTION public.review_payment(p_payment_id uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE payment public.payments%ROWTYPE; registration public.registrations%ROWTYPE;
BEGIN
  IF public.current_user_role() NOT IN ('ADMIN', 'SUPER_ADMIN') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT r.* INTO registration FROM public.registrations r JOIN public.payments p ON p.registration_id = r.id
    WHERE p.id = p_payment_id FOR UPDATE OF r;
  IF NOT FOUND OR registration.deleted_at IS NOT NULL OR registration.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Registration is not awaiting payment';
  END IF;
  SELECT * INTO payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF payment.payment_gateway = 'CHIP' THEN RAISE EXCEPTION 'Provider verification is required for CHIP'; END IF;
  IF payment.status NOT IN ('PENDING', 'PENDING_REVIEW') OR payment.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Payment already reviewed'; END IF;
  IF payment.amount <> registration.net_amount OR payment.amount <= 0 OR payment.currency <> 'MYR' THEN RAISE EXCEPTION 'Payment amount mismatch'; END IF;
  IF p_approve AND EXISTS (SELECT 1 FROM public.payments WHERE registration_id = registration.id
    AND payment_gateway = 'CHIP' AND status IN ('PENDING', 'PENDING_REVIEW') AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Resolve the active CHIP checkout before approving another payment';
  END IF;
  UPDATE public.payments SET status = CASE WHEN p_approve THEN 'SUCCESS' ELSE 'FAILED' END WHERE id = payment.id;
  IF p_approve THEN UPDATE public.registrations SET status = 'PAID' WHERE id = registration.id; END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
