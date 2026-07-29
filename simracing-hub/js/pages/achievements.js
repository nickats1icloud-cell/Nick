/** Badges: όλα τα διαθέσιμα επιτεύγματα, με σήμανση όσων έχει ο χρήστης. */

import { mountShell } from "../shell.js";
import { session, authReady } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import { $, $$, esc, render, empty, skeletonCards } from "../ui.js";

await mountShell("achievements");
await authReady();

let badges = [];
let mine = new Set();
let category = "";

render("#badge-list", skeletonCards(6, 150));

badges = (await safe(db.from("achievement_badges").select("*").order("category").order("name"), [])) || [];

if (session.user) {
  const rows = (await safe(db.from("user_achievements").select("badge_id").eq("user_id", session.user.id), [])) || [];
  mine = new Set(rows.map((row) => row.badge_id));
}

const categories = Array.from(new Set(badges.map((row) => row.category).filter(Boolean))).sort();

render(
  "#badge-cats",
  [`<button class="hub-chip is-active" data-cat="" type="button">Όλα</button>`]
    .concat(categories.map((cat) => `<button class="hub-chip" data-cat="${esc(cat)}" type="button">${esc(cat)}</button>`))
    .join(""),
);

$("#badge-cats").addEventListener("click", (ev) => {
  const chip = ev.target.closest("[data-cat]");
  if (!chip) return;
  category = chip.dataset.cat;
  $$("#badge-cats .hub-chip").forEach((node) => node.classList.toggle("is-active", node === chip));
  paint();
});

function paint() {
  const list = category ? badges.filter((row) => row.category === category) : badges;

  if (!list.length) {
    render("#badge-list", `<div style="grid-column:1/-1">${empty("Δεν υπάρχουν badges ακόμα.", "🎖")}</div>`);
    return;
  }

  render(
    "#badge-list",
    list
      .map((badge) => {
        const owned = mine.has(badge.id);
        return `<article class="hub-card ${owned ? "hub-card--rail" : ""}" style="${owned ? "" : "opacity:0.62"}">
          <div class="u-row" style="gap:12px">
            <span style="font-size:1.9rem">${esc(badge.icon || "🏅")}</span>
            <div style="min-width:0;flex:1">
              <h3 style="font-size:0.98rem">${esc(badge.name)}</h3>
              <span class="hub-badge">${esc(badge.category || "—")}</span>
            </div>
            ${owned ? '<span class="hub-badge hub-badge--ok">✓ Το έχεις</span>' : ""}
          </div>
          ${badge.description ? `<p class="u-small u-dim" style="margin-top:10px">${esc(badge.description)}</p>` : ""}
          ${badge.requirement ? `<p class="u-tiny u-faint" style="margin-top:8px">🎯 ${esc(badge.requirement)}</p>` : ""}
        </article>`;
      })
      .join(""),
  );
}

paint();
