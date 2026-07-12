-- Create organizer_codes table
CREATE TABLE IF NOT EXISTS public.organizer_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.organizer_codes ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage organizer codes" ON public.organizer_codes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'ADMIN'
        )
    );

-- Anyone can read active codes (for signup validation)
CREATE POLICY "Anyone can read active codes" ON public.organizer_codes
    FOR SELECT
    USING (is_active = true);
