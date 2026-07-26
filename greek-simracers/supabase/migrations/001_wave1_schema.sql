-- Greek Simracers — Wave 1 schema.
-- Consolidated, clean rewrite of the schema the original Lovable project
-- built up across 22 incremental migrations. Covers: profiles + roles,
-- articles, forum, championships, site settings, contact form.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- SECURITY DEFINER ώστε να μπορεί να καλείται μέσα από RLS policies χωρίς
-- αναδρομικό έλεγχο πάνω στο ίδιο το user_roles.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create policy "Users can view own roles"
  on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Admins manage roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Profiles (1:1 με auth.users, δημιουργείται αυτόματα με trigger)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  username text unique,
  avatar_url text,
  bio text,
  location text,
  favorite_sim text,
  setup_type text,
  favorite_track text,
  -- Νέοι λογαριασμοί χρειάζονται έγκριση διαχειριστή πριν την πρώτη σύνδεση.
  is_approved boolean not null default false,
  last_seen timestamptz,
  show_online boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete profiles"
  on public.profiles for delete
  using (public.has_role(auth.uid(), 'admin'));

-- Κανείς εκτός διαχειριστών δεν μπορεί να αλλάξει το is_approved —
-- ούτε ο ίδιος ο κάτοχος του προφίλ.
revoke update (is_approved) on public.profiles from authenticated, anon;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Άρθρα
-- ---------------------------------------------------------------------------

create table public.article_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  color text not null default '#1d4ed8',
  created_at timestamptz not null default now()
);

alter table public.article_categories enable row level security;

create policy "Article categories are publicly readable"
  on public.article_categories for select
  using (true);

create policy "Admins manage article categories"
  on public.article_categories for all
  using (public.has_role(auth.uid(), 'admin'));

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.article_categories(id) on delete set null,
  title text not null,
  content text not null,
  cover_url text,
  published boolean not null default true,
  pinned boolean not null default false,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.articles enable row level security;

create policy "Published articles are publicly readable"
  on public.articles for select
  using (published or auth.uid() = author_id or public.has_role(auth.uid(), 'admin'));

create policy "Authenticated users can create articles"
  on public.articles for insert
  with check (auth.uid() = author_id);

create policy "Authors and admins can update articles"
  on public.articles for update
  using (auth.uid() = author_id or public.has_role(auth.uid(), 'admin'));

create policy "Authors and admins can delete articles"
  on public.articles for delete
  using (auth.uid() = author_id or public.has_role(auth.uid(), 'admin'));

create table public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.article_comments enable row level security;

create policy "Article comments are publicly readable"
  on public.article_comments for select
  using (true);

create policy "Authenticated users can comment"
  on public.article_comments for insert
  with check (auth.uid() = author_id);

create policy "Authors can update own comments"
  on public.article_comments for update
  using (auth.uid() = author_id);

create policy "Authors and admins can delete comments"
  on public.article_comments for delete
  using (auth.uid() = author_id or public.has_role(auth.uid(), 'admin'));

create table public.article_likes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (article_id, user_id)
);

alter table public.article_likes enable row level security;

create policy "Article likes are publicly readable"
  on public.article_likes for select
  using (true);

create policy "Users can like"
  on public.article_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike"
  on public.article_likes for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Forum
-- ---------------------------------------------------------------------------

create table public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text not null default '💬',
  color text not null default '#1d4ed8',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.forum_categories enable row level security;

create policy "Forum categories are publicly readable"
  on public.forum_categories for select
  using (true);

create policy "Admins manage forum categories"
  on public.forum_categories for all
  using (public.has_role(auth.uid(), 'admin'));

create table public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.forum_categories(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  pinned boolean not null default false,
  locked boolean not null default false,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.forum_threads enable row level security;

create policy "Forum threads are publicly readable"
  on public.forum_threads for select
  using (true);

create policy "Authenticated users can create threads"
  on public.forum_threads for insert
  with check (auth.uid() = author_id);

create policy "Authors and admins can update threads"
  on public.forum_threads for update
  using (auth.uid() = author_id or public.has_role(auth.uid(), 'admin'));

create policy "Authors and admins can delete threads"
  on public.forum_threads for delete
  using (auth.uid() = author_id or public.has_role(auth.uid(), 'admin'));

create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.forum_posts enable row level security;

create policy "Forum posts are publicly readable"
  on public.forum_posts for select
  using (true);

create policy "Authenticated users can reply"
  on public.forum_posts for insert
  with check (auth.uid() = author_id);

create policy "Authors can update own posts"
  on public.forum_posts for update
  using (auth.uid() = author_id);

create policy "Authors and admins can delete posts"
  on public.forum_posts for delete
  using (auth.uid() = author_id or public.has_role(auth.uid(), 'admin'));

-- Κρατά το updated_at του thread φρέσκο σε κάθε νέα απάντηση, ώστε το
-- "τελευταία δραστηριότητα" ordering να δουλεύει χωρίς client-side λογική.
create or replace function public.touch_thread_on_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.forum_threads set updated_at = now() where id = new.thread_id;
  return new;
end;
$$;

create trigger on_forum_post_created
  after insert on public.forum_posts
  for each row execute function public.touch_thread_on_post();

-- ---------------------------------------------------------------------------
-- View counters (διόρθωση bug του πρωτότυπου: πραγματικό increment αντί
-- για hardcoded τιμή, χωρίς να απαιτείται UPDATE policy στους επισκέπτες)
-- ---------------------------------------------------------------------------

create or replace function public.increment_article_views(article_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.articles set views = views + 1 where id = article_id;
$$;

create or replace function public.increment_thread_views(thread_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.forum_threads set views = views + 1 where id = thread_id;
$$;

-- ---------------------------------------------------------------------------
-- Championships
-- ---------------------------------------------------------------------------

create table public.championships (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'upcoming' check (status in ('active', 'upcoming', 'completed')),
  category text,
  races_completed integer not null default 0,
  races_total integer not null default 0,
  participants integer not null default 0,
  start_date date,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.championships enable row level security;

create policy "Championships are publicly readable"
  on public.championships for select
  using (true);

create policy "Admins manage championships"
  on public.championships for all
  using (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Site settings (key/value)
-- ---------------------------------------------------------------------------

create table public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

create policy "Site settings are publicly readable"
  on public.site_settings for select
  using (true);

create policy "Admins manage site settings"
  on public.site_settings for all
  using (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Φόρμα επικοινωνίας (νέο — το πρωτότυπο δεν αποθήκευε πουθενά τα μηνύματα)
-- ---------------------------------------------------------------------------

create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null check (char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;

-- Οποιοσδήποτε (και ανώνυμος) μπορεί να στείλει μήνυμα· μόνο διαχειριστές
-- μπορούν να τα διαβάσουν.
create policy "Anyone can submit contact form"
  on public.contact_submissions for insert
  with check (true);

create policy "Admins read contact submissions"
  on public.contact_submissions for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins delete contact submissions"
  on public.contact_submissions for delete
  using (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('covers', 'covers', true),
  ('article-images', 'article-images', true);

create policy "Public read for site buckets"
  on storage.objects for select
  using (bucket_id in ('avatars', 'covers', 'article-images'));

create policy "Authenticated upload to site buckets"
  on storage.objects for insert
  with check (
    bucket_id in ('avatars', 'covers', 'article-images')
    and auth.role() = 'authenticated'
  );

create policy "Owners manage own objects"
  on storage.objects for update
  using (bucket_id in ('avatars', 'covers', 'article-images') and owner = auth.uid());

create policy "Owners delete own objects"
  on storage.objects for delete
  using (bucket_id in ('avatars', 'covers', 'article-images') and owner = auth.uid());

-- ---------------------------------------------------------------------------
-- Seed δεδομένα
-- ---------------------------------------------------------------------------

insert into public.article_categories (name, slug, color) values
  ('Νέα', 'nea', '#1d4ed8'),
  ('Οδηγοί & Setups', 'odigoi-setups', '#0891b2'),
  ('Αγώνες', 'agones', '#dc2626'),
  ('Συνεντεύξεις', 'synentefxeis', '#7c3aed'),
  ('Εκπαίδευση', 'ekpaideysi', '#059669');

insert into public.forum_categories (name, description, icon, color, sort_order) values
  ('Γενικές Συζητήσεις', 'Ό,τι αφορά το sim racing και την κοινότητα', '💬', '#1d4ed8', 1),
  ('Τεχνική Υποστήριξη', 'Hardware, software και ρυθμίσεις', '🔧', '#0891b2', 2),
  ('Αγώνες & Leagues', 'Διοργανώσεις, πρωταθλήματα και αποτελέσματα', '🏆', '#dc2626', 3),
  ('Simracing Games', 'ACC, iRacing, F1, Assetto Corsa και άλλα', '🎮', '#7c3aed', 4),
  ('Αγορές & Πωλήσεις', 'Αγγελίες για εξοπλισμό sim racing', '💰', '#059669', 5),
  ('Off Topic', 'Συζητήσεις εκτός θέματος', '🗨️', '#6b7280', 6);

insert into public.site_settings (key, value) values
  ('site_name', 'Greek Simracers'),
  ('discord_invite_url', ''),
  ('discord_server_id', '');
