/** Ευρετήριο μελών με φίλτρα, ταξινόμηση και follow. */

import { mountShell } from "../shell.js";
import { session, authReady } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import {
  $, esc, render, avatar, nameOf, fmtDate, isOnline, empty, skeletonCards,
  debounce, toastOk, toastError, toast,
} from "../ui.js";

await mountShell("members");
await authReady();

const state = { rows: [], follows: new Map(), search: "", sim: "", setup: "", sort: "newest" };

render("#mem-list", skeletonCards(8, 190));

const rows =
  (await safe(
    db
      .from("profiles")
      .select(
        "id, user_id, display_name, username, avatar_url, bio, location, nationality, favorite_sim, setup_type, years_simracing, created_at, last_seen, show_online",
      )
      .eq("is_approved", true),
    [],
  )) || [];

state.rows = rows;

if (session.user) {
  const mine = (await safe(db.from("follows").select("following_id, status").eq("follower_id", session.user.id), [])) || [];
  state.follows = new Map(mine.map((row) => [row.following_id, row.status]));
}

/* ------------------------------------------------------------- φίλτρα ---- */

const sims = Array.from(new Set(rows.map((row) => row.favorite_sim).filter(Boolean))).sort();
const setups = Array.from(new Set(rows.map((row) => row.setup_type).filter(Boolean))).sort();
const SETUP_LABEL = { wheel: "Τιμόνι", controller: "Controller", keyboard: "Πληκτρολόγιο" };

$("#mem-sim").insertAdjacentHTML("beforeend", sims.map((sim) => `<option value="${esc(sim)}">${esc(sim)}</option>`).join(""));
$("#mem-setup").insertAdjacentHTML(
  "beforeend",
  setups.map((setup) => `<option value="${esc(setup)}">${esc(SETUP_LABEL[setup] || setup)}</option>`).join(""),
);

render(
  "#mem-stats",
  [
    [rows.length, "Μέλη"],
    [rows.filter((row) => row.show_online !== false && isOnline(row.last_seen)).length, "Online τώρα"],
    [sims.length, "Διαφορετικά sims"],
  ]
    .map(
      ([value, label]) =>
        `<div class="hub-stat"><div class="hub-stat__value">${esc(value)}</div><div class="hub-stat__label">${esc(label)}</div></div>`,
    )
    .join(""),
);

$("#mem-search").addEventListener("input", debounce((ev) => {
  state.search = ev.target.value.trim().toLowerCase();
  paint();
}, 200));
$("#mem-sim").addEventListener("change", (ev) => {
  state.sim = ev.target.value;
  paint();
});
$("#mem-setup").addEventListener("change", (ev) => {
  state.setup = ev.target.value;
  paint();
});
$("#mem-sort").addEventListener("change", (ev) => {
  state.sort = ev.target.value;
  paint();
});

/* ---------------------------------------------------------------- λίστα ---- */

function paint() {
  let list = state.rows.filter((row) => {
    if (state.sim && row.favorite_sim !== state.sim) return false;
    if (state.setup && row.setup_type !== state.setup) return false;
    if (!state.search) return true;
    return `${row.display_name || ""} ${row.username || ""} ${row.location || ""}`.toLowerCase().includes(state.search);
  });

  const online = (row) => row.show_online !== false && isOnline(row.last_seen);

  list = list.slice().sort((a, b) => {
    if (state.sort === "name") return nameOf(a).localeCompare(nameOf(b), "el");
    if (state.sort === "oldest") return new Date(a.created_at) - new Date(b.created_at);
    if (state.sort === "online") return Number(online(b)) - Number(online(a));
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (!list.length) {
    render("#mem-list", `<div style="grid-column:1/-1">${empty("Δεν βρέθηκαν μέλη με αυτά τα φίλτρα.", "🔍")}</div>`);
    return;
  }

  render(
    "#mem-list",
    list
      .map((row) => {
        const status = state.follows.get(row.user_id);
        const isMe = session.user?.id === row.user_id;
        return `<article class="member u-cut">
          <a class="hub-avatar-wrap" href="profile.html?u=${encodeURIComponent(row.user_id)}">
            ${avatar(row, "lg")}
            ${online(row) ? '<span class="hub-avatar-wrap__status" style="background:hsl(var(--ok))"></span>' : ""}
          </a>
          <div>
            <a class="member__name" href="profile.html?u=${encodeURIComponent(row.user_id)}" style="color:inherit">${esc(nameOf(row))}</a>
            <p class="u-tiny u-faint">${esc(row.location || row.nationality || "—")}</p>
          </div>
          ${row.bio ? `<p class="u-tiny u-dim u-clamp-2">${esc(row.bio)}</p>` : ""}
          <div class="member__tags">
            ${row.favorite_sim ? `<span class="hub-badge">${esc(row.favorite_sim)}</span>` : ""}
            ${row.setup_type ? `<span class="hub-badge hub-badge--accent">${esc(SETUP_LABEL[row.setup_type] || row.setup_type)}</span>` : ""}
          </div>
          <p class="u-tiny u-faint">Μέλος από ${fmtDate(row.created_at, { month: "short", year: "numeric" })}</p>
          ${
            isMe
              ? '<span class="hub-badge hub-badge--brand">Εσύ</span>'
              : `<button class="hub-btn hub-btn--sm ${status ? "hub-btn--ghost" : "hub-btn--primary"}" type="button" data-follow="${esc(row.user_id)}">
                   ${status === "accepted" ? "Ακολουθείς" : status === "pending" ? "Σε αναμονή" : "Ακολούθησε"}
                 </button>`
          }
        </article>`;
      })
      .join(""),
  );
}

/* --------------------------------------------------------------- follow ---- */

$("#mem-list").addEventListener("click", async (ev) => {
  const button = ev.target.closest("[data-follow]");
  if (!button) return;

  if (!session.user) {
    toast("Χρειάζεται σύνδεση", { body: "Συνδέσου για να ακολουθήσεις μέλη.", tone: "bad" });
    return;
  }

  const target = button.dataset.follow;
  const status = state.follows.get(target);
  button.disabled = true;

  if (status) {
    const { error } = await db.from("follows").delete().eq("follower_id", session.user.id).eq("following_id", target);
    if (error) {
      button.disabled = false;
      return toastError(error);
    }
    state.follows.delete(target);
    toastOk("Σταμάτησες να ακολουθείς");
  } else {
    const { error } = await db
      .from("follows")
      .insert({ follower_id: session.user.id, following_id: target, status: "pending" });
    if (error) {
      button.disabled = false;
      return toastError(error);
    }
    state.follows.set(target, "pending");
    toastOk("Στάλθηκε αίτημα");
  }

  button.disabled = false;
  paint();
});

paint();
