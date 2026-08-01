# Greek Simracers — greeksimracers.gr

Καθαρό rebuild του site της κοινότητας, σε **σκέτα HTML/CSS/JS αρχεία** —
χωρίς npm, χωρίς build step. Ανοίγεις τα αρχεία, τα διαβάζεις, τα
επεξεργάζεσαι, τα ανεβάζεις. Ό,τι δυναμικό (χρήστες, forum, άρθρα,
championships) τρέχει πάνω σε [Supabase](https://supabase.com) απευθείας
από τον browser.

## Δομή

```
greek-simracers/
├── index.html            # Intro/splash (redirect στο home μετά την 1η επίσκεψη)
├── home.html             # Αρχική σελίδα
├── auth.html             # Σύνδεση / Εγγραφή (2 βήματα) / Ξέχασα τον κωδικό
├── reset-password.html   # Ορισμός νέου κωδικού (από το email επαναφοράς)
├── about.html            # Σχετικά με εμάς
├── articles.html         # Λίστα άρθρων + δημιουργία
├── article.html          # Προβολή άρθρου (?id=...) + likes + σχόλια
├── forum.html            # Κατηγορίες forum
├── forum-category.html   # Threads κατηγορίας (?id=...)
├── forum-thread.html     # Thread + απαντήσεις (?id=...)
├── championships.html    # Πρωταθλήματα με φίλτρα
├── game.html             # GSR Time Attack (το παιχνίδι της κοινότητας)
├── members.html          # Ευρετήριο μελών
├── contact.html          # Φόρμα επικοινωνίας (αποθηκεύεται στη βάση)
├── terms.html            # Όροι χρήσης
├── privacy.html          # Πολιτική απορρήτου
├── 404.html              # Σελίδα "Λάθος Στροφή!"
├── css/
│   ├── tokens.css        # Design tokens (χρώματα/γραμματοσειρές, dark+light)
│   ├── base.css          # Reset, τυπογραφία, κουμπιά, κάρτες, φόρμες, toasts
│   └── components.css    # Navbar, footer, hero, grids
├── js/
│   ├── config.js         # ⚠️ Εδώ μπαίνουν τα Supabase URL/key + social links
│   ├── supabase-client.js
│   ├── auth.js           # Session, approval gate, "τελευταία σύνδεση"
│   ├── partials.js       # Κοινό navbar/footer + theme toggle + mobile menu
│   ├── backgrounds.js    # Canvas particles
│   ├── markdown.js       # Ασφαλές markdown rendering (XSS-escaped)
│   ├── toast.js          # Ειδοποιήσεις
│   └── game/             # Το παιχνίδι (βλ. "GSR Time Attack" παρακάτω)
├── assets/               # Λογότυπα
└── supabase/migrations/  # SQL schema της βάσης
```

## GSR Time Attack (`game.html`)

Το παιχνίδι της κοινότητας: top-down racer σε `<canvas>`, χωρίς βιβλιοθήκες
και χωρίς build — σκέτα ES modules στο `js/game/`.

- **Λειτουργίες**: *Time Attack* (μόνος με το ρολόι, με ghost του καλύτερου
  γύρου και ζωντανό delta) και *Αγώνας* (5 AI αντίπαλοι, 3 γύροι, κατάταξη).
- **Πίστες**: Ακρόπολις Ring (1.5 km), Θεσσαλονίκη Waterfront (2.1 km),
  Ολυμπία GP (2.8 km). Ορίζονται με λίγα control points και γίνονται κλειστές
  Catmull-Rom καμπύλες.
- **Αμάξια**: GT3, Formula, Drift AE — διαφορετικό grip, φρένα, αεροδυναμική.
- **Χειρισμός**: πληκτρολόγιο (βελάκια/WASD, Space χειρόφρενο, R επαναφορά,
  E γραμμή οδήγησης, Esc παύση), κουμπιά αφής σε κινητά, gamepad/τιμονιέρα.
- **Χρόνοι**: πάντα τοπικά (localStorage). Αν υπάρχει Supabase **και**
  συνδεδεμένος χρήστης, ο χρόνος μπαίνει και στον κοινό πίνακα — τρέξε το
  `supabase/migrations/002_game_lap_times.sql`.

| Αρχείο | Ρόλος |
| --- | --- |
| `js/game/tracks.js` | Ορισμοί πιστών, spline, δειγματοληψία, καμπυλότητα |
| `js/game/car.js` | Φυσική (arcade drift), προδιαγραφές αμαξιών, συγκρούσεις |
| `js/game/ai.js` | AI οδηγοί: racing line, ταχύτητα στροφής, αποφυγή |
| `js/game/input.js` | Πληκτρολόγιο / αφή / gamepad σε ενιαία inputs |
| `js/game/render.js` | Σχεδίαση πίστας, αμαξιών, ιχνών, minimap |
| `js/game/ghost.js` | Καταγραφή & αναπαραγωγή του καλύτερου γύρου |
| `js/game/leaderboard.js` | Τοπικοί + κοινοί χρόνοι, μορφοποίηση |
| `js/game/engine.js` | Βρόχος, χρονομέτρηση, τομείς, κατάταξη, κάμερα |

Η φυσική τρέχει με σταθερό βήμα (1/120 s) μέσα σε accumulator, ώστε ο ίδιος
γύρος να δίνει τον ίδιο χρόνο ανεξάρτητα από το refresh rate της οθόνης.

## Setup (μία φορά)

1. **Δημιούργησε Supabase project** στο [supabase.com](https://supabase.com)
   (δωρεάν tier αρκεί).
2. **Τρέξε το schema**: SQL Editor → επικόλλησε το περιεχόμενο του
   `supabase/migrations/001_wave1_schema.sql` → Run. Μετά, για τον πίνακα
   χρόνων του παιχνιδιού, τρέξε και το `002_game_lap_times.sql`.
3. **Πάρε τα κλειδιά**: Project Settings → API → αντέγραψε το `Project URL`
   και το `anon public` key.
4. **Συμπλήρωσέ τα στο `js/config.js`** (το anon key ΔΕΝ είναι μυστικό —
   η ασφάλεια επιβάλλεται από τα RLS policies της βάσης).
5. Άνοιξε το site (βλ. παρακάτω) και κάνε την πρώτη εγγραφή.
6. **Κάνε τον εαυτό σου admin**: SQL Editor →
   ```sql
   update public.profiles set is_approved = true;
   insert into public.user_roles (user_id, role)
   select user_id, 'admin' from public.profiles;
   ```
   (μόνο για τον πρώτο χρήστη — μετά οι εγκρίσεις θα γίνονται από το
   Admin panel όταν προστεθεί.)

> **Σημαντικό — έγκριση λογαριασμών:** κάθε νέα εγγραφή έχει
> `is_approved = false` και ΔΕΝ μπορεί να συνδεθεί μέχρι να εγκριθεί
> (όπως στο πρωτότυπο site). Αν "δεν δουλεύει το login" σε νέο
> λογαριασμό, αυτό είναι ο λόγος.

## Τοπική προβολή

Επειδή οι σελίδες χρησιμοποιούν ES modules, χρειάζεται ένας απλός static
server (όχι διπλό κλικ στο αρχείο):

```bash
cd greek-simracers
python3 -m http.server 8000
# → http://localhost:8000
```

## Deployment

Το GitHub Actions workflow (`.github/workflows/deploy.yml`) αντιγράφει
αυτόν τον φάκελο ως έχει στο GitHub Pages κάτω από
`/Nick/greek-simracers/`. Δεν υπάρχει κανένα build βήμα — ό,τι είναι στα
αρχεία, αυτό σερβίρεται. Το site δουλεύει το ίδιο και σε οποιοδήποτε
άλλο static hosting (Netlify, Cloudflare Pages, απλό φάκελο σε cPanel).

## Διορθώσεις σε σχέση με το πρωτότυπο (Lovable)

- Οι μετρητές προβολών (άρθρα/threads) αυξάνονται πραγματικά (RPC
  `increment_*_views`) — στο πρωτότυπο γράφονταν πάντα η τιμή 1.
- Η φόρμα επικοινωνίας αποθηκεύει πραγματικά στη βάση
  (`contact_submissions`) — στο πρωτότυπο ήταν ψεύτικη (setTimeout).
- Το `updated_at` των threads ενημερώνεται με database trigger σε κάθε
  απάντηση.
- Ένα ενιαίο, σχολιασμένο SQL schema αντί για 22 διάσπαρτα migrations.
