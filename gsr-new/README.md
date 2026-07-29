# Greek SimRacers Hub — στατική έκδοση (HTML5)

Πλήρες rebuild του `greek-simracing-hub` (React + Vite + TypeScript + Tailwind +
shadcn/ui) σε **σκέτα HTML5 / CSS / JavaScript modules**.

- ❌ κανένα `npm install`, κανένα `npm run build`, κανένα bundle
- ✅ ανεβάζεις τον φάκελο ως έχει σε οποιοδήποτε hosting και δουλεύει
- ✅ ίδια βάση δεδομένων (Supabase) — ίδιοι πίνακες, ίδια RLS policies
- ✅ διαφορετική σχεδίαση από το αρχικό (δες [Σχεδίαση](#σχεδίαση))

## Γρήγορη εκκίνηση

### Τοπικά

Τα ES modules **δεν** τρέχουν από `file://`. Χρειάζεσαι έναν απλό server:

```bash
cd gsr-new
python3 -m http.server 8000
# άνοιξε http://localhost:8000
```

### Στο hosting

Ανέβασε **όλο τον φάκελο** `gsr-new/` (ή το περιεχόμενό του στο
document root). Δεν χρειάζεται Node, PHP ή βάση στον server — όλα τα δυναμικά
τρέχουν στον browser απευθείας πάνω στο Supabase.

Τι πρέπει να ανέβει:

```
index.html … 404.html      όλες οι σελίδες
css/                       4 αρχεία
js/                        modules + vendor bundle
assets/                    λογότυπο, εικόνες shop
```

Ο φάκελος `supabase/` είναι μόνο για αναφορά (schema + edge functions) — δεν
χρειάζεται στο hosting.

Αν το hosting σου έχει ρύθμιση για σελίδα σφάλματος 404, δείξ' την στο
`404.html`.

## Ρύθμιση

Όλα τα «κουμπιά» βρίσκονται στο **`js/config.js`**:

```js
export const SUPABASE_URL = "https://xxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi…";
```

Το `anon` key **δεν είναι μυστικό** — είναι σχεδιασμένο να εκτίθεται στον
browser και η ασφάλεια επιβάλλεται από τα RLS policies της βάσης. (Το
`service_role` key δεν πρέπει ΠΟΤΕ να μπει εδώ.)

Ό,τι άλλο (όνομα site, tagline, social links, email επικοινωνίας, ώρες
υποστήριξης, extra links στο footer) διαβάζεται από τον πίνακα `site_settings`
και αλλάζει από το **Admin → Ρυθμίσεις**. Οι τιμές στο `config.js` είναι απλώς
τα fallbacks αν η βάση δεν απαντήσει.

## Δομή

```
gsr-new/
├── index.html                  intro / splash (μία φορά ανά session)
├── home.html                   αρχική
├── auth.html                   σύνδεση / εγγραφή 2 βημάτων / ξέχασα κωδικό
├── reset-password.html         νέος κωδικός από το email επαναφοράς
├── profile.html                προφίλ (?u=<user_id> για άλλου χρήστη)
├── members.html                ευρετήριο μελών + follow
├── articles.html / article.html  άρθρα, likes, σχόλια
├── forum.html / forum-category.html / forum-thread.html
├── teams.html                  racing teams + roster
├── championships.html          πρωταθλήματα με φίλτρα
├── predictions.html            προβλέψεις + βαθμολογία
├── lap-times.html              leaderboard χρόνων γύρου
├── incidents.html              αναφορές περιστατικών
├── achievements.html           badges
├── driver-of-the-month.html    υποψηφιότητες + ψηφοφορία
├── games-hub.html              F1 Reaction Time + leaderboard
├── podcasts.html               επεισόδια + Spotify embeds
├── shop.html                   κατάλογος, καλάθι, παραγγελία
├── notifications.html          ειδοποιήσεις
├── support.html                tickets με realtime chat
├── contact.html · about.html · terms.html · privacy.html
├── admin.html                  πίνακας διαχείρισης (15 ενότητες)
├── 404.html
│
├── css/
│   ├── tokens.css              design tokens (dark + light)
│   ├── base.css                reset, τυπογραφία, κουμπιά, φόρμες, modals, toasts
│   ├── shell.css               navbar, drawer, footer, page header
│   └── pages.css               στυλ ανά σελίδα/feature
│
├── js/
│   ├── config.js               ⚠️ Supabase keys + defaults
│   ├── supabase-client.js      ένα client instance + `safe()` / `countRows()`
│   ├── auth.js                 session, πύλη έγκρισης, ρόλοι, site_settings
│   ├── shell.js                navbar/footer/θέμα/ειδοποιήσεις
│   ├── ui.js                   DOM helpers, escaping, ημερομηνίες, toasts, modals
│   ├── markdown.js             ασφαλής markdown renderer + editor toolbar
│   ├── fx.js                   canvas backgrounds + typewriter
│   ├── pages/*.js              ένα module ανά σελίδα
│   └── vendor/supabase.umd.js  το επίσημο bundle του supabase-js
│
├── assets/                     λογότυπο + εικόνες προϊόντων
└── supabase/                   migrations + edge functions (αναφορά)
```

## Συμβάσεις κώδικα

- **ES modules, χωρίς framework.** Κάθε σελίδα φορτώνει ένα module από
  `js/pages/`. Το vendor bundle του Supabase φορτώνεται με κλασικό `<script>`
  πριν από τα modules και εκθέτει το global `supabase`.
- **Κλάσεις:** `hub-*` για components, `u-*` για utilities. Χωρίς Tailwind.
- **Χρώματα:** πάντα μέσω CSS custom properties σε μορφή HSL components, ώστε
  να δουλεύει το `hsl(var(--brand) / 0.4)`.
- **XSS:** οτιδήποτε έρχεται από τη βάση περνάει από `esc()` πριν μπει σε
  template string. Τα URL από `safeUrl()` (μπλοκάρει `javascript:`). Το
  `markdown.js` κάνει escape **πρώτα** και βάζει tags μετά.
- **Ελληνικά** σε UI, σχόλια και ονόματα μεταβλητών όπου έχει νόημα.

## Πώς μεταφράστηκαν τα React κομμάτια

| Αρχικό (React) | Εδώ |
|---|---|
| `AuthContext` | `js/auth.js` — ίδια πύλη έγκρισης, ίδιο heartbeat `last_seen` |
| `useSiteSettings` | `loadSettings()` στο `js/auth.js`, με cache ανά σελίδα |
| `Navbar` / `Footer` | `mountShell()` στο `js/shell.js` |
| `useTheme` | `applyTheme()` + inline script στο `<head>` (χωρίς flash) |
| `@uiw/react-md-editor` | `js/markdown.js` (renderer + toolbar, ~250 γραμμές) |
| `framer-motion` | CSS transitions/animations |
| `lucide-react` | emoji + inline SVG για τα social |
| `ReactiveBackground`, `Particles`, `RacingBackground` | `js/fx.js` |
| `Admin.tsx` (2.772 γραμμές) | `js/pages/admin.js` — δηλωτικοί ορισμοί + ένας κοινός CRUD renderer |
| React Router | μία σελίδα ανά route, παράμετροι με `?id=` |

Το `FantasyLeague` έμεινε ως «Έρχεται σύντομα», όπως ακριβώς ήταν και στο
αρχικό `GamesHub.tsx`.

Η φόρμα επικοινωνίας στο αρχικό project έκανε **προσομοίωση** αποστολής (δεν
υπάρχει πίνακας για μηνύματα επικοινωνίας στο schema). Εδώ κάνει κάτι
πραγματικό: για συνδεδεμένους δημιουργεί support ticket, για επισκέπτες ανοίγει
προσυμπληρωμένο `mailto:`.

## Σχεδίαση

Το κύριο χρώμα είναι μπλε, όπως και στο αρχικό, αλλά η υπόλοιπη γλώσσα
σχεδίασης είναι διαφορετική:

| | Αρχικό | Εδώ |
|---|---|---|
| Βάση | βαθύ navy `hsl(210 40% 6%)` | ψυχρό γραφίτης `hsl(220 12% 8%)` |
| Κύριο χρώμα | μπλε Ελλάδας `#1565C0` | ηλεκτρικό azure `hsl(214 100% 58%)` |
| Δεύτερο | ανοιχτό μπλε / λευκό | κυανό `hsl(187 92% 52%)` |
| Γραμματοσειρές | Orbitron + Inter | Chakra Petch + Rubik + JetBrains Mono |
| Γεωμετρία | στρογγυλεμένες κάρτες 0.5–1rem | αιχμηρές ακμές, λοξοκομμένες γωνίες, «λωρίδες εκκίνησης» |
| Κίνηση | framer-motion | CSS + canvas |

Τα CSS custom properties λέγονται `--brand` / `--accent` (όχι με όνομα
χρώματος), οπότε μια επόμενη αλλαγή παλέτας αγγίζει μόνο το `css/tokens.css`.

Και τα δύο θέματα (dark/light) υποστηρίζονται. Το θέμα ακολουθεί το σύστημα
μέχρι ο χρήστης να διαλέξει ρητά, και αποθηκεύεται στο `localStorage`.

## Βάση δεδομένων

Δεν άλλαξε τίποτα. Χρησιμοποιούνται οι ίδιοι πίνακες:

`profiles` · `user_roles` · `follows` · `profile_likes` · `profile_comments` ·
`articles` · `article_categories` · `article_likes` · `article_comments` ·
`forum_categories` · `forum_threads` · `forum_posts` · `teams` ·
`team_members` · `championships` · `prediction_events` · `prediction_entries` ·
`incident_reports` · `lap_times` · `achievement_badges` · `user_achievements` ·
`driver_of_month_nominations` · `driver_of_month_votes` · `reaction_scores` ·
`podcast_episodes` · `shop_products` · `shop_orders` · `shop_order_items` ·
`support_tickets` · `support_messages` · `notifications` · `site_settings`

Τα migrations βρίσκονται στο `supabase/migrations/` (αντιγραμμένα από το
αρχικό project). Σε νέο Supabase project:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

Και μετά κάνε τον εαυτό σου admin από τον SQL Editor:

```sql
update public.profiles set is_approved = true where user_id = '<το user_id σου>';
insert into public.user_roles (user_id, role) values ('<το user_id σου>', 'admin');
```

### Storage

Το ανέβασμα avatar χρησιμοποιεί bucket `avatars` (public). Αν δεν υπάρχει,
φτιάξ' τον από **Storage → New bucket → avatars → Public**.

### Edge functions

Τα `notify-admin-signup` και `notify-admin-order` καλούνται best-effort — αν
δεν είναι deployed, η εγγραφή και η παραγγελία δουλεύουν κανονικά και το
σφάλμα απλώς γράφεται στην κονσόλα.

## Τι να προσέχεις

**Άδειο αποτέλεσμα ≠ κενός πίνακας.** Όταν ένα RLS policy απορρίπτει γραμμές,
το Supabase γυρίζει `[]`, όχι σφάλμα. Αν κάτι δεν εμφανίζεται, έλεγξε πρώτα το
policy.

**Οι νέοι λογαριασμοί περιμένουν έγκριση.** Μετά την εγγραφή γίνεται αμέσως
`signOut()`. Μέχρι να μπει `is_approved = true`, η σύνδεση αποτυγχάνει με
μήνυμα — αυτό είναι το επιθυμητό.

**Γραμματοσειρές.** Φορτώνονται από Google Fonts. Αν το hosting σου τρέχει
χωρίς εξωτερικό δίκτυο, το site πέφτει σε system fonts χωρίς να χαλάσει.
