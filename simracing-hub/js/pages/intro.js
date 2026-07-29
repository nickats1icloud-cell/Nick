/**
 * Intro / splash. Παίζει μία φορά ανά session (sessionStorage), όπως και το
 * αρχικό React Intro — μετά πηγαίνει κατευθείαν στο home.
 */

import { speedBars, typewriter } from "../fx.js";
import { $ } from "../ui.js";
import { applyTheme, currentTheme } from "../shell.js";

const SEEN = "hub_intro_seen";

applyTheme(currentTheme());

if (sessionStorage.getItem(SEEN)) {
  location.replace("home.html");
} else {
  speedBars($("#intro-canvas"));

  const enter = () => {
    sessionStorage.setItem(SEEN, "1");
    location.href = "home.html";
  };

  $("#intro-skip").addEventListener("click", enter);
  $("#intro-enter").addEventListener("click", (ev) => {
    ev.preventDefault();
    enter();
  });

  typewriter($("#intro-kicker"), "Racing is our Passion", { speed: 55, delay: 700 });
  typewriter($("#intro-sub"), "Greek SimRacers Hub", { speed: 78, delay: 2000 });

  // Μπάρα προόδου: 0 → 100% σε 2.6s, μετά εμφανίζεται το CTA.
  const fill = $("#intro-fill");
  const pct = $("#intro-pct");
  const phase = $("#intro-phase");
  const cta = $("#intro-cta");

  const DURATION = 2600;
  const started = performance.now();

  const tick = () => {
    const value = Math.min(((performance.now() - started) / DURATION) * 100, 100);
    fill.style.width = `${value}%`;
    pct.textContent = `${Math.floor(value)}%`;
    phase.textContent = value < 30 ? "Initializing" : value < 70 ? "Loading Systems" : "Ready";
    if (value < 100) requestAnimationFrame(tick);
    else cta.classList.add("is-shown");
  };
  requestAnimationFrame(tick);

  // Enter/Space μπαίνει κατευθείαν.
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") enter();
  });
}
