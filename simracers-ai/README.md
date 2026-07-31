# Greek SimRacers AI

Ξεχωριστό site με έναν AI βοηθό που απαντά σε ερωτήσεις της κοινότητας.
Ξέρει τι ειπώθηκε στα επεισόδια του **Greek SimRacers Podcast**, τους
κανονισμούς των πρωταθλημάτων, το περιεχόμενο του site, και γενικά θέματα
sim racing.

Ανεξάρτητο από το `greek-simracers/` και από το React app της ρίζας —
δικός του φάκελος, δικά του αρχεία, δικό του deploy.

## Πώς δουλεύει

```
Browser  ──POST──▶  Supabase Edge Function  ──▶  Claude API
   ▲                       │                     (claude-opus-5)
   │                       ▼
   └──── streaming ──  αναζήτηση στη βάση γνώσης (Postgres)
```

Το **κλειδί του Claude ζει μόνο στο Edge Function**, ποτέ στον browser. Αυτός
είναι και ο λόγος που υπάρχει το Edge Function: αν το κλειδί έμπαινε στο
front-end, οποιοσδήποτε άνοιγε τα devtools θα το έβλεπε και θα χρεωνόσουν εσύ.

Σε κάθε ερώτηση ψάχνουμε στη βάση γνώσης τα ~12 πιο σχετικά αποσπάσματα και
στέλνουμε **μόνο αυτά** στον Claude — όχι ολόκληρα τα transcripts. Έτσι το
κόστος μένει σταθερό είτε έχεις 10 επεισόδια είτε 100.

## Τεχνολογία

Καθαρή HTML/CSS/JS χωρίς build step και χωρίς npm, όπως και το
`greek-simracers/`. Το μόνο που τρέχει σε Node είναι το script φόρτωσης της
βάσης γνώσης, και αυτό μόνο όταν προσθέτεις υλικό.

```
index.html                      η σελίδα της συζήτησης
css/styles.css                  στυλ (ίδια tokens με το greeksimracers.gr)
js/config.js                    δημόσιες ρυθμίσεις — συμπλήρωσέ το
js/chat.js                      η λογική του chat + streaming
js/markdown.js                  ασφαλής markdown renderer
knowledge/                      το υλικό του βοηθού (δες knowledge/_README.md)
scripts/ingest.mjs              φορτώνει το knowledge/ στο Supabase
supabase/migrations/            το schema της βάσης γνώσης
supabase/functions/ask/         το Edge Function που μιλάει στον Claude
```

## Εγκατάσταση

### 1. Κλειδί Claude API

Φτιάξε λογαριασμό στο [console.anthropic.com](https://console.anthropic.com)
και δημιούργησε ένα API key. Βάλε λίγα credits — δες την ενότητα Κόστος.

### 2. Supabase project

Μπορείς να χρησιμοποιήσεις το ίδιο project με το `greek-simracers/` ή να
φτιάξεις καινούργιο. Εγκατάστησε το Supabase CLI και σύνδεσε το project:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <το-project-ref-σου>
```

### 3. Βάση γνώσης

```bash
supabase db push
```

Αυτό δημιουργεί τον πίνακα `kb_chunks` και τη συνάρτηση αναζήτησης
`search_kb`. Αν προτιμάς χωρίς CLI: άνοιξε το SQL Editor στο Supabase
Dashboard και τρέξε το περιεχόμενο του
`supabase/migrations/001_knowledge_base.sql`.

### 4. Edge Function

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ask --no-verify-jwt
```

Το `--no-verify-jwt` σημαίνει ότι η συνάρτηση δέχεται αιτήματα χωρίς login —
το θέλουμε, γιατί ο βοηθός είναι ανοιχτός σε όλους. Το anon key αρκεί.

### 5. Ρυθμίσεις front-end

Άνοιξε το `js/config.js` και συμπλήρωσε τα δύο πεδία από το Supabase
Dashboard → Project Settings → API:

```js
export const SUPABASE_URL = "https://xxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJ...";
```

Αυτά δεν είναι μυστικά — το anon key είναι φτιαγμένο για να είναι ορατό στον
browser, και το RLS ελέγχει τι επιτρέπεται.

### 6. Φόρτωσε το υλικό

Βάλε τα transcripts και τους κανονισμούς στο `knowledge/` (οδηγίες στο
`knowledge/_README.md`) και τρέξε:

```bash
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node scripts/ingest.mjs
```

Το `service_role` key είναι **μυστικό**. Μένει στο terminal σου — μην το
βάλεις σε αρχείο και μην το ανεβάσεις στο GitHub.

### 7. Δοκιμή τοπικά

```bash
python3 -m http.server 8000
```

και άνοιξε http://localhost:8000. Χρειάζεται web server — τα ES modules δεν
τρέχουν με διπλό κλικ στο `index.html` (`file://`).

## Κόστος

Το μοντέλο είναι `claude-opus-5` — το ισχυρότερο για αυτή τη δουλειά.
Κοστίζει $5 ανά εκατομμύριο tokens εισόδου και $25 ανά εκατομμύριο εξόδου.

Μια τυπική ερώτηση στέλνει ~3.000 tokens (οδηγίες + αποσπάσματα) και παίρνει
~400 πίσω, δηλαδή κάπου **1,5–2 λεπτά του δολαρίου**. Χίλιες ερωτήσεις τον
μήνα ≈ 15–20 δολάρια.

Δύο πράγματα το κρατάνε χαμηλά και είναι ήδη ενεργά στον κώδικα:

- **Prompt caching** στις σταθερές οδηγίες — από τη 2η ερώτηση και μετά το
  σταθερό κομμάτι κοστίζει ~10% της κανονικής τιμής
- **Αναζήτηση αντί για "στείλε τα πάντα"** — μπαίνουν στο context μόνο τα
  σχετικά αποσπάσματα

Αν θέλεις φθηνότερα, άλλαξε το `MODEL` στο `supabase/functions/ask/index.ts`
σε `claude-sonnet-5` (περίπου το μισό κόστος, ελάχιστη διαφορά για Q&A πάνω
σε δοσμένο υλικό).

## Deploy

Το site είναι στατικά αρχεία — ανεβαίνει όπως είναι σε GitHub Pages, Netlify,
Cloudflare Pages ή σε οποιονδήποτε web server. Δεν χρειάζεται build.

Αν το βάλεις σε υποφάκελο (π.χ. `/Nick/simracers-ai/`), δεν χρειάζεται καμία
αλλαγή — όλοι οι σύνδεσμοι είναι σχετικοί.

## Επόμενα βήματα

Πράγματα που δεν μπήκαν αλλά χωράνε εύκολα:

- **Αυτόματο συγχρονισμό με το site.** Αντί να γράφεις το `knowledge/site/`
  με το χέρι, ένα cron job μπορεί να διαβάζει τα άρθρα και τα πρωταθλήματα
  απευθείας από τους πίνακες του `greek-simracers/` και να ενημερώνει τα
  chunks.
- **Widget στο greeksimracers.gr.** Το ίδιο Edge Function μπορεί να
  εξυπηρετεί ένα μικρό παράθυρο chat στη γωνία του κύριου site.
- **Rate limiting.** Τώρα υπάρχουν όρια μεγέθους αλλά όχι όριο ερωτήσεων ανά
  χρήστη. Αν το site δεχτεί κατάχρηση, ένα όριο ανά IP στο Edge Function
  είναι εύκολο.
- **Σύνδεση με λογαριασμό.** Αν θες ο βοηθός να απαντά διαφορετικά σε μέλη,
  το Supabase Auth του `greek-simracers/` δουλεύει ως έχει.
