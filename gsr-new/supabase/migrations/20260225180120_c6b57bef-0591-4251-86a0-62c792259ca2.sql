
-- Add is_approved column to profiles (default false = pending approval)
ALTER TABLE public.profiles ADD COLUMN is_approved boolean NOT NULL DEFAULT false;
