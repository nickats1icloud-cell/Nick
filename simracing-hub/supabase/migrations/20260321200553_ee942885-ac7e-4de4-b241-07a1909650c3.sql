
-- Championships table
CREATE TABLE public.championships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('active', 'upcoming', 'completed')),
  category text NOT NULL DEFAULT 'GT3',
  races_completed integer NOT NULL DEFAULT 0,
  races_total integer NOT NULL DEFAULT 0,
  participants integer NOT NULL DEFAULT 0,
  start_date date,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Championships are public" ON public.championships
  FOR SELECT TO public USING (true);

-- Admin manage
CREATE POLICY "Admins can manage championships" ON public.championships
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
