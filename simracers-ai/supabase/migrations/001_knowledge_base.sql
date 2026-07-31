-- Βάση γνώσης για τον AI βοηθό των Greek SimRacers.
--
-- Ιδέα: όλο το υλικό (podcast transcripts, κανονισμοί, περιεχόμενο του site)
-- σπάει σε μικρά κομμάτια ("chunks"). Σε κάθε ερώτηση ψάχνουμε ποια κομμάτια
-- ταιριάζουν και στέλνουμε ΜΟΝΟ αυτά στον Claude — όχι όλο το αρχείο. Έτσι
-- μένει φθηνό και γρήγορο ακόμα κι όταν τα επεισόδια γίνουν 50.
--
-- Η αναζήτηση είναι λεξιλογική (full-text) με ελληνική κανονικοποίηση:
-- πεζά + αφαίρεση τόνων + τελικό σίγμα, ώστε "ΣΕΤΆΠ", "σετάπ" και "σεταπ"
-- να θεωρούνται η ίδια λέξη.

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- Κανονικοποίηση ελληνικού κειμένου.
--
-- Γιατί translate() και όχι σκέτο lower(): η lower() πεζοποιεί ελληνικά μόνο
-- αν το collation της βάσης είναι UTF-8. Σε collation "C" αφήνει το «ΠΟΙΝΕΣ»
-- ως έχει, και τότε η αναζήτηση με κεφαλαία δεν βρίσκει τίποτα. Το translate()
-- δουλεύει το ίδιο παντού, οπότε δεν εξαρτόμαστε από τη ρύθμιση του project.
--
-- Σειρά: κεφαλαία → πεζά, μετά αφαίρεση τόνων, μετά τελικό σίγμα.
-- Έτσι «ΣΕΤΆΠ», «Σετάπ» και «σεταπ» καταλήγουν όλα στο ίδιο «σεταπ».
--
-- IMMUTABLE γιατί χρησιμοποιείται σε generated column / index.
create or replace function gsr_normalize(txt text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select replace(
           unaccent('unaccent',
             lower(translate(
               txt,
               'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩΆΈΉΊΌΎΏΪΫ',
               'αβγδεζηθικλμνξοπρστυφχψωάέήίόύώϊϋ'
             ))
           ),
           'ς', 'σ'
         );
$$;

-- Ένα chunk = ένα κομμάτι κειμένου με την προέλευσή του.
create table if not exists kb_chunks (
  id          bigint generated always as identity primary key,

  -- Από πού προέρχεται: 'podcast' | 'rules' | 'site' | 'general'
  source      text not null check (source in ('podcast', 'rules', 'site', 'general')),

  -- Τίτλος πηγής, π.χ. "Επεισόδιο 3 — Το πρώτο μας πρωτάθλημα"
  title       text not null,

  -- Προαιρετικός σύνδεσμος (Spotify episode, σελίδα του site, Google Doc)
  url         text,

  -- Θέση μέσα στην πηγή, για σωστή σειρά και για αναφορά στον χρήστη
  ordinal     integer not null default 0,

  -- Χρονική σήμανση στο podcast (δευτερόλεπτα από την αρχή), αν υπάρχει
  start_sec   integer,

  content     text not null,

  created_at  timestamptz not null default now(),

  unique (source, title, ordinal)
);

-- Το full-text διάνυσμα. 'simple' γιατί η Postgres δεν έχει ελληνικό
-- λεξικό stemming — η κανονικοποίηση από πάνω κάνει τη δουλειά.
alter table kb_chunks
  add column if not exists tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', gsr_normalize(title)), 'A') ||
    setweight(to_tsvector('simple', gsr_normalize(content)), 'B')
  ) stored;

create index if not exists kb_chunks_tsv_idx on kb_chunks using gin (tsv);
create index if not exists kb_chunks_trgm_idx
  on kb_chunks using gin (gsr_normalize(content) gin_trgm_ops);
create index if not exists kb_chunks_source_idx on kb_chunks (source);

-- Αναζήτηση: πρώτα full-text, και αν δεν βρεθεί τίποτα πέφτουμε σε
-- fuzzy trigram (πιάνει ορθογραφικά λάθη και μισοτελειωμένες λέξεις).
create or replace function search_kb(query_text text, match_limit integer default 12)
returns table (
  id        bigint,
  source    text,
  title     text,
  url       text,
  start_sec integer,
  content   text,
  score     real
)
language plpgsql
stable
as $$
declare
  normalized text := gsr_normalize(coalesce(query_text, ''));
  ts_query   tsquery;
begin
  if length(trim(normalized)) = 0 then
    return;
  end if;

  -- websearch_to_tsquery δέχεται ελεύθερο κείμενο χωρίς να σκάει σε σύμβολα.
  ts_query := websearch_to_tsquery('simple', normalized);

  return query
    select c.id, c.source, c.title, c.url, c.start_sec, c.content,
           ts_rank_cd(c.tsv, ts_query)::real as score
    from kb_chunks c
    where c.tsv @@ ts_query
    order by score desc, c.source, c.ordinal
    limit match_limit;

  -- Η FOUND ενημερώνεται από το RETURN QUERY. Αν βρήκαμε ακριβή αποτελέσματα,
  -- σταματάμε εδώ — το fuzzy είναι μόνο δίχτυ ασφαλείας.
  if found then
    return;
  end if;

  -- Fuzzy fallback για ορθογραφικά λάθη ("στρατιγική" αντί "στρατηγική") και
  -- για τα λάθη της αυτόματης απομαγνητοφώνησης.
  --
  -- Χρησιμοποιούμε word_similarity και όχι similarity: η similarity συγκρίνει
  -- ΟΛΟΚΛΗΡΟ το κείμενο του chunk με την ερώτηση, οπότε μια σύντομη ερώτηση
  -- απέναντι σε μια παράγραφο βγάζει σκορ σχεδόν μηδέν και το fallback δεν
  -- πυροδοτείται ποτέ. Η word_similarity ψάχνει την καλύτερη λέξη μέσα στο
  -- κείμενο, που είναι αυτό που θέλουμε.
  --
  -- Συγκρίνουμε λέξη-λέξη και κρατάμε το καλύτερο σκορ ανά chunk. Λέξεις
  -- κάτω των 4 χαρακτήρων αγνοούνται — άρθρα και προθέσεις ταιριάζουν με
  -- τα πάντα και μόνο θόρυβο προσθέτουν.
  return query
    with query_words as (
      select w
      from unnest(string_to_array(normalized, ' ')) as w
      where length(w) >= 4
    )
    select c.id, c.source, c.title, c.url, c.start_sec, c.content,
           max(word_similarity(qw.w, gsr_normalize(c.content)))::real as score
    from kb_chunks c
    join query_words qw on qw.w <% gsr_normalize(c.content)
    group by c.id, c.source, c.title, c.url, c.start_sec, c.content
    order by score desc
    limit match_limit;
end;
$$;

-- RLS: η βάση γνώσης είναι δημόσια για ανάγνωση (το site τη διαβάζει μέσω
-- του Edge Function), αλλά γράφεται μόνο με το service_role key.
alter table kb_chunks enable row level security;

drop policy if exists "kb_chunks_public_read" on kb_chunks;
create policy "kb_chunks_public_read"
  on kb_chunks for select
  using (true);

-- Καταγραφή ερωτήσεων: χρήσιμη για να δεις τι ρωτάει ο κόσμος και τι
-- δεν καλύπτει η βάση γνώσης. Δεν αποθηκεύεται τίποτα προσωπικό.
create table if not exists kb_queries (
  id           bigint generated always as identity primary key,
  question     text not null,
  hit_count    integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table kb_queries enable row level security;
-- Καμία policy = κανείς δεν διαβάζει/γράφει με anon key. Μόνο service_role
-- (το Edge Function) περνάει, γιατί το service_role παρακάμπτει το RLS.
