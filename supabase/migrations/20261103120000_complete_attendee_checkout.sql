-- Keep legacy participants intact. Enforce complete attendee data only for new registrations.
INSERT INTO public.form_templates (name, description, is_system, fields)
VALUES ('Standard Registration', 'Complete attendee details for race entry', true, '[
  {"id":"full_name","type":"TEXT","label":"Full name as on IC / passport","required":true},
  {"id":"ic_passport","type":"TEXT","label":"IC / passport number","required":true},
  {"id":"bib_name","type":"TEXT","label":"Name printed on bib","required":true},
  {"id":"email","type":"EMAIL","label":"Email","required":true},
  {"id":"phone","type":"PHONE","label":"Phone number","required":true},
  {"id":"gender","type":"RADIO","label":"Gender","required":true},
  {"id":"dob","type":"DATE","label":"Date of birth","required":true},
  {"id":"category_age","type":"DROPDOWN","label":"Category by age","required":true},
  {"id":"tee_size","type":"DROPDOWN","label":"Event tee size","required":true},
  {"id":"country","type":"TEXT","label":"Country","required":true},
  {"id":"medical_status","type":"RADIO","label":"Medical condition","required":true},
  {"id":"medical_details","type":"TEXT","label":"Medical condition details","required":false},
  {"id":"emergency_name","type":"TEXT","label":"Emergency contact name","required":true},
  {"id":"emergency_phone","type":"PHONE","label":"Emergency contact phone","required":true}
]'::jsonb)
ON CONFLICT (name) DO NOTHING;

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
  IF event.form_template_id IS NOT NULL AND (p_billing->>'terms_accepted' IS DISTINCT FROM 'true'
    OR p_billing->>'policy_accepted' IS DISTINCT FROM 'true') THEN
    RAISE EXCEPTION 'Accept the event rules and privacy policy';
  END IF;
  IF event.form_template_id IS NOT NULL AND (
    coalesce(length(btrim(p_billing->>'country')), 0) NOT BETWEEN 1 AND 100
    OR coalesce(length(btrim(p_billing->>'city')), 0) NOT BETWEEN 1 AND 100
    OR coalesce(length(btrim(p_billing->>'postcode')), 0) NOT BETWEEN 1 AND 20) THEN
    RAISE EXCEPTION 'Enter billing country, city, and postcode';
  END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_participants) LOOP
    IF coalesce(length(btrim(entry->>'full_name')), 0) NOT BETWEEN 1 AND 255 THEN
      RAISE EXCEPTION 'Enter each participant name';
    END IF;
    IF event.form_template_id IS NOT NULL AND (
      coalesce(length(btrim(entry->>'bib_name')), 0) NOT BETWEEN 1 AND 100
      OR coalesce(length(btrim(entry->>'ic_passport')), 0) NOT BETWEEN 4 AND 100
      OR coalesce(length(btrim(entry->>'email')), 0) NOT BETWEEN 3 AND 255
      OR entry->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      OR coalesce(length(btrim(entry->>'phone')), 0) NOT BETWEEN 8 AND 50
      OR coalesce(entry->>'gender', '') NOT IN ('MALE', 'FEMALE')
      OR entry->>'dob' IS NULL OR (entry->>'dob')::date > current_date
      OR coalesce(length(btrim(entry->>'country')), 0) NOT BETWEEN 1 AND 100
      OR coalesce(length(btrim(entry->>'category_age')), 0) NOT BETWEEN 1 AND 50
      OR coalesce(entry->>'tee_size', '') NOT IN ('XXS','XS','S','M','L','XL','XXL','3XL')
      OR coalesce(entry->>'medical_status', '') NOT IN ('true','false')
      OR (entry->>'medical_status' = 'true' AND coalesce(length(btrim(entry->>'medical_details')), 0) = 0)
      OR coalesce(length(btrim(entry->>'emergency_name')), 0) NOT BETWEEN 1 AND 255
      OR coalesce(length(btrim(entry->>'emergency_phone')), 0) NOT BETWEEN 8 AND 50) THEN
      RAISE EXCEPTION 'Complete every attendee field';
    END IF;
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
  UPDATE public.registrations SET form_data = jsonb_build_object('attendee_count', jsonb_array_length(p_participants),
    'terms_accepted', coalesce(p_billing->>'terms_accepted' = 'true', false),
    'policy_accepted', coalesce(p_billing->>'policy_accepted' = 'true', false))
    WHERE id = (created->>'registration_id')::uuid;
  RETURN created;
END;
$$;
REVOKE ALL ON FUNCTION public.create_registration_atomic(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_registration_atomic(uuid, uuid, jsonb, jsonb, text) TO authenticated;

-- Attendee options and consent are recorded with the priced entry.
CREATE FUNCTION public.protect_registration_form_data() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user = 'authenticated' AND NEW.form_data IS DISTINCT FROM OLD.form_data THEN
    RAISE EXCEPTION 'Registration form data is server-managed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_registration_form_data BEFORE UPDATE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.protect_registration_form_data();

-- Each attendee's options stay on that participant row, even with identical names.
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS tee_size varchar(8);
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
      medical_details, emergency_name, emergency_phone
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
      NULLIF(v_p->>'age', '')::INTEGER,
      NULLIF(v_p->>'address', ''),
      NULLIF(v_p->>'postcode', ''),
      NULLIF(v_p->>'country', ''),
      NULLIF(v_p->>'category_age', ''),
      NULLIF(v_p->>'tee_size', ''),
      CASE WHEN NULLIF(v_p->>'medical_status', '') IS NULL THEN FALSE
           ELSE (v_p->>'medical_status')::BOOLEAN END,
      NULLIF(v_p->>'medical_details', ''),
      NULLIF(v_p->>'emergency_name', ''),
      NULLIF(v_p->>'emergency_phone', '')
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
