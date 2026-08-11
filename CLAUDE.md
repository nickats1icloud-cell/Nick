# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Nick" is a React + Vite single-page app with three features:

- `/championship` — **Race Control**: a championship management system for a
  Le Mans Ultimate endurance series (teams, team principals, drivers, calendar,
  stint plans validated against a configurable rulebook, results, standings).
- `/dashboard` — a fully functional digital car instrument cluster (analog
  tacho/speedo, secondary gauges, warning lights, and a client-side vehicle
  physics simulation) styled after the Honda Civic EK's LCD cluster.
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

Optional backend config for `/championship` goes in `.env.local` (see
`.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally
`VITE_LMU_CHAMPIONSHIP_ID`. Without them the app runs fully local.

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on push to any
of the branches listed in its `on.push.branches` array (or via manual
`workflow_dispatch`) — add a new feature branch there if it should deploy. The app is served from `/Nick/` (see `base` in
`vite.config.js`), and `router basename` in `src/main.jsx` is set from
`import.meta.env.BASE_URL` to match. The build step copies `dist/index.html`
to `dist/404.html` so client-side routes (e.g. `/Nick/about` on a hard
reload) resolve correctly on Pages, which has no server-side rewrite support.

## Architecture

- **Routing**: `src/main.jsx` mounts `<App>` inside a `BrowserRouter`;
  `src/App.jsx` defines all routes under a shared `Layout` (`/`, `/dashboard`,
  `/podcast`, `/championship/*`, `/about`, catch-all `NotFound`). To add a page:
  create a component in `src/pages/` and add a `<Route>` in `App.jsx`; to add a
  nav link, edit `src/components/Navbar.jsx`. The `/championship` branch is a
  nested route tree whose element wraps `ChampLayout` in
  `ChampionshipProvider`, so every sub-page shares one state tree.
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
- **Championship management (`/championship`)**: the third feature. It runs in
  **two modes with identical UI** — local (`localStorage`, no accounts) and
  backed by Supabase (Postgres + Auth + RLS + realtime). The mode is decided by
  `src/lib/lmu/config.js`: if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are
  set, it goes remote; otherwise everything behaves as before. Data layer lives
  in `src/lib/lmu/` as pure modules:
  - `constants.js` — classes, cars per class, the 11 LMU tracks (length, pit
    loss, per-class reference lap times), per-class car defaults, driver
    categories, roles, points presets, default rulebook. **All physical numbers
    are deliberately approximate** — tune the named constants here rather than
    scattering magic numbers.
  - `model.js` — factories (`createTeam`, `createEvent`, `createPlan`, …),
    `emptyState()` and `normalizeState()`, which repairs anything loaded from
    localStorage or an imported JSON backup (it never throws).
  - `store.js` — `reducer(state, action)` plus `loadState`/`saveState`. Every
    mutation is an action so the layer could sit behind a real API later.
  - `stints.js` — `computePlan()` derives the whole timeline (per-stint start/end,
    pit time, fuel, tyre sets, per-driver totals, continuous-driving blocks);
    `generateStints()` auto-builds a plan and then tops it up against
    `computePlan` so coverage is exact rather than estimated.
  - `rules.js` — `validatePlan()` turns the computed plan into `error`/`warn`/`ok`
    checks (max continuous driving, rest, drive-time share, Am minimum, fuel,
    tyres, roster, availability, deadline). Errors block submission.
  - `standings.js` — per-class classification, points (incl. double points, pole,
    fastest lap, minimum-laps rule, drop rounds) and tie-breaks.
  - `permissions.js` — `can(state, action, scope)` for ADMIN / PRINCIPAL /
    DRIVER. This is the **UI half** of the rules: it hides controls. In remote
    mode the same rules are enforced for real by RLS policies in
    `supabase/migrations/001_championship.sql` — keep the two in sync when you
    change either.
  - `seed.js` — the demo championship; `exports.js` — Markdown/CSV/JSON export
    and backup parsing.
  - **Backend modules** (only active in remote mode): `config.js` (env/mode),
    `supabase.js` (lazy `getClient()` via dynamic import, so supabase-js is a
    separate chunk that never loads locally), `api.js` (row↔model mappers,
    `fetchState()` which returns the *same* state shape the UI already used,
    `pushAction()` which maps each reducer action to writes, `uploadState()`
    which copies a local championship into the cloud remapping non-UUID ids),
    `auth.js` (email+password, `lmu_claim_driver` RPC).
  - Ids are real UUIDs (`utils.uid()` → `crypto.randomUUID()`) so browser-made
    ids can be primary keys directly — that is why the same state works in both
    modes without translation.
  State reaches the UI through `ChampionshipProvider`
  (`src/components/champ/`) + the `useChampionship` / `usePlan` hooks in
  `src/hooks/useChampionship.js`; the context object itself lives in
  `src/lib/lmu/context.js` so provider and hooks stay in separate files (React
  fast refresh). In remote mode the provider computes the next state with the
  pure reducer, applies it optimistically, then pushes it; on rejection it shows
  the database's message and re-fetches. Pages read `ctx.backend` for
  mode/session/sync status. Presentational components are in
  `src/components/champ/` with a `champ__*` class convention, pages in
  `src/pages/champ/`.
- **Database** (`supabase/migrations/001_championship.sql`): tables, RLS
  policies, guard triggers (`lmu_guard_plan` locks approved plans and reserves
  approval for admins, `lmu_guard_driver` restricts which columns each role may
  change, `lmu_guard_stint` keeps a stint's driver inside the plan's team) and
  RPCs (`lmu_create_championship`, `lmu_claim_driver`). Helper predicates are
  `SECURITY DEFINER` to avoid RLS recursion. Stint plans are readable only by
  their own team and the organiser; a `v_public_drivers` view exposes safe
  driver columns to anonymous visitors without leaking emails.
- **Styling**: no CSS framework — plain CSS in `src/index.css` with design
  tokens (colors, radius, max-width) defined as CSS custom properties in
  `:root`. Dashboard-specific styles use a `dash__*` BEM-like naming
  convention (e.g. `dash__cluster`, `dash__pod`, `dash__gear`); the podcast
  page uses `pod__*` and the championship pages `champ__*` the same way.

## Conventions

- Functional components with hooks only; no class components.
- Components are plain `.jsx` files exporting a single default function
  matching the filename.
- ESLint config (`eslint.config.js`) disables `react/prop-types` (no
  PropTypes or TS types are used for props) and turns off
  `jsx-no-target-blank`. `react-hooks` recommended rules are enabled, so obey
  the exhaustive-deps rule for `useEffect`/hooks unless there's a documented
  reason not to.
