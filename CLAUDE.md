# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Nick" is a React + Vite single-page app with three features:

- `/dashboard` — a fully functional digital car instrument cluster (analog
  tacho/speedo, secondary gauges, warning lights, and a client-side vehicle
  physics simulation) styled after the Honda Civic EK's LCD cluster.
- `/lab` — a virtual workbench for Arduino sim racing hardware: a parts
  library, a wiring canvas, a design rule check, a behavioural simulation
  (contact bounce, ADC noise, loop timing, current budget, brownout) and an
  Arduino sketch generator.
- `/podcast` — a coaching tool for a Greek-language sim racing podcast: it
  parses the show's RSS feed and an episode transcript, scores both, and
  produces concrete Greek-language presentation advice.

The README, in-code comments, and UI copy are in Greek — match that language
when writing user-facing strings or comments in this codebase.

## Sub-projects

- **`greek-simracers/`** — a second, fully independent site (greeksimracers.gr
  rebuild): plain static HTML/CSS/JS with **no build step and no npm** — do
  not add bundlers or frameworks there. Dynamic features (auth, forum,
  articles, championships, contact form) use Supabase via the vendored
  `js/vendor/supabase.umd.js` bundle; config lives in `js/config.js`; the DB
  schema is `supabase/migrations/001_wave1_schema.sql`. See its own README.md
  for conventions. It deploys as-is to `/Nick/greek-simracers/` via a copy
  step in `.github/workflows/deploy.yml`. Preview locally with
  `python3 -m http.server` (ES modules don't run from `file://`).

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server with hot reload, http://localhost:5173
npm run build       # production build to dist/
npm run preview     # preview the production build
npm run lint        # ESLint over the whole project
```

There is no test suite configured (no test runner/script in `package.json`).
There is no `typecheck` script either — this is a plain JS/JSX project, not
TypeScript.

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on push to
`claude/website-setup-0k2c7k` or `claude/custom-car-dashboard-5v69i8` (or via
manual `workflow_dispatch`). The app is served from `/Nick/` (see `base` in
`vite.config.js`), and `router basename` in `src/main.jsx` is set from
`import.meta.env.BASE_URL` to match. The build step copies `dist/index.html`
to `dist/404.html` so client-side routes (e.g. `/Nick/about` on a hard
reload) resolve correctly on Pages, which has no server-side rewrite support.

## Architecture

- **Routing**: `src/main.jsx` mounts `<App>` inside a `BrowserRouter`;
  `src/App.jsx` defines all routes under a shared `Layout` (`/`, `/dashboard`,
  `/lab`, `/lab/wiring`, `/podcast`, `/about`, catch-all `NotFound`). Routes
  listed in `WIDE_ROUTES` (`Layout.jsx`) skip the 960px `.container`. To add a page: create a component in
  `src/pages/` and add a `<Route>` in `App.jsx`; to add a nav link, edit
  `src/components/Navbar.jsx`.
- **Layout shell**: `src/components/Layout.jsx` wraps every route with
  `Navbar` + `Footer` and renders the matched page via `<Outlet />`.
- **Vehicle simulation (`src/hooks/useVehicleSim.js`)**: the core of the
  dashboard feature. A custom hook running a `requestAnimationFrame` loop
  that advances a mutable physics state (`sim.current`) every frame based on
  `controls.current` (throttle/brake/ignition, set imperatively by the UI
  without triggering re-renders) and `toggles.current` (turn signals, high
  beam, handbrake). Each frame it computes speed, RPM, automatic gear
  selection, turbo boost, coolant temp, oil pressure, battery voltage, fuel
  burn, odometer/trip, and derived warning-light states, then calls
  `setState` once with a plain snapshot object — this is the only state that
  triggers React re-renders. The hook returns `[state, api]`, where `api`
  exposes imperative setters (`setThrottle`, `setBrake`, `toggleLeft`,
  `toggleIgnition`, `resetTrip`, `refuel`, etc.) consumed by
  `src/pages/Dashboard.jsx`. It is not a real physics model — tuning
  constants (gear ratios, redline, drag coefficients) live as named
  constants at the top of the file and are deliberately approximate, tuned
  for a convincing feel rather than accuracy.
- **Dashboard UI (`src/pages/Dashboard.jsx`)**: consumes `useVehicleSim`,
  wires up keyboard controls (arrow keys/WASD for throttle/brake, A/D for
  turn signals, H for high beam, P for handbrake) via `window` key
  listeners, and provides a `hold()` helper that binds mouse/touch
  press-and-hold events to the same throttle/brake setters for on-screen
  pedal buttons.
- **Gauge components (`src/components/dashboard/`)**:
  - `Gauge.jsx` — a generic analog gauge rendered as raw SVG (polar
    coordinate math for ticks/needle/redline arc), parameterized by
    `value`/`max`/`majorStep`/`redlineFrom`/`accent`, reused for both the
    tachometer and speedometer.
  - `BarGauge.jsx` — linear bar-style gauge used for coolant, fuel, boost,
    oil pressure, and voltage.
  - `WarningLights.jsx` — renders the warning-light icon grid from the
    `warnings` object produced by `useVehicleSim`.
- **Podcast coach (`src/pages/Podcast.jsx` + `src/lib/`)**: the second feature,
  entirely client-side (no backend, no API keys, no npm additions). The page is
  a thin controller over pure-function modules in `src/lib/`:
  - `rssFeed.js` — fetches the RSS (direct, then a chain of public CORS
    proxies; the UI also accepts pasted XML) and parses it with `DOMParser`
    into `{ title, …, episodes[] }`.
  - `transcript.js` — parses SRT / WebVTT / plain text (with optional inline
    timestamps and `Όνομα:` speaker labels) into
    `{ segments[], text, speakers, durationSec, hasTiming }`.
  - `greekText.js` — Greek-specific text utilities: accent/final-sigma
    normalization, tokenizing, sentence splitting (`;` is the Greek question
    mark), approximate syllable counting, stopwords, n-gram repeats.
  - `speechAnalysis.js` — the core: filler lexicon (hesitation sounds, crutch
    words, connector tics, hedges), speaking rate, sentence length, questions,
    speaker balance, monologues, pauses, English-vs-sim-racing-jargon, hook and
    outro checks. Produces `scores` (0-100 per dimension, weighted `overall`)
    and `tips[]` (severity + explanation + drill), all written in Greek.
  - `feedAnalysis.js` — publishing cadence, duration consistency, title and
    shownotes quality, metadata completeness, keyword extraction, plus feed
    tips; `analyzeEpisodeMeta` does the same for a single episode.
  - `score.js`, `report.js`, `storage.js`, `demoTranscript.js` — score→tone
    mapping, Markdown export, `localStorage` helpers (feed URL, transcripts,
    analysis history), and a sample transcript for the demo button.
  Scoring bands and the filler lexicon are deliberately approximate heuristics
  tuned for useful coaching, not linguistics research — adjust the named
  constants at the top of each module rather than scattering magic numbers.
  Presentational components live in `src/components/podcast/` and use a
  `pod__*` BEM-like class convention.
- **Sim racing lab (`src/pages/SimLab.jsx` + `src/lib/simlab/` +
  `src/components/simlab/`)**: the third feature, entirely client-side. The page
  is a controller over pure-function modules in `src/lib/simlab/`:
  - `boards.js` / `parts.js` — the hardware catalogue. Boards carry the *real*
    pinout of each board, in header order, with the printed label, the
    capability tags (`digital`, `analog`, `pwm`, `interrupt`, `sda`, …) and an
    `ino` field holding the name the Arduino compiler expects (`D6` → `6`,
    `GP26` → `26`, `A2` → `A2`). Codegen reads `ino` via `inoPin()` rather than
    guessing from the id, so a pin with no `ino` (a power rail) surfaces as an
    explicit "unwired" warning in the sketch instead of a silent `-1`. Parts
    declare pins with types (`din`, `aout`, `pwm`, `sda`, `pwr`, `gnd`, `v12`,
    …), a `role`, tunable `params`, a `loopUs(values, board)` cost and current
    draw. Adding a part means adding one entry here — nothing else is
    hard-coded against specific part ids except a few display specialisations.
  - `circuit.js` — the build model (`nodes`, `wires`, `settings`), net
    resolution by union-find, and the fixed card geometry that lets wire
    endpoints be computed without measuring the DOM. It also holds the wire
    router: `routeWire()` produces an orthogonal path that exits each pin
    along its facing side and picks the first vertical corridor that clears
    every card rectangle (falling back to a detour above/below), and
    `autoLayout()` places the board so each part sits on the side matching the
    pin column it wires to. Routes are memoised in `Workbench.jsx` — they are
    expensive and only change when something moves.
  - `libraries.js` — a registry of real Arduino libraries mapped to part roles
    and board architectures, with flash/RAM cost and install commands.
  - `firmware.js` — derives the program from the netlist: which parts became
    HID buttons/axes, the loop-time budget and the memory estimate. Everything
    downstream (simulation, DRC, codegen, BOM) consumes this one object, so the
    thing you test is the thing you flash.
  - `drc.js` — the design rule check; each finding carries severity, cause and
    a concrete fix.
  - `engine.js` — the simulation: it runs the firmware loop at the frequency
    `firmware.js` computed (not at frame rate), which is what makes a slow
    display visibly break the inputs.
  - `telemetry.js` — the virtual car and tracks that feed the outputs.
  - `codegen.js`, `bom.js`, `presets.js`, `storage.js`.
  Tuning constants live at the top of each module. Component styles use a
  `lab__*` BEM-like convention, and the page breaks out of the 960px
  `.container` via `.lab`.
  `BoardArt.jsx` draws each board as SVG at its real millimetre proportions
  (the viewBox is the board's mm, padded so overhanging connectors aren't
  clipped); it renders between the two pin columns on the workbench card and
  larger in the inspector when the board is selected. Coordinates must be
  passed as numbers, not strings — the sub-components do arithmetic on them.
  `Workbench.jsx` owns zoom and pan: the content sits in a scaled wrapper, so
  pointer coordinates must be divided by `zoom` before they become node
  positions. Panning starts on a pointerdown that `isBackground()` accepts —
  the scale wrapper means the event target is rarely the canvas itself, so
  test with `closest()` rather than `e.target === e.currentTarget`.
  `/lab/wiring` (`WiringLab.jsx`) renders the same `Workbench` full-screen.
  Both it and `SimLab.jsx` hold the build through `useBuildStore`, which
  persists to `localStorage` and syncs across tabs via the `storage` event;
  it skips writes when the serialised build is unchanged so two open tabs
  don't ping state back and forth. The store also owns undo/redo: history
  lives in refs as JSON snapshots, changes closer than 400ms coalesce into
  one step (so drags don't flood it), and Ctrl/⌘+Z / Ctrl+Shift+Z work on any
  page using the hook. While a wire is pending, `Workbench.jsx` draws a
  dashed rubber-band to the cursor and marks every pin as compatible or not
  (`typeMatchesCaps` for board pins, the `PART_PAIRS` set for part-to-part);
  unknown part pairs stay neutral rather than being dimmed.
  The canvas has two views, switched in `SimLab.jsx`: `Workbench.jsx` (the
  schematic — cards, pins and wires) and `PanelView.jsx` (the rig — SVG
  controls you actually press, turn and drag). Both drive the same `controls`
  object and read the same `engine.nodes` state, so the simulated debounce and
  ADC noise show up identically in either. Panel styles use a `pnl__*` prefix.
  Generated sketch/BOM/JSON filenames go through `sketchName()` — the Arduino
  IDE rejects non-ASCII sketch names and requires the folder to match the
  `.ino`, so Greek build names are transliterated.
- **Styling**: no CSS framework — plain CSS in `src/index.css` with design
  tokens defined as CSS custom properties in `:root`: a slate-based dark
  palette, a violet accent with a cyan secondary, a dense spacing scale
  (`--sp-1`…`--sp-6`), elevation (`--shadow-1`…`--shadow-3`) and `--ease`.
  A global `:focus-visible` ring and a `prefers-reduced-motion` block live
  next to the tokens. Part icons are inline SVG (`PartIcon.jsx`) — no emoji.
  Routes listed in `WIDE_ROUTES` (`Layout.jsx`) render outside the 960px
  `.container` and set their own width, rather than breaking out with
  negative-margin tricks. Dashboard-specific styles use a `dash__*` BEM-like naming
  convention (e.g. `dash__cluster`, `dash__pod`, `dash__gear`); the podcast
  page uses `pod__*` the same way.

## Conventions

- Functional components with hooks only; no class components.
- Components are plain `.jsx` files exporting a single default function
  matching the filename.
- ESLint config (`eslint.config.js`) disables `react/prop-types` (no
  PropTypes or TS types are used for props) and turns off
  `jsx-no-target-blank`. `react-hooks` recommended rules are enabled, so obey
  the exhaustive-deps rule for `useEffect`/hooks unless there's a documented
  reason not to.
