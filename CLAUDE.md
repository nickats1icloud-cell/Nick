# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Nick" is a React + Vite single-page app centered on `/dashboard`: a fully
functional digital car instrument cluster (analog tacho/speedo, secondary
gauges, warning lights, and a client-side vehicle physics simulation) styled
after the Honda Civic EK's LCD cluster. The README, in-code comments, and UI
copy are in Greek — match that language when writing user-facing strings or
comments in this codebase.

The repository holds **two independent sites** that share nothing but the
deploy workflow: the React app at the root, and the static
`greek-simracers/` site (see below). Keep them separate — no shared
components, styles, or dependencies.

## Repo layout

```
.
├── index.html, vite.config.js, eslint.config.js, package.json
├── src/                   # the React app (see Architecture)
├── public/
├── greek-simracers/       # independent static site (no npm, no build)
├── .github/workflows/deploy.yml
├── .claude/skills/ui-ux-pro-max/   # vendored UI/UX design-reference skill
└── .mcp.json              # project MCP servers
```

## Commands

```bash
npm install         # install dependencies
npm run dev         # dev server with hot reload, http://localhost:5173
npm run build       # production build to dist/
npm run preview     # preview the production build
npm run lint        # ESLint over the whole project
```

There is no test suite configured (no test runner/script in `package.json`).
There is no `typecheck` script either — this is a plain JS/JSX project, not
TypeScript. `npm run lint` is the only automated check available; run it
after editing anything under `src/`.

**Known lint state:** `npm run lint` exits non-zero on a clean checkout with
36 errors, *all* of them inside the vendored, minified
`greek-simracers/js/vendor/supabase.umd.js` (`no-unused-vars`, `no-undef`
for `Deno`/`Buffer`, `no-empty`, …). `eslint.config.js` only ignores `dist`,
so the bundle gets linted. Judge your own changes by whether the reported
files are yours — nothing outside that vendor file should appear. Adding
`greek-simracers/js/vendor` to the config's `ignores` would make the run
green.

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on push to
`claude/website-setup-0k2c7k`, `claude/custom-car-dashboard-5v69i8`, or
`claude/greek-sim-racers-rebuild-fjomf8` (or via manual `workflow_dispatch`).
If work lands on a different branch and should go live, add that branch to
the workflow's `on.push.branches` list.

The workflow does three things beyond a plain build:

- The app is served from `/Nick/` (see `base` in `vite.config.js`), and
  `router basename` in `src/main.jsx` is set from `import.meta.env.BASE_URL`
  to match.
- It copies `dist/index.html` to `dist/404.html` so client-side routes (e.g.
  `/Nick/about` on a hard reload) resolve on Pages, which has no server-side
  rewrite support.
- It copies `greek-simracers/` verbatim into `dist/greek-simracers`, served
  at `/Nick/greek-simracers/`.

## Architecture

- **Routing**: `src/main.jsx` mounts `<App>` inside a `BrowserRouter`;
  `src/App.jsx` defines all routes under a shared `Layout` (`/`, `/dashboard`,
  `/about`, catch-all `NotFound`). To add a page: create a component in
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
  constants (`REDLINE_RPM`, `MAX_RPM`, `MAX_SPEED`, `MAX_BOOST`,
  `GEAR_RATIOS`, shift points, `IDLE_RPM`) live at the top of the file and
  are deliberately approximate, tuned for a convincing feel rather than
  accuracy. The exported constants are also imported by the gauge markup, so
  changing a limit updates both the physics and the dials.
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
- **Styling**: no CSS framework — plain CSS in `src/index.css` with design
  tokens (colors, radius, max-width) defined as CSS custom properties in
  `:root`. Dashboard-specific styles use a `dash__*` BEM-like naming
  convention (e.g. `dash__cluster`, `dash__pod`, `dash__gear`).

## Sub-project: `greek-simracers/`

A second, fully independent site (greeksimracers.gr rebuild): plain static
HTML/CSS/JS with **no build step and no npm** — do not add bundlers,
frameworks, or npm dependencies there. It has its own `README.md` with the
full page inventory and Supabase setup steps; read it before making changes.

Conventions that matter when editing it:

- **One HTML file per page** (`home.html`, `forum-thread.html`,
  `championships.html`, …), each loading its own ES module. Detail pages
  read their record id from the query string (`?id=…`). `index.html` is an
  intro/splash that redirects to `home.html` after the first visit.
- **Shared chrome via `js/partials.js`** — navbar and footer are injected as
  template strings (plus theme toggle and mobile menu), not duplicated in
  each HTML file. Add nav links to its `NAV_LINKS` array.
- **`js/auth.js` is a singleton module**, standing in for a React
  context/provider: ES module caching means every page importing it shares
  one session, with `onAuthChange` subscribers and a "last seen" heartbeat.
  It also enforces the **approval gate** — new signups have
  `is_approved = false` and are signed straight back out, which is the usual
  answer to "login doesn't work for a new account".
- **Supabase from the browser** via the vendored `js/vendor/supabase.umd.js`
  bundle (loaded with `<script defer>` in each page's `<head>`, sets
  `window.supabase`) — no CDN dependency. `js/supabase-client.js` wraps it
  and deliberately falls back to placeholder URL/key when `js/config.js` is
  unfilled, so an unconfigured checkout still renders every page with
  queries failing quietly instead of taking down the module graph.
- **Config, not secrets**: `js/config.js` holds `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, and `SOCIAL_LINKS`. The anon key is meant to be
  public; access control lives in the RLS policies, so never rely on
  client-side checks for authorization.
- **Database schema** is a single annotated file,
  `supabase/migrations/001_wave1_schema.sql` — tables for roles, profiles,
  articles (+ comments/likes/categories), forum categories/threads/posts,
  championships, site settings, and contact submissions, each with RLS
  policies, plus triggers (`handle_new_user`, `touch_thread_on_post`) and
  RPCs (`has_role`, `increment_article_views`, `increment_thread_views`).
  Extend the schema by appending a new numbered migration rather than
  editing this one in place once it has been applied.
- **CSS** is split into `css/tokens.css` (dark + light design tokens),
  `css/base.css` (reset, typography, buttons, cards, forms, toasts), and
  `css/components.css` (navbar, footer, hero, grids). All classes are
  namespaced `gsr__*` / `gsr-<block>__*`.
- **Rendering user content** goes through `js/markdown.js`, which escapes
  HTML before rendering; keep using it rather than assigning raw
  `innerHTML` from database values.
- **Preview locally** with a static server (ES modules don't run from
  `file://`): `cd greek-simracers && python3 -m http.server 8000`.

## Tooling in this repo

- `.mcp.json` declares the **21st** MCP server (`https://21st.dev/api/mcp`),
  which reads its key from the `MCP_21ST_API_KEY` environment variable — the
  key is never committed.
- `.claude/skills/ui-ux-pro-max/` is a vendored design-reference skill (CSV
  datasets + Python search scripts). It is reference data for design work,
  not application code — don't import from it or bundle it into either site.

## Conventions

- Functional components with hooks only; no class components.
- Components are plain `.jsx` files exporting a single default function
  matching the filename.
- No semicolons and single quotes in `src/` (the React app); the
  `greek-simracers/` JS uses semicolons and double quotes. Match whichever
  file you're in.
- ESLint config (`eslint.config.js`) disables `react/prop-types` (no
  PropTypes or TS types are used for props) and turns off
  `jsx-no-target-blank`. `react-hooks` recommended rules are enabled, so obey
  the exhaustive-deps rule for `useEffect`/hooks unless there's a documented
  reason not to. `dist` is ignored; the lint run covers `greek-simracers/`
  too, so its hand-written browser JS must stay lint-clean as well (see
  "Known lint state" above for the vendored-bundle errors).
