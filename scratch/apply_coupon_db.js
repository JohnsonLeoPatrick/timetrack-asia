const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is missing in .env.local!');
  process.exit(1);
}

const client = new Client({ connectionString });

async function applyMigration() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  const sql = `
    -- 1. Add linked_email and category_id columns to coupons
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS linked_email VARCHAR(255);
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES event_categories(id) ON DELETE SET NULL;

    -- 2. Update validate_coupon function signature and logic
    CREATE OR REPLACE FUNCTION validate_coupon(
      p_code VARCHAR(100),
      p_user_id UUID,
      p_event_id UUID,
      p_order_amount DECIMAL,
      p_category_id UUID DEFAULT NULL
    ) RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      v_coupon coupons%ROWTYPE;
      v_user_uses INTEGER;
      v_discount DECIMAL;
      v_user_email VARCHAR(255);
      v_result JSONB;
    BEGIN
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

      -- Check category restriction
      IF v_coupon.category_id IS NOT NULL AND p_category_id IS NOT NULL AND v_coupon.category_id <> p_category_id THEN
        RETURN jsonb_build_object('valid', FALSE, 'error', 'Coupon is not valid for this race category');
      END IF;

      -- Check email restriction
      IF v_coupon.linked_email IS NOT NULL THEN
        SELECT email INTO v_user_email FROM public.users WHERE id = p_user_id;
        IF v_user_email IS NULL OR LOWER(v_user_email) <> LOWER(v_coupon.linked_email) THEN
          RETURN jsonb_build_object('valid', FALSE, 'error', 'This coupon is restricted to a different email address');
        END IF;
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
  `;

  try {
    await client.query(sql);
    console.log("Successfully updated coupons table schema and validate_coupon PL/pgSQL function.");
  } catch (error) {
    console.error('Error executing coupons database migration:', error);
  } finally {
    await client.end();
  }
}

applyMigration();
