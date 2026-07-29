/**
 * Games Hub — F1 Reaction Time Challenge.
 *
 * Ροή παιχνιδιού: idle → countdown (τα 5 φώτα ανάβουν διαδοχικά) → waiting
 * (τυχαία καθυστέρηση 1–4s) → go (σβήνουν) → κλικ. Κλικ πριν το «go» = false
 * start. Το σκορ αποθηκεύεται στο `reaction_scores` αν ο χρήστης είναι μέλος.
 */

import { mountShell } from "../shell.js";
import { session, authReady } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import { $, $$, esc, render, avatar, nameOf, empty, toastOk } from "../ui.js";

await mountShell("games");
await authReady();

/* ----------------------------------------------------------------- tabs ---- */

$$(".hub-tabs__btn").forEach((button) =>
  button.addEventListener("click", () => {
    $$(".hub-tabs__btn").forEach((node) => node.classList.toggle("is-active", node === button));
    $("#tab-reaction").hidden = button.dataset.tab !== "reaction";
    $("#tab-fantasy").hidden = button.dataset.tab !== "fantasy";
  }),
);

/* ------------------------------------------------------------------ ήχος ---- */

let soundOn = false;
let audio = null;

const ctx = () => {
  if (!audio || audio.state === "closed") audio = new AudioContext();
  return audio;
};

function beep(frequency = 800, duration = 0.09, type = "square") {
  if (!soundOn) return;
  try {
    const context = ctx();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(gain).connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + duration);
  } catch {
    /* ο browser μπορεί να μπλοκάρει τον ήχο πριν από interaction */
  }
}

$("#game-sound").addEventListener("click", (ev) => {
  soundOn = !soundOn;
  ev.currentTarget.textContent = soundOn ? "🔊 Ήχος" : "🔇 Ήχος";
  ev.currentTarget.setAttribute("aria-pressed", String(soundOn));
  if (soundOn) beep(600, 0.06);
});

/* ---------------------------------------------------------------- παιχνίδι ---- */

const board = $("#game-board");
const pods = $$("#game-lights .lights__pod");
const msg = $("#game-msg");
const result = $("#game-result");
const startButton = $("#game-start");

let phase = "idle";
let goTime = 0;
let timers = [];

const clearTimers = () => {
  timers.forEach(clearTimeout);
  timers = [];
};

const setLights = (count) => pods.forEach((pod, index) => pod.classList.toggle("on", index < count));

function reset() {
  clearTimers();
  phase = "idle";
  setLights(0);
  board.classList.remove("is-go", "is-early");
  msg.textContent = "Έτοιμος;";
  result.textContent = "";
  startButton.textContent = "Έναρξη";
  startButton.disabled = false;
}

function start() {
  clearTimers();
  phase = "countdown";
  board.classList.remove("is-go", "is-early");
  result.textContent = "";
  msg.textContent = "Περίμενε τα φώτα…";
  startButton.disabled = true;
  setLights(0);

  pods.forEach((_, index) => {
    timers.push(
      setTimeout(() => {
        setLights(index + 1);
        beep(760, 0.07);
      }, 700 + index * 900),
    );
  });

  // Μετά και τα 5 φώτα, τυχαία καθυστέρηση 1–4 δευτερολέπτων.
  timers.push(
    setTimeout(() => {
      phase = "waiting";
      timers.push(
        setTimeout(() => {
          phase = "go";
          goTime = performance.now();
          setLights(0);
          board.classList.add("is-go");
          msg.textContent = "GO!";
          beep(1250, 0.16, "sine");
        }, 1000 + Math.random() * 3000),
      );
    }, 700 + pods.length * 900),
  );
}

async function press() {
  if (phase === "idle" || phase === "result" || phase === "too-early") {
    start();
    return;
  }

  if (phase === "countdown" || phase === "waiting") {
    clearTimers();
    phase = "too-early";
    board.classList.add("is-early");
    setLights(0);
    msg.textContent = "False Start! 🚫";
    result.textContent = "";
    startButton.disabled = false;
    startButton.textContent = "Ξανά";
    beep(180, 0.3, "sawtooth");
    return;
  }

  if (phase === "go") {
    const ms = Math.round(performance.now() - goTime);
    phase = "result";
    board.classList.remove("is-go");
    msg.textContent = grade(ms);
    result.textContent = `${ms} ms`;
    result.style.color = color(ms);
    startButton.disabled = false;
    startButton.textContent = "Ξανά";

    if (session.user) {
      const { error } = await db.from("reaction_scores").insert({ user_id: session.user.id, reaction_time: ms });
      if (!error) {
        toastOk("Το σκορ αποθηκεύτηκε", `${ms} ms`);
        loadBoard();
      }
    } else {
      msg.innerHTML = `${grade(ms)} — <a href="auth.html">συνδέσου</a> για να αποθηκευτεί`;
    }
  }
}

const grade = (ms) =>
  ms < 180 ? "Απίστευτο! 🏆" : ms < 230 ? "Επίπεδο F1 🔥" : ms < 300 ? "Πολύ καλά 👏" : ms < 400 ? "Καλά 🙂" : "Θέλει δουλειά 🐢";

const color = (ms) =>
  ms < 220 ? "hsl(var(--ok))" : ms < 320 ? "hsl(var(--accent))" : "hsl(var(--brand))";

board.addEventListener("click", press);
board.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" || ev.key === " ") {
    ev.preventDefault();
    press();
  }
});
startButton.addEventListener("click", (ev) => {
  ev.stopPropagation();
  start();
});

reset();

/* ------------------------------------------------------------ leaderboard ---- */

async function loadBoard() {
  render("#game-board-list", '<div class="hub-loading"><div class="hub-spinner"></div></div>');

  const rows = (await safe(db.from("reaction_scores").select("id, user_id, reaction_time").order("reaction_time").limit(60), [])) || [];

  // Καλύτερο σκορ ανά χρήστη, top 10.
  const best = new Map();
  rows.forEach((row) => {
    const current = best.get(row.user_id);
    if (!current || row.reaction_time < current.reaction_time) best.set(row.user_id, row);
  });
  const top = Array.from(best.values()).sort((a, b) => a.reaction_time - b.reaction_time).slice(0, 10);

  if (!top.length) {
    render("#game-board-list", empty("Κανένα σκορ ακόμα. Γίνε ο πρώτος!", "⚡"));
    return;
  }

  const profiles =
    (await safe(db.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", top.map((row) => row.user_id)), [])) || [];
  const map = new Map(profiles.map((row) => [row.user_id, row]));

  render(
    "#game-board-list",
    `<div class="u-stack" style="--gap:6px">${top
      .map(
        (row, index) => `<div class="u-row" style="gap:10px;padding:6px 4px">
          <span class="hub-pos ${index < 3 ? `hub-pos--${index + 1}` : ""}">${index + 1}</span>
          ${avatar(map.get(row.user_id), "xs")}
          <span class="u-small u-truncate" style="flex:1">${esc(nameOf(map.get(row.user_id), "Anonymous"))}</span>
          <span class="u-mono u-small" style="color:${color(row.reaction_time)};font-weight:600">${row.reaction_time}ms</span>
        </div>`,
      )
      .join("")}</div>`,
  );

  // Προσωπικό ρεκόρ
  if (session.user) {
    const mine = rows.filter((row) => row.user_id === session.user.id);
    const node = $("#game-best");
    if (mine.length) {
      const record = Math.min(...mine.map((row) => row.reaction_time));
      node.style.display = "";
      node.innerHTML = `<div class="u-between"><span class="u-small">Το ρεκόρ σου</span><span class="u-mono" style="color:${color(record)};font-weight:700">${record} ms</span></div>`;
    }
  }
}

loadBoard();
