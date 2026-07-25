# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Nick" is a React + Vite single-page app centered on `/dashboard`: a fully
functional digital car instrument cluster (analog tacho/speedo, secondary
gauges, warning lights, and a client-side vehicle physics simulation) styled
after the Honda Civic EK's LCD cluster. The README, in-code comments, and UI
copy are in Greek — match that language when writing user-facing strings or
comments in this codebase.

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
- **Styling**: no CSS framework — plain CSS in `src/index.css` with design
  tokens (colors, radius, max-width) defined as CSS custom properties in
  `:root`. Dashboard-specific styles use a `dash__*` BEM-like naming
  convention (e.g. `dash__cluster`, `dash__pod`, `dash__gear`).

## Conventions

- Functional components with hooks only; no class components.
- Components are plain `.jsx` files exporting a single default function
  matching the filename.
- ESLint config (`eslint.config.js`) disables `react/prop-types` (no
  PropTypes or TS types are used for props) and turns off
  `jsx-no-target-blank`. `react-hooks` recommended rules are enabled, so obey
  the exhaustive-deps rule for `useEffect`/hooks unless there's a documented
  reason not to.
