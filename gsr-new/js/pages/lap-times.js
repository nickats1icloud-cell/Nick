/** Χρόνοι γύρου: leaderboard με φίλτρα και υποβολή νέου χρόνου. */

import { mountShell } from "../shell.js";
import { session, authReady } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import {
  $, esc, safeUrl, render, nameOf, fmtLap, parseLap, fmtDate, empty, debounce,
  byUserId, uniq, openModal, toastOk, toastError, toast,
} from "../ui.js";
import { SIM_OPTIONS } from "../config.js";

await mountShell("laptimes");
await authReady();

const state = { rows: [], profiles: new Map(), sim: "", track: "", search: "" };

async function load() {
  render("#lap-list", '<div class="hub-loading"><div class="hub-spinner"></div></div>');

  const rows = (await safe(db.from("lap_times").select("*").order("lap_time_ms"), [])) || [];
  const profiles =
    (await safe(db.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", uniq(rows.map((r) => r.user_id))), [])) || [];

  state.rows = rows;
  state.profiles = byUserId(profiles);

  fillSelect("#lap-sim", uniq(rows.map((row) => row.sim_name)).sort());
  fillSelect("#lap-track", uniq(rows.map((row) => row.track_name)).sort());
  paint();
}

function fillSelect(selector, values) {
  const node = $(selector);
  const current = node.value;
  node.length = 1;
  values.forEach((value) => node.insertAdjacentHTML("beforeend", `<option value="${esc(value)}">${esc(value)}</option>`));
  node.value = current;
}

function paint() {
  const list = state.rows.filter((row) => {
    if (state.sim && row.sim_name !== state.sim) return false;
    if (state.track && row.track_name !== state.track) return false;
    if (state.search && !String(row.car_name || "").toLowerCase().includes(state.search)) return false;
    return true;
  });

  if (!list.length) {
    render("#lap-list", empty("Δεν υπάρχουν χρόνοι με αυτά τα φίλτρα.", "⏱"));
    return;
  }

  const best = list[0].lap_time_ms;

  render(
    "#lap-list",
    `<div class="hub-table-wrap"><table class="hub-table">
      <thead><tr>
        <th style="width:56px">#</th><th>Οδηγός</th><th>Πίστα</th><th>Αυτοκίνητο</th>
        <th>Sim</th><th>Χρόνος</th><th>Διαφορά</th><th>Συνθήκες</th><th></th>
      </tr></thead>
      <tbody>
        ${list
          .map((row, index) => {
            const profile = state.profiles.get(row.user_id);
            const gap = row.lap_time_ms - best;
            return `<tr>
              <td><span class="hub-pos ${index < 3 ? `hub-pos--${index + 1}` : ""}">${index + 1}</span></td>
              <td><a href="profile.html?u=${encodeURIComponent(row.user_id)}" style="color:inherit">${esc(nameOf(profile))}</a>
                  ${row.verified ? ' <span class="hub-badge hub-badge--ok" title="Επαληθευμένος">✓</span>' : ""}</td>
              <td>${esc(row.track_name)}</td>
              <td>${esc(row.car_name)}</td>
              <td><span class="hub-badge">${esc(row.sim_name)}</span></td>
              <td class="hub-table__num" style="color:hsl(var(--brand));font-weight:600">${fmtLap(row.lap_time_ms)}</td>
              <td class="hub-table__num u-faint">${index === 0 ? "—" : `+${(gap / 1000).toFixed(3)}`}</td>
              <td class="u-small u-faint">${esc(row.conditions || "—")}</td>
              <td>${row.video_url ? `<a class="u-small" href="${safeUrl(row.video_url)}" target="_blank" rel="noopener noreferrer">▶</a>` : ""}
                  <span class="u-tiny u-faint">${fmtDate(row.created_at, { day: "2-digit", month: "2-digit" })}</span></td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table></div>`,
  );
}

/* -------------------------------------------------------------- φίλτρα ---- */

$("#lap-sim").addEventListener("change", (ev) => {
  state.sim = ev.target.value;
  paint();
});
$("#lap-track").addEventListener("change", (ev) => {
  state.track = ev.target.value;
  paint();
});
$("#lap-search").addEventListener("input", debounce((ev) => {
  state.search = ev.target.value.trim().toLowerCase();
  paint();
}, 200));

/* -------------------------------------------------------- νέος χρόνος ---- */

$("#lap-new").addEventListener("click", () => {
  if (!session.user) {
    toast("Χρειάζεται σύνδεση", { body: "Συνδέσου για να ανεβάσεις χρόνο.", tone: "bad" });
    return;
  }

  const { root, close } = openModal({
    title: "Νέος χρόνος γύρου",
    body: `<div class="u-grid u-grid--2" style="gap:14px">
        <label class="hub-field"><span>Sim</span>
          <select class="hub-select" name="sim">${SIM_OPTIONS.map((sim) => `<option>${esc(sim)}</option>`).join("")}</select>
        </label>
        <label class="hub-field"><span>Πίστα</span><input class="hub-input" name="track" placeholder="π.χ. Spa-Francorchamps" /></label>
      </div>
      <div class="u-grid u-grid--2" style="gap:14px">
        <label class="hub-field"><span>Αυτοκίνητο</span><input class="hub-input" name="car" placeholder="π.χ. Ferrari 296 GT3" /></label>
        <label class="hub-field"><span>Χρόνος (μ:δδ.χχχ)</span><input class="hub-input u-mono" name="time" placeholder="1:23.456" /></label>
      </div>
      <div class="u-grid u-grid--2" style="gap:14px">
        <label class="hub-field"><span>Συνθήκες</span><input class="hub-input" name="conditions" placeholder="Dry / Wet / Night" /></label>
        <label class="hub-field"><span>Video (URL)</span><input class="hub-input" name="video" placeholder="https://youtube.com/…" /></label>
      </div>
      <p class="u-tiny u-faint">Οι χρόνοι επαληθεύονται από τους διαχειριστές.</p>`,
    footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Άκυρο</button>
             <button class="hub-btn hub-btn--primary" type="button" data-save>Υποβολή</button>`,
  });

  root.querySelector("[data-save]").addEventListener("click", async (ev) => {
    const value = (name) => root.querySelector(`[name="${name}"]`).value.trim();
    const ms = parseLap(value("time"));

    if (!value("track") || !value("car") || !ms) {
      return toastError(null, "Συμπλήρωσε πίστα, αυτοκίνητο και έγκυρο χρόνο (π.χ. 1:23.456).");
    }

    ev.target.disabled = true;
    const { error } = await db.from("lap_times").insert({
      user_id: session.user.id,
      sim_name: value("sim"),
      track_name: value("track"),
      car_name: value("car"),
      lap_time_ms: ms,
      conditions: value("conditions") || null,
      video_url: value("video") || null,
    });

    ev.target.disabled = false;
    if (error) return toastError(error);
    toastOk("Ο χρόνος καταχωρήθηκε");
    close();
    load();
  });
});

load();
