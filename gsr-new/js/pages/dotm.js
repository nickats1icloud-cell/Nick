/** Οδηγός του Μήνα: υποψηφιότητες + ψηφοφορία (μία ψήφος ανά μέλος/μήνα). */

import { mountShell } from "../shell.js";
import { session, authReady } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import {
  $, esc, render, avatar, nameOf, empty, skeletonCards, byUserId,
  openModal, toastOk, toastError, toast,
} from "../ui.js";

await mountShell("dotm");
await authReady();

// Ίδια μορφή κλειδιού με το αρχικό project: "YYYY-MM".
const now = new Date();
const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

$("#dotm-month").textContent = now.toLocaleDateString("el-GR", { month: "long", year: "numeric" });

const state = { nominations: [], votes: [], profiles: new Map(), myVote: null };

async function load() {
  render("#dotm-list", skeletonCards(3, 190));

  const [nominations, votes, profiles] = await Promise.all([
    safe(db.from("driver_of_month_nominations").select("*").eq("month_year", monthYear).order("created_at"), []),
    safe(db.from("driver_of_month_votes").select("*").eq("month_year", monthYear), []),
    safe(db.from("profiles").select("user_id, display_name, username, avatar_url").eq("is_approved", true), []),
  ]);

  state.nominations = nominations || [];
  state.votes = votes || [];
  state.profiles = byUserId(profiles);
  state.myVote = session.user ? (votes || []).find((row) => row.user_id === session.user.id) || null : null;

  paint();
}

function paint() {
  if (!state.nominations.length) {
    render(
      "#dotm-list",
      `<div style="grid-column:1/-1">${empty("Καμία υποψηφιότητα αυτόν τον μήνα. Πρότεινε εσύ έναν οδηγό!", "🏅")}</div>`,
    );
    return;
  }

  const total = state.votes.length || 1;
  const counts = new Map();
  state.votes.forEach((vote) => counts.set(vote.nomination_id, (counts.get(vote.nomination_id) || 0) + 1));

  const ranked = state.nominations
    .map((nomination) => ({ ...nomination, count: counts.get(nomination.id) || 0 }))
    .sort((a, b) => b.count - a.count);

  render(
    "#dotm-list",
    ranked
      .map((nomination, index) => {
        const profile = nomination.driver_user_id ? state.profiles.get(nomination.driver_user_id) : null;
        const share = Math.round((nomination.count / total) * 100);
        const isMine = state.myVote?.nomination_id === nomination.id;
        return `<article class="hub-card hub-card--hover u-cut">
          <div class="u-row" style="gap:12px">
            <span class="hub-pos ${index < 3 ? `hub-pos--${index + 1}` : ""}">${index + 1}</span>
            ${avatar(profile || { display_name: nomination.driver_name }, "lg")}
            <div style="min-width:0;flex:1">
              <h3 style="font-size:1rem">${esc(profile ? nameOf(profile) : nomination.driver_name)}</h3>
              <p class="u-tiny u-faint">${nomination.count} ψήφ${nomination.count === 1 ? "ος" : "οι"} · ${share}%</p>
            </div>
          </div>

          ${nomination.reason ? `<p class="u-small u-dim u-clamp-3" style="margin-top:12px">“${esc(nomination.reason)}”</p>` : ""}

          <div class="hub-progress" style="margin-top:14px"><span style="width:${share}%"></span></div>

          <button class="hub-btn hub-btn--sm ${isMine ? "hub-btn--primary" : "hub-btn--ghost"} hub-btn--block" type="button"
                  data-vote="${esc(nomination.id)}" style="margin-top:14px">
            ${isMine ? "✓ Η ψήφος σου" : "Ψήφισε"}
          </button>
        </article>`;
      })
      .join(""),
  );
}

/* ---------------------------------------------------------------- ψήφος ---- */

$("#dotm-list").addEventListener("click", async (ev) => {
  const button = ev.target.closest("[data-vote]");
  if (!button) return;

  if (!session.user) {
    toast("Χρειάζεται σύνδεση", { body: "Συνδέσου για να ψηφίσεις.", tone: "bad" });
    return;
  }

  button.disabled = true;

  // Μία ψήφος ανά μήνα: σβήνουμε την προηγούμενη πριν βάλουμε τη νέα.
  if (state.myVote) {
    await safe(db.from("driver_of_month_votes").delete().eq("user_id", session.user.id).eq("month_year", monthYear));
    if (state.myVote.nomination_id === button.dataset.vote) {
      toastOk("Η ψήφος αφαιρέθηκε");
      await load();
      return;
    }
  }

  const { error } = await db.from("driver_of_month_votes").insert({
    nomination_id: button.dataset.vote,
    user_id: session.user.id,
    month_year: monthYear,
  });

  if (error) {
    button.disabled = false;
    return toastError(error);
  }

  toastOk("Η ψήφος καταχωρήθηκε");
  load();
});

/* ------------------------------------------------------------- πρόταση ---- */

$("#dotm-nominate").addEventListener("click", async () => {
  if (!session.user) {
    toast("Χρειάζεται σύνδεση", { body: "Συνδέσου για να προτείνεις οδηγό.", tone: "bad" });
    return;
  }

  const members = Array.from(state.profiles.values()).sort((a, b) => nameOf(a).localeCompare(nameOf(b), "el"));

  const { root, close } = openModal({
    title: "Πρόταση οδηγού",
    body: `<label class="hub-field"><span>Μέλος</span>
        <select class="hub-select" name="member">
          <option value="">— Επίλεξε μέλος —</option>
          ${members.map((profile) => `<option value="${esc(profile.user_id)}">${esc(nameOf(profile))}</option>`).join("")}
        </select>
      </label>
      <label class="hub-field"><span>…ή γράψε όνομα</span><input class="hub-input" name="name" placeholder="Όνομα οδηγού" /></label>
      <label class="hub-field"><span>Γιατί;</span><textarea class="hub-textarea" name="reason" rows="4" maxlength="500" placeholder="Πες μας γιατί του αξίζει…"></textarea></label>`,
    footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Άκυρο</button>
             <button class="hub-btn hub-btn--primary" type="button" data-save>Υποβολή</button>`,
  });

  root.querySelector("[data-save]").addEventListener("click", async (ev) => {
    const memberId = root.querySelector('[name="member"]').value;
    const typed = root.querySelector('[name="name"]').value.trim();
    const name = memberId ? nameOf(state.profiles.get(memberId)) : typed;

    if (!name) return toastError(null, "Διάλεξε μέλος ή γράψε όνομα.");
    ev.target.disabled = true;

    const { error } = await db.from("driver_of_month_nominations").insert({
      month_year: monthYear,
      driver_name: name,
      driver_user_id: memberId || null,
      nominated_by: session.user.id,
      reason: root.querySelector('[name="reason"]').value.trim() || null,
    });

    ev.target.disabled = false;
    if (error) return toastError(error);
    toastOk("Η πρόταση καταχωρήθηκε");
    close();
    load();
  });
});

load();
