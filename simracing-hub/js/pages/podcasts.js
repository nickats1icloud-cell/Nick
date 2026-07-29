/** Podcasts: λίστα επεισοδίων με φίλτρο κατηγορίας, αναζήτηση και Spotify embed. */

import { mountShell } from "../shell.js";
import { db, safe } from "../supabase-client.js";
import { $, $$, esc, safeUrl, render, empty, skeletonCards, debounce } from "../ui.js";

await mountShell("podcasts");

let episodes = [];
let category = "";
let search = "";

render("#pod-list", skeletonCards(4, 100));

episodes =
  (await safe(
    db.from("podcast_episodes").select("*").eq("published", true).order("episode_number", { ascending: false }),
    [],
  )) || [];

const categories = Array.from(new Set(episodes.map((row) => row.category).filter(Boolean))).sort();

render(
  "#pod-cats",
  [`<button class="hub-chip is-active" data-cat="" type="button">Όλα</button>`]
    .concat(categories.map((cat) => `<button class="hub-chip" data-cat="${esc(cat)}" type="button">${esc(cat)}</button>`))
    .join(""),
);

$("#pod-cats").addEventListener("click", (ev) => {
  const chip = ev.target.closest("[data-cat]");
  if (!chip) return;
  category = chip.dataset.cat;
  $$("#pod-cats .hub-chip").forEach((node) => node.classList.toggle("is-active", node === chip));
  paint();
});

$("#pod-search").addEventListener("input", debounce((ev) => {
  search = ev.target.value.trim().toLowerCase();
  paint();
}, 200));

const spotifyId = (url) => (String(url || "").match(/episode\/([A-Za-z0-9]+)/) || [])[1] || null;

function paint() {
  const list = episodes.filter((row) => {
    if (category && row.category !== category) return false;
    if (!search) return true;
    return `${row.title} ${row.description || ""} ${row.host || ""}`.toLowerCase().includes(search);
  });

  if (!list.length) {
    render("#pod-list", empty("Δεν βρέθηκαν επεισόδια.", "🎧"));
    return;
  }

  render(
    "#pod-list",
    list
      .map((ep) => {
        const id = spotifyId(ep.spotify_url) || ep.spotify_id;
        return `<article class="pod">
          <div class="pod__row">
            <div class="pod__num"><span class="u-tiny">EP</span><b>#${esc(ep.episode_number ?? "—")}</b></div>
            <span class="pod__play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
            <div style="min-width:0;flex:1">
              ${ep.category ? `<span class="hub-badge">${esc(ep.category)}</span>` : ""}
              <h2 style="font-size:1rem;margin-top:5px">${esc(ep.title)}</h2>
              ${ep.description ? `<p class="u-small u-dim u-clamp-2" style="margin-top:4px">${esc(ep.description)}</p>` : ""}
              <p class="u-tiny u-faint" style="margin-top:4px">${esc(ep.host || "")}${ep.duration ? ` · ${esc(ep.duration)}` : ""}</p>
            </div>
            ${ep.spotify_url ? `<a class="hub-btn hub-btn--sm hub-btn--ghost" href="${safeUrl(ep.spotify_url)}" target="_blank" rel="noopener noreferrer">Spotify ↗</a>` : ""}
          </div>
          ${id ? `<div class="pod__embed"><iframe src="https://open.spotify.com/embed/episode/${esc(id)}?utm_source=generator" loading="lazy" allow="clipboard-write; encrypted-media; picture-in-picture" title="${esc(ep.title)}"></iframe></div>` : ""}
        </article>`;
      })
      .join(""),
  );
}

paint();
