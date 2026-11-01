-- Time Track v2: Security hardening (007)
-- 1. Prevent privilege escalation at signup (metadata role must never be trusted).
-- 2. Add missing RLS policies that silently deny legitimate flows
--    (refunds, payments UPDATE, invoices INSERT/UPDATE, payment_gateways).
-- 3. Align organizer-code policies with the application's SUPER_ADMIN role.

-- ============================================================
-- 1. handle_new_user: always create accounts as ATHLETE.
--    Role elevation is performed server-side with the service role
--    only after an organizer access code has been validated.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, first_name, last_name, phone, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    'ATHLETE',
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    avatar_url = EXCLUDED.avatar_url;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. organizer_codes: include SUPER_ADMIN, and never allow
--    non-admins to mutate codes (consumption is service-role only).
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage organizer codes" ON public.organizer_codes;
CREATE POLICY "Admins can manage organizer codes" ON public.organizer_codes
  FOR ALL
  USING (public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'))
  WITH CHECK (public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ============================================================
-- 3. refunds: previously had no policy at all (RLS deny-all).
-- ============================================================
DROP POLICY IF EXISTS "Users can read own refunds" ON refunds;
CREATE POLICY "Users can read own refunds" ON refunds
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM registrations WHERE registrations.id = refunds.registration_id AND registrations.athlete_id = auth.uid())
    OR EXISTS (SELECT 1 FROM registrations r JOIN events e ON r.event_id = e.id WHERE r.id = refunds.registration_id AND e.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

DROP POLICY IF EXISTS "Users can request own refunds" ON refunds;
CREATE POLICY "Users can request own refunds" ON refunds
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM registrations WHERE registrations.id = refunds.registration_id AND registrations.athlete_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

DROP POLICY IF EXISTS "Organizers and admins can process refunds" ON refunds;
CREATE POLICY "Organizers and admins can process refunds" ON refunds
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM registrations r JOIN events e ON r.event_id = e.id WHERE r.id = refunds.registration_id AND e.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM registrations r JOIN events e ON r.event_id = e.id WHERE r.id = refunds.registration_id AND e.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ============================================================
-- 4. payments: admins/organizers need UPDATE to approve/reject.
-- ============================================================
DROP POLICY IF EXISTS "Organizers and admins can update payments" ON payments;
CREATE POLICY "Organizers and admins can update payments" ON payments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM registrations r JOIN events e ON r.event_id = e.id WHERE r.id = payments.registration_id AND e.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM registrations r JOIN events e ON r.event_id = e.id WHERE r.id = payments.registration_id AND e.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ============================================================
-- 5. invoices: registration flow creates invoice rows.
-- ============================================================
DROP POLICY IF EXISTS "Users can create own invoices" ON invoices;
CREATE POLICY "Users can create own invoices" ON invoices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM registrations WHERE registrations.id = invoices.registration_id AND registrations.athlete_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

DROP POLICY IF EXISTS "Organizers and admins can update invoices" ON invoices;
CREATE POLICY "Organizers and admins can update invoices" ON invoices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM registrations r JOIN events e ON r.event_id = e.id WHERE r.id = invoices.registration_id AND e.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM registrations r JOIN events e ON r.event_id = e.id WHERE r.id = invoices.registration_id AND e.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ============================================================
-- 6. payment_gateways: previously had no policy at all.
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read enabled gateways" ON payment_gateways;
CREATE POLICY "Anyone can read enabled gateways" ON payment_gateways
  FOR SELECT USING (is_enabled = TRUE OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

DROP POLICY IF EXISTS "Admins can manage payment gateways" ON payment_gateways;
CREATE POLICY "Admins can manage payment gateways" ON payment_gateways
  FOR ALL
  USING (public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'))
  WITH CHECK (public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));
