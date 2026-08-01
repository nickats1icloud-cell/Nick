/*
 * Rendering επεισοδίων (κάρτες + compact γραμμές) και το delegated wiring
 * των κουμπιών play / αγαπημένα / λίστα. Ένας listener στο document αρκεί
 * για όλες τις κάρτες, ακόμα και για όσες μπαίνουν δυναμικά μετά.
 */

import { icon } from "./icons.js";
import { esc, durationLabel, dateLabel, compactNumber } from "./format.js";
import { Player, onPlayerChange } from "./player.js";
import { isFavorite, toggleFavorite, toggleQueue, progressPercent } from "./store.js";
import { toast } from "./toast.js";

/** Το τετράγωνο "εξώφυλλο" του επεισοδίου — καθαρό CSS, χωρίς εικόνες. */
export function artHtml(ep, modifier = "") {
  return `<div class="art ${modifier}" style="--art-h:${Number(ep.hue) || 243}" aria-hidden="true">
    <span class="art__num">#${ep.number}</span>
  </div>`;
}

function playButton(ep, size = "") {
  return `<button class="play-btn ${size}" data-play="${esc(ep.id)}"
    aria-label="Αναπαραγωγή: ${esc(ep.title)}">
    <span class="icon-play">${icon("play")}</span><span class="icon-pause">${icon("pause")}</span>
  </button>`;
}

function favButton(ep) {
  const active = isFavorite(ep.id);
  return `<button class="icon-btn fav-btn" data-fav="${esc(ep.id)}"
    aria-pressed="${active}" aria-label="Αποθήκευση στα αγαπημένα">${icon("heart")}</button>`;
}

function tagsHtml(ep) {
  return ep.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("");
}

function progressHtml(ep) {
  const percent = progressPercent(ep.id, ep.duration);
  const label = percent > 0 && percent < 98 ? `${percent}% ακουσμένο` : durationLabel(ep.duration);
  return `<div class="ep-progress" role="img" aria-label="${esc(label)}">
      <i style="--p:${percent}%"></i>
    </div>
    <span class="ep-progress__label">${esc(label)}</span>`;
}

/** Πλήρης κάρτα επεισοδίου (grid). */
export function episodeCard(ep, { delay = 0 } = {}) {
  const isNew = (Date.now() - new Date(ep.date).getTime()) / 86400000 < 10;
  return `<article class="ep-card" data-ep="${esc(ep.id)}" data-reveal style="--reveal-delay:${delay}ms">
    <div class="ep-card__top">
      ${artHtml(ep)}
      <div style="min-width:0">
        <div class="ep-card__meta">
          <span>S${ep.season} · E${ep.number}</span>
          <span aria-hidden="true">·</span>
          <time datetime="${esc(ep.date)}">${dateLabel(ep.date)}</time>
          ${isNew ? '<span class="badge badge--new">Νέο</span>' : ""}
          <span class="eq" data-eq hidden aria-hidden="true"><i></i><i></i><i></i></span>
        </div>
        <h3 class="ep-card__title">
          <a href="episode.html?id=${encodeURIComponent(ep.id)}">${esc(ep.title)}</a>
        </h3>
      </div>
    </div>
    <p class="ep-card__excerpt">${esc(ep.excerpt)}</p>
    <div class="ep-card__tags">${tagsHtml(ep)}</div>
    <div class="ep-card__foot">
      ${playButton(ep)}
      ${progressHtml(ep)}
      ${favButton(ep)}
    </div>
  </article>`;
}

/** Compact γραμμή (λίστες, "σχετικά επεισόδια"). */
export function episodeRow(ep) {
  return `<article class="ep-row" data-ep="${esc(ep.id)}">
    ${artHtml(ep, "art--sm")}
    <div style="min-width:0">
      <div class="ep-card__meta">
        <span>E${ep.number}</span>
        <span aria-hidden="true">·</span>
        <span>${durationLabel(ep.duration)}</span>
        <span class="eq" data-eq hidden aria-hidden="true"><i></i><i></i><i></i></span>
      </div>
      <div class="ep-row__title">
        <a href="episode.html?id=${encodeURIComponent(ep.id)}">${esc(ep.title)}</a>
      </div>
    </div>
    <div class="row ep-row__actions" style="gap:.35rem">
      ${playButton(ep)}
      ${favButton(ep)}
    </div>
  </article>`;
}

/** Στατιστικά επεισοδίου για hero/σελίδα επεισοδίου. */
export function episodeMetaHtml(ep) {
  return `<div class="row" style="gap:1rem;color:hsl(var(--muted-foreground));font-size:.85rem">
    <span class="row" style="gap:.35rem">${icon("calendar")}${dateLabel(ep.date)}</span>
    <span class="row" style="gap:.35rem">${icon("clock")}${durationLabel(ep.duration)}</span>
    <span class="row" style="gap:.35rem">${icon("headphones")}${compactNumber(ep.plays)}</span>
  </div>`;
}

/* ---------------- delegated events ---------------- */

let wired = false;

export function wireEpisodeActions() {
  if (wired) return;
  wired = true;

  document.addEventListener("click", (event) => {
    const playBtn = event.target.closest("[data-play]");
    if (playBtn) {
      event.preventDefault();
      const seek = playBtn.dataset.seek ? Number(playBtn.dataset.seek) : null;
      Player.play(playBtn.dataset.play, { seek });
      return;
    }

    const favBtn = event.target.closest("[data-fav]");
    if (favBtn) {
      event.preventDefault();
      const active = toggleFavorite(favBtn.dataset.fav);
      // Κάθε κουμπί του ίδιου επεισοδίου (κάρτα + sidebar) ενημερώνεται μαζί.
      document
        .querySelectorAll(`[data-fav="${CSS.escape(favBtn.dataset.fav)}"]`)
        .forEach((node) => node.setAttribute("aria-pressed", String(active)));
      toast(active ? "Προστέθηκε στα αγαπημένα" : "Αφαιρέθηκε από τα αγαπημένα", "ok");
      return;
    }

    const queueBtn = event.target.closest("[data-queue]");
    if (queueBtn) {
      event.preventDefault();
      const active = toggleQueue(queueBtn.dataset.queue);
      queueBtn.setAttribute("aria-pressed", String(active));
      toast(active ? "Μπήκε στη λίστα «για αργότερα»" : "Βγήκε από τη λίστα", "ok");
    }
  });

  // Ζωντανή ενημέρωση όλων των καρτών όταν αλλάζει ο player.
  onPlayerChange((snap) => {
    document.querySelectorAll("[data-ep]").forEach((card) => {
      const id = card.dataset.ep;
      const current = snap.episode?.id === id;
      const playing = current && snap.playing;

      card.classList.toggle("is-current", current);
      card.querySelector("[data-play]")?.setAttribute("data-playing", String(playing));
      const eq = card.querySelector("[data-eq]");
      if (eq) eq.hidden = !playing;

      // Η μπάρα προόδου του τρέχοντος επεισοδίου κινείται σε πραγματικό χρόνο.
      if (current && snap.duration) {
        const bar = card.querySelector(".ep-progress > i");
        if (bar) bar.style.setProperty("--p", `${(snap.time / snap.duration) * 100}%`);
      }
    });
  });
}

/** Βοηθητικό για τις σελίδες: γεμίζει container με κάρτες. */
export function renderCards(container, episodes) {
  if (!container) return;
  container.innerHTML = episodes
    .map((ep, index) => episodeCard(ep, { delay: Math.min(index, 6) * 60 }))
    .join("");
}
