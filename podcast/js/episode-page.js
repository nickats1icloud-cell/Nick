/*
 * Σελίδα επεισοδίου (?id=ep-062).
 * Tabs (σημειώσεις / ενότητες / απομαγνητοφώνηση), κλικ σε timestamp για
 * μετάβαση, ζωντανό highlight της τρέχουσας ενότητας και γραμμής,
 * sidebar με καλεσμένους, στοιχεία και κοινοποίηση.
 */

import { initPage, initReveal } from "./ui.js";
import { EPISODES, EPISODES_SORTED, getEpisode } from "./data/episodes.js";
import { icon } from "./icons.js";
import { esc, timecode, durationLabel, dateLabel, compactNumber, normalize } from "./format.js";
import { artHtml, episodeRow, episodeMetaHtml } from "./render.js";
import { Player, onPlayerChange } from "./player.js";
import { isFavorite, getQueue, progressPercent } from "./store.js";
import { toast } from "./toast.js";

initPage();

const id = new URLSearchParams(location.search).get("id");
const ep = getEpisode(id) || EPISODES_SORTED[0];

if (!ep) {
  location.replace("episodes.html");
}

document.title = `#${ep.number} ${ep.title} — Greek SimRacers Podcast`;
document
  .querySelector('meta[name="description"]')
  ?.setAttribute("content", ep.excerpt);

/* ---------------- Hero ---------------- */

function renderHero() {
  const host = document.querySelector("[data-hero]");
  const percent = progressPercent(ep.id, ep.duration);
  const inQueue = getQueue().includes(ep.id);

  host.innerHTML = `
    ${artHtml(ep, "art--lg")}
    <div data-ep="${esc(ep.id)}">
      <div class="row" style="gap:.5rem">
        <span class="badge">Σεζόν ${ep.season}</span>
        <span class="badge">Επεισόδιο ${ep.number}</span>
        ${ep.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}
      </div>
      <h1 style="font-size:clamp(1.8rem,4vw,3rem);margin-block:1rem .75rem">${esc(ep.title)}</h1>
      <p class="lead">${esc(ep.excerpt)}</p>
      ${episodeMetaHtml(ep)}
      <div class="row" style="margin-top:1.5rem;gap:.6rem">
        <button class="btn btn--primary" data-play="${esc(ep.id)}">
          <span class="icon-play">${icon("play")}</span><span class="icon-pause">${icon("pause")}</span>
          <span data-play-label>${percent > 2 && percent < 98 ? "Συνέχεια" : "Αναπαραγωγή"}</span>
        </button>
        <button class="btn fav-btn" data-fav="${esc(ep.id)}" aria-pressed="${isFavorite(ep.id)}">
          ${icon("heart")} Αγαπημένο
        </button>
        <button class="btn" data-queue="${esc(ep.id)}" aria-pressed="${inQueue}">
          ${icon("plus")} Για αργότερα
        </button>
        <button class="btn btn--ghost" data-share>${icon("share")} Κοινοποίηση</button>
      </div>
    </div>`;
}

/* ---------------- Tabs ---------------- */

function wireTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];

  const select = (tab) => {
    tabs.forEach((other) => {
      const selected = other === tab;
      other.setAttribute("aria-selected", String(selected));
      document.getElementById(other.getAttribute("aria-controls")).hidden = !selected;
    });
    tab.focus();
  };

  tabs.forEach((tab) => tab.addEventListener("click", () => select(tab)));

  // Βέλη αριστερά/δεξιά μέσα στα tabs (WAI-ARIA tab pattern).
  document.querySelector('[role="tablist"]').addEventListener("keydown", (event) => {
    const index = tabs.indexOf(document.activeElement);
    if (index === -1) return;
    if (event.key === "ArrowRight") select(tabs[(index + 1) % tabs.length]);
    if (event.key === "ArrowLeft") select(tabs[(index - 1 + tabs.length) % tabs.length]);
  });
}

/* ---------------- Σημειώσεις ---------------- */

function renderNotes() {
  const host = document.querySelector("[data-notes]");
  const links = ep.links?.length
    ? `<h3>Links από το επεισόδιο</h3><ul>${ep.links
        .map((link) => `<li><a href="${esc(link.url)}" rel="noopener">${esc(link.label)}</a></li>`)
        .join("")}</ul>`
    : "";

  host.innerHTML = `
    ${ep.description.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}
    ${links}
    <h3>Πού θα το ακούσεις</h3>
    <p>
      Το επεισόδιο παίζει απευθείας εδώ, αλλά θα το βρεις και στις
      <a href="subscribe.html">πλατφόρμες</a> — με τα ίδια chapters.
    </p>`;
}

/* ---------------- Ενότητες (chapters) ---------------- */

function renderChapters() {
  const host = document.querySelector("[data-chapters]");
  if (!ep.chapters?.length) {
    host.innerHTML = `<p class="empty-state">Αυτό το επεισόδιο δεν έχει ενότητες.</p>`;
    return;
  }

  host.innerHTML = `<div class="chapters">${ep.chapters
    .map(
      (chapter, index) => `<button class="chapter" data-seek-to="${chapter.t}" data-chapter="${index}">
        <time datetime="PT${Math.round(chapter.t)}S">${timecode(chapter.t)}</time>
        <span>${esc(chapter.title)}</span>
      </button>`
    )
    .join("")}</div>`;
}

/* ---------------- Απομαγνητοφώνηση ---------------- */

function renderTranscript() {
  const host = document.querySelector("[data-transcript]");
  if (!ep.transcript?.length) {
    host.innerHTML = `
      <div class="empty-state">
        ${icon("inbox")}
        <h3>Δεν υπάρχει ακόμα απομαγνητοφώνηση</h3>
        <p>Τα πιο πρόσφατα επεισόδια αποκτούν σταδιακά πλήρες κείμενο.</p>
      </div>`;
    return;
  }

  host.innerHTML = `
    <div class="search-box" style="margin-bottom:1rem">
      ${icon("search")}
      <label class="sr-only" for="tq">Αναζήτηση στην απομαγνητοφώνηση</label>
      <input class="input" id="tq" type="search" placeholder="Ψάξε μέσα στο κείμενο…" data-tsearch />
    </div>
    <div class="transcript" data-tlines></div>`;

  const lines = host.querySelector("[data-tlines]");

  const paint = (query = "") => {
    const q = normalize(query.trim());
    const rows = ep.transcript.filter(
      (line) => !q || normalize(`${line.speaker} ${line.text}`).includes(q)
    );

    if (!rows.length) {
      lines.innerHTML = `<p class="empty-state">Καμία αναφορά για «${esc(query)}».</p>`;
      return;
    }

    lines.innerHTML = rows
      .map((line) => {
        let text = esc(line.text);
        if (q) {
          // Το highlight γίνεται πάνω στο ήδη escaped κείμενο.
          const index = normalize(line.text).indexOf(q);
          if (index !== -1) {
            const raw = line.text;
            text =
              esc(raw.slice(0, index)) +
              `<mark>${esc(raw.slice(index, index + q.length))}</mark>` +
              esc(raw.slice(index + q.length));
          }
        }
        return `<div class="tline" data-seek-to="${line.t}" data-t="${line.t}" role="button" tabindex="0">
          <time>${timecode(line.t)}</time>
          <p><b>${esc(line.speaker)}:</b> ${text}</p>
        </div>`;
      })
      .join("");
  };

  paint();

  let timer = null;
  host.querySelector("[data-tsearch]").addEventListener("input", (event) => {
    clearTimeout(timer);
    const value = event.target.value;
    timer = setTimeout(() => paint(value), 150);
  });
}

/* ---------------- Sidebar ---------------- */

function renderSide() {
  const host = document.querySelector("[data-side]");
  const guests = ep.guests?.length
    ? `<div class="card side-card">
        <h4>Καλεσμένοι</h4>
        <div class="stack">
          ${ep.guests
            .map(
              (guest) => `<div class="guest">
                <i aria-hidden="true">${esc(guest.initials)}</i>
                <div><strong>${esc(guest.name)}</strong><small>${esc(guest.role)}</small></div>
              </div>`
            )
            .join("")}
        </div>
      </div>`
    : "";

  host.innerHTML = `
    ${guests}
    <div class="card side-card">
      <h4>Στοιχεία</h4>
      <dl class="meta-list">
        <div><dt>Ημερομηνία</dt><dd>${dateLabel(ep.date)}</dd></div>
        <div><dt>Διάρκεια</dt><dd>${durationLabel(ep.duration)}</dd></div>
        <div><dt>Σεζόν</dt><dd>${ep.season}</dd></div>
        <div><dt>Επεισόδιο</dt><dd>#${ep.number}</dd></div>
        <div><dt>Ακροάσεις</dt><dd>${compactNumber(ep.plays)}</dd></div>
        <div><dt>Ενότητες</dt><dd>${ep.chapters?.length || 0}</dd></div>
      </dl>
    </div>
    <div class="card side-card">
      <h4>Κοινοποίηση</h4>
      <div class="row" style="gap:.4rem">
        <button class="btn btn--sm" data-share>${icon("share")} Μοιράσου</button>
        <button class="btn btn--sm btn--ghost" data-copy>${icon("link")} Αντιγραφή link</button>
      </div>
      <p style="font-size:.78rem;color:hsl(var(--muted-foreground));margin-top:.75rem">
        Θες link σε συγκεκριμένο σημείο; Κάνε κλικ σε μια ενότητα και αντίγραψε
        τη διεύθυνση — κρατάει το timestamp.
      </p>
    </div>`;
}

/* ---------------- Σχετικά επεισόδια ---------------- */

function renderRelated() {
  const host = document.querySelector("[data-related]");
  const scored = EPISODES.filter((other) => other.id !== ep.id)
    .map((other) => ({
      ep: other,
      score: other.tags.filter((tag) => ep.tags.includes(tag)).length,
    }))
    .sort((a, b) => b.score - a.score || new Date(b.ep.date) - new Date(a.ep.date))
    .slice(0, 4);

  host.innerHTML = scored.map((entry) => episodeRow(entry.ep)).join("");
}

/* ---------------- Seek από chapters / transcript ---------------- */

function wireSeeking() {
  const jump = (seconds) => {
    Player.play(ep, { seek: seconds, autoplay: !Player.isPlaying(ep.id) });
    // Το URL κρατάει το σημείο ώστε να μοιράζεται με link.
    const url = new URL(location.href);
    url.searchParams.set("t", Math.round(seconds));
    history.replaceState(null, "", url);
  };

  document.addEventListener("click", (event) => {
    const node = event.target.closest("[data-seek-to]");
    if (!node) return;
    jump(Number(node.dataset.seekTo));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const node = event.target.closest?.(".tline[data-seek-to]");
    if (!node) return;
    event.preventDefault();
    jump(Number(node.dataset.seekTo));
  });
}

/* ---------------- Highlight τρέχουσας ενότητας/γραμμής ---------------- */

function wireHighlight() {
  onPlayerChange((snap) => {
    const active = snap.episode?.id === ep.id;
    const label = document.querySelector("[data-play-label]");
    if (label) label.textContent = active && snap.playing ? "Παύση" : "Αναπαραγωγή";

    if (!active) {
      document
        .querySelectorAll(".chapter.is-current, .tline.is-current")
        .forEach((node) => node.classList.remove("is-current"));
      return;
    }

    const chapters = ep.chapters || [];
    let currentChapter = -1;
    chapters.forEach((chapter, index) => {
      if (snap.time >= chapter.t) currentChapter = index;
    });
    document.querySelectorAll("[data-chapter]").forEach((node) => {
      node.classList.toggle("is-current", Number(node.dataset.chapter) === currentChapter);
    });

    const lines = [...document.querySelectorAll(".tline[data-t]")];
    let currentLine = null;
    for (const line of lines) {
      if (snap.time >= Number(line.dataset.t)) currentLine = line;
    }
    lines.forEach((line) => line.classList.toggle("is-current", line === currentLine));
  });
}

/* ---------------- Κοινοποίηση ---------------- */

function wireShare() {
  document.addEventListener("click", async (event) => {
    const share = event.target.closest("[data-share]");
    const copy = event.target.closest("[data-copy]");
    if (!share && !copy) return;

    const url = location.href;
    if (share && navigator.share) {
      try {
        await navigator.share({ title: ep.title, text: ep.excerpt, url });
      } catch {
        /* ο χρήστης ακύρωσε */
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast("Το link αντιγράφηκε", "ok");
    } catch {
      toast("Δεν έγινε η αντιγραφή — αντίγραψε το link από τη μπάρα.", "err");
    }
  });
}

/* ---------------- Init ---------------- */

renderHero();
wireTabs();
renderNotes();
renderChapters();
renderTranscript();
renderSide();
renderRelated();
wireSeeking();
wireHighlight();
wireShare();
initReveal();

// ?t=1234 → φορτώνει το επεισόδιο στο σωστό σημείο, χωρίς autoplay.
const t = Number(new URLSearchParams(location.search).get("t"));
if (Number.isFinite(t) && t > 0) {
  Player.play(ep, { seek: t, autoplay: false });
}
