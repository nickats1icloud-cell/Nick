/* Αρχική σελίδα: hero feature, στατιστικά, πλέγμα επεισοδίων, κοινότητα. */

import { initPage, initReveal, initCounters } from "./ui.js";
import { SITE } from "./data/site.js";
import { EPISODES_SORTED, allTags, getEpisode } from "./data/episodes.js";
import { icon } from "./icons.js";
import { esc, durationLabel, dateLabel, timecode } from "./format.js";
import { artHtml, renderCards } from "./render.js";
import { Player, onPlayerChange } from "./player.js";
import { lastPlayed, progressPercent } from "./store.js";
import { toast } from "./toast.js";

initPage();

const latest = EPISODES_SORTED[0];

/* ---------- Hero: featured επεισόδιο ---------- */

function renderFeatured() {
  const host = document.querySelector("[data-featured]");
  if (!host || !latest) return;

  host.innerHTML = `
    <div class="row" style="justify-content:space-between">
      <span class="badge badge--live"><i class="dot-live"></i> Νέο επεισόδιο</span>
      <span class="badge">S${latest.season} · E${latest.number}</span>
    </div>
    <div class="row" style="gap:1rem;margin-top:1.25rem;flex-wrap:nowrap">
      ${artHtml(latest)}
      <div style="min-width:0">
        <h3 style="font-size:1.25rem">${esc(latest.title)}</h3>
        <p style="color:hsl(var(--muted-foreground));font-size:.88rem;margin-top:.4rem">
          ${esc(latest.excerpt)}
        </p>
      </div>
    </div>
    <div class="row" style="gap:.5rem;margin-top:1rem">
      ${latest.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}
    </div>
    <div class="wave" data-wave style="margin-top:1.25rem"></div>
    <div class="row" style="justify-content:space-between;margin-top:1rem" data-ep="${esc(latest.id)}">
      <div class="row" style="gap:.6rem">
        <button class="play-btn" data-play="${esc(latest.id)}" aria-label="Αναπαραγωγή: ${esc(latest.title)}">
          <span class="icon-play">${icon("play")}</span><span class="icon-pause">${icon("pause")}</span>
        </button>
        <div>
          <div style="font-weight:600;font-size:.9rem">Παίξε τώρα</div>
          <div style="font-family:var(--font-mono);font-size:.72rem;color:hsl(var(--muted-foreground))">
            ${durationLabel(latest.duration)} · ${dateLabel(latest.date)}
          </div>
        </div>
      </div>
      <a class="btn btn--sm" href="episode.html?id=${encodeURIComponent(latest.id)}">
        Λεπτομέρειες ${icon("arrowRight")}
      </a>
    </div>`;

  buildWave(host.querySelector("[data-wave]"), latest);
}

/**
 * Ψεύτικο waveform, αλλά ντετερμινιστικό ανά επεισόδιο (ίδιο id → ίδιο σχήμα)
 * ώστε να μη "χοροπηδάει" σε κάθε refresh. Δείχνει την πρόοδο ακρόασης.
 */
function buildWave(node, ep) {
  if (!node) return;
  const bars = 64;
  let seed = ep.number * 9301;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  node.innerHTML = Array.from({ length: bars }, (_, i) => {
    const shape = Math.sin((i / bars) * Math.PI); // πιο "γεμάτο" στη μέση
    const height = 18 + rand() * 70 * (0.55 + shape * 0.6);
    return `<i style="--h:${Math.min(100, height).toFixed(0)}%"></i>`;
  }).join("");
  node.setAttribute("role", "img");
  node.setAttribute("aria-label", `Ηχητικό γράφημα επεισοδίου ${ep.number}`);

  // Οι μπάρες βάφονται όσο προχωράει η αναπαραγωγή αυτού του επεισοδίου.
  const bars_ = [...node.children];
  onPlayerChange((snap) => {
    const active = snap.episode?.id === ep.id;
    node.classList.toggle("wave--playing", active && snap.playing);
    const ratio = active && snap.duration ? snap.time / snap.duration : 0;
    const played = Math.round(ratio * bars_.length);
    bars_.forEach((bar, index) => bar.classList.toggle("is-played", index < played));
  });
}

/* ---------- Στατιστικά ---------- */

function renderStats() {
  const host = document.querySelector("[data-stats]");
  if (!host) return;
  host.innerHTML = SITE.stats
    .map(
      (stat) => `<div>
        <div class="stat__num" data-count="${stat.value}" data-suffix="${esc(stat.suffix)}">0</div>
        <div class="stat__label">${esc(stat.label)}</div>
      </div>`
    )
    .join("");
  initCounters(host);
}

/* ---------- Ticker ---------- */

function renderTicker() {
  const host = document.querySelector("[data-ticker]");
  if (!host) return;
  const words = [
    "iRacing",
    "Assetto Corsa Competizione",
    "rFactor 2",
    "Le Mans Virtual",
    "Setup talk",
    "Direct drive",
    "Endurance",
    "Racecraft",
    "Telemetry",
    "GT3",
    "Ελληνικά πρωταθλήματα",
    "Rookie tips",
  ];
  // Διπλασιάζουμε τη λίστα ώστε το marquee να κυλάει χωρίς κενό.
  const html = [...words, ...words].map((w) => `<span>${esc(w)}</span>`).join("");
  host.innerHTML = html;
}

/* ---------- Συνέχισε την ακρόαση ---------- */

function renderContinue() {
  const section = document.querySelector("[data-continue]");
  const body = document.querySelector("[data-continue-body]");
  if (!section || !body) return;

  const last = lastPlayed();
  const ep = last && getEpisode(last.id);
  if (!ep) return;

  const percent = progressPercent(ep.id, ep.duration);
  if (percent < 2 || percent > 97) return;

  const remaining = Math.max(0, (ep.duration || 0) - last.time);
  section.hidden = false;
  body.innerHTML = `
    <div class="card" style="padding:1.25rem;display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap" data-ep="${esc(ep.id)}">
      ${artHtml(ep, "art--sm")}
      <div style="flex:1;min-width:200px">
        <div class="ep-card__meta">S${ep.season} · E${ep.number}</div>
        <h3 style="font-size:1.1rem;margin-top:.2rem">${esc(ep.title)}</h3>
        <div class="row" style="gap:.75rem;margin-top:.6rem">
          <div class="ep-progress" style="max-width:280px"><i style="--p:${percent}%"></i></div>
          <span class="ep-progress__label">απομένουν ${durationLabel(remaining)}</span>
        </div>
      </div>
      <button class="btn btn--primary" data-play="${esc(ep.id)}" data-seek="${Math.round(last.time)}">
        ${icon("play")} Συνέχεια από ${timecode(last.time)}
      </button>
    </div>`;
}

/* ---------- Πλέγμα επεισοδίων + φίλτρο tag ---------- */

function renderGrid() {
  const grid = document.querySelector("[data-home-grid]");
  const tagBar = document.querySelector("[data-home-tags]");
  if (!grid) return;

  let active = null;
  const tags = allTags().slice(0, 7);

  const paint = () => {
    const list = active
      ? EPISODES_SORTED.filter((ep) => ep.tags.includes(active))
      : EPISODES_SORTED;
    renderCards(grid, list.slice(0, 6));
    initReveal(grid);
  };

  if (tagBar) {
    tagBar.innerHTML =
      `<button class="chip" data-tag="" aria-pressed="true">Όλα</button>` +
      tags
        .map(
          ({ tag, count }) =>
            `<button class="chip" data-tag="${esc(tag)}" aria-pressed="false">${esc(tag)} <span style="opacity:.6">${count}</span></button>`
        )
        .join("");

    tagBar.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-tag]");
      if (!chip) return;
      active = chip.dataset.tag || null;
      tagBar
        .querySelectorAll("[data-tag]")
        .forEach((node) => node.setAttribute("aria-pressed", String(node === chip)));
      paint();
    });
  }

  paint();
}

/* ---------- Πλατφόρμες / hosts / quotes ---------- */

function renderPlatforms() {
  const host = document.querySelector("[data-platforms]");
  if (!host) return;
  host.innerHTML = SITE.platforms
    .map(
      (p) => `<a class="platform" href="${esc(p.url)}" style="--p-color:${esc(p.color)}" rel="noopener" data-reveal>
        ${icon(p.id)}
        <span><strong>${esc(p.name)}</strong><small>${esc(p.note)}</small></span>
      </a>`
    )
    .join("");
  initReveal(host);
}

function renderHosts() {
  const host = document.querySelector("[data-hosts]");
  if (!host) return;
  host.innerHTML = SITE.hosts
    .map(
      (person, index) => `<article class="card host" data-reveal style="--reveal-delay:${index * 80}ms">
        <div class="host__avatar" aria-hidden="true">${esc(person.initials)}</div>
        <h3>${esc(person.name)}</h3>
        <div class="host__role">${esc(person.role)}</div>
        <p class="host__bio">${esc(person.bio)}</p>
      </article>`
    )
    .join("");
  initReveal(host);
}

function renderQuotes() {
  const host = document.querySelector("[data-quotes]");
  if (!host) return;
  host.innerHTML = SITE.quotes
    .map(
      (quote, index) => `<figure class="card quote" data-reveal style="--reveal-delay:${index * 80}ms">
        <div class="quote__mark" aria-hidden="true">&bdquo;</div>
        <blockquote><p>${esc(quote.text)}</p></blockquote>
        <figcaption class="quote__who">
          <i aria-hidden="true">${esc(quote.initials)}</i>
          <span><strong>${esc(quote.name)}</strong><br />${esc(quote.role)}</span>
        </figcaption>
      </figure>`
    )
    .join("");
  initReveal(host);
}

/* ---------- Newsletter ---------- */

function wireNewsletter() {
  const form = document.querySelector("[data-newsletter]");
  const error = document.querySelector("[data-newsletter-error]");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.querySelector("input[type=email]");
    const value = input.value.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

    input.setAttribute("aria-invalid", String(!valid));
    error.textContent = valid ? "" : "Γράψε ένα σωστό email για να σου στέλνουμε το επεισόδιο.";
    if (!valid) {
      input.focus();
      return;
    }

    // Δεν υπάρχει backend ακόμα — δηλώνεται καθαρά αντί να προσποιηθούμε επιτυχία.
    toast("Η φόρμα δεν είναι ακόμα συνδεδεμένη με λίστα email.", "info");
    error.textContent =
      "Demo: το newsletter δεν έχει συνδεθεί ακόμα. Δες το README για τη σύνδεση.";
    input.value = "";
  });
}

/* ---------- Hero: κουμπί "άκου το τελευταίο" ---------- */

document.querySelector("[data-play-latest]")?.addEventListener("click", () => {
  Player.play(latest);
});

renderFeatured();
renderStats();
renderTicker();
renderContinue();
renderGrid();
renderPlatforms();
renderHosts();
renderQuotes();
wireNewsletter();
initReveal();
