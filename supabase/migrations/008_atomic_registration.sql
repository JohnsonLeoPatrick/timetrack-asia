-- Time Track v2: Atomic registration creation
--
-- Creating a registration used to require several sequential REST calls
-- (registration -> billing -> participants -> coupon redemption). If any call
-- failed, earlier rows were left behind as partial writes, and two concurrent
-- requests could both redeem a coupon beyond its max uses. This function does
-- the whole thing inside one transaction and locks the coupon row.

CREATE OR REPLACE FUNCTION create_registration_atomic(
  p_event_id UUID,
  p_athlete_id UUID,
  p_billing JSONB,
  p_participants JSONB,
  p_coupon_code TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      ic_passport, dob, age, address, postcode, country, medical_status,
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
