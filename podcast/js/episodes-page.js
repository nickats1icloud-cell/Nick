/*
 * Σελίδα αρχείου επεισοδίων: αναζήτηση, φίλτρα (tags, σεζόν, αγαπημένα),
 * ταξινόμηση, εναλλαγή προβολής και "φόρτωσε περισσότερα".
 * Η κατάσταση γράφεται στο URL (?q=…&tag=…) ώστε να μοιράζεται με link.
 */

import { initPage, initReveal } from "./ui.js";
import { EPISODES, allTags } from "./data/episodes.js";
import { normalize, esc } from "./format.js";
import { episodeCard, episodeRow } from "./render.js";
import { getFavorites } from "./store.js";

initPage();

const PAGE_SIZE = 9;

const dom = {
  search: document.querySelector("[data-search]"),
  sort: document.querySelector("[data-sort]"),
  favorites: document.querySelector("[data-only-favorites]"),
  tagBar: document.querySelector("[data-tag-bar]"),
  results: document.querySelector("[data-results]"),
  empty: document.querySelector("[data-empty]"),
  count: document.querySelector("[data-results-count]"),
  more: document.querySelector("[data-more]"),
  reset: document.querySelector("[data-reset]"),
  views: document.querySelectorAll("[data-view]"),
};

const params = new URLSearchParams(location.search);

const state = {
  query: params.get("q") || "",
  tags: new Set(params.get("tag") ? [params.get("tag")] : []),
  season: params.get("season") ? Number(params.get("season")) : null,
  onlyFavorites: params.get("filter") === "favorites",
  sort: params.get("sort") || "new",
  view: params.get("view") === "list" ? "list" : "grid",
  visible: PAGE_SIZE,
};

/* ---------- Φίλτρα UI ---------- */

const seasons = [...new Set(EPISODES.map((ep) => ep.season))].sort((a, b) => b - a);

function renderTagBar() {
  const tags = allTags();
  dom.tagBar.innerHTML =
    seasons
      .map(
        (season) =>
          `<button class="chip" data-season="${season}" aria-pressed="${state.season === season}">Σεζόν ${season}</button>`
      )
      .join("") +
    `<span style="width:1px;height:22px;background:hsl(var(--border));margin-inline:.35rem"></span>` +
    tags
      .map(
        ({ tag, count }) =>
          `<button class="chip" data-tag="${esc(tag)}" aria-pressed="${state.tags.has(tag)}">${esc(tag)} <span style="opacity:.55">${count}</span></button>`
      )
      .join("");
}

/* ---------- Φιλτράρισμα ---------- */

function haystack(ep) {
  return normalize(
    [
      ep.title,
      ep.excerpt,
      ep.tags.join(" "),
      ep.guests.map((g) => `${g.name} ${g.role}`).join(" "),
      (ep.chapters || []).map((c) => c.title).join(" "),
      `επεισόδιο ${ep.number} e${ep.number} s${ep.season}`,
    ].join(" ")
  );
}

function filtered() {
  const query = normalize(state.query.trim());
  const favorites = new Set(getFavorites());

  let list = EPISODES.filter((ep) => {
    if (query && !haystack(ep).includes(query)) return false;
    if (state.tags.size && ![...state.tags].every((tag) => ep.tags.includes(tag))) return false;
    if (state.season && ep.season !== state.season) return false;
    if (state.onlyFavorites && !favorites.has(ep.id)) return false;
    return true;
  });

  const sorters = {
    new: (a, b) => new Date(b.date) - new Date(a.date),
    old: (a, b) => new Date(a.date) - new Date(b.date),
    long: (a, b) => b.duration - a.duration,
    short: (a, b) => a.duration - b.duration,
    plays: (a, b) => b.plays - a.plays,
  };
  list = list.sort(sorters[state.sort] || sorters.new);
  return list;
}

/* ---------- Render ---------- */

function syncUrl() {
  const next = new URLSearchParams();
  if (state.query) next.set("q", state.query);
  if (state.tags.size) next.set("tag", [...state.tags][0]);
  if (state.season) next.set("season", state.season);
  if (state.onlyFavorites) next.set("filter", "favorites");
  if (state.sort !== "new") next.set("sort", state.sort);
  if (state.view !== "grid") next.set("view", state.view);
  const query = next.toString();
  history.replaceState(null, "", query ? `?${query}` : location.pathname);
}

function render() {
  const list = filtered();
  const slice = list.slice(0, state.visible);

  dom.results.className = state.view === "list" ? "ep-list" : "ep-grid";
  dom.results.innerHTML = slice
    .map((ep, index) =>
      state.view === "list" ? episodeRow(ep) : episodeCard(ep, { delay: Math.min(index, 6) * 50 })
    )
    .join("");

  dom.empty.hidden = list.length > 0;
  dom.more.hidden = list.length <= state.visible;
  dom.count.textContent = list.length
    ? `${list.length} ${list.length === 1 ? "επεισόδιο" : "επεισόδια"}${
        list.length > slice.length ? ` · εμφανίζονται ${slice.length}` : ""
      }`
    : "";

  const dirty =
    state.query || state.tags.size || state.season || state.onlyFavorites || state.sort !== "new";
  dom.reset.hidden = !dirty;

  initReveal(dom.results);
  syncUrl();
}

function update(patch = {}) {
  Object.assign(state, patch);
  if (!("visible" in patch)) state.visible = PAGE_SIZE;
  render();
}

/* ---------- Events ---------- */

let searchTimer = null;
dom.search.value = state.query;
dom.search.addEventListener("input", (event) => {
  // Debounce: το φιλτράρισμα είναι φθηνό, αλλά το re-render όχι σε κάθε πλήκτρο.
  clearTimeout(searchTimer);
  const value = event.target.value;
  searchTimer = setTimeout(() => update({ query: value }), 160);
});

dom.sort.value = state.sort;
dom.sort.addEventListener("change", (event) => update({ sort: event.target.value }));

dom.favorites.setAttribute("aria-pressed", String(state.onlyFavorites));
dom.favorites.addEventListener("click", () => {
  const next = !state.onlyFavorites;
  dom.favorites.setAttribute("aria-pressed", String(next));
  update({ onlyFavorites: next });
});

dom.tagBar.addEventListener("click", (event) => {
  const tagChip = event.target.closest("[data-tag]");
  if (tagChip) {
    const tag = tagChip.dataset.tag;
    state.tags.has(tag) ? state.tags.delete(tag) : state.tags.add(tag);
    tagChip.setAttribute("aria-pressed", String(state.tags.has(tag)));
    update();
    return;
  }

  const seasonChip = event.target.closest("[data-season]");
  if (seasonChip) {
    const season = Number(seasonChip.dataset.season);
    const next = state.season === season ? null : season;
    update({ season: next });
    renderTagBar();
  }
});

dom.views.forEach((button) => {
  button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
  button.addEventListener("click", () => {
    dom.views.forEach((other) =>
      other.setAttribute("aria-pressed", String(other === button))
    );
    update({ view: button.dataset.view });
  });
});

dom.more.addEventListener("click", () => {
  update({ visible: state.visible + PAGE_SIZE });
  // Το focus πηγαίνει στο πρώτο νέο αποτέλεσμα για χρήστες πληκτρολογίου.
  dom.results.children[state.visible - PAGE_SIZE]?.querySelector("a")?.focus();
});

dom.reset.addEventListener("click", () => {
  state.tags.clear();
  dom.search.value = "";
  dom.sort.value = "new";
  dom.favorites.setAttribute("aria-pressed", "false");
  update({ query: "", season: null, onlyFavorites: false, sort: "new" });
  renderTagBar();
});

renderTagBar();
render();
