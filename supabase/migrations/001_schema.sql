-- Time Track: Complete PostgreSQL Schema (v2)
-- Ported from v1 Express backend + v2 additions

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Helper Function for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(50) NOT NULL DEFAULT 'ATHLETE',
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    password_hash VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    avatar_url VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Sync users trigger: when Supabase Auth creates a user, insert into public.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, first_name, last_name, phone, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'ATHLETE'),
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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    registration_open TIMESTAMP WITH TIME ZONE NOT NULL,
    registration_close TIMESTAMP WITH TIME ZONE NOT NULL,
    venue_name VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    postcode VARCHAR(20),
    country VARCHAR(100),
    cover_image VARCHAR(512),
    banner_image VARCHAR(512),
    max_participants INTEGER,
    bib_format VARCHAR(100) DEFAULT 'RUN-####',
    terms_and_conditions TEXT,
    results_finalized BOOLEAN DEFAULT FALSE,
    form_template_id UUID,
    coupons_allowed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. event_gallery
CREATE TABLE IF NOT EXISTS event_gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    image_url VARCHAR(512) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_event_gallery_event_id ON event_gallery(event_id);
CREATE TRIGGER trg_event_gallery_updated_at BEFORE UPDATE ON event_gallery FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. event_categories
CREATE TABLE IF NOT EXISTS event_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    max_slots INTEGER,
    min_age INTEGER,
    max_age INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_event_categories_event_id ON event_categories(event_id);
CREATE TRIGGER trg_event_categories_updated_at BEFORE UPDATE ON event_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. category_addons
CREATE TABLE IF NOT EXISTS category_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES event_categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_category_addons_category_id ON category_addons(category_id);
CREATE TRIGGER trg_category_addons_updated_at BEFORE UPDATE ON category_addons FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. addon_options
CREATE TABLE IF NOT EXISTS addon_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    addon_id UUID NOT NULL REFERENCES category_addons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_addon_options_addon_id ON addon_options(addon_id);
CREATE TRIGGER trg_addon_options_updated_at BEFORE UPDATE ON addon_options FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. form_templates (v2)
CREATE TABLE IF NOT EXISTS form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    organizer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_system BOOLEAN DEFAULT FALSE,
    fields JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE TRIGGER trg_form_templates_updated_at BEFORE UPDATE ON form_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. registrations
CREATE TABLE IF NOT EXISTS registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    athlete_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    registration_number VARCHAR(100) UNIQUE NOT NULL,
    persons_count INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    net_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    coupon_id UUID,
    expires_at TIMESTAMP WITH TIME ZONE,
    form_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_athlete_id ON registrations(athlete_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE TRIGGER trg_registrations_updated_at BEFORE UPDATE ON registrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10. billing_details
CREATE TABLE IF NOT EXISTS billing_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    city VARCHAR(100),
    postcode VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE TRIGGER trg_billing_details_updated_at BEFORE UPDATE ON billing_details FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 11. participants
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES event_categories(id) ON DELETE RESTRICT,
    full_name VARCHAR(255) NOT NULL,
    bib_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    gender VARCHAR(20),
    ic_passport VARCHAR(100),
    dob DATE,
    age INTEGER,
    address TEXT,
    postcode VARCHAR(20),
    country VARCHAR(100),
    category_age VARCHAR(50),
    bib_number VARCHAR(100),
    qr_token VARCHAR(255),
    medical_status BOOLEAN DEFAULT FALSE,
    medical_details TEXT,
    emergency_name VARCHAR(255),
    emergency_phone VARCHAR(50),
    check_in_time TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_participants_registration_id ON participants(registration_id);
CREATE INDEX IF NOT EXISTS idx_participants_category_id ON participants(category_id);
CREATE INDEX IF NOT EXISTS idx_participants_ic_passport ON participants(ic_passport);
CREATE INDEX IF NOT EXISTS idx_participants_bib_number ON participants(bib_number);
CREATE INDEX IF NOT EXISTS idx_participants_qr_token ON participants(qr_token);
CREATE TRIGGER trg_participants_updated_at BEFORE UPDATE ON participants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 12. participant_addons
CREATE TABLE IF NOT EXISTS participant_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES category_addons(id) ON DELETE RESTRICT,
    selected_option VARCHAR(255),
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_participant_addons_participant_id ON participant_addons(participant_id);
CREATE TRIGGER trg_participant_addons_updated_at BEFORE UPDATE ON participant_addons FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 13. payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT,
    payment_gateway VARCHAR(100) NOT NULL,
    gateway_reference VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'MYR',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    receipt_url VARCHAR(512),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_payments_registration_id ON payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_reference ON payments(gateway_reference);
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 14. invoices
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    pdf_url VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_invoices_registration_id ON invoices(registration_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 15. refunds
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT,
    amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'REFUND_REQUESTED',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_registration_id ON refunds(registration_id);
CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 16. payment_gateways
CREATE TABLE IF NOT EXISTS payment_gateways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER trg_payment_gateways_updated_at BEFORE UPDATE ON payment_gateways FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 17. results
CREATE TABLE IF NOT EXISTS results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    participant_id UUID NOT NULL UNIQUE REFERENCES participants(id) ON DELETE RESTRICT,
    bib_number VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'FINISHED',
    finish_time VARCHAR(50),
    gun_time INTERVAL,
    chip_time INTERVAL,
    splits JSONB,
    overall_rank INTEGER,
    gender_rank INTEGER,
    category_rank INTEGER,
    age_group_rank INTEGER,
    certificate_url VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_results_event_id ON results(event_id);
CREATE INDEX IF NOT EXISTS idx_results_participant_id ON results(participant_id);
CREATE INDEX IF NOT EXISTS idx_results_bib_number ON results(bib_number);
CREATE INDEX IF NOT EXISTS idx_results_event_ranks ON results(event_id, overall_rank);
CREATE TRIGGER trg_results_updated_at BEFORE UPDATE ON results FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 18. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    module VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time ON audit_logs(action, created_at DESC);

-- 19. staff_assignments
CREATE TABLE IF NOT EXISTS staff_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_event_id ON staff_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_user_id ON staff_assignments(user_id);

-- 20. notification_templates
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(100) UNIQUE NOT NULL,
    subject VARCHAR(255),
    content_html TEXT NOT NULL,
    content_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 21. notification_logs
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    type VARCHAR(100) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type_status ON notification_logs(type, status);

-- 22. user_notification_preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT TRUE,
    whatsapp_enabled BOOLEAN DEFAULT FALSE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    marketing_enabled BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 23. coupons (v2)
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'FIXED',
    value DECIMAL(10, 2) NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER NOT NULL DEFAULT 0,
    max_uses_per_user INTEGER NOT NULL DEFAULT 1,
    min_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    starts_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    organizer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_organizer_id ON coupons(organizer_id);
CREATE INDEX IF NOT EXISTS idx_coupons_event_id ON coupons(event_id);
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 24. coupon_redemptions (v2)
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    discount_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_id ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_registration_id ON coupon_redemptions(registration_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user_id ON coupon_redemptions(user_id);

-- 25. email_queue (v2)
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_address VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    html_body TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_at);
