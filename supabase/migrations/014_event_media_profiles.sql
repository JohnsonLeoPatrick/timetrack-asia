-- Usernames are public handles, separate from participant and billing names.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username varchar(32);
UPDATE public.users SET username = 'runner_' || replace(id::text, '-', '')::varchar(24) WHERE username IS NULL;
ALTER TABLE public.users ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN username SET DEFAULT ('runner_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24));
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON public.users(lower(username));
ALTER TABLE public.users ADD CONSTRAINT users_username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,32}$');

-- Uploads run through the authenticated server action, never a public write policy.
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('event-covers', 'event-covers', true, 4194304, ARRAY['image/webp'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
