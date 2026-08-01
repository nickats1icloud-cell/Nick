# Greek SimRacers Podcast — website

Στατικό site HTML5 για το podcast, **χωρίς build step και χωρίς npm**. Καθαρά
αρχεία HTML/CSS/JS (ES modules) που ανεβαίνουν ως έχουν.

Ζει δίπλα στο `greek-simracers/` (site της κοινότητας) και ακολουθεί τις ίδιες
συμβάσεις: design tokens σε CSS custom properties, dark-first με toggle,
ελληνικά σε UI και σχόλια.

## Προεπισκόπηση τοπικά

```bash
cd podcast
python3 -m http.server 8000
# → http://localhost:8000
```

Τα ES modules **δεν** τρέχουν από `file://` — χρειάζεται server.

## Δομή

```
podcast/
├── index.html          # Αρχική: hero, τελευταίο επεισόδιο, πλέγμα, κοινότητα
├── episodes.html       # Αρχείο: αναζήτηση, φίλτρα, ταξινόμηση, προβολές
├── episode.html        # Σελίδα επεισοδίου (?id=ep-062, προαιρετικό &t=1140)
├── about.html          # Η εκπομπή: ομάδα, χρονολόγιο, FAQ
├── subscribe.html      # Πλατφόρμες, newsletter, RSS
├── contact.html        # Φόρμα επικοινωνίας (3 θέματα)
├── 404.html            # "Λάθος στροφή"
├── manifest.webmanifest
├── css/
│   ├── tokens.css      # Χρώματα, τυπογραφία, spacing, σκιές (dark + light)
│   ├── base.css        # Reset, κουμπιά, φόρμες, toasts, reveal, reduced-motion
│   ├── components.css  # Navbar, hero, κάρτες, player, palette, footer
│   └── pages.css       # Στυλ ανά σελίδα
└── js/
    ├── data/
    │   ├── episodes.js # ⚠️ Εδώ προσθέτεις επεισόδια
    │   └── site.js     # ⚠️ Links, hosts, στατιστικά, FAQ, πλατφόρμες
    ├── ui.js           # Navbar/footer/drawer, θέμα, reveal, counters, canvas
    ├── player.js       # Global audio player (singleton)
    ├── render.js       # Κάρτες επεισοδίων + delegated events
    ├── palette.js      # Command palette (Ctrl/Cmd + K)
    ├── store.js        # localStorage: θέμα, αγαπημένα, πρόοδος, ρυθμίσεις
    ├── format.js       # Ημερομηνίες, timecodes, escape, αναζήτηση χωρίς τόνους
    ├── icons.js        # Inline SVG icons (χωρίς emoji, χωρίς icon font)
    ├── toast.js        # Ειδοποιήσεις
    └── *-page.js       # Ένα script ανά σελίδα
```

## Τι κάνει το site

- **Global player** που παραμένει κάτω-κάτω σε κάθε σελίδα: play/pause, ±15/30
  δευτ., ταχύτητα 0.8x–2x, ένταση, seek με ποντίκι/αφή/πληκτρολόγιο, επόμενο/
  προηγούμενο επεισόδιο, Media Session API (χειριστήρια κλειδωμένης οθόνης).
- **Θυμάται πού σταμάτησες** ανά επεισόδιο (localStorage) και δείχνει μπάρα
  προόδου στις κάρτες + ενότητα «Συνέχισε» στην αρχική.
- **Chapters & απομαγνητοφώνηση** με κλικ σε timestamp για μετάβαση, ζωντανό
  highlight της τρέχουσας γραμμής και αναζήτηση μέσα στο κείμενο.
- **Command palette** (`Ctrl/Cmd + K` ή `/`) για επεισόδια, σελίδες, ενέργειες.
- **Φίλτρα αρχείου**: αναζήτηση (αγνοεί τόνους), tags, σεζόν, αγαπημένα,
  ταξινόμηση, πλέγμα/λίστα — η κατάσταση γράφεται στο URL και μοιράζεται.
- **Αγαπημένα & «για αργότερα»**, θέμα dark/light, toasts, scroll reveal,
  counters, ticker, canvas στο hero.
- **Πλήκτρα**: `Space`/`K` play-pause, `←`/`→` skip, `M` σίγαση, `Esc` κλείσιμο.

## Προσθήκη επεισοδίου

Στο `js/data/episodes.js` αντιγράφεις ένα αντικείμενο και αλλάζεις:

```js
{
  id: "ep-063",            // μοναδικό
  number: 63, season: 3,
  title: "…", excerpt: "…",
  tags: ["iRacing", "Setup"],
  date: "2026-07-30",      // ISO
  duration: 3600,          // δευτερόλεπτα
  hue: 200,                // 0-360, χρώμα του CSS εξωφύλλου
  plays: 0,
  audio: "https://…/ep-063.mp3",
  guests: [{ initials: "ΝΚ", name: "…", role: "…" }],
  description: ["παράγραφος 1", "παράγραφος 2"],
  chapters: [{ t: 0, title: "Εισαγωγή" }],
  links: [{ label: "…", url: "…" }],
  transcript: [{ t: 0, speaker: "Νίκος", text: "…" }],
}
```

### DEMO λειτουργία ήχου

Αν το `audio` είναι κενό (ή το αρχείο δεν φορτώνει), ο player τρέχει **εικονικό
χρονόμετρο** ώστε να δουλεύουν seek, chapters, ταχύτητα και αποθήκευση προόδου,
και το δηλώνει με την ένδειξη `DEMO` δίπλα στον τίτλο. Δεν παίζει ήχος — μόλις
βάλεις πραγματικό mp3 URL, παίζει κανονικά χωρίς άλλη αλλαγή.

Τα δείγματα επεισοδίων που υπάρχουν τώρα είναι **placeholder περιεχόμενο**
(φανταστικοί τίτλοι, ονόματα και νούμερα) για να φαίνεται το site γεμάτο.

## Τι λείπει / επόμενα βήματα

- **Πραγματικά αρχεία ήχου** και RSS feed (`feed.xml`).
- **Newsletter**: η φόρμα κάνει μόνο validation — δεν στέλνει πουθενά. Σύνδεσέ
  τη με τον provider σου (ή με Supabase, όπως το `greek-simracers/`).
- **Φόρμα επικοινωνίας**: ανοίγει τον mail client με προσυμπληρωμένο μήνυμα
  αντί να αποθηκεύει σε βάση. Αν θες αποθήκευση, χρησιμοποίησε τον ίδιο
  Supabase client με το site της κοινότητας.
- **Links πλατφορμών** στο `js/data/site.js` είναι `#`.

## Deploy

Αντιγράφεται ως έχει από το `.github/workflows/deploy.yml` και σερβίρεται από
`/Nick/podcast/`.
