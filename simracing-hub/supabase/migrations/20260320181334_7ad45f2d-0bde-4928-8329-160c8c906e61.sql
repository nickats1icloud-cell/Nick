ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS show_online boolean NOT NULL DEFAULT true;