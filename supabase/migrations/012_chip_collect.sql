BEGIN;
-- Even application administrators cannot forge provider-managed CHIP states.
CREATE FUNCTION public.protect_chip_payment_rows()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND
    (NEW.payment_gateway = 'CHIP' OR (TG_OP = 'UPDATE' AND OLD.payment_gateway = 'CHIP')) THEN
    RAISE EXCEPTION 'CHIP payment records are managed by the server';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_chip_payment_rows BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.protect_chip_payment_rows();
-- One in-flight CHIP attempt per registration; the existing payment ID is also
-- the provider reference. Never derive financial values from browser input.
CREATE UNIQUE INDEX payments_one_pending_chip ON public.payments (registration_id)
WHERE payment_gateway = 'CHIP' AND status IN ('PENDING', 'PENDING_REVIEW') AND deleted_at IS NULL;
CREATE UNIQUE INDEX payments_unique_chip_purchase ON public.payments (gateway_reference)
WHERE payment_gateway = 'CHIP' AND gateway_reference IS NOT NULL;

CREATE FUNCTION public.prepare_chip_payment(p_registration_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE registration public.registrations%ROWTYPE; payment public.payments%ROWTYPE; buyer_email text; event_title text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'protect_registration_pricing' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Financial access boundaries must be installed first';
  END IF;
  SELECT * INTO registration FROM public.registrations WHERE id = p_registration_id AND athlete_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR registration.status <> 'PENDING' OR registration.deleted_at IS NOT NULL OR registration.net_amount <= 0
    OR (registration.expires_at IS NOT NULL AND registration.expires_at <= now()) THEN
    RAISE EXCEPTION 'Registration is not payable';
  END IF;
  SELECT email INTO buyer_email FROM public.users WHERE id = p_user_id AND status = 'ACTIVE' AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account inactive'; END IF;
  SELECT title INTO event_title FROM public.events WHERE id = registration.event_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event unavailable'; END IF;
  SELECT * INTO payment FROM public.payments WHERE registration_id = p_registration_id AND payment_gateway = 'CHIP'
    AND status IN ('PENDING', 'PENDING_REVIEW') AND deleted_at IS NULL LIMIT 1;
  IF FOUND THEN
    IF payment.amount <> registration.net_amount THEN RAISE EXCEPTION 'Registration amount changed'; END IF;
    IF payment.status = 'PENDING_REVIEW' OR payment.gateway_reference IS NULL OR payment.metadata->>'checkout_url' IS NULL THEN
      RAISE EXCEPTION 'Payment awaiting provider confirmation';
    END IF;
  ELSE
    INSERT INTO public.payments (registration_id, payment_gateway, amount, currency, status)
      VALUES (registration.id, 'CHIP', registration.net_amount, 'MYR', 'PENDING') RETURNING * INTO payment;
  END IF;
  RETURN jsonb_build_object('id', payment.id, 'amount', payment.amount, 'checkout_url', payment.metadata->>'checkout_url',
    'email', buyer_email, 'title', event_title, 'expires_at', registration.expires_at);
END;
$$;

CREATE FUNCTION public.settle_chip_payment(p_payment_id uuid, p_purchase_id uuid, p_amount_sen bigint)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE payment public.payments%ROWTYPE; registration public.registrations%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  -- Match the checkout lock order, registration first, to avoid deadlocks.
  SELECT r.* INTO registration FROM public.registrations r JOIN public.payments p ON p.registration_id = r.id
    WHERE p.id = p_payment_id FOR UPDATE OF r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration missing'; END IF;
  SELECT * INTO payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF payment.payment_gateway <> 'CHIP' OR payment.gateway_reference IS DISTINCT FROM p_purchase_id::text
    OR payment.currency <> 'MYR' OR round(payment.amount * 100)::bigint <> p_amount_sen
    OR round(registration.net_amount * 100)::bigint <> p_amount_sen OR p_amount_sen <= 0 THEN
    RAISE EXCEPTION 'Payment verification mismatch';
  END IF;
  -- At-least-once delivery is normal. Never replay a paid/refunded state backwards.
  IF payment.status = 'SUCCESS' AND registration.status IN ('PAID', 'REFUNDED') THEN RETURN; END IF;
  IF payment.status NOT IN ('PENDING', 'PENDING_REVIEW') OR registration.status <> 'PENDING'
    OR registration.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Payment cannot be settled'; END IF;
  UPDATE public.payments SET status = 'SUCCESS' WHERE id = payment.id;
  UPDATE public.registrations SET status = 'PAID' WHERE id = registration.id;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_chip_payment(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_chip_payment(uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_chip_payment(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_chip_payment(uuid, uuid, bigint) TO service_role;

CREATE FUNCTION public.close_chip_payment(p_payment_id uuid, p_purchase_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.payments SET status = 'FAILED' WHERE id = p_payment_id AND payment_gateway = 'CHIP'
    AND gateway_reference = p_purchase_id::text AND status IN ('PENDING', 'PENDING_REVIEW');
END;
$$;
REVOKE ALL ON FUNCTION public.close_chip_payment(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_chip_payment(uuid, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
