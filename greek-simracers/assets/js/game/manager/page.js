/**
 * Το UI του GSR Team Manager: οθόνες, φόρμες και ο τοίχος των μηχανικών.
 *
 * Η λογική της καριέρας ζει στο model.js και η προσομοίωση στο race.js —
 * εδώ γίνεται μόνο η ζωγραφική και το δέσιμο των κουμπιών.
 */

import {
  CALENDAR,
  DIFFICULTIES,
  PACE_MODES,
  TYRES,
  UPGRADES,
  difficultyById,
  formatGap,
  formatTime,
  makeDriverPool,
  makeRng,
  money,
  tyreById,
} from "./data.js";
import {
  allTeams,
  applyRaceResult,
  buyUpgrade,
  carRating,
  clearSave,
  costOfUpgrade,
  driverStandings,
  endSeason,
  hireDriver,
  load,
  newCareer,
  nextRace,
  save,
  seasonFinished,
  signingFee,
  teamStandings,
} from "./model.js";
import { Race } from "../race.js";
import { trackById } from "../tracks.js";

const el = (id) => document.getElementById(id);

const TEAM_COLORS = ["#2f6fd0", "#d63b3b", "#e8a33d", "#43a86b", "#7d5fd0", "#dcdcdc"];

let state = null;
let race = null;

// ---------------------------------------------------------------------------
// Βοηθητικά ζωγραφικής
// ---------------------------------------------------------------------------

function show(screenId) {
  for (const id of ["screen-start", "screen-hq", "screen-quali", "screen-race", "screen-results"]) {
    el(id).hidden = id !== screenId;
  }
  el("mgr-topbar").hidden = screenId === "start" || screenId === "screen-start" || !state;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Μικρή γραμμή προόδου (0-100) για ratings. */
function bar(value, color) {
  const wrap = document.createElement("div");
  wrap.className = "mgr-bar";
  const fill = document.createElement("div");
  fill.className = "mgr-bar__fill";
  fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
  if (color) fill.style.background = color;
  wrap.appendChild(fill);
  return wrap;
}

function row(label, value) {
  const div = document.createElement("div");
  div.className = "mgr-row";
  const l = document.createElement("span");
  l.textContent = label;
  const v = document.createElement("strong");
  v.textContent = value;
  div.append(l, v);
  return div;
}

function empty(text) {
  const p = document.createElement("p");
  p.className = "mgr-muted";
  p.textContent = text;
  return p;
}

// ---------------------------------------------------------------------------
// Οθόνη έναρξης
// ---------------------------------------------------------------------------

const draft = {
  name: "",
  color: TEAM_COLORS[0],
  difficulty: "pro",
  drivers: [],
  seed: Math.floor(Math.random() * 1e9),
  pool: [],
};

function renderStart() {
  const saved = load();
  el("resume-card").hidden = !saved;
  el("new-career").hidden = Boolean(saved);
  if (saved) {
    const done = saved.round;
    el("resume-info").textContent =
      `${saved.team.name} · Σεζόν ${saved.season} · ${done}/${CALENDAR.length} αγώνες · ταμείο ${money(saved.money)}`;
  }

  // Χρώματα ομάδας
  const colors = el("team-colors");
  colors.innerHTML = "";
  for (const color of TEAM_COLORS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `mgr-color${color === draft.color ? " mgr-color--active" : ""}`;
    btn.style.background = color;
    btn.setAttribute("aria-label", `Χρώμα ${color}`);
    btn.addEventListener("click", () => {
      draft.color = color;
      renderStart();
    });
    colors.appendChild(btn);
  }

  // Δυσκολία
  const diffs = el("choice-difficulty");
  diffs.innerHTML = "";
  for (const d of DIFFICULTIES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `mgr-choice${d.id === draft.difficulty ? " mgr-choice--active" : ""}`;
    const strong = document.createElement("strong");
    strong.textContent = d.name;
    const small = document.createElement("small");
    small.textContent = `Budget ${money(d.budget)}`;
    btn.append(strong, small);
    btn.addEventListener("click", () => {
      draft.difficulty = d.id;
      renderStart();
    });
    diffs.appendChild(btn);
  }

  // Αγορά οδηγών
  if (!draft.pool.length) draft.pool = makeDriverPool(makeRng(draft.seed), 14);
  const budget = difficultyById(draft.difficulty).budget;
  const spent = draft.drivers.reduce((sum, id) => {
    const d = draft.pool.find((x) => x.id === id);
    return sum + (d ? signingFee(d) : 0);
  }, 0);
  el("hire-budget").textContent = `— διαθέσιμα ${money(budget - spent)} από ${money(budget)}`;

  const grid = el("market-grid");
  grid.innerHTML = "";
  for (const driver of draft.pool) {
    const picked = draft.drivers.includes(driver.id);
    const fee = signingFee(driver);
    const affordable = picked || (spent + fee <= budget && draft.drivers.length < 2);
    grid.appendChild(
      driverCard(driver, {
        selected: picked,
        disabled: !affordable,
        action: picked ? "Αφαίρεση" : "Επιλογή",
        onAction: () => {
          if (picked) draft.drivers = draft.drivers.filter((id) => id !== driver.id);
          else if (affordable) draft.drivers.push(driver.id);
          renderStart();
        },
      }),
    );
  }

  el("btn-start-career").disabled = draft.drivers.length !== 2;
}

/** Κάρτα οδηγού — χρησιμοποιείται και στην αγορά και στη βάση. */
function driverCard(driver, { selected, disabled, action, onAction, extra } = {}) {
  const card = document.createElement("div");
  card.className = `mgr-driver${selected ? " mgr-driver--selected" : ""}`;

  const head = document.createElement("div");
  head.className = "mgr-driver__head";
  const name = document.createElement("strong");
  name.textContent = driver.name;
  const age = document.createElement("span");
  age.className = "mgr-muted";
  age.textContent = `${driver.age} ετών`;
  head.append(name, age);
  card.appendChild(head);

  const stats = document.createElement("div");
  stats.className = "mgr-driver__stats";
  const addStat = (label, value, barValue) => {
    const wrap = document.createElement("div");
    const l = document.createElement("span");
    l.textContent = label;
    const v = document.createElement("strong");
    v.textContent = value;
    wrap.append(l, v, bar(barValue));
    stats.appendChild(wrap);
  };
  addStat("Ταχύτητα", String(Math.round(driver.skill)), driver.skill);
  addStat("Σταθερότητα", String(Math.round(driver.consistency)), driver.consistency);
  if (driver.morale !== undefined) addStat("Ηθικό", String(Math.round(driver.morale)), driver.morale);
  card.appendChild(stats);

  const foot = document.createElement("div");
  foot.className = "mgr-driver__foot";
  const salary = document.createElement("span");
  salary.className = "mgr-muted";
  salary.textContent = `Μισθός ${money(driver.salary)}/αγώνα`;
  foot.appendChild(salary);
  if (extra) foot.appendChild(extra);
  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline btn-sm";
    btn.textContent = action;
    btn.disabled = Boolean(disabled);
    btn.addEventListener("click", onAction);
    foot.appendChild(btn);
  }
  card.appendChild(foot);
  return card;
}

// ---------------------------------------------------------------------------
// Βάση (HQ)
// ---------------------------------------------------------------------------

function renderTopbar() {
  if (!state) return;
  el("top-color").style.background = state.team.color;
  el("top-team").textContent = state.team.name;
  el("top-season").textContent = `Σεζόν ${state.season} · Αγώνας ${Math.min(state.round + 1, CALENDAR.length)}/${CALENDAR.length}`;
  el("top-money").textContent = money(state.money);
  el("top-car").textContent = String(Math.round(carRating(state.team.car)));
  el("top-points").textContent = String(state.team.points);
}

function renderHQ() {
  renderTopbar();
  renderBasePane();
  renderDevPane();
  renderDriversPane();
  renderChampPane();
}

function renderBasePane() {
  const container = el("next-race");
  container.innerHTML = "";
  const race = nextRace(state);

  if (!race) {
    container.appendChild(empty("Η σεζόν ολοκληρώθηκε — δες τη βαθμολογία και ξεκίνα την επόμενη."));
    el("btn-goto-race").textContent = "ΤΕΛΟΣ ΣΕΖΟΝ";
  } else {
    const track = trackById(race.trackId);
    const title = document.createElement("div");
    title.className = "mgr-race-title";
    title.textContent = `${track.emoji} ${race.name}`;
    container.appendChild(title);
    container.appendChild(row("Πίστα", track.name));
    container.appendChild(row("Γύροι", String(race.laps)));
    container.appendChild(row("Χαρακτήρας", track.subtitle));
    el("btn-goto-race").textContent = "ΣΤΗΝ ΠΙΣΤΑ";
  }

  const summary = el("team-summary");
  summary.innerHTML = "";
  summary.appendChild(row("Ταμείο", money(state.money)));
  summary.appendChild(row("Φήμη", `${Math.round(state.team.reputation)}/100`));
  summary.appendChild(row("Μισθοί/αγώνα", money(state.team.drivers.reduce((s, d) => s + d.salary, 0))));
  for (const upgrade of UPGRADES) {
    const line = document.createElement("div");
    line.className = "mgr-stat";
    const label = document.createElement("span");
    label.textContent = `${upgrade.emoji} ${upgrade.name}`;
    const value = document.createElement("strong");
    value.textContent = String(Math.round(state.team.car[upgrade.id]));
    line.append(label, value, bar(state.team.car[upgrade.id], state.team.color));
    summary.appendChild(line);
  }

  const log = el("team-log");
  log.innerHTML = "";
  if (!state.log.length) log.appendChild(empty("Κανένα νέο ακόμα."));
  for (const entry of state.log.slice(0, 8)) {
    const line = document.createElement("div");
    line.className = "mgr-log";
    const when = document.createElement("span");
    when.textContent = `Σ${entry.season}·Α${entry.round}`;
    const text = document.createElement("span");
    text.textContent = entry.text;
    line.append(when, text);
    log.appendChild(line);
  }
}

function renderDevPane() {
  const list = el("dev-list");
  list.innerHTML = "";
  for (const upgrade of UPGRADES) {
    const rating = state.team.car[upgrade.id];
    const cost = costOfUpgrade(state, upgrade.id);
    const card = document.createElement("div");
    card.className = "mgr-dev";

    const head = document.createElement("div");
    head.className = "mgr-dev__head";
    const name = document.createElement("strong");
    name.textContent = `${upgrade.emoji} ${upgrade.name}`;
    const value = document.createElement("span");
    value.className = "mgr-dev__value";
    value.textContent = String(Math.round(rating));
    head.append(name, value);

    const desc = document.createElement("p");
    desc.className = "mgr-muted";
    desc.textContent = upgrade.desc;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline btn-sm";
    btn.textContent = rating >= 99 ? "Στο μέγιστο" : `Αναβάθμιση · ${money(cost)}`;
    btn.disabled = rating >= 99 || state.money < cost;
    btn.addEventListener("click", () => {
      const result = buyUpgrade(state, upgrade.id);
      if (result.ok) {
        save(state);
        renderHQ();
      }
    });

    card.append(head, bar(rating, state.team.color), desc, btn);
    list.appendChild(card);
  }
}

let marketSlot = 0;

function renderDriversPane() {
  const mine = el("my-drivers");
  mine.innerHTML = "";
  state.team.drivers.forEach((driver, index) => {
    const badge = document.createElement("span");
    badge.className = "mgr-pill";
    badge.textContent = `${driver.points || 0} βαθμοί`;
    mine.appendChild(
      driverCard(driver, {
        selected: marketSlot === index,
        action: marketSlot === index ? "Επιλεγμένος" : "Αντικατάσταση",
        disabled: marketSlot === index,
        extra: badge,
        onAction: () => {
          marketSlot = index;
          renderDriversPane();
        },
      }),
    );
  });

  el("market-hint").textContent =
    `Θέση προς αλλαγή: ${state.team.drivers[marketSlot]?.name ?? "—"}. Η υπογραφή κοστίζει τρεις μισθούς.`;

  const market = el("hq-market");
  market.innerHTML = "";
  const pool = state.market.slice().sort((a, b) => b.skill - a.skill).slice(0, 8);
  if (!pool.length) market.appendChild(empty("Κανένας διαθέσιμος οδηγός."));
  for (const driver of pool) {
    const fee = signingFee(driver);
    market.appendChild(
      driverCard(driver, {
        action: `Υπογραφή · ${money(fee)}`,
        disabled: state.money < fee,
        onAction: () => {
          const result = hireDriver(state, driver.id, marketSlot);
          if (result.ok) {
            save(state);
            renderHQ();
          }
        },
      }),
    );
  }
}

function renderChampPane() {
  const drivers = el("standings-drivers");
  drivers.innerHTML = "";
  driverStandings(state).forEach((d, i) => {
    drivers.appendChild(standingRow(i + 1, d.name, d.team, d.points, d.color, d.isPlayer));
  });

  const teams = el("standings-teams");
  teams.innerHTML = "";
  teamStandings(state).forEach((t, i) => {
    teams.appendChild(standingRow(i + 1, t.name, "", t.points, t.color, t.isPlayer));
  });

  const calendar = el("calendar-list");
  calendar.innerHTML = "";
  CALENDAR.forEach((race, i) => {
    const done = state.history.find((h) => h.season === state.season && h.round === race.round);
    const line = document.createElement("div");
    line.className = `mgr-cal${i === state.round ? " mgr-cal--next" : ""}`;
    const name = document.createElement("span");
    name.textContent = `${race.round}. ${race.name}`;
    const info = document.createElement("span");
    info.className = "mgr-muted";
    if (done) {
      const best = done.results.find((r) => r.teamId === "player");
      info.textContent = best ? `P${best.position}${best.dnf ? " (DNF)" : ""}` : "—";
    } else {
      info.textContent = `${race.laps} γύροι`;
    }
    line.append(name, info);
    calendar.appendChild(line);
  });
}

function standingRow(position, name, team, points, color, isPlayer) {
  const line = document.createElement("div");
  line.className = `mgr-standing${isPlayer ? " mgr-standing--player" : ""}`;
  const pos = document.createElement("span");
  pos.className = "mgr-standing__pos";
  pos.textContent = String(position);
  const chip = document.createElement("span");
  chip.className = "mgr-standing__chip";
  chip.style.background = color;
  const label = document.createElement("span");
  label.className = "mgr-standing__name";
  label.textContent = team ? `${name} · ${team}` : name;
  const pts = document.createElement("strong");
  pts.textContent = String(points);
  line.append(pos, chip, label, pts);
  return line;
}

// ---------------------------------------------------------------------------
// Αγωνιστικό Σαββατοκύριακο
// ---------------------------------------------------------------------------

function gotoRaceWeekend() {
  if (seasonFinished(state)) {
    // Οι βαθμοί μηδενίζονται στο endSeason — κρατάμε την τελική εικόνα πρώτα.
    const finalTeams = teamStandings(state);
    const finalDrivers = driverStandings(state);
    const season = state.season;
    const { position, bonus } = endSeason(state);
    save(state);
    showSeasonEnd({ season, position, bonus, finalTeams, finalDrivers });
    return;
  }

  const raceDef = nextRace(state);
  const track = trackById(raceDef.trackId);

  if (!race) {
    race = new Race({
      canvas: el("game-canvas"),
      minimap: el("minimap"),
      onUpdate: renderRaceHud,
      onEvent: onRaceEvent,
      onFinish: onRaceFinish,
    });
    window.gsrRace = race; // βοηθητικό για debugging από την κονσόλα
  }

  // Η σκηνή πρέπει να είναι ορατή πριν μετρηθεί το μέγεθος του καμβά.
  show("screen-race");
  const grid = race.setup({
    teams: allTeams(state),
    raceDef,
    difficultyId: state.difficulty,
  });
  show("screen-quali");

  el("quali-title").textContent = `Κατατακτήριες — ${raceDef.name}`;
  el("quali-sub").textContent = `${track.name} · ${raceDef.laps} γύροι · ${track.subtitle}`;

  const list = el("quali-grid");
  list.innerHTML = "";
  const pole = grid[0].lapMs;
  grid.forEach((entry, i) => {
    const line = document.createElement("div");
    line.className = `mgr-standing${entry.team.isPlayer ? " mgr-standing--player" : ""}`;
    const pos = document.createElement("span");
    pos.className = "mgr-standing__pos";
    pos.textContent = String(i + 1);
    const chip = document.createElement("span");
    chip.className = "mgr-standing__chip";
    chip.style.background = entry.team.color;
    const name = document.createElement("span");
    name.className = "mgr-standing__name";
    name.textContent = `${entry.driver.name} · ${entry.team.name}`;
    const time = document.createElement("strong");
    time.textContent = i === 0 ? formatTime(entry.lapMs) : formatGap(entry.lapMs - pole);
    line.append(pos, chip, name, time);
    list.appendChild(line);
  });
}

function beginRace() {
  show("screen-race");
  race.renderer.resize();
  renderPitwall();
  renderSpeedButtons();
  race.start();
}

function renderSpeedButtons() {
  const wrap = el("speed-buttons");
  wrap.innerHTML = "";
  for (const mult of [1, 2, 4]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `mgr-speedbtn${race.speed === mult ? " mgr-speedbtn--active" : ""}`;
    btn.textContent = `x${mult}`;
    btn.addEventListener("click", () => {
      race.setSpeed(mult);
      renderSpeedButtons();
    });
    wrap.appendChild(btn);
  }
}

/** Ο τοίχος των μηχανικών: εντολές για τους δύο οδηγούς σου. */
function renderPitwall() {
  const wall = el("pitwall");
  wall.innerHTML = "";
  const players = race.entries.filter((e) => e.isPlayer);

  for (const entry of players) {
    const card = document.createElement("div");
    card.className = "mgr-wall";
    card.dataset.entry = entry.id;

    const head = document.createElement("div");
    head.className = "mgr-wall__head";
    const name = document.createElement("strong");
    name.textContent = entry.driver.name;
    const pos = document.createElement("span");
    pos.className = "mgr-wall__pos";
    pos.dataset.role = "pos";
    pos.textContent = `P${entry.position}`;
    head.append(name, pos);

    const tyre = document.createElement("div");
    tyre.className = "mgr-wall__tyre";
    tyre.dataset.role = "tyre";

    const modes = document.createElement("div");
    modes.className = "mgr-wall__modes";
    for (const mode of PACE_MODES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mgr-mini";
      btn.dataset.mode = mode.id;
      btn.textContent = mode.name;
      btn.addEventListener("click", () => {
        race.orderPace(entry.id, mode.id);
        updateWall();
      });
      modes.appendChild(btn);
    }

    const pits = document.createElement("div");
    pits.className = "mgr-wall__pits";
    const label = document.createElement("span");
    label.className = "mgr-label";
    label.textContent = "Pit stop με:";
    pits.appendChild(label);
    for (const tyreSpec of TYRES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mgr-mini";
      btn.style.borderColor = tyreSpec.color;
      btn.textContent = tyreSpec.name;
      btn.addEventListener("click", () => {
        race.orderPit(entry.id, tyreSpec.id);
        updateWall();
      });
      pits.appendChild(btn);
    }

    const camera = document.createElement("button");
    camera.type = "button";
    camera.className = "mgr-mini mgr-mini--wide";
    camera.textContent = "Κάμερα σε αυτόν";
    camera.addEventListener("click", () => {
      race.setCamera(entry.id);
      updateWall();
    });

    card.append(head, tyre, modes, pits, camera);
    wall.appendChild(card);
  }
}

/** Ενημερώνει μόνο τα δυναμικά κομμάτια του τοίχου (χωρίς να ξαναχτίζει DOM). */
function updateWall() {
  if (!race) return;
  for (const card of el("pitwall").children) {
    const entry = race.entries.find((e) => e.id === card.dataset.entry);
    if (!entry) continue;
    card.querySelector('[data-role="pos"]').textContent = entry.dnf
      ? "DNF"
      : entry.inPit
        ? "PIT"
        : `P${entry.position}`;
    const tyre = tyreById(entry.tyre.compound);
    const life = Math.round(entry.tyre.life * 100);
    const tyreEl = card.querySelector('[data-role="tyre"]');
    tyreEl.innerHTML = "";
    const dot = document.createElement("span");
    dot.className = "mgr-tyredot";
    dot.style.background = tyre.color;
    const text = document.createElement("span");
    text.textContent = `${tyre.name} · ${life}%`;
    const wear = bar(life, life < 25 ? "#e0483d" : tyre.color);
    tyreEl.append(dot, text, wear);
    if (entry.pitRequest) {
      const flag = document.createElement("span");
      flag.className = "mgr-pill mgr-pill--warn";
      flag.textContent = `PIT: ${tyreById(entry.pitRequest).name}`;
      tyreEl.appendChild(flag);
    }
    for (const btn of card.querySelectorAll("[data-mode]")) {
      btn.classList.toggle("mgr-mini--active", btn.dataset.mode === entry.mode);
    }
  }
}

let lastToast = 0;

function onRaceEvent(event) {
  // Στην πίστα δείχνουμε μόνο τα σημαντικά, για να μη γίνει θόρυβος.
  if (["pit", "dnf", "flag", "fastest", "order"].includes(event.kind)) {
    const toast = el("hud-toast");
    toast.textContent = event.text;
    toast.hidden = false;
    lastToast = performance.now();
    setTimeout(() => {
      if (performance.now() - lastToast >= 2200) toast.hidden = true;
    }, 2400);
  }
}

const lightEls = [];
function ensureLights() {
  if (lightEls.length) return;
  const wrap = el("hud-lights");
  for (let i = 0; i < 5; i++) {
    const light = document.createElement("div");
    light.className = "game-light";
    wrap.appendChild(light);
    lightEls.push(light);
  }
}

function renderRaceHud(hud) {
  ensureLights();
  el("hud-lap").textContent = `Γύρος ${hud.lap}/${hud.totalLaps}`;
  el("hud-race").textContent = hud.raceName;
  el("hud-focus-name").textContent = hud.focusName;
  el("hud-speed").textContent = String(Math.round(hud.focusSpeed));

  const countdown = hud.phase === "countdown";
  el("hud-center").hidden = !countdown;
  if (countdown) lightEls.forEach((light, i) => light.classList.toggle("game-light--on", i < hud.lights));

  renderTower(hud);
  updateWall();

  const events = el("race-events");
  events.innerHTML = "";
  if (!hud.events.length) events.appendChild(empty("Ησυχία στο ραδιόφωνο."));
  for (const event of hud.events) {
    const line = document.createElement("div");
    line.className = `mgr-event mgr-event--${event.kind}${event.isPlayer ? " mgr-event--mine" : ""}`;
    line.textContent = event.text;
    events.appendChild(line);
  }
}

function renderTower(hud) {
  const tower = el("timing-tower");
  tower.innerHTML = "";
  for (const row of hud.timing) {
    const line = document.createElement("div");
    line.className = `mgr-tower__row${row.isPlayer ? " mgr-tower__row--player" : ""}${row.isFocus ? " mgr-tower__row--focus" : ""}`;
    line.addEventListener("click", () => {
      race.setCamera(row.id);
    });

    const pos = document.createElement("span");
    pos.className = "mgr-tower__pos";
    pos.textContent = String(row.position);

    const chip = document.createElement("span");
    chip.className = "mgr-standing__chip";
    chip.style.background = row.color;

    const name = document.createElement("span");
    name.className = "mgr-tower__name";
    name.textContent = row.name;

    const tyre = document.createElement("span");
    tyre.className = "mgr-tower__tyre";
    tyre.style.background = tyreById(row.tyre).color;
    tyre.style.opacity = String(0.35 + row.tyreLife * 0.65);
    tyre.textContent = tyreById(row.tyre).short;

    const gap = document.createElement("span");
    gap.className = "mgr-tower__gap";
    if (row.dnf) gap.textContent = "DNF";
    else if (row.inPit) gap.textContent = "PIT";
    else if (row.position === 1) gap.textContent = "Ηγέτης";
    else if (row.lapsDown > 0) gap.textContent = `+${row.lapsDown} γ.`;
    else gap.textContent = formatGap(row.gapMs);

    line.append(pos, chip, name, tyre, gap);
    tower.appendChild(line);
  }
}

function onRaceFinish(results) {
  const income = applyRaceResult(state, results);
  save(state);
  renderTopbar();

  const mine = results.filter((r) => r.teamId === "player");
  el("results-title").textContent = `Αποτέλεσμα — ${state.history[state.history.length - 1]?.raceName ?? ""}`;
  el("results-sub").textContent = mine
    .map((r) => `${r.name}: ${r.dnf ? "εγκατάλειψη" : `P${r.position}`}`)
    .join(" · ");

  const table = el("results-table");
  table.innerHTML = "";
  for (const row of results) {
    const line = document.createElement("div");
    line.className = `mgr-standing${row.isPlayer ? " mgr-standing--player" : ""}`;
    const pos = document.createElement("span");
    pos.className = "mgr-standing__pos";
    pos.textContent = row.dnf ? "—" : String(row.position);
    const chip = document.createElement("span");
    chip.className = "mgr-standing__chip";
    chip.style.background = row.color;
    const name = document.createElement("span");
    name.className = "mgr-standing__name";
    name.textContent = `${row.name} · ${row.teamName}`;
    const info = document.createElement("strong");
    info.textContent = row.dnf ? row.dnfReason || "DNF" : formatTime(row.bestLap);
    line.append(pos, chip, name, info);
    table.appendChild(line);
  }

  const box = el("results-income");
  box.innerHTML = "";
  box.appendChild(row("Έπαθλα", money(income.prize)));
  box.appendChild(row("Χορηγοί", money(income.sponsors)));
  box.appendChild(row("Μισθοί", `-${money(income.salaries)}`));
  box.appendChild(row("Ταμείο", money(state.money)));

  show("screen-results");
}

/** Οθόνη τέλους σεζόν: τελική βαθμολογία, έπαθλο και τι αλλάζει για του χρόνου. */
function showSeasonEnd({ season, position, bonus, finalTeams, finalDrivers }) {
  renderTopbar();
  const champion = finalDrivers[0];
  el("results-title").textContent = `Τέλος σεζόν ${season} — P${position} στο πρωτάθλημα ομάδων`;
  el("results-sub").textContent =
    `Πρωταθλητής οδηγών: ${champion.name} (${champion.team}) · έπαθλο συμμετοχής ${money(bonus)}`;

  const table = el("results-table");
  table.innerHTML = "";
  finalTeams.forEach((team, i) => {
    table.appendChild(standingRow(i + 1, team.name, "", team.points, team.color, team.isPlayer));
  });

  const box = el("results-income");
  box.innerHTML = "";
  box.appendChild(row("Έπαθλο σεζόν", money(bonus)));
  box.appendChild(row("Ταμείο", money(state.money)));
  box.appendChild(
    row("Επόμενη σεζόν", "Οι αντίπαλοι ανέπτυξαν τα αυτοκίνητά τους — ανέβασε κι εσύ ρυθμό"),
  );

  show("screen-results");
}

// ---------------------------------------------------------------------------
// Δέσιμο κουμπιών
// ---------------------------------------------------------------------------

el("btn-resume").addEventListener("click", () => {
  state = load();
  if (!state) return;
  renderHQ();
  show("screen-hq");
});

el("btn-newcareer").addEventListener("click", () => {
  clearSave();
  el("resume-card").hidden = true;
  el("new-career").hidden = false;
});

el("btn-start-career").addEventListener("click", () => {
  const name = el("team-name").value.trim().slice(0, 26) || "Hellenic Racing";
  state = newCareer({
    teamName: name,
    color: draft.color,
    difficultyId: draft.difficulty,
    driverIds: draft.drivers,
    seed: draft.seed,
    // Η δεξαμενή που είδε ο παίκτης είναι και η δεξαμενή της καριέρας.
    pool: draft.pool,
  });
  save(state);
  renderHQ();
  show("screen-hq");
});

el("btn-quit").addEventListener("click", () => {
  if (race) {
    race.destroy();
    race = null;
  }
  clearSave();
  state = null;
  draft.drivers = [];
  draft.pool = [];
  draft.seed = Math.floor(Math.random() * 1e9);
  renderStart();
  show("screen-start");
});

for (const tab of document.querySelectorAll(".mgr-tab")) {
  tab.addEventListener("click", () => {
    for (const other of document.querySelectorAll(".mgr-tab")) {
      other.classList.toggle("mgr-tab--active", other === tab);
    }
    for (const pane of ["base", "dev", "drivers", "champ"]) {
      el(`pane-${pane}`).hidden = pane !== tab.dataset.tab;
    }
  });
}

el("btn-goto-race").addEventListener("click", gotoRaceWeekend);
el("btn-back-hq").addEventListener("click", () => show("screen-hq"));
el("btn-start-race").addEventListener("click", beginRace);
el("btn-pause-race").addEventListener("click", () => {
  race.setPaused(!race.paused);
  el("btn-pause-race").textContent = race.paused ? "Συνέχεια" : "Παύση";
});
el("btn-skip").addEventListener("click", () => race.skipToEnd());
el("btn-continue").addEventListener("click", () => {
  renderHQ();
  show("screen-hq");
});

// ---------------------------------------------------------------------------
// Εκκίνηση
// ---------------------------------------------------------------------------

renderStart();
show("screen-start");
