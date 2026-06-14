# 🚗 Voxel Horizon

Ένα open-world voxel παιχνίδι οδήγησης που τρέχει στο browser, φτιαγμένο με
**Three.js** + **Cannon-es** + **Vite**. Αισθητική voxel (Minecraft-inspired),
gameplay εμπνευσμένο από GTA RP / Motor Town / Forza Horizon / The Crew.

> **Phase 1** (αυτό το build): voxel κόσμος, ένα αυτοκίνητο με simcade physics,
> ρεαλιστικά λάστιχα & κινητήρας, odometer, κύκλος μέρας/νύχτας, HUD με
> ταχύμετρο, 3 κάμερες, minimap και mobile controls. Χωρίς multiplayer/NPCs/
> economy ακόμα.

## Εκκίνηση

```bash
npm install
npm run dev
```

Άνοιξε το [http://localhost:5173](http://localhost:5173), πάτα **W** και οδήγησε.

## Χειριστήρια

| Πλήκτρο        | Λειτουργία              |
| -------------- | ---------------------- |
| `W` / `↑`      | Γκάζι                  |
| `S` / `↓`      | Φρένο / όπισθεν        |
| `A` `D` / `← →`| Τιμόνι                 |
| `Space`        | Χειρόφρενο             |
| `C`            | Εναλλαγή κάμερας       |
| `H`            | Κόρνα                  |
| `L`            | Φώτα                   |

Σε κινητό εμφανίζονται αυτόματα touch controls (D-pad + κουμπιά).

## Εντολές

| Εντολή            | Περιγραφή                         |
| ----------------- | --------------------------------- |
| `npm run dev`     | Dev server με hot reload          |
| `npm run build`   | Production build στο `dist/`       |
| `npm run preview` | Προεπισκόπηση του build            |
| `npm run lint`    | Έλεγχος κώδικα με ESLint           |

## Τι περιλαμβάνει το Phase 1

- **Voxel κόσμος** με streaming chunks (16×16), InstancedMesh για performance,
  6 biomes (Metropolis, Riviera, Alpine, Desert, Rural, Industrial), road grid,
  κτίρια (με collision κοντά στον παίκτη) και animated νερό.
- **Simcade physics** με Cannon-es `RaycastVehicle` (γκάζι, φρένο, τιμόνι,
  χειρόφρενο, αυτόματο κιβώτιο 6 σχέσεων).
- **TireSystem** — 4 λάστιχα με wear, temperature, pressure, grip multiplier,
  blowout, 8 τύποι λάστιχων.
- **EngineSystem** — θερμοκρασία με θερμοστάτη, λάδι, ψυκτικό, καύσιμο, RPM,
  health, βλάβες (head gasket, timing belt κ.λπ.) και OBD fault codes.
- **Odometer** — πραγματικά χιλιόμετρα + service intervals.
- **DayNightCycle** — κινούμενος ήλιος/φεγγάρι, αστέρια, sky color, δυναμικός
  φωτισμός & σκιές (30 real min = 24h game).
- **HUD** (Ελληνικά) — analog ταχύμετρο + RPM arc (SVG), σχέση, ώρα, χλμ,
  θερμοκρασίες 4 λάστιχων, θερμοκρασία κινητήρα, καύσιμο.
- **3 κάμερες** — Chase, Hood, Top-down (`C`).
- **Minimap** — 2D overhead view με δείκτη κατεύθυνσης.
- **Mobile controls** — touch D-pad + κουμπιά με haptic feedback.

## Δομή

```
.
├── index.html
├── vite.config.js
├── shared/
│   └── constants.js          # TILES, CONTROLS, chunk/day config
└── src/
    ├── main.js               # Entry point + game loop
    ├── styles.css            # HUD / overlay styles
    ├── world/
    │   ├── WorldMap.js        # Procedural voxel generation
    │   ├── ChunkManager.js    # Chunk streaming + colliders
    │   ├── DayNightCycle.js   # Sun/moon/stars/lighting
    │   └── Regions.js         # 6 biomes
    ├── vehicles/
    │   ├── VehicleBase.js     # Vehicle orchestration + gearbox + odometer
    │   ├── CarPhysics.js      # Cannon-es RaycastVehicle
    │   ├── TireSystem.js      # Tires: wear/temp/pressure/grip/blowout
    │   ├── EngineSystem.js    # Engine: temp/oil/fuel/rpm/faults
    │   └── VehicleData.js     # Per-category stats
    ├── player/
    │   ├── Player.js          # Input controller
    │   └── Camera.js          # Chase / Hood / Top-down rig
    └── ui/
        ├── HUD.js             # Speedometer + gauges (Greek)
        ├── Minimap.js         # 2D minimap
        └── MobileControls.js  # Touch controls
```

## Επόμενες φάσεις (όχι ακόμα)

Multiplayer (Socket.IO), AI NPCs (Claude API), economy, jobs, law system,
on-foot character controller.

## Tech stack

Three.js · Cannon-es · simplex-noise · Vite · Vanilla JS (ES Modules)
