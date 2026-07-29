
-- FOLLOWS / FRIEND REQUESTS
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view follows involving them" ON public.follows;
DROP POLICY IF EXISTS "Admins view all follows" ON public.follows;
DROP POLICY IF EXISTS "Users can send follow requests" ON public.follows;
DROP POLICY IF EXISTS "Users can update their received requests" ON public.follows;
DROP POLICY IF EXISTS "Users can delete their own follows" ON public.follows;
CREATE POLICY "Users can view follows involving them" ON public.follows FOR SELECT USING (auth.uid() = follower_id OR auth.uid() = following_id);
CREATE POLICY "Admins view all follows" ON public.follows FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can send follow requests" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can update their received requests" ON public.follows FOR UPDATE USING (auth.uid() = following_id OR auth.uid() = follower_id);
CREATE POLICY "Users can delete their own follows" ON public.follows FOR DELETE USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- PROFILE LIKES
CREATE TABLE IF NOT EXISTS public.profile_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, profile_user_id)
);
ALTER TABLE public.profile_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profile likes are public" ON public.profile_likes FOR SELECT USING (true);
CREATE POLICY "Users can like profiles" ON public.profile_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike profiles" ON public.profile_likes FOR DELETE USING (auth.uid() = user_id);

-- PROFILE COMMENTS
CREATE TABLE IF NOT EXISTS public.profile_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profile comments are public" ON public.profile_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment" ON public.profile_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update own comments" ON public.profile_comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete own comments" ON public.profile_comments FOR DELETE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

-- ARTICLE CATEGORIES
CREATE TABLE IF NOT EXISTS public.article_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  color text DEFAULT '#1565C0',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Article categories are public" ON public.article_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage article categories" ON public.article_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.article_categories (name, slug, color) VALUES
  ('Νέα', 'news', '#1565C0'),
  ('Οδηγοί & Setups', 'guides', '#2E7D32'),
  ('Αγώνες', 'races', '#B71C1C'),
  ('Συνεντεύξεις', 'interviews', '#6A1B9A'),
  ('Εκπαίδευση', 'tutorials', '#E65100')
ON CONFLICT (slug) DO NOTHING;

-- ARTICLES
CREATE TABLE IF NOT EXISTS public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.article_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  cover_url text,
  published boolean DEFAULT true,
  pinned boolean DEFAULT false,
  views integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published articles are public" ON public.articles FOR SELECT USING (published = true OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can create articles" ON public.articles FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors and admins can update articles" ON public.articles FOR UPDATE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authors and admins can delete articles" ON public.articles FOR DELETE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

-- ARTICLE COMMENTS
CREATE TABLE IF NOT EXISTS public.article_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Article comments are public" ON public.article_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment on articles" ON public.article_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors and admins can delete article comments" ON public.article_comments FOR DELETE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

-- ARTICLE LIKES
CREATE TABLE IF NOT EXISTS public.article_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, user_id)
);
ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Article likes are public" ON public.article_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like articles" ON public.article_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike articles" ON public.article_likes FOR DELETE USING (auth.uid() = user_id);

-- FORUM CATEGORIES
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text DEFAULT '🏁',
  color text DEFAULT '#1565C0',
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forum categories are public" ON public.forum_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage forum categories" ON public.forum_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.forum_categories (name, description, icon, color, sort_order) VALUES
  ('Γενικές Συζητήσεις', 'Γενικά θέματα για το simracing', '💬', '#1565C0', 1),
  ('Τεχνική Υποστήριξη', 'Hardware, software, setups και βοήθεια', '🔧', '#2E7D32', 2),
  ('Αγώνες & Leagues', 'Αποτελέσματα, εγγραφές και οργάνωση αγώνων', '🏆', '#B71C1C', 3),
  ('Simracing Games', 'Κουβέντα για παιχνίδια: ACC, iRacing, F1, rFactor', '🎮', '#6A1B9A', 4),
  ('Αγορές & Πωλήσεις', 'Αγοράστε και πουλήστε εξοπλισμό', '💰', '#E65100', 5),
  ('Off Topic', 'Οτιδήποτε άλλο εκτός simracing', '🌍', '#37474F', 6)
ON CONFLICT DO NOTHING;

-- FORUM THREADS
CREATE TABLE IF NOT EXISTS public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.forum_categories(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  pinned boolean DEFAULT false,
  locked boolean DEFAULT false,
  views integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forum threads are public" ON public.forum_threads FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create threads" ON public.forum_threads FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors and admins can update threads" ON public.forum_threads FOR UPDATE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authors and admins can delete threads" ON public.forum_threads FOR DELETE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

-- FORUM POSTS
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.forum_threads(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forum posts are public" ON public.forum_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can post replies" ON public.forum_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors and admins can update posts" ON public.forum_posts FOR UPDATE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authors and admins can delete posts" ON public.forum_posts FOR DELETE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

-- PODCAST EPISODES
CREATE TABLE IF NOT EXISTS public.podcast_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  spotify_id text,
  spotify_url text,
  host text,
  episode_number integer,
  duration text,
  category text DEFAULT 'Γενικά',
  published boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published episodes are public" ON public.podcast_episodes FOR SELECT USING (published = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage episodes" ON public.podcast_episodes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- SITE SETTINGS
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Site settings are public" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.site_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.site_settings (key, value) VALUES
  ('discord_server_id', '459797812251590677'),
  ('discord_invite_url', 'https://discord.gg/greeksimracers'),
  ('site_name', 'Greek SimRacers')
ON CONFLICT (key) DO NOTHING;

-- TRIGGERS
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_forum_threads_updated_at BEFORE UPDATE ON public.forum_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_forum_posts_updated_at BEFORE UPDATE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profile_comments_updated_at BEFORE UPDATE ON public.profile_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
