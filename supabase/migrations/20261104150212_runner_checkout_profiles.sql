-- Private reusable information. Medical declarations and event selections are never profile defaults.
CREATE TABLE public.runner_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  personal jsonb NOT NULL DEFAULT '{}', billing jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(personal) = 'object' AND jsonb_typeof(billing) = 'object')
);
CREATE TABLE public.runner_checkout_drafts (
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  payload jsonb NOT NULL, expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY(user_id, event_id), CHECK (pg_column_size(payload) < 400000)
);
ALTER TABLE public.runner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runner_checkout_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.runner_profiles, public.runner_checkout_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.runner_profiles, public.runner_checkout_drafts TO authenticated;
CREATE POLICY "Account owns runner profile" ON public.runner_profiles FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Account owns checkout draft" ON public.runner_checkout_drafts FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- Nonempty size arrays mean that the category includes that shirt. Empty arrays disable it.
ALTER TABLE public.event_categories ADD COLUMN event_tee_sizes text[] NOT NULL DEFAULT ARRAY['XS','S','M','L','XL','2XL','3XL'],
  ADD COLUMN finisher_tee_sizes text[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT valid_event_tee_sizes CHECK (event_tee_sizes <@ ARRAY['XXS','XS','S','M','L','XL','2XL','XXL','3XL']::text[] AND cardinality(event_tee_sizes) <= 9),
  ADD CONSTRAINT valid_finisher_tee_sizes CHECK (finisher_tee_sizes <@ ARRAY['XXS','XS','S','M','L','XL','2XL','XXL','3XL']::text[] AND cardinality(finisher_tee_sizes) <= 9);
ALTER TABLE public.events ADD COLUMN terms_version text NOT NULL DEFAULT '1';
CREATE FUNCTION public.version_event_terms() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.terms_and_conditions IS DISTINCT FROM OLD.terms_and_conditions THEN NEW.terms_version := gen_random_uuid()::text;
  ELSE NEW.terms_version := OLD.terms_version; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER version_event_terms BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.version_event_terms();
ALTER TABLE public.participants ADD COLUMN finisher_tee_size varchar(8), ADD COLUMN emergency_relationship varchar(100),
  ADD COLUMN medical_acknowledged_at timestamptz, ADD COLUMN participant_type text;
ALTER TABLE public.registrations ADD COLUMN checkout_key uuid;
CREATE UNIQUE INDEX registration_checkout_key ON public.registrations(athlete_id, checkout_key) WHERE checkout_key IS NOT NULL;
CREATE OR REPLACE FUNCTION public.protect_registration_form_data() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user = 'authenticated' AND (NEW.form_data IS DISTINCT FROM OLD.form_data OR NEW.checkout_key IS DISTINCT FROM OLD.checkout_key) THEN
    RAISE EXCEPTION 'Registration form data is server-managed';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.create_registration_atomic(
  p_event_id uuid, p_athlete_id uuid, p_billing jsonb, p_participants jsonb, p_coupon_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  event public.events%ROWTYPE;
  category public.event_categories%ROWTYPE;
  coupon public.coupons%ROWTYPE;
  entry jsonb;
  requested int;
  reserved int;
  order_total numeric;
  created jsonb;
  existing public.registrations%ROWTYPE;
  runner jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_athlete_id OR NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'ACTIVE' AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'Unauthorized registration owner'; END IF;
  IF p_billing->>'checkout_key' IS NULL THEN RAISE EXCEPTION 'Checkout key is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_athlete_id::text || (p_billing->>'checkout_key'), 0));
  SELECT * INTO existing FROM public.registrations WHERE athlete_id = p_athlete_id AND checkout_key = (p_billing->>'checkout_key')::uuid;
  IF FOUND THEN
    IF existing.event_id <> p_event_id OR existing.status NOT IN ('PENDING','PAID') OR existing.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Checkout is no longer active. Start a new registration'; END IF;
    RETURN jsonb_build_object('registration_id', existing.id, 'net_amount', existing.net_amount);
  END IF;
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
  IF (p_billing->>'terms_accepted' IS DISTINCT FROM 'true'
    OR p_billing->>'policy_accepted' IS DISTINCT FROM 'true') THEN
    RAISE EXCEPTION 'Accept the event rules and privacy policy';
  END IF;
  IF (
    coalesce(length(btrim(p_billing->>'country')), 0) NOT BETWEEN 1 AND 100
    OR coalesce(length(btrim(p_billing->>'city')), 0) NOT BETWEEN 1 AND 100
    OR coalesce(length(btrim(p_billing->>'postcode')), 0) NOT BETWEEN 1 AND 20) THEN
    RAISE EXCEPTION 'Enter billing country, city, and postcode';
  END IF;
  IF p_billing->>'terms_version' IS DISTINCT FROM event.terms_version THEN RAISE EXCEPTION 'Event terms changed. Reload and review the new terms'; END IF;
  -- Serialize category edits and checkouts before validating shirt eligibility.
  PERFORM id FROM public.event_categories WHERE event_id = p_event_id
    AND id IN (SELECT (value->>'category_id')::uuid FROM jsonb_array_elements(p_participants)) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM jsonb_array_elements(p_participants) WHERE value->>'participant_type' = 'myself') > 1 THEN RAISE EXCEPTION 'Only one participant can be Myself'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_participants) LOOP
    IF coalesce(length(btrim(entry->>'full_name')), 0) NOT BETWEEN 1 AND 255 THEN
      RAISE EXCEPTION 'Enter each participant name';
    END IF;
    IF (
      coalesce(length(btrim(entry->>'bib_name')), 0) NOT BETWEEN 1 AND 100
      OR coalesce(length(btrim(entry->>'ic_passport')), 0) NOT BETWEEN 4 AND 100
      OR coalesce(length(btrim(entry->>'email')), 0) NOT BETWEEN 3 AND 255
      OR entry->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      OR coalesce(length(btrim(entry->>'phone')), 0) NOT BETWEEN 8 AND 50
      OR coalesce(entry->>'gender', '') NOT IN ('MALE', 'FEMALE')
      OR entry->>'dob' IS NULL OR (entry->>'dob')::date > current_date
      OR (entry->>'dob')::date < current_date - interval '120 years'
      OR coalesce(length(btrim(entry->>'country')), 0) NOT BETWEEN 1 AND 100
      OR coalesce(length(btrim(entry->>'category_age')), 0) NOT BETWEEN 1 AND 50
      OR coalesce(entry->>'medical_status', '') NOT IN ('true','false')
      OR (entry->>'medical_status' = 'true' AND coalesce(length(btrim(entry->>'medical_details')), 0) = 0)
      OR coalesce(length(btrim(entry->>'emergency_name')), 0) NOT BETWEEN 1 AND 255
      OR coalesce(length(btrim(entry->>'emergency_phone')), 0) NOT BETWEEN 8 AND 50) THEN
      RAISE EXCEPTION 'Complete every attendee field';
    END IF;
    IF coalesce(entry->>'participant_type', '') NOT IN ('myself','other')
      OR entry->>'medical_acknowledged' IS DISTINCT FROM 'true'
      OR coalesce(length(btrim(entry->>'emergency_relationship')), 0) NOT BETWEEN 1 AND 100
      OR coalesce(length(entry->>'medical_details'), 0) > 2000 THEN RAISE EXCEPTION 'Complete emergency relationship and medical acknowledgement'; END IF;
    SELECT * INTO category FROM public.event_categories WHERE id = (entry->>'category_id')::uuid AND event_id = p_event_id;
    IF (cardinality(category.event_tee_sizes) > 0 AND NOT coalesce(entry->>'tee_size' = ANY(category.event_tee_sizes), false))
      OR (cardinality(category.event_tee_sizes) = 0 AND nullif(entry->>'tee_size', '') IS NOT NULL)
      OR (cardinality(category.finisher_tee_sizes) > 0 AND NOT coalesce(entry->>'finisher_tee_size' = ANY(category.finisher_tee_sizes), false))
      OR (cardinality(category.finisher_tee_sizes) = 0 AND nullif(entry->>'finisher_tee_size', '') IS NOT NULL) THEN
      RAISE EXCEPTION 'Select an available shirt size for each eligible shirt'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.event_categories WHERE id = (entry->>'category_id')::uuid
      AND event_id = p_event_id AND deleted_at IS NULL AND base_price >= 0) THEN
      RAISE EXCEPTION 'Invalid category for this event';
    END IF;
  END LOOP;
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
    IF NOT event.coupons_allowed THEN RAISE EXCEPTION 'This coupon is no longer available. Please review your total'; END IF;
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
  created := public.create_registration_priced(p_event_id, p_athlete_id, p_billing, p_participants, p_coupon_code);
  UPDATE public.registrations SET checkout_key = (p_billing->>'checkout_key')::uuid, form_data = jsonb_build_object('attendee_count', jsonb_array_length(p_participants),
    'terms_accepted_at', now(), 'terms_version', event.terms_version, 'terms_text', event.terms_and_conditions, 'privacy_version', '2026-11-04', 'declaration_version', '2026-11-04',
    'terms_accepted', coalesce(p_billing->>'terms_accepted' = 'true', false),
    'policy_accepted', coalesce(p_billing->>'policy_accepted' = 'true', false))
    WHERE id = (created->>'registration_id')::uuid;
  -- Explicit save choices update reusable information in the same transaction.
  IF p_billing->>'save_runner' = 'true' THEN
    SELECT value INTO runner FROM jsonb_array_elements(p_participants) WHERE value->>'participant_type' = 'myself';
    IF runner IS NULL THEN RAISE EXCEPTION 'Add yourself before saving a runner profile'; END IF;
    SELECT jsonb_object_agg(key, value) INTO runner FROM jsonb_each(runner)
      WHERE key IN ('full_name','bib_name','email','phone','gender','ic_passport','dob','address','postcode','country','emergency_name','emergency_phone','emergency_relationship');
    INSERT INTO public.runner_profiles(user_id, personal) VALUES (p_athlete_id, runner)
      ON CONFLICT(user_id) DO UPDATE SET personal = excluded.personal, updated_at = now();
  END IF;
  IF p_billing->>'save_billing' = 'true' THEN
    SELECT jsonb_object_agg(key, value) INTO runner FROM jsonb_each(p_billing) WHERE key IN ('first_name','phone','email','country','city','postcode');
    INSERT INTO public.runner_profiles(user_id, billing) VALUES (p_athlete_id, runner)
      ON CONFLICT(user_id) DO UPDATE SET billing = excluded.billing, updated_at = now();
  END IF;
  DELETE FROM public.runner_checkout_drafts WHERE user_id = p_athlete_id AND event_id = p_event_id;
  RETURN created;
END;
$$;
REVOKE ALL ON FUNCTION public.create_registration_atomic(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_registration_atomic(uuid, uuid, jsonb, jsonb, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.create_registration_priced(
  p_event_id UUID,
  p_athlete_id UUID,
  p_billing JSONB,
  p_participants JSONB,
  p_coupon_code TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total DECIMAL(10, 2) := 0;
  v_discount DECIMAL(10, 2) := 0;
  v_coupon_id UUID := NULL;
  v_coupon coupons%ROWTYPE;
  v_net DECIMAL(10, 2);
  v_reg_number VARCHAR(100);
  v_reg_id UUID;
  v_user_uses INTEGER;
  v_p JSONB;
  v_cat_price DECIMAL(10, 2);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_athlete_id THEN
    RAISE EXCEPTION 'Unauthorized registration owner';
  END IF;
  IF p_participants IS NULL OR jsonb_typeof(p_participants) <> 'array' OR jsonb_array_length(p_participants) = 0 THEN
    RAISE EXCEPTION 'At least one participant is required';
  END IF;

  -- Compute the total from the event's own category prices (never trust the client).
  FOR v_p IN SELECT * FROM jsonb_array_elements(p_participants) LOOP
    SELECT base_price INTO v_cat_price
    FROM event_categories
    WHERE id = (v_p->>'category_id')::UUID AND event_id = p_event_id;

    IF v_cat_price IS NULL THEN
      RAISE EXCEPTION 'Invalid category for this event';
    END IF;

    v_total := v_total + v_cat_price;
  END LOOP;

  -- Validate + lock the coupon so concurrent redemptions cannot exceed limits.
  IF p_coupon_code IS NOT NULL AND p_coupon_code <> '' THEN
    SELECT * INTO v_coupon FROM coupons
    WHERE code = UPPER(p_coupon_code)
      AND is_active = TRUE
      AND deleted_at IS NULL
      AND (event_id IS NULL OR event_id = p_event_id)
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      AND (starts_at IS NULL OR starts_at < CURRENT_TIMESTAMP)
    FOR UPDATE;

    IF FOUND THEN
      IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
        RAISE EXCEPTION 'Coupon has reached maximum uses';
      END IF;

      SELECT COUNT(*) INTO v_user_uses
      FROM coupon_redemptions
      WHERE coupon_id = v_coupon.id AND user_id = p_athlete_id;

      IF v_user_uses >= v_coupon.max_uses_per_user THEN
        RAISE EXCEPTION 'You have already used this coupon';
      END IF;

      IF v_total >= v_coupon.min_order_amount THEN
        IF v_coupon.type = 'FIXED' THEN
          v_discount := LEAST(v_coupon.value, v_total);
        ELSIF v_coupon.type = 'PERCENTAGE' THEN
          v_discount := ROUND(v_total * v_coupon.value / 100, 2);
          v_discount := LEAST(v_discount, v_total);
        ELSE
          v_discount := 0;
        END IF;

        IF v_discount > 0 THEN
          v_coupon_id := v_coupon.id;
        END IF;
      END IF;
    END IF;
  END IF;

  v_net := GREATEST(0, v_total - v_discount);
  v_reg_number := generate_registration_number();

  INSERT INTO registrations (
    event_id, athlete_id, registration_number, persons_count, status,
    total_amount, discount_amount, net_amount, coupon_id, expires_at
  ) VALUES (
    p_event_id, p_athlete_id, v_reg_number, jsonb_array_length(p_participants),
    CASE WHEN v_net > 0 THEN 'PENDING' ELSE 'PAID' END,
    v_total, v_discount, v_net, v_coupon_id, CURRENT_TIMESTAMP + INTERVAL '24 hours'
  ) RETURNING id INTO v_reg_id;

  INSERT INTO billing_details (registration_id, first_name, phone, email, country, city, postcode)
  VALUES (
    v_reg_id,
    p_billing->>'first_name',
    p_billing->>'phone',
    p_billing->>'email',
    NULLIF(p_billing->>'country', ''),
    NULLIF(p_billing->>'city', ''),
    NULLIF(p_billing->>'postcode', '')
  );

  FOR v_p IN SELECT * FROM jsonb_array_elements(p_participants) LOOP
    INSERT INTO participants (
      registration_id, category_id, full_name, bib_name, email, phone, gender,
      ic_passport, dob, age, address, postcode, country, category_age, tee_size, medical_status,
      medical_details, emergency_name, emergency_phone, finisher_tee_size, emergency_relationship, medical_acknowledged_at, participant_type
    ) VALUES (
      v_reg_id,
      (v_p->>'category_id')::UUID,
      v_p->>'full_name',
      NULLIF(v_p->>'bib_name', ''),
      NULLIF(v_p->>'email', ''),
      NULLIF(v_p->>'phone', ''),
      NULLIF(v_p->>'gender', ''),
      NULLIF(v_p->>'ic_passport', ''),
      NULLIF(v_p->>'dob', '')::DATE,
      extract(year FROM age(current_date, (v_p->>'dob')::date))::integer,
      NULLIF(v_p->>'address', ''),
      NULLIF(v_p->>'postcode', ''),
      NULLIF(v_p->>'country', ''),
      NULLIF(v_p->>'category_age', ''),
      NULLIF(v_p->>'tee_size', ''),
      CASE WHEN NULLIF(v_p->>'medical_status', '') IS NULL THEN FALSE
           ELSE (v_p->>'medical_status')::BOOLEAN END,
      CASE WHEN v_p->>'medical_status' = 'true' THEN NULLIF(v_p->>'medical_details', '') ELSE NULL END,
      NULLIF(v_p->>'emergency_name', ''),
      NULLIF(v_p->>'emergency_phone', ''), NULLIF(v_p->>'finisher_tee_size', ''), v_p->>'emergency_relationship', now(), v_p->>'participant_type'
    );
  END LOOP;

  IF v_coupon_id IS NOT NULL THEN
    INSERT INTO coupon_redemptions (coupon_id, registration_id, user_id, discount_amount)
    VALUES (v_coupon_id, v_reg_id, p_athlete_id, v_discount);

    UPDATE coupons SET current_uses = current_uses + 1 WHERE id = v_coupon_id;
  END IF;

  RETURN jsonb_build_object(
    'registration_id', v_reg_id,
    'net_amount', v_net,
    'total_amount', v_total,
    'discount_amount', v_discount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_registration_priced(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;

-- Owners can correct safety details until registration closes. Financial and identity fields stay immutable.
CREATE FUNCTION public.update_participant_safety(p_participant_id uuid, p_details jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.participants p JOIN public.registrations r ON r.id = p.registration_id
    JOIN public.events e ON e.id = r.event_id JOIN public.users u ON u.id = r.athlete_id
    WHERE p.id = p_participant_id AND r.athlete_id = auth.uid() AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
      AND r.status IN ('PENDING','PAID') AND r.deleted_at IS NULL AND p.deleted_at IS NULL AND now() < e.registration_close
  ) THEN RAISE EXCEPTION 'Safety details cannot be updated for this entry'; END IF;
  IF coalesce(length(btrim(p_details->>'emergency_name')),0) NOT BETWEEN 1 AND 255
    OR coalesce(length(btrim(p_details->>'emergency_phone')),0) NOT BETWEEN 8 AND 50
    OR coalesce(length(btrim(p_details->>'emergency_relationship')),0) NOT BETWEEN 1 AND 100
    OR p_details->>'medical_acknowledged' IS DISTINCT FROM 'true'
    OR coalesce(p_details->>'medical_status','') NOT IN ('true','false')
    OR coalesce(length(p_details->>'medical_details'),0) > 2000
    OR (p_details->>'medical_status' = 'true' AND coalesce(length(btrim(p_details->>'medical_details')),0) = 0)
  THEN RAISE EXCEPTION 'Complete emergency contact and medical declaration'; END IF;
  UPDATE public.participants SET emergency_name = btrim(p_details->>'emergency_name'), emergency_phone = btrim(p_details->>'emergency_phone'),
    emergency_relationship = btrim(p_details->>'emergency_relationship'), medical_status = (p_details->>'medical_status')::boolean,
    medical_details = CASE WHEN p_details->>'medical_status' = 'true' THEN btrim(p_details->>'medical_details') ELSE NULL END,
    medical_acknowledged_at = now() WHERE id = p_participant_id;
END; $$;
REVOKE ALL ON FUNCTION public.update_participant_safety(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_participant_safety(uuid,jsonb) TO authenticated;
