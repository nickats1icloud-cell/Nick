/**
 * Predictions: για κάθε event ο χρήστης μαντεύει P1/P2/P3 (+ γρηγορότερο γύρο)
 * πριν λήξει η προθεσμία. Οι απαντήσεις αποθηκεύονται ως JSON στο
 * `prediction_entries.predictions`, ακριβώς όπως στο αρχικό schema.
 */

import { mountShell } from "../shell.js";
import { session, authReady } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import {
  $, $$, esc, render, avatar, nameOf, fmtDateTime, empty, skeletonCards,
  byUserId, uniq, toastOk, toastError, toast,
} from "../ui.js";

await mountShell("predictions");
await authReady();

const state = { events: [], entries: new Map() };

/* ----------------------------------------------------------------- tabs ---- */

$$(".hub-tabs__btn").forEach((button) =>
  button.addEventListener("click", () => {
    $$(".hub-tabs__btn").forEach((node) => node.classList.toggle("is-active", node === button));
    const board = button.dataset.tab === "board";
    $("#pred-events").hidden = board;
    $("#pred-board").hidden = !board;
    if (board) loadBoard();
  }),
);

/* --------------------------------------------------------------- events ---- */

async function load() {
  render("#pred-events", skeletonCards(3, 170));

  const events = (await safe(db.from("prediction_events").select("*").order("deadline", { ascending: false }), [])) || [];
  state.events = events;

  if (session.user) {
    const entries = (await safe(db.from("prediction_entries").select("*").eq("user_id", session.user.id), [])) || [];
    state.entries = new Map(entries.map((row) => [row.event_id, row]));
  }

  paint();
}

const FIELDS = [
  ["p1", "🥇 1η θέση"],
  ["p2", "🥈 2η θέση"],
  ["p3", "🥉 3η θέση"],
  ["fastest", "⚡ Γρηγορότερος γύρος"],
];

function paint() {
  if (!state.events.length) {
    render("#pred-events", empty("Δεν υπάρχουν ενεργά predictions.", "🎯"));
    return;
  }

  render(
    "#pred-events",
    state.events
      .map((event) => {
        const open = new Date(event.deadline) > new Date() && event.status !== "closed";
        const entry = state.entries.get(event.id);
        const answers = entry?.predictions || {};
        const results = event.results || null;

        return `<article class="hub-card ${open ? "hub-card--rail" : ""}" data-event="${esc(event.id)}">
          <div class="u-between">
            <div style="min-width:0">
              <h2 style="font-size:1.1rem">${esc(event.title)}</h2>
              <p class="u-tiny u-faint">Προθεσμία: ${fmtDateTime(event.deadline)}${event.event_date ? ` · Αγώνας: ${fmtDateTime(event.event_date)}` : ""}</p>
            </div>
            <span class="hub-badge ${open ? "hub-badge--ok" : "hub-badge--bad"}">${open ? "Ανοιχτό" : "Κλειστό"}</span>
          </div>

          ${event.description ? `<p class="u-small u-dim" style="margin-top:10px">${esc(event.description)}</p>` : ""}

          <div class="u-grid u-grid--2" style="gap:12px;margin-top:16px">
            ${FIELDS.map(
              ([key, label]) => `<label class="hub-field">
                <span>${label}</span>
                <input class="hub-input" data-field="${key}" value="${esc(answers[key] || "")}" ${open ? "" : "disabled"} placeholder="Όνομα οδηγού" />
              </label>`,
            ).join("")}
          </div>

          ${
            results
              ? `<div class="hub-card" style="margin-top:14px;background:hsl(var(--surface-2))">
                   <p class="u-tiny u-faint">Αποτελέσματα</p>
                   <p class="u-small" style="margin-top:4px">${FIELDS.map(([key, label]) => (results[key] ? `${label}: <strong>${esc(results[key])}</strong>` : "")).filter(Boolean).join(" · ")}</p>
                 </div>`
              : ""
          }

          <div class="u-row" style="margin-top:14px">
            ${entry?.points_earned != null ? `<span class="hub-badge hub-badge--brand">${entry.points_earned} πόντοι</span>` : ""}
            <span class="u-spacer"></span>
            ${open ? `<button class="hub-btn hub-btn--primary hub-btn--sm" type="button" data-save="${esc(event.id)}">${entry ? "Ενημέρωση" : "Υποβολή"}</button>` : ""}
          </div>
        </article>`;
      })
      .join(""),
  );
}

$("#pred-events").addEventListener("click", async (ev) => {
  const button = ev.target.closest("[data-save]");
  if (!button) return;

  if (!session.user) {
    toast("Χρειάζεται σύνδεση", { body: "Συνδέσου για να παίξεις.", tone: "bad" });
    return;
  }

  const card = button.closest("[data-event]");
  const predictions = {};
  card.querySelectorAll("[data-field]").forEach((input) => {
    const value = input.value.trim();
    if (value) predictions[input.dataset.field] = value;
  });

  if (!Object.keys(predictions).length) return toastError(null, "Συμπλήρωσε τουλάχιστον μία πρόβλεψη.");

  button.disabled = true;
  const { error } = await db
    .from("prediction_entries")
    .upsert({ event_id: card.dataset.event, user_id: session.user.id, predictions }, { onConflict: "event_id,user_id" });
  button.disabled = false;

  if (error) return toastError(error);
  toastOk("Η πρόβλεψή σου καταχωρήθηκε");
  load();
});

/* ---------------------------------------------------------- βαθμολογία ---- */

async function loadBoard() {
  render("#pred-board", '<div class="hub-loading"><div class="hub-spinner"></div></div>');

  const rows = (await safe(db.from("prediction_entries").select("user_id, points_earned"), [])) || [];

  if (!rows.length) {
    render("#pred-board", empty("Δεν υπάρχει βαθμολογία ακόμα.", "🏁"));
    return;
  }

  const totals = new Map();
  rows.forEach((row) => totals.set(row.user_id, (totals.get(row.user_id) || 0) + (row.points_earned || 0)));

  const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const profiles =
    (await safe(db.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", uniq(ranked.map(([id]) => id))), [])) || [];
  const map = byUserId(profiles);

  render(
    "#pred-board",
    `<div class="hub-table-wrap"><table class="hub-table">
      <thead><tr><th style="width:56px">#</th><th>Παίκτης</th><th>Συμμετοχές</th><th>Πόντοι</th></tr></thead>
      <tbody>
        ${ranked
          .map(([userId, points], index) => {
            const profile = map.get(userId);
            const plays = rows.filter((row) => row.user_id === userId).length;
            return `<tr>
              <td><span class="hub-pos ${index < 3 ? `hub-pos--${index + 1}` : ""}">${index + 1}</span></td>
              <td><a class="u-row" href="profile.html?u=${encodeURIComponent(userId)}" style="gap:8px;color:inherit">${avatar(profile, "xs")}<span>${esc(nameOf(profile))}</span></a></td>
              <td class="hub-table__num">${plays}</td>
              <td class="hub-table__num" style="color:hsl(var(--brand));font-weight:600">${points}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table></div>`,
  );
}

load();
