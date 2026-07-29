
-- Racing categories (F1, GT3, GT4, MotoGP, etc.)
CREATE TABLE public.fantasy_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  max_drivers_per_team INT NOT NULL DEFAULT 5,
  budget_cap NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drivers available per category
CREATE TABLE public.fantasy_drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.fantasy_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  team_name TEXT,
  number INT,
  price NUMERIC NOT NULL DEFAULT 10,
  points INT NOT NULL DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User fantasy teams
CREATE TABLE public.fantasy_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.fantasy_categories(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  total_points INT NOT NULL DEFAULT 0,
  budget_remaining NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id)
);

-- Drivers in user teams
CREATE TABLE public.fantasy_team_drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.fantasy_teams(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.fantasy_drivers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, driver_id)
);

-- Enable RLS
ALTER TABLE public.fantasy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasy_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasy_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasy_team_drivers ENABLE ROW LEVEL SECURITY;

-- Categories & drivers are readable by everyone
CREATE POLICY "Categories are public" ON public.fantasy_categories FOR SELECT USING (true);
CREATE POLICY "Drivers are public" ON public.fantasy_drivers FOR SELECT USING (true);

-- Teams: users manage their own
CREATE POLICY "Users can view all teams" ON public.fantasy_teams FOR SELECT USING (true);
CREATE POLICY "Users can create own teams" ON public.fantasy_teams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own teams" ON public.fantasy_teams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own teams" ON public.fantasy_teams FOR DELETE USING (auth.uid() = user_id);

-- Team drivers: users manage via their teams
CREATE POLICY "Team drivers are viewable" ON public.fantasy_team_drivers FOR SELECT USING (true);
CREATE POLICY "Users can add drivers to own teams" ON public.fantasy_team_drivers FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.fantasy_teams WHERE id = team_id AND user_id = auth.uid()));
CREATE POLICY "Users can remove drivers from own teams" ON public.fantasy_team_drivers FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.fantasy_teams WHERE id = team_id AND user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_fantasy_teams_updated_at
  BEFORE UPDATE ON public.fantasy_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed categories
INSERT INTO public.fantasy_categories (name, slug, icon, description, max_drivers_per_team, budget_cap) VALUES
  ('Formula 1', 'f1', '🏎️', 'Η κορυφαία κατηγορία μονοθεσίων', 5, 100),
  ('GT3', 'gt3', '🏁', 'GT World Challenge - GT3 class', 4, 80),
  ('GT4', 'gt4', '🚗', 'GT World Challenge - GT4 class', 4, 80),
  ('MotoGP', 'motogp', '🏍️', 'Η κορυφαία κατηγορία μοτοσικλετών', 4, 80),
  ('WRC', 'wrc', '🌍', 'World Rally Championship', 3, 60),
  ('Formula E', 'fe', '⚡', 'Ηλεκτρικά μονοθέσια', 4, 80);

-- Seed F1 drivers
INSERT INTO public.fantasy_drivers (category_id, name, team_name, number, price, points) VALUES
  ((SELECT id FROM public.fantasy_categories WHERE slug='f1'), 'Max Verstappen', 'Red Bull Racing', 1, 30, 575),
  ((SELECT id FROM public.fantasy_categories WHERE slug='f1'), 'Lando Norris', 'McLaren', 4, 25, 374),
  ((SELECT id FROM public.fantasy_categories WHERE slug='f1'), 'Charles Leclerc', 'Ferrari', 16, 24, 356),
  ((SELECT id FROM public.fantasy_categories WHERE slug='f1'), 'Oscar Piastri', 'McLaren', 81, 22, 292),
  ((SELECT id FROM public.fantasy_categories WHERE slug='f1'), 'Carlos Sainz', 'Williams', 55, 20, 290),
  ((SELECT id FROM public.fantasy_categories WHERE slug='f1'), 'Lewis Hamilton', 'Ferrari', 44, 22, 211),
  ((SELECT id FROM public.fantasy_categories WHERE slug='f1'), 'George Russell', 'Mercedes', 63, 18, 245),
  ((SELECT id FROM public.fantasy_categories WHERE slug='f1'), 'Fernando Alonso', 'Aston Martin', 14, 14, 70),
  ((SELECT id FROM public.fantasy_categories WHERE slug='f1'), 'Pierre Gasly', 'Alpine', 10, 10, 42),
  ((SELECT id FROM public.fantasy_categories WHERE slug='f1'), 'Yuki Tsunoda', 'RB', 22, 10, 30);

-- Seed GT3 drivers
INSERT INTO public.fantasy_drivers (category_id, name, team_name, number, price, points) VALUES
  ((SELECT id FROM public.fantasy_categories WHERE slug='gt3'), 'Valentino Rossi', 'Team WRT', 46, 22, 180),
  ((SELECT id FROM public.fantasy_categories WHERE slug='gt3'), 'Dries Vanthoor', 'Team WRT', 32, 20, 165),
  ((SELECT id FROM public.fantasy_categories WHERE slug='gt3'), 'Maro Engel', 'Mercedes-AMG', 13, 18, 150),
  ((SELECT id FROM public.fantasy_categories WHERE slug='gt3'), 'Jules Gounon', 'Mercedes-AMG', 88, 16, 140),
  ((SELECT id FROM public.fantasy_categories WHERE slug='gt3'), 'Mattia Drudi', 'Audi Sport', 21, 14, 120),
  ((SELECT id FROM public.fantasy_categories WHERE slug='gt3'), 'Ricardo Feller', 'Audi Sport', 7, 12, 100);

-- Seed MotoGP drivers
INSERT INTO public.fantasy_drivers (category_id, name, team_name, number, price, points) VALUES
  ((SELECT id FROM public.fantasy_categories WHERE slug='motogp'), 'Francesco Bagnaia', 'Ducati Lenovo', 1, 28, 461),
  ((SELECT id FROM public.fantasy_categories WHERE slug='motogp'), 'Jorge Martin', 'Aprilia Racing', 89, 26, 497),
  ((SELECT id FROM public.fantasy_categories WHERE slug='motogp'), 'Marc Marquez', 'Ducati Lenovo', 93, 24, 372),
  ((SELECT id FROM public.fantasy_categories WHERE slug='motogp'), 'Enea Bastianini', 'KTM', 23, 18, 291),
  ((SELECT id FROM public.fantasy_categories WHERE slug='motogp'), 'Pedro Acosta', 'KTM Tech3', 37, 16, 181),
  ((SELECT id FROM public.fantasy_categories WHERE slug='motogp'), 'Maverick Viñales', 'Aprilia Racing', 12, 14, 163);
