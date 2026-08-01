-- Greek Simracers — πίνακας χρόνων του GSR Time Attack (game.html).
-- Τρέξε το μετά το 001_wave1_schema.sql (χρησιμοποιεί τη public.has_role).
--
-- Το παιχνίδι δουλεύει και χωρίς αυτόν τον πίνακα: οι χρόνοι κρατιούνται
-- τοπικά στον browser. Ο πίνακας προσθέτει μόνο το κοινό leaderboard.

create table public.game_lap_times (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Το όνομα που έδωσε ο παίκτης στο παιχνίδι (μπορεί να διαφέρει από το προφίλ).
  driver_name text not null check (char_length(driver_name) between 1 and 24),
  track_id text not null,
  car_id text not null,
  -- Χρόνος γύρου σε ms. Το κάτω όριο κόβει προφανώς αδύνατους χρόνους.
  lap_ms integer not null check (lap_ms between 10000 and 1800000),
  created_at timestamptz not null default now()
);

alter table public.game_lap_times enable row level security;

create policy "Lap times are publicly readable"
  on public.game_lap_times for select
  using (true);

create policy "Users can submit own lap times"
  on public.game_lap_times for insert
  with check (auth.uid() = user_id);

create policy "Users and admins can delete lap times"
  on public.game_lap_times for delete
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- Το leaderboard ρωτάει πάντα "οι ταχύτεροι χρόνοι αυτής της πίστας".
create index game_lap_times_track_lap_idx on public.game_lap_times (track_id, lap_ms);
create index game_lap_times_user_idx on public.game_lap_times (user_id);
