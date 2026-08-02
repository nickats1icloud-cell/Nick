/**
 * Η σελίδα του παιχνιδιού: δένει το μενού, το HUD και τους πίνακες χρόνων
 * με τη μηχανή (engine.js). Ό,τι αφορά προσομοίωση ζει στα υπόλοιπα modules.
 */

import { TRACKS, trackById } from "./tracks.js";
import { CARS, carById } from "./car.js";
import { DIFFICULTIES } from "./ai.js";
import { Game, MODES } from "./engine.js";
import {
  formatTime,
  formatDelta,
  localTimes,
  localBest,
  saveLocal,
  savedDriverName,
  rememberDriverName,
  fetchRemote,
  submitRemote,
} from "./leaderboard.js";

const el = (id) => document.getElementById(id);

// ===== Ρυθμίσεις συνεδρίας =====
const settings = {
  trackId: TRACKS[0].id,
  carId: CARS[0].id,
  mode: "timeattack",
  difficulty: "pro",
  driverName: savedDriverName(),
};

el("driver-name").value = settings.driverName;

// Αν ο επισκέπτης είναι συνδεδεμένος και δεν έχει δικό του όνομα οδηγού,
// προσυμπληρώνουμε το display_name του προφίλ του.
async function prefillDriverName() {
  if (el("driver-name").value || typeof window.supabaseClient === "undefined") return;
  try {
    const { data } = await window.supabaseClient.auth.getUser();
    const user = data?.user;
    if (!user) return;
    const { data: profile } = await window.supabaseClient
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const name = profile?.display_name || (user.email ? user.email.split("@")[0] : "");
    if (name) {
      el("driver-name").value = name.slice(0, 24);
      settings.driverName = el("driver-name").value;
    }
  } catch {
    // Χωρίς σύνδεση/προφίλ απλώς μένει κενό — ο παίκτης το γράφει μόνος του.
  }
}

// ===== Μενού επιλογών =====
function renderChoices(container, items, currentId, onPick) {
  container.innerHTML = "";
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `game-choice${item.id === currentId ? " game-choice--active" : ""}`;
    const strong = document.createElement("strong");
    strong.textContent = item.title;
    const small = document.createElement("small");
    small.textContent = item.subtitle;
    btn.append(strong, small);
    btn.addEventListener("click", () => onPick(item.id));
    container.appendChild(btn);
  }
}

function renderMenu() {
  renderChoices(
    el("choice-track"),
    TRACKS.map((t) => ({
      id: t.id,
      title: `${t.emoji} ${t.name}`,
      subtitle: `${t.difficulty} · ${t.subtitle}`,
    })),
    settings.trackId,
    (id) => {
      settings.trackId = id;
      renderMenu();
      refreshBoards();
    },
  );

  renderChoices(
    el("choice-car"),
    CARS.map((c) => ({ id: c.id, title: c.name, subtitle: c.blurb })),
    settings.carId,
    (id) => {
      settings.carId = id;
      renderMenu();
    },
  );

  renderChoices(
    el("choice-mode"),
    [
      {
        id: "timeattack",
        title: "Time Attack",
        subtitle: "Μόνος με το ρολόι, με ghost του καλύτερου γύρου",
      },
      {
        id: "race",
        title: "Αγώνας",
        subtitle: `${MODES.race.aiCount} αντίπαλοι, ${trackById(settings.trackId).raceLaps} γύροι`,
      },
    ],
    settings.mode,
    (id) => {
      settings.mode = id;
      el("difficulty-block").hidden = id !== "race";
      renderMenu();
    },
  );

  renderChoices(
    el("choice-difficulty"),
    DIFFICULTIES.map((d) => ({
      id: d.id,
      title: d.label,
      subtitle: `Ρυθμός ${Math.round(d.pace * 100)}%`,
    })),
    settings.difficulty,
    (id) => {
      settings.difficulty = id;
      renderMenu();
    },
  );
}

// ===== Πίνακες χρόνων =====
function boardRows(container, rows, emptyText) {
  container.innerHTML = "";
  if (!rows.length) {
    const p = document.createElement("p");
    p.className = "game-empty";
    p.textContent = emptyText;
    container.appendChild(p);
    return;
  }
  rows.forEach((row, i) => {
    const line = document.createElement("div");
    line.className = "game-board__row";
    const pos = document.createElement("span");
    pos.className = "game-board__pos";
    pos.textContent = `${i + 1}.`;
    const name = document.createElement("span");
    name.textContent = row.name;
    const time = document.createElement("span");
    time.className = "game-board__time";
    time.textContent = formatTime(row.lapMs);
    line.append(pos, name, time);
    container.appendChild(line);
  });
}

async function refreshBoards() {
  const track = trackById(settings.trackId);
  el("board-track-local").textContent = track.name;
  el("board-track-remote").textContent = track.name;

  boardRows(
    el("board-local"),
    localTimes(track.id)
      .slice(0, 5)
      .map((t) => ({ name: `${t.driverName || "Οδηγός"} · ${carById(t.carId).name}`, lapMs: t.lapMs })),
    "Δεν έχεις κάνει ακόμα έγκυρο γύρο εδώ.",
  );

  const remote = await fetchRemote(track.id, 8);
  if (!remote.available) {
    boardRows(el("board-remote"), [], "Ο κοινός πίνακας δεν είναι διαθέσιμος αυτή τη στιγμή.");
    return;
  }
  boardRows(
    el("board-remote"),
    remote.rows.map((r) => ({
      name: `${r.driver_name} · ${carById(r.car_id).name}`,
      lapMs: r.lap_ms,
    })),
    "Κανένας χρόνος ακόμα — γίνε ο πρώτος!",
  );
}

// ===== HUD =====
const hud = {
  root: el("hud"),
  current: el("hud-current"),
  best: el("hud-best"),
  last: el("hud-last"),
  delta: el("hud-delta"),
  lap: el("hud-lap"),
  position: el("hud-position"),
  speed: el("hud-speed"),
  gear: el("hud-gear"),
  rpm: el("hud-rpm"),
  center: el("hud-center"),
  lights: el("hud-lights"),
  flash: el("hud-flash"),
  toast: el("hud-toast"),
};

// Τα 5 φώτα εκκίνησης φτιάχνονται μία φορά.
for (let i = 0; i < 5; i++) {
  const light = document.createElement("div");
  light.className = "game-light";
  hud.lights.appendChild(light);
}
const lightEls = Array.from(hud.lights.children);

let toastTimer = 0;
function flashMessage(text, variant = "") {
  hud.toast.textContent = text;
  hud.toast.className = `game-toastline${variant ? ` game-toastline--${variant}` : ""}`;
  hud.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    hud.toast.hidden = true;
  }, 2600);
}

function updateHud(state) {
  hud.current.textContent = formatTime(state.lapMs);
  hud.current.style.color = state.valid ? "" : "#f87171";
  hud.best.textContent = formatTime(state.bestLap);
  hud.last.textContent = formatTime(state.lastLap);
  hud.delta.textContent = state.delta === null ? "—" : formatDelta(state.delta);
  hud.delta.className = state.delta === null ? "" : state.delta < 0 ? "game-delta--up" : "game-delta--down";

  hud.lap.textContent =
    state.totalLaps === Infinity ? `Γύρος ${state.lap}` : `Γύρος ${state.lap}/${state.totalLaps}`;
  hud.position.hidden = state.position === null;
  if (state.position !== null) hud.position.textContent = `P${state.position}/${state.fieldSize}`;

  hud.speed.textContent = String(Math.round(state.speed));
  hud.gear.textContent = String(state.gear);
  hud.rpm.style.width = `${Math.round(state.rpm * 100)}%`;

  const showCenter = state.phase === "countdown";
  hud.center.hidden = !showCenter;
  if (showCenter) {
    lightEls.forEach((light, i) => light.classList.toggle("game-light--on", i < state.lights));
    hud.flash.textContent = "";
  }
}

// ===== Παιχνίδι =====
const game = new Game({
  canvas: el("game-canvas"),
  minimap: el("minimap"),
  onHud: updateHud,
  onEvent: handleEvent,
});

// Βοηθητικό για debugging από την κονσόλα (π.χ. gsrGame.track, gsrGame.entries).
window.gsrGame = game;

["left", "right", "throttle", "brake"].forEach((action) => {
  game.input.bindButton(el(`pad-${action}`), action);
});

function handleEvent(event) {
  switch (event.type) {
    case "go":
      flashMessage("GO!", "good");
      break;
    case "invalid":
      flashMessage("ΑΚΥΡΟΣ ΓΥΡΟΣ — εκτός πίστας", "warn");
      break;
    case "respawn":
      flashMessage("Επαναφορά στην πίστα", "warn");
      break;
    case "assist-line":
      flashMessage(event.on ? "Γραμμή οδήγησης: ON" : "Γραμμή οδήγησης: OFF");
      break;
    case "sector":
      flashMessage(`S${event.index} ${formatTime(event.split)}`);
      break;
    case "lap":
      handleLap(event);
      break;
    case "pause":
      el("pause").hidden = !event.paused;
      break;
    case "finish":
      showResults(event.results);
      break;
  }
}

function handleLap(event) {
  if (!event.valid) {
    flashMessage(`Γύρος ${event.lap}: άκυρος`, "warn");
    return;
  }
  if (event.isBest) {
    flashMessage(`Νέος καλύτερος γύρος! ${formatTime(event.lapMs)}`, "good");
    recordTime(event.lapMs);
  } else {
    flashMessage(`Γύρος ${event.lap}: ${formatTime(event.lapMs)}`);
  }
}

// Η προτροπή για σύνδεση εμφανίζεται μία φορά ανά επίσκεψη, όχι σε κάθε γύρο.
let warnedAboutSubmit = false;

/** Αποθηκεύει τοπικά τον χρόνο και τον ανεβάζει στον κοινό πίνακα αν γίνεται. */
async function recordTime(lapMs) {
  const entry = {
    trackId: settings.trackId,
    carId: settings.carId,
    driverName: settings.driverName || "Ανώνυμος",
    lapMs,
  };
  saveLocal(entry);
  refreshBoards();

  const result = await submitRemote(entry);
  if (result.ok) {
    refreshBoards();
  } else if (result.reason === "not-signed-in" && !warnedAboutSubmit) {
    warnedAboutSubmit = true;
    flashMessage("Συνδέσου για να μπει ο χρόνος στον πίνακα της κοινότητας");
  }
}

function showResults(results) {
  const track = trackById(results.trackId);
  el("results-title").textContent =
    results.mode === "race" ? `Τερματισμός — P${results.position}` : "Τέλος συνεδρίας";
  el("results-lead").textContent =
    `${track.name} · ${carById(results.carId).name} · καλύτερος γύρος ${formatTime(results.bestLap)}`;

  const body = el("results-body");
  body.innerHTML = "";

  if (results.mode === "race") {
    const table = document.createElement("table");
    table.className = "game-results";
    table.innerHTML =
      "<thead><tr><th>#</th><th>Οδηγός</th><th>Γύροι</th><th>Καλύτερος γύρος</th></tr></thead>";
    const tbody = document.createElement("tbody");
    for (const row of results.rows) {
      const tr = document.createElement("tr");
      tr.dataset.player = String(row.isPlayer);
      const cells = [
        String(row.position),
        row.name,
        String(row.laps),
        row.bestLap ? formatTime(row.bestLap) : "—",
      ];
      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    body.appendChild(table);
  }

  const best = localBest(results.trackId);
  if (best) {
    const p = document.createElement("p");
    p.className = "game-empty";
    p.textContent = `Ρεκόρ πίστας (σε αυτή τη συσκευή): ${formatTime(best.lapMs)} — ${best.driverName}`;
    body.appendChild(p);
  }

  el("results").hidden = false;
}

// ===== Κουμπιά =====
function startGame() {
  settings.driverName = el("driver-name").value.trim().slice(0, 24);
  if (settings.driverName) rememberDriverName(settings.driverName);

  el("menu").hidden = true;
  el("results").hidden = true;
  el("pause").hidden = true;
  hud.root.hidden = false;
  game.locked = false;

  game.start({
    trackId: settings.trackId,
    carId: settings.carId,
    mode: settings.mode,
    difficulty: settings.difficulty,
    driverName: settings.driverName || "Εσύ",
    keepGhost: false,
  });
}

function openMenu() {
  game.locked = true;
  game.setPaused(true);
  el("pause").hidden = true;
  el("results").hidden = true;
  el("menu").hidden = false;
  renderMenu();
  refreshBoards();
}

el("btn-start").addEventListener("click", startGame);
el("btn-resume").addEventListener("click", () => game.setPaused(false));
el("btn-restart-pause").addEventListener("click", () => {
  el("pause").hidden = true;
  game.restart();
});
// Στο Time Attack δεν υπάρχει καρέ τερματισμού — το κλείνει ο ίδιος ο παίκτης.
el("btn-finish-pause").addEventListener("click", () => {
  el("pause").hidden = true;
  game.setPaused(false);
  game.finishRace();
});
el("btn-menu-pause").addEventListener("click", openMenu);
el("btn-menu-results").addEventListener("click", openMenu);
el("btn-again").addEventListener("click", () => {
  el("results").hidden = true;
  game.restart();
});

window.addEventListener("beforeunload", () => game.destroy());

renderMenu();
refreshBoards();
prefillDriverName();
