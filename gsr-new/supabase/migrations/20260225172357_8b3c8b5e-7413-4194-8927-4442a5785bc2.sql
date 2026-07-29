
-- Table for reaction time scores
CREATE TABLE public.reaction_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  reaction_time integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reaction_scores ENABLE ROW LEVEL SECURITY;

-- Everyone can see scores (for leaderboard)
CREATE POLICY "Reaction scores are public"
  ON public.reaction_scores FOR SELECT
  USING (true);

-- Authenticated users can insert their own scores
CREATE POLICY "Users can insert own scores"
  ON public.reaction_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own scores
CREATE POLICY "Users can delete own scores"
  ON public.reaction_scores FOR DELETE
  USING (auth.uid() = user_id);

-- Index for leaderboard queries
CREATE INDEX idx_reaction_scores_time ON public.reaction_scores (reaction_time ASC);
CREATE INDEX idx_reaction_scores_user ON public.reaction_scores (user_id);
