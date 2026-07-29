-- Driver of the Month
CREATE TABLE public.driver_of_month_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year text NOT NULL,
  driver_name text NOT NULL,
  driver_user_id uuid,
  nominated_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month_year, driver_name, nominated_by)
);

CREATE TABLE public.driver_of_month_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id uuid REFERENCES public.driver_of_month_nominations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  month_year text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_year)
);

ALTER TABLE public.driver_of_month_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_of_month_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nominations are public" ON public.driver_of_month_nominations FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can nominate" ON public.driver_of_month_nominations FOR INSERT TO authenticated WITH CHECK (auth.uid() = nominated_by);
CREATE POLICY "Admins can manage nominations" ON public.driver_of_month_nominations FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Votes are public" ON public.driver_of_month_votes FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can vote" ON public.driver_of_month_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own vote" ON public.driver_of_month_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Achievement Badges
CREATE TABLE public.achievement_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT '🏆',
  category text NOT NULL DEFAULT 'racing',
  requirement text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid REFERENCES public.achievement_badges(id) ON DELETE CASCADE NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  awarded_by uuid,
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.achievement_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges are public" ON public.achievement_badges FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage badges" ON public.achievement_badges FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Achievements are public" ON public.user_achievements FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage achievements" ON public.user_achievements FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- Predictions Game
CREATE TABLE public.prediction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  championship_id uuid REFERENCES public.championships(id) ON DELETE SET NULL,
  event_date timestamptz,
  deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved')),
  results jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.prediction_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.prediction_events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  predictions jsonb NOT NULL,
  points_earned integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.prediction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are public" ON public.prediction_events FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage events" ON public.prediction_events FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Entries are public" ON public.prediction_entries FOR SELECT TO public USING (true);
CREATE POLICY "Users can create entries" ON public.prediction_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own entries" ON public.prediction_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Incident Reports
CREATE TABLE public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  championship_id uuid REFERENCES public.championships(id) ON DELETE SET NULL,
  race_name text,
  description text NOT NULL,
  video_url text,
  drivers_involved text[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports" ON public.incident_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create reports" ON public.incident_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can manage reports" ON public.incident_reports FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- Teams
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag text,
  description text,
  logo_url text,
  banner_url text,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'captain', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams are public" ON public.teams FOR SELECT TO public USING (true);
CREATE POLICY "Users can create teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update teams" ON public.teams FOR UPDATE TO authenticated USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners can delete teams" ON public.teams FOR DELETE TO authenticated USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team members are public" ON public.team_members FOR SELECT TO public USING (true);
CREATE POLICY "Team owners can manage members" ON public.team_members FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team owners can remove members" ON public.team_members FOR DELETE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Lap Times
CREATE TABLE public.lap_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  track_name text NOT NULL,
  car_name text NOT NULL,
  sim_name text NOT NULL,
  lap_time_ms integer NOT NULL,
  conditions text DEFAULT 'dry',
  screenshot_url text,
  verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lap_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lap times are public" ON public.lap_times FOR SELECT TO public USING (true);
CREATE POLICY "Users can add lap times" ON public.lap_times FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own lap times" ON public.lap_times FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update lap times" ON public.lap_times FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));