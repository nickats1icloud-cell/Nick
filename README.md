# Nick — Ψηφιακό Καντράν Αυτοκινήτου

Ένα πλήρως λειτουργικό ψηφιακό καντράν αυτοκινήτου (digital instrument cluster)
εμπνευσμένο από το LCD καντράν του Honda Civic EK, φτιαγμένο με React + Vite.

## Το καντράν (`/dashboard`)

- **Στροφόμετρο & ταχύμετρο** — αναλογικά SVG όργανα με βελόνα, υποδιαιρέσεις και ζώνη redline.
- **Κεντρική ψηφιακή οθόνη** — ταχύτητα, σχέση μετάδοσης (gear), odometer & trip.
- **Δευτερεύοντα όργανα** — θερμοκρασία νερού, καύσιμο, boost (turbo), πίεση λαδιού, τάση μπαταρίας.
- **Warning lights** — φλας, μεγάλη σκάλα, χειρόφρενο, λάδι, μπαταρία, υπερθέρμανση, καύσιμο, check engine, ABS.
- **Μηχανή προσομοίωσης** — «οδήγησε» με γκάζι/φρένο και αυτόματο κιβώτιο· όλα τα όργανα αντιδρούν ζωντανά.

### Έλεγχοι

| Πλήκτρο            | Λειτουργία        |
| ------------------ | ----------------- |
| `↑` / `W`          | Γκάζι             |
| `↓` / `S`          | Φρένο             |
| `A` / `D`          | Φλας αρ./δεξ.     |
| `H`                | Μεγάλη σκάλα      |
| `P`                | Χειρόφρενο        |

Υπάρχουν και on-screen κουμπιά (γκάζι/φρένο/διακόπτες) για χρήση με ποντίκι ή αφή.

## Εργαλεία Le Mans Ultimate

Δύο εργαλεία για sim racers, φτιαγμένα να δουλεύουν **100% στον browser** —
χωρίς server, χωρίς λογαριασμό, χωρίς να φεύγει κανένα αρχείο από τον
υπολογιστή σου.

### Stint Planner (`/stint-planner`)

Προγραμματισμός βαρδιών για endurance αγώνες με driver swaps.

- Ορίζεις διάρκεια αγώνα, μήκος stint και χρόνο pit stop.
- Κάθε οδηγός δηλώνει το παράθυρο διαθεσιμότητάς του **στη δική του ζώνη ώρας**·
  ο αλγόριθμος αναθέτει τα stints μόνο σε όποιον είναι ξύπνιος, μοιράζοντας
  ισόποσα τον χρόνο οδήγησης.
- Επισήμανση ακάλυπτων stints, χειροκίνητη αλλαγή οδηγού ανά stint, οπτική
  γραμμή χρόνου και live countdown για το επόμενο swap.
- Εξαγωγή: shareable link (το πλάνο κωδικοποιείται μέσα στο URL), αρχείο `.ics`
  για το ημερολόγιο, και έτοιμο κείμενο για Discord.

### League Control (`/league-control`)

Διαχείριση πρωταθλήματος από τα αρχεία αποτελεσμάτων του παιχνιδιού.

- Drag & drop των `.xml` από το `…\Le Mans Ultimate\UserData\Log\Results\`.
- Βαθμολογία **ανά κλάση** (Hypercar / LMP2 / LMGT3 …), όπως στο WEC.
- Ρυθμίσεις: σύστημα βαθμών (WEC / top-15 / απλό / custom), βαθμοί pole και
  γρήγορου γύρου, ελάχιστο ποσοστό γύρων για κατάταξη, drop χειρότερων
  αποτελεσμάτων, πολλαπλασιαστής ανά αγώνα (π.χ. ×2 για το Le Mans).
- Ποινές βαθμών και αποκλεισμοί ανά οδηγό, με αυτόματη προαγωγή όσων ακολουθούν.
- Εξαγωγή βαθμολογίας σε CSV και αποθήκευση/φόρτωση όλου του πρωταθλήματος σε
  JSON.

Ιδέες και έρευνα αγοράς για περισσότερα εργαλεία LMU:
[`docs/le-mans-ultimate-app-ideas.md`](docs/le-mans-ultimate-app-ideas.md).

## Stack

- [React 18](https://react.dev)
- [Vite 5](https://vitejs.dev)
- [React Router 6](https://reactrouter.com)
- ESLint

## Εκκίνηση

```bash
npm install
npm run dev
```

Άνοιξε [http://localhost:5173](http://localhost:5173).

## Εντολές

| Εντολή            | Περιγραφή                          |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Dev server με hot reload           |
| `npm run build`   | Production build στο `dist/`       |
| `npm run preview` | Προεπισκόπηση του production build  |
| `npm run lint`    | Έλεγχος κώδικα με ESLint           |

## Δομή

```
.
├── index.html
├── vite.config.js
├── eslint.config.js
└── src
    ├── main.jsx          # Entry point + router
    ├── App.jsx           # Ορισμός routes
    ├── index.css         # Global styles + design tokens
    ├── components/       # Layout, Navbar, Footer, όργανα καντράν
    ├── hooks/            # useVehicleSim — προσομοίωση οχήματος
    ├── lib/              # Καθαρή λογική: stints, results XML, βαθμολογία
    └── pages/            # Home, Dashboard, StintPlanner, LeagueControl, About
```

## Πώς να επεκταθεί

- Νέα σελίδα: φτιάξε ένα component στο `src/pages/` και πρόσθεσέ το ως `<Route>` στο `src/App.jsx`.
- Νέο link στο menu: πρόσθεσε ένα `<NavLink>` στο `src/components/Navbar.jsx`.
- Styling: τα design tokens (χρώματα, radius κ.λπ.) ορίζονται ως CSS variables στην κορυφή του `src/index.css`.
