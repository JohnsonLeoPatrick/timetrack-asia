-- Time Track v2: Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Helper: current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR(50)
LANGUAGE SQL SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.users WHERE id = auth.uid()),
    'ATHLETE'
  );
$$;

-- ==================== USERS ====================
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can read all users" ON users
  FOR SELECT USING (public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- ==================== EVENTS ====================
CREATE POLICY "Anyone can read live events" ON events
  FOR SELECT USING (status IN ('LIVE', 'APPROVED', 'COMPLETED') AND deleted_at IS NULL);

CREATE POLICY "Organizers can read own events" ON events
  FOR SELECT USING (organizer_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

CREATE POLICY "Organizers can insert events" ON events
  FOR INSERT WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "Organizers can update own events" ON events
  FOR UPDATE USING (organizer_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

CREATE POLICY "Organizers can delete own events" ON events
  FOR UPDATE USING (organizer_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ==================== EVENT GALLERY ====================
CREATE POLICY "Anyone can read event gallery" ON event_gallery
  FOR SELECT USING (TRUE);

CREATE POLICY "Organizers can manage own gallery" ON event_gallery
  FOR ALL USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_gallery.event_id AND events.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ==================== EVENT CATEGORIES ====================
CREATE POLICY "Anyone can read categories" ON event_categories
  FOR SELECT USING (TRUE);

CREATE POLICY "Organizers can manage own categories" ON event_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_categories.event_id AND events.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ==================== CATEGORY ADDONS ====================
CREATE POLICY "Anyone can read addons" ON category_addons
  FOR SELECT USING (TRUE);

CREATE POLICY "Organizers can manage own addons" ON category_addons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM event_categories ec JOIN events e ON ec.event_id = e.id WHERE ec.id = category_addons.category_id AND e.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ==================== ADDON OPTIONS ====================
CREATE POLICY "Anyone can read addon options" ON addon_options
  FOR SELECT USING (TRUE);

CREATE POLICY "Organizers can manage own addon options" ON addon_options
  FOR ALL USING (
    EXISTS (SELECT 1 FROM category_addons ca JOIN event_categories ec ON ca.category_id = ec.id JOIN events e ON ec.event_id = e.id WHERE ca.id = addon_options.addon_id AND e.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ==================== FORM TEMPLATES ====================
CREATE POLICY "Anyone can read system forms" ON form_templates
  FOR SELECT USING (is_system = TRUE OR organizer_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

CREATE POLICY "Organizers can manage own forms" ON form_templates
  FOR ALL USING (organizer_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ==================== REGISTRATIONS ====================
CREATE POLICY "Users can read own registrations" ON registrations
  FOR SELECT USING (athlete_id = auth.uid());

CREATE POLICY "Organizers can read event registrations" ON registrations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = registrations.event_id AND events.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

CREATE POLICY "Users can create registrations" ON registrations
  FOR INSERT WITH CHECK (athlete_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

CREATE POLICY "Users can update own registrations" ON registrations
  FOR UPDATE USING (athlete_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ==================== BILLING DETAILS ====================
CREATE POLICY "Users can read own billing" ON billing_details
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM registrations WHERE registrations.id = billing_details.registration_id AND registrations.athlete_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

CREATE POLICY "Users can manage own billing" ON billing_details
  FOR ALL USING (
    EXISTS (SELECT 1 FROM registrations WHERE registrations.id = billing_details.registration_id AND registrations.athlete_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ==================== PARTICIPANTS ====================
CREATE POLICY "Users can read own participants" ON participants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM registrations WHERE registrations.id = participants.registration_id AND registrations.athlete_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

CREATE POLICY "Organizers can read event participants" ON participants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM registrations r JOIN events e ON r.event_id = e.id WHERE r.id = participants.registration_id AND e.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

CREATE POLICY "Users can manage own participants" ON participants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM registrations WHERE registrations.id = participants.registration_id AND registrations.athlete_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ==================== PARTICIPANT ADDONS ====================
CREATE POLICY "Users can read own participant addons" ON participant_addons
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM participants p JOIN registrations r ON p.registration_id = r.id WHERE p.id = participant_addons.participant_id AND r.athlete_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

CREATE POLICY "Users can manage own participant addons" ON participant_addons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM participants p JOIN registrations r ON p.registration_id = r.id WHERE p.id = participant_addons.participant_id AND r.athlete_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ==================== PAYMENTS ====================
CREATE POLICY "Users can read own payments" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM registrations WHERE registrations.id = payments.registration_id AND registrations.athlete_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

CREATE POLICY "Users can insert payments" ON payments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM registrations WHERE registrations.id = payments.registration_id AND registrations.athlete_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ==================== INVOICES ====================
CREATE POLICY "Users can read own invoices" ON invoices
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM registrations WHERE registrations.id = invoices.registration_id AND registrations.athlete_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ==================== RESULTS ====================
CREATE POLICY "Anyone can read finalized results" ON results
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = results.event_id AND events.results_finalized = TRUE)
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

CREATE POLICY "Organizers can manage own results" ON results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = results.event_id AND events.organizer_id = auth.uid())
    OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ==================== AUDIT LOGS ====================
CREATE POLICY "Admins can read audit logs" ON audit_logs
  FOR SELECT USING (public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (TRUE);

-- ==================== COUPONS ====================
CREATE POLICY "Anyone can read active coupons" ON coupons
  FOR SELECT USING (is_active = TRUE AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP));

CREATE POLICY "Organizers can read own coupons" ON coupons
  FOR SELECT USING (organizer_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

CREATE POLICY "Organizers can manage own coupons" ON coupons
  FOR ALL USING (organizer_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ==================== COUPON REDEMPTIONS ====================
CREATE POLICY "Users can read own redemptions" ON coupon_redemptions
  FOR SELECT USING (user_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

CREATE POLICY "Users can insert redemptions" ON coupon_redemptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ==================== EMAIL QUEUE ====================
CREATE POLICY "System manages email queue" ON email_queue
  FOR ALL USING (public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ==================== STAFF ASSIGNMENTS ====================
CREATE POLICY "Organizers can manage staff" ON staff_assignments
  FOR ALL USING (
    assigned_by = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ==================== NOTIFICATION LOGS ====================
CREATE POLICY "Users can read own notifications" ON notification_logs
  FOR SELECT USING (user_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ==================== NOTIFICATION PREFERENCES ====================
CREATE POLICY "Users can manage own preferences" ON user_notification_preferences
  FOR ALL USING (user_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ==================== NOTIFICATION TEMPLATES ====================
CREATE POLICY "Anyone can read notification templates" ON notification_templates
  FOR SELECT USING (TRUE);
