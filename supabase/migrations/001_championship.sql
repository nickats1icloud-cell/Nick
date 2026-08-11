-- ============================================================================
-- Race Control — schema πρωταθλήματος Le Mans Ultimate
-- ============================================================================
-- Πλήρες backend για το /championship: πίνακες, RLS πολιτικές, triggers και
-- RPC. Η λογική δικαιωμάτων που πριν ήταν μόνο στο UI εφαρμόζεται εδώ, στη
-- βάση — δηλαδή δεν παρακάμπτεται από τον browser.
--
-- Μοντέλο πρόσβασης
--   • Διοργανωτής (ADMIN)  : όλα, μέσα στο πρωτάθλημά του
--   • Αρχηγός (PRINCIPAL)  : roster και πλάνα ΜΟΝΟ της ομάδας του
--   • Οδηγός (DRIVER)      : τα προσωπικά του στοιχεία και η διαθεσιμότητά του
--   • Επισκέπτης (anon)    : καλεντάρι, ομάδες, αποτελέσματα, βαθμολογίες
--                            — ΟΧΙ πλάνα stint (η στρατηγική είναι μυστική)
--
-- Εκτέλεση: Supabase Dashboard → SQL Editor → paste → Run
--           ή: supabase db push
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- πίνακες --

create table if not exists championships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text not null default '',
  organizer text not null default '',
  description text not null default '',
  classes text[] not null default array['HYPERCAR', 'LMP2', 'LMGT3'],
  rules jsonb not null default '{}'::jsonb,
  scoring jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

comment on table championships is 'Ένα πρωτάθλημα/σεζόν. Τα rules και scoring μένουν jsonb ώστε ο κανονισμός να εξελίσσεται χωρίς migration.';

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references championships on delete cascade,
  -- Ο οδηγός υπάρχει στο roster πριν φτιάξει λογαριασμό: ο αρχηγός τον
  -- προσθέτει με email, και στο signup συνδέεται αυτόματα (trigger παρακάτω).
  user_id uuid references auth.users on delete set null,
  email text,
  name text not null,
  nickname text not null default '',
  country text not null default '',
  category text not null default 'SILVER'
    check (category in ('PLATINUM', 'GOLD', 'SILVER', 'BRONZE')),
  steam_id text not null default '',
  discord text not null default '',
  role text not null default 'DRIVER' check (role in ('ADMIN', 'PRINCIPAL', 'DRIVER')),
  team_id uuid,
  pace_delta_sec numeric not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (championship_id, user_id)
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references championships on delete cascade,
  name text not null,
  short_name text not null default '',
  car_class text not null default 'LMP2',
  car text not null default '',
  number text not null default '',
  color text not null default '#7c5cff',
  principal_id uuid references drivers on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

do $$
begin
  alter table drivers
    add constraint drivers_team_id_fkey
    foreign key (team_id) references teams (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

create index if not exists drivers_championship_idx on drivers (championship_id);
create index if not exists drivers_team_idx on drivers (team_id);
create index if not exists drivers_user_idx on drivers (user_id);
create index if not exists teams_championship_idx on teams (championship_id);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references championships on delete cascade,
  round int not null default 1,
  name text not null,
  track_id text not null default '',
  -- timestamptz και όχι τοπικό string: τώρα που το βλέπουν πολλοί χρήστες σε
  -- διαφορετικές ζώνες ώρας, η ώρα εκκίνησης πρέπει να είναι απόλυτη.
  starts_at timestamptz,
  duration_minutes int not null default 360 check (duration_minutes > 0),
  status text not null default 'UPCOMING' check (status in ('UPCOMING', 'LIVE', 'DONE')),
  notes text not null default ''
);

create index if not exists events_championship_idx on events (championship_id, round);

create table if not exists availability (
  event_id uuid not null references events on delete cascade,
  driver_id uuid not null references drivers on delete cascade,
  value text not null check (value in ('YES', 'MAYBE', 'NO')),
  updated_at timestamptz not null default now(),
  primary key (event_id, driver_id)
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  team_id uuid not null references teams on delete cascade,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'CHANGES')),
  strategy_note text not null default '',
  car jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (event_id, team_id)
);

create table if not exists stints (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans on delete cascade,
  position int not null default 0,
  driver_id uuid references drivers on delete set null,
  laps int not null default 10 check (laps > 0),
  lap_time_sec numeric not null default 0,
  fuel_added_l numeric not null default 0,
  tyres text not null default 'NEW' check (tyres in ('NEW', 'KEEP', 'USED')),
  compound text not null default 'MEDIUM',
  note text not null default ''
);

create index if not exists stints_plan_idx on stints (plan_id, position);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references events on delete cascade,
  published_at timestamptz
);

create table if not exists result_entries (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references results on delete cascade,
  team_id uuid not null references teams on delete cascade,
  position int not null default 0,
  class_position int not null default 0,
  laps int not null default 0,
  total_time_sec numeric not null default 0,
  best_lap_sec numeric not null default 0,
  status text not null default 'FINISHED'
    check (status in ('FINISHED', 'DNF', 'DSQ', 'DNS')),
  pole boolean not null default false,
  fastest_lap boolean not null default false,
  penalty_points numeric not null default 0,
  driver_ids uuid[] not null default '{}',
  note text not null default '',
  unique (result_id, team_id)
);

create table if not exists activity_log (
  id bigserial primary key,
  championship_id uuid not null references championships on delete cascade,
  at timestamptz not null default now(),
  who text not null default '',
  message text not null default ''
);

create index if not exists activity_log_champ_idx on activity_log (championship_id, at desc);

-- -------------------------------------------------- βοηθητικές συναρτήσεις --
-- SECURITY DEFINER: παρακάμπτουν το RLS ώστε οι πολιτικές να μη καλούν
-- αναδρομικά τον εαυτό τους (κλασική παγίδα του Postgres RLS).

create or replace function lmu_is_admin(p_champ uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from drivers
    where championship_id = p_champ and user_id = auth.uid() and role = 'ADMIN'
  );
$$;

create or replace function lmu_is_member(p_champ uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from drivers where championship_id = p_champ and user_id = auth.uid()
  );
$$;

create or replace function lmu_is_principal(p_team uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from teams t
    join drivers d on d.id = t.principal_id
    where t.id = p_team and d.user_id = auth.uid()
  );
$$;

create or replace function lmu_in_team(p_team uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from drivers where team_id = p_team and user_id = auth.uid()
  );
$$;

create or replace function lmu_champ_of_team(p_team uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select championship_id from teams where id = p_team;
$$;

create or replace function lmu_champ_of_event(p_event uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select championship_id from events where id = p_event;
$$;

create or replace function lmu_champ_of_driver(p_driver uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select championship_id from drivers where id = p_driver;
$$;

create or replace function lmu_team_of_driver(p_driver uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select team_id from drivers where id = p_driver;
$$;

create or replace function lmu_is_self(p_driver uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from drivers where id = p_driver and user_id = auth.uid());
$$;

/** Το πρωτάθλημα ενός πλάνου — για τις πολιτικές των stints. */
create or replace function lmu_team_of_plan(p_plan uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select team_id from plans where id = p_plan;
$$;

/**
 * Μπορεί ο συνδεδεμένος χρήστης να πειράξει αυτό το πλάνο;
 * Ο διοργανωτής πάντα· ο αρχηγός μόνο όσο το πλάνο ΔΕΝ είναι εγκεκριμένο.
 * Το κλείδωμα του εγκεκριμένου πλάνου επιβάλλεται εδώ, στη βάση.
 */
create or replace function lmu_can_edit_plan(p_plan uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from plans p
    join teams t on t.id = p.team_id
    where p.id = p_plan
      and (
        lmu_is_admin(t.championship_id)
        or (lmu_is_principal(t.id) and p.status <> 'APPROVED')
      )
  );
$$;

create or replace function lmu_can_view_plan(p_plan uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from plans p
    join teams t on t.id = p.team_id
    where p.id = p_plan
      and (lmu_is_admin(t.championship_id) or lmu_is_principal(t.id) or lmu_in_team(t.id))
  );
$$;

-- ------------------------------------------------------------------ RLS on --

alter table championships enable row level security;
alter table drivers enable row level security;
alter table teams enable row level security;
alter table events enable row level security;
alter table availability enable row level security;
alter table plans enable row level security;
alter table stints enable row level security;
alter table results enable row level security;
alter table result_entries enable row level security;
alter table activity_log enable row level security;

-- --- championships: δημόσια ανάγνωση, αλλαγές μόνο από τη διοργάνωση ---
drop policy if exists championships_read on championships;
create policy championships_read on championships for select using (true);

drop policy if exists championships_write on championships;
create policy championships_write on championships for update
  using (lmu_is_admin(id)) with check (lmu_is_admin(id));

drop policy if exists championships_delete on championships;
create policy championships_delete on championships for delete using (lmu_is_admin(id));
-- INSERT: μόνο μέσω lmu_create_championship() (φτιάχνει και τον ADMIN οδηγό).

-- --- events / teams: δημόσια ανάγνωση (καλεντάρι & συμμετοχές) ---
drop policy if exists events_read on events;
create policy events_read on events for select using (true);

drop policy if exists events_write on events;
create policy events_write on events for all
  using (lmu_is_admin(championship_id)) with check (lmu_is_admin(championship_id));

drop policy if exists teams_read on teams;
create policy teams_read on teams for select using (true);

drop policy if exists teams_admin on teams;
create policy teams_admin on teams for all
  using (lmu_is_admin(championship_id)) with check (lmu_is_admin(championship_id));

-- Ο αρχηγός αλλάζει τα στοιχεία της ομάδας του (όχι κατηγορία — δες trigger).
drop policy if exists teams_principal_update on teams;
create policy teams_principal_update on teams for update
  using (lmu_is_principal(id)) with check (lmu_is_principal(id));

-- --- drivers: ανάγνωση μόνο για μέλη (η στήλη email δεν είναι δημόσια).
--     Οι επισκέπτες βλέπουν ονόματα μέσω του view v_public_drivers. ---
drop policy if exists drivers_read on drivers;
create policy drivers_read on drivers for select
  to authenticated using (lmu_is_member(championship_id));

drop policy if exists drivers_admin on drivers;
create policy drivers_admin on drivers for all
  using (lmu_is_admin(championship_id)) with check (lmu_is_admin(championship_id));

-- Ο αρχηγός προσθέτει οδηγούς στη δική του ομάδα…
drop policy if exists drivers_principal_insert on drivers;
create policy drivers_principal_insert on drivers for insert
  to authenticated with check (lmu_is_principal(team_id));

-- …και αλλάζει τους οδηγούς της ομάδας του (ποιες στήλες: δες lmu_guard_driver).
drop policy if exists drivers_principal_update on drivers;
create policy drivers_principal_update on drivers for update
  to authenticated using (lmu_is_principal(team_id)) with check (true);

drop policy if exists drivers_principal_delete on drivers;
create policy drivers_principal_delete on drivers for delete
  to authenticated using (lmu_is_principal(team_id));

-- Ο κάθε οδηγός ενημερώνει τα δικά του στοιχεία.
drop policy if exists drivers_self_update on drivers;
create policy drivers_self_update on drivers for update
  to authenticated using (user_id = auth.uid()) with check (true);

-- --- availability: μέλη διαβάζουν, γράφει ο ίδιος / ο αρχηγός / η διοργάνωση ---
drop policy if exists availability_read on availability;
create policy availability_read on availability for select
  to authenticated using (lmu_is_member(lmu_champ_of_event(event_id)));

drop policy if exists availability_write on availability;
create policy availability_write on availability for all
  to authenticated
  using (
    lmu_is_admin(lmu_champ_of_event(event_id))
    or lmu_is_self(driver_id)
    or lmu_is_principal(lmu_team_of_driver(driver_id))
  )
  with check (
    lmu_is_admin(lmu_champ_of_event(event_id))
    or lmu_is_self(driver_id)
    or lmu_is_principal(lmu_team_of_driver(driver_id))
  );

-- --- plans & stints: ΜΥΣΤΙΚΑ. Μόνο η ομάδα τους και η διοργάνωση. ---
drop policy if exists plans_read on plans;
create policy plans_read on plans for select
  to authenticated
  using (
    lmu_is_admin(lmu_champ_of_team(team_id))
    or lmu_is_principal(team_id)
    or lmu_in_team(team_id)
  );

drop policy if exists plans_insert on plans;
create policy plans_insert on plans for insert
  to authenticated
  with check (lmu_is_admin(lmu_champ_of_team(team_id)) or lmu_is_principal(team_id));

drop policy if exists plans_update on plans;
create policy plans_update on plans for update
  to authenticated
  using (
    lmu_is_admin(lmu_champ_of_team(team_id))
    or (lmu_is_principal(team_id) and status <> 'APPROVED')
  )
  with check (lmu_is_admin(lmu_champ_of_team(team_id)) or lmu_is_principal(team_id));

drop policy if exists plans_delete on plans;
create policy plans_delete on plans for delete
  to authenticated using (lmu_is_admin(lmu_champ_of_team(team_id)));

drop policy if exists stints_read on stints;
create policy stints_read on stints for select
  to authenticated using (lmu_can_view_plan(plan_id));

drop policy if exists stints_write on stints;
create policy stints_write on stints for all
  to authenticated using (lmu_can_edit_plan(plan_id)) with check (lmu_can_edit_plan(plan_id));

-- --- αποτελέσματα: δημόσια ανάγνωση, γράφει μόνο η διοργάνωση ---
drop policy if exists results_read on results;
create policy results_read on results for select using (true);

drop policy if exists results_write on results;
create policy results_write on results for all
  using (lmu_is_admin(lmu_champ_of_event(event_id)))
  with check (lmu_is_admin(lmu_champ_of_event(event_id)));

drop policy if exists result_entries_read on result_entries;
create policy result_entries_read on result_entries for select using (true);

drop policy if exists result_entries_write on result_entries;
create policy result_entries_write on result_entries for all
  using (lmu_is_admin(lmu_champ_of_team(team_id)))
  with check (lmu_is_admin(lmu_champ_of_team(team_id)));

-- --- ιστορικό ενεργειών: μέλη ---
drop policy if exists activity_read on activity_log;
create policy activity_read on activity_log for select
  to authenticated using (lmu_is_member(championship_id));

drop policy if exists activity_insert on activity_log;
create policy activity_insert on activity_log for insert
  to authenticated with check (lmu_is_member(championship_id));

-- --------------------------------------------------------- δημόσιο roster --
-- View χωρίς email/notes, ώστε οι επισκέπτες να βλέπουν βαθμολογίες οδηγών
-- χωρίς να εκτίθενται προσωπικά στοιχεία. Ανήκει στον owner του schema, οπότε
-- διαβάζει τον πίνακα χωρίς RLS (security_invoker = off, η προεπιλογή).

create or replace view v_public_drivers as
  select id, championship_id, team_id, name, nickname, country, category, role,
         pace_delta_sec
  from drivers;

grant select on v_public_drivers to anon, authenticated;

-- ------------------------------------------------------------------ triggers --

/** Ποιες στήλες οδηγού επιτρέπεται να αλλάξει ο καθένας. */
create or replace function lmu_guard_driver()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if lmu_is_admin(old.championship_id) then
    return new;
  end if;

  -- Κοινά για όλους τους μη-διοργανωτές: αυτά δεν αλλάζουν ποτέ από το UI.
  new.championship_id := old.championship_id;
  new.user_id := old.user_id;

  if lmu_is_principal(old.team_id) or lmu_is_principal(new.team_id) then
    -- Ο αρχηγός δεν μοιράζει ρόλους — αυτό είναι δουλειά της διοργάνωσης.
    new.role := old.role;
    return new;
  end if;

  if old.user_id = auth.uid() then
    -- Ο οδηγός αλλάζει μόνο τα προσωπικά του στοιχεία.
    new.role := old.role;
    new.category := old.category;
    new.team_id := old.team_id;
    new.pace_delta_sec := old.pace_delta_sec;
    return new;
  end if;

  raise exception 'Δεν επιτρέπεται η αλλαγή αυτού του οδηγού';
end $$;

drop trigger if exists guard_driver on drivers;
create trigger guard_driver before update on drivers
  for each row execute function lmu_guard_driver();

/** Η κατηγορία της ομάδας ορίζεται από τη διοργάνωση, όχι από τον αρχηγό. */
create or replace function lmu_guard_team()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if lmu_is_admin(old.championship_id) then
    return new;
  end if;
  new.championship_id := old.championship_id;
  new.car_class := old.car_class;
  return new;
end $$;

drop trigger if exists guard_team on teams;
create trigger guard_team before update on teams
  for each row execute function lmu_guard_team();

/** Έγκριση πλάνου = αποκλειστικό δικαίωμα της διοργάνωσης. */
create or replace function lmu_guard_plan()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  if lmu_is_admin(lmu_champ_of_team(new.team_id)) then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'APPROVED' then
      raise exception 'Το πλάνο είναι εγκεκριμένο και κλειδωμένο από τη διοργάνωση';
    end if;
    if new.status in ('APPROVED', 'CHANGES') and new.status <> old.status then
      raise exception 'Την έγκριση πλάνου την κάνει μόνο η διοργάνωση';
    end if;
  elsif new.status <> 'DRAFT' then
    raise exception 'Το νέο πλάνο ξεκινά ως πρόχειρο';
  end if;
  return new;
end $$;

drop trigger if exists guard_plan on plans;
create trigger guard_plan before insert or update on plans
  for each row execute function lmu_guard_plan();

/** Ο οδηγός ενός stint πρέπει να ανήκει στην ομάδα του πλάνου. */
create or replace function lmu_guard_stint()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid;
begin
  if new.driver_id is null then
    return new;
  end if;
  v_team := lmu_team_of_plan(new.plan_id);
  if lmu_team_of_driver(new.driver_id) is distinct from v_team then
    raise exception 'Ο οδηγός δεν ανήκει στην ομάδα αυτού του πλάνου';
  end if;
  return new;
end $$;

drop trigger if exists guard_stint on stints;
create trigger guard_stint before insert or update on stints
  for each row execute function lmu_guard_stint();

/** Στο signup, ο λογαριασμός δένεται με τον οδηγό που τον περιμένει (ίδιο email). */
create or replace function lmu_link_driver_on_signup()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update drivers
  set user_id = new.id
  where user_id is null and email is not null and lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function lmu_link_driver_on_signup();

-- ---------------------------------------------------------------------- RPC --

/**
 * Δημιουργία πρωταθλήματος. Δεν γίνεται με απλό INSERT γιατί ο δημιουργός
 * πρέπει ταυτόχρονα να γίνει ADMIN οδηγός — αλλιώς δεν θα είχε δικαιώματα
 * πάνω σε αυτό που μόλις έφτιαξε.
 */
create or replace function lmu_create_championship(
  p_name text,
  p_season text default '',
  p_organizer text default '',
  p_display_name text default '',
  p_rules jsonb default '{}'::jsonb,
  p_scoring jsonb default '{}'::jsonb,
  p_classes text[] default array['HYPERCAR', 'LMP2', 'LMGT3']
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Χρειάζεται σύνδεση για να δημιουργήσεις πρωτάθλημα';
  end if;
  select email into v_email from auth.users where id = auth.uid();

  insert into championships (name, season, organizer, classes, rules, scoring, created_by)
  values (coalesce(nullif(p_name, ''), 'Νέο πρωτάθλημα'), coalesce(p_season, ''),
          coalesce(p_organizer, ''), p_classes, coalesce(p_rules, '{}'::jsonb),
          coalesce(p_scoring, '{}'::jsonb), auth.uid())
  returning id into v_id;

  insert into drivers (championship_id, user_id, email, name, role, category)
  values (v_id, auth.uid(), v_email,
          coalesce(nullif(p_display_name, ''), split_part(coalesce(v_email, 'Διοργανωτής'), '@', 1)),
          'ADMIN', 'GOLD');

  insert into activity_log (championship_id, who, message)
  values (v_id, coalesce(p_display_name, v_email, '—'), 'Δημιουργήθηκε το πρωτάθλημα.');

  return v_id;
end $$;

/**
 * «Είμαι εγώ αυτός ο οδηγός»: δένει τον λογαριασμό με roster εγγραφή που έχει
 * το ίδιο email — για όταν ο αρχηγός πρόσθεσε το email *μετά* το signup.
 */
create or replace function lmu_claim_driver()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email text;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Χρειάζεται σύνδεση';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return 0;
  end if;
  update drivers set user_id = auth.uid()
  where user_id is null and lower(email) = lower(v_email);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function lmu_create_championship(text, text, text, text, jsonb, jsonb, text[])
  to authenticated;
grant execute on function lmu_claim_driver() to authenticated;

-- ------------------------------------------------------------------ realtime --
-- Ό,τι αλλάζει κάποιος, το βλέπουν οι άλλοι χωρίς refresh.

do $$
begin
  alter publication supabase_realtime add table championships, events, teams, drivers,
    availability, plans, stints, results, result_entries, activity_log;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
