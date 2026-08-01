/*
 * Command palette (Ctrl/Cmd + K).
 * Ψάχνει επεισόδια (τίτλος, περίληψη, tags, καλεσμένοι), σελίδες και
 * γρήγορες ενέργειες. Πλήρης πλοήγηση με πληκτρολόγιο.
 */

import { EPISODES_SORTED } from "./data/episodes.js";
import { NAV } from "./data/site.js";
import { icon } from "./icons.js";
import { esc, normalize, durationLabel } from "./format.js";
import { Player } from "./player.js";

let root = null;
let input = null;
let results = null;
let items = [];
let activeIndex = 0;
let lastFocused = null;

function actions() {
  return [
    {
      group: "Ενέργειες",
      label: "Παίξε το πιο πρόσφατο επεισόδιο",
      hint: EPISODES_SORTED[0]?.title || "",
      icon: "play",
      run: () => Player.play(EPISODES_SORTED[0]),
    },
    {
      group: "Ενέργειες",
      label: "Εναλλαγή θέματος (σκούρο / ανοιχτό)",
      hint: "Light & dark",
      icon: "moon",
      run: () => document.querySelector("[data-theme-toggle]")?.click(),
    },
    {
      group: "Ενέργειες",
      label: "Τα αγαπημένα μου",
      hint: "Αποθηκευμένα επεισόδια",
      icon: "heart",
      run: () => (location.href = "episodes.html?filter=favorites"),
    },
  ];
}

function pages() {
  return NAV.map((item) => ({
    group: "Σελίδες",
    label: item.label,
    hint: item.href,
    icon: "arrowRight",
    run: () => (location.href = item.href),
  }));
}

function episodeEntries() {
  return EPISODES_SORTED.map((ep) => ({
    group: "Επεισόδια",
    label: `#${ep.number} · ${ep.title}`,
    hint: `${durationLabel(ep.duration)} · ${ep.tags.join(", ")}`,
    icon: "headphones",
    haystack: normalize(
      [ep.title, ep.excerpt, ep.tags.join(" "), ep.guests.map((g) => g.name).join(" ")].join(" ")
    ),
    run: () => (location.href = `episode.html?id=${encodeURIComponent(ep.id)}`),
  }));
}

function search(query) {
  const q = normalize(query.trim());
  const all = [...episodeEntries(), ...pages(), ...actions()];
  if (!q) return all.filter((entry) => entry.group !== "Σελίδες").slice(0, 8);

  return all
    .map((entry) => {
      const haystack = entry.haystack || normalize(`${entry.label} ${entry.hint}`);
      const index = haystack.indexOf(q);
      return index === -1 ? null : { ...entry, score: index };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, 20);
}

function renderResults(query) {
  items = search(query);
  activeIndex = 0;

  if (!items.length) {
    results.innerHTML = `<div class="palette__empty">Δεν βρέθηκε τίποτα για «${esc(query)}».<br>Δοκίμασε «setup», «endurance» ή «iRacing».</div>`;
    return;
  }

  let html = "";
  let group = null;
  items.forEach((entry, index) => {
    if (entry.group !== group) {
      group = entry.group;
      html += `<div class="palette__group">${esc(group)}</div>`;
    }
    html += `<button class="palette__item${index === 0 ? " is-active" : ""}" data-index="${index}" role="option">
      <span style="display:grid;place-items:center;width:20px;color:hsl(var(--muted-foreground))">${icon(entry.icon)}</span>
      <span style="min-width:0">
        <strong>${esc(entry.label)}</strong>
        <span>${esc(entry.hint)}</span>
      </span>
    </button>`;
  });
  results.innerHTML = html;
}

function setActive(index) {
  const nodes = results.querySelectorAll(".palette__item");
  if (!nodes.length) return;
  activeIndex = (index + nodes.length) % nodes.length;
  nodes.forEach((node, i) => node.classList.toggle("is-active", i === activeIndex));
  nodes[activeIndex].scrollIntoView({ block: "nearest" });
}

function runActive() {
  const entry = items[activeIndex];
  if (!entry) return;
  closePalette();
  entry.run();
}

export function openPalette() {
  if (!root) return;
  lastFocused = document.activeElement;
  root.classList.add("is-open");
  document.body.style.overflow = "hidden";
  input.value = "";
  renderResults("");
  input.focus();
}

export function closePalette() {
  if (!root) return;
  root.classList.remove("is-open");
  document.body.style.overflow = "";
  if (lastFocused instanceof HTMLElement) lastFocused.focus();
}

export function initPalette() {
  if (root) return;

  root = document.createElement("div");
  root.className = "palette";
  root.innerHTML = `
    <div class="palette__scrim" data-close></div>
    <div class="palette__panel" role="dialog" aria-modal="true" aria-label="Αναζήτηση">
      <div class="palette__field">
        ${icon("search")}
        <input type="search" placeholder="Ψάξε επεισόδιο, θέμα ή καλεσμένο…" aria-label="Αναζήτηση" autocomplete="off">
        <button class="icon-btn" data-close aria-label="Κλείσιμο">${icon("close")}</button>
      </div>
      <div class="palette__results" role="listbox"></div>
      <div class="palette__foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> πλοήγηση</span>
        <span><kbd>Enter</kbd> άνοιγμα</span>
        <span><kbd>Esc</kbd> κλείσιμο</span>
      </div>
    </div>`;
  document.body.appendChild(root);

  input = root.querySelector("input");
  results = root.querySelector(".palette__results");

  input.addEventListener("input", () => renderResults(input.value));

  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) {
      closePalette();
      return;
    }
    const item = event.target.closest(".palette__item");
    if (item) {
      activeIndex = Number(item.dataset.index);
      runActive();
    }
  });

  root.addEventListener("keydown", (event) => {
    const keys = {
      ArrowDown: () => setActive(activeIndex + 1),
      ArrowUp: () => setActive(activeIndex - 1),
      Enter: () => runActive(),
      Escape: () => closePalette(),
    };
    if (keys[event.key]) {
      event.preventDefault();
      keys[event.key]();
    }
  });

  window.addEventListener("keydown", (event) => {
    const combo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
    const slash =
      event.key === "/" &&
      !(event.target instanceof HTMLElement &&
        (event.target.matches("input, textarea") || event.target.isContentEditable));
    if (combo || slash) {
      event.preventDefault();
      root.classList.contains("is-open") ? closePalette() : openPalette();
    }
  });
}
