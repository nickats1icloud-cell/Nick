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
    ├── components/       # Layout, Navbar, Footer
    └── pages/            # Home, About, NotFound
```

## Πώς να επεκταθεί

- Νέα σελίδα: φτιάξε ένα component στο `src/pages/` και πρόσθεσέ το ως `<Route>` στο `src/App.jsx`.
- Νέο link στο menu: πρόσθεσε ένα `<NavLink>` στο `src/components/Navbar.jsx`.
- Styling: τα design tokens (χρώματα, radius κ.λπ.) ορίζονται ως CSS variables στην κορυφή του `src/index.css`.
