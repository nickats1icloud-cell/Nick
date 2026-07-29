
-- Add extra profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS discord_username text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS years_simracing text,
  ADD COLUMN IF NOT EXISTS website_url text;

-- Create covers storage bucket for article cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for covers bucket
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Covers are publicly accessible' AND tablename = 'objects') THEN
    CREATE POLICY "Covers are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'covers');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload covers' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can upload covers"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'covers' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own covers' AND tablename = 'objects') THEN
    CREATE POLICY "Users can update own covers"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'covers' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own covers' AND tablename = 'objects') THEN
    CREATE POLICY "Users can delete own covers"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'covers' AND auth.uid() IS NOT NULL);
  END IF;
END $$;
