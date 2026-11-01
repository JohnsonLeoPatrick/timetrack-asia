-- Time Track v2: Coupon System (Functions & Seed Data)

-- Validate and apply a coupon code
CREATE OR REPLACE FUNCTION validate_coupon(
  p_code VARCHAR(100),
  p_user_id UUID,
  p_event_id UUID,
  p_order_amount DECIMAL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon coupons%ROWTYPE;
  v_user_uses INTEGER;
  v_discount DECIMAL;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized coupon validation';
  END IF;
  -- Find coupon
  SELECT * INTO v_coupon FROM coupons
  WHERE code = UPPER(p_code)
    AND is_active = TRUE
    AND deleted_at IS NULL
    AND (event_id IS NULL OR event_id = p_event_id)
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    AND (starts_at IS NULL OR starts_at < CURRENT_TIMESTAMP);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', FALSE, 'error', 'Coupon not found or expired');
  END IF;

  -- Check max uses
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('valid', FALSE, 'error', 'Coupon has reached maximum uses');
  END IF;

  -- Check user uses
  SELECT COUNT(*) INTO v_user_uses
  FROM coupon_redemptions
  WHERE coupon_id = v_coupon.id AND user_id = p_user_id;

  IF v_user_uses >= v_coupon.max_uses_per_user THEN
    RETURN jsonb_build_object('valid', FALSE, 'error', 'You have already used this coupon');
  END IF;

  -- Check minimum order
  IF p_order_amount < v_coupon.min_order_amount THEN
    RETURN jsonb_build_object('valid', FALSE, 'error', 'Minimum order amount is RM' || v_coupon.min_order_amount::TEXT);
  END IF;

  -- Calculate discount
  IF v_coupon.type = 'FIXED' THEN
    v_discount := LEAST(v_coupon.value, p_order_amount);
  ELSIF v_coupon.type = 'PERCENTAGE' THEN
    v_discount := ROUND(p_order_amount * v_coupon.value / 100, 2);
    v_discount := LEAST(v_discount, p_order_amount);
  ELSE
    v_discount := 0;
  END IF;

  v_result := jsonb_build_object(
    'valid', TRUE,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'type', v_coupon.type,
    'value', v_coupon.value,
    'discount_amount', v_discount
  );

  RETURN v_result;
END;
$$;

-- Redeem a coupon (increment uses and create redemption record)
CREATE OR REPLACE FUNCTION redeem_coupon(
  p_coupon_id UUID,
  p_registration_id UUID,
  p_user_id UUID,
  p_discount_amount DECIMAL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert redemption record
  INSERT INTO coupon_redemptions (coupon_id, registration_id, user_id, discount_amount)
  VALUES (p_coupon_id, p_registration_id, p_user_id, p_discount_amount);

  -- Increment coupon usage
  UPDATE coupons SET current_uses = current_uses + 1
  WHERE id = p_coupon_id;
END;
$$;

-- Generate unique registration number
CREATE OR REPLACE FUNCTION generate_registration_number()
RETURNS VARCHAR(100)
LANGUAGE plpgsql
AS $$
DECLARE
  v_number VARCHAR(100);
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_number := 'TT-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM registrations WHERE registration_number = v_number) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_number;
END;
$$;

-- Seed some example coupons
INSERT INTO coupons (code, type, value, max_uses, max_uses_per_user, min_order_amount, is_active, starts_at, expires_at) VALUES
  ('WELCOME10', 'PERCENTAGE', 10, 100, 1, 0, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '90 days'),
  ('FLAT50', 'FIXED', 50, 50, 1, 200, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '60 days'),
  ('EARLYBIRD20', 'PERCENTAGE', 20, 30, 1, 100, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days')
ON CONFLICT (code) DO NOTHING;
