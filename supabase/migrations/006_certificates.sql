-- 1. certificates
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    participant_name VARCHAR(255) NOT NULL,
    issue_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    certificate_url VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_certificates_event_id ON certificates(event_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
CREATE TRIGGER trg_certificates_updated_at BEFORE UPDATE ON certificates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add RLS to certificates
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Allow public read access to certificates
CREATE POLICY "Allow public read access to certificates" ON certificates
    FOR SELECT
    USING (true);

-- Allow organizers and developers to manage certificates
CREATE POLICY "Allow organizers and developers to manage certificates" ON certificates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.role = 'DEVELOPER' OR users.role = 'ORGANIZER')
        )
    );
