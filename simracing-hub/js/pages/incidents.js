/** Αναφορές περιστατικών: υποβολή και παρακολούθηση κατάστασης. */

import { mountShell } from "../shell.js";
import { requireUser } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import { $, esc, safeUrl, render, fmtDateTime, empty, openModal, toastOk, toastError } from "../ui.js";

await mountShell("incidents");
const user = await requireUser();

const STATUS = {
  pending: { label: "Σε εξέταση", badge: "hub-badge--warn" },
  reviewing: { label: "Υπό εξέταση", badge: "hub-badge--ice" },
  resolved: { label: "Επιλύθηκε", badge: "hub-badge--ok" },
  dismissed: { label: "Απορρίφθηκε", badge: "" },
};

let championships = [];

if (user) {
  championships = (await safe(db.from("championships").select("id, title").order("title"), [])) || [];
  await load();
}

async function load() {
  render("#inc-list", '<div class="hub-loading"><div class="hub-spinner"></div></div>');

  const rows =
    (await safe(
      db.from("incident_reports").select("*").eq("reporter_id", user.id).order("created_at", { ascending: false }),
      [],
    )) || [];

  if (!rows.length) {
    render("#inc-list", empty("Δεν έχεις υποβάλει αναφορές.", "⚠️"));
    return;
  }

  const champMap = new Map(championships.map((row) => [row.id, row.title]));

  render(
    "#inc-list",
    rows
      .map((row) => {
        const status = STATUS[row.status] || STATUS.pending;
        return `<article class="hub-card hub-card--rail">
          <div class="u-between">
            <div style="min-width:0">
              <h3 style="font-size:1rem">${esc(row.race_name || "Χωρίς τίτλο αγώνα")}</h3>
              <p class="u-tiny u-faint">${fmtDateTime(row.created_at)}${row.championship_id && champMap.has(row.championship_id) ? ` · ${esc(champMap.get(row.championship_id))}` : ""}</p>
            </div>
            <span class="hub-badge ${status.badge}">${esc(status.label)}</span>
          </div>

          ${row.drivers_involved?.length ? `<p class="u-small u-dim" style="margin-top:10px">👥 ${esc(row.drivers_involved.join(", "))}</p>` : ""}
          <p class="u-small" style="margin-top:10px;white-space:pre-wrap">${esc(row.description)}</p>
          ${row.video_url ? `<p style="margin-top:10px"><a class="u-small" href="${safeUrl(row.video_url)}" target="_blank" rel="noopener noreferrer">▶ Βίντεο</a></p>` : ""}
          ${row.admin_notes ? `<div class="hub-card" style="margin-top:12px;background:hsl(var(--surface-2))"><p class="u-tiny u-faint">Σχόλιο αγωνοδικών</p><p class="u-small" style="margin-top:4px">${esc(row.admin_notes)}</p></div>` : ""}
        </article>`;
      })
      .join(""),
  );
}

$("#inc-new").addEventListener("click", () => {
  const { root, close } = openModal({
    title: "Νέα αναφορά περιστατικού",
    body: `<label class="hub-field"><span>Πρωτάθλημα</span>
        <select class="hub-select" name="championship">
          <option value="">— Χωρίς πρωτάθλημα —</option>
          ${championships.map((row) => `<option value="${esc(row.id)}">${esc(row.title)}</option>`).join("")}
        </select>
      </label>
      <label class="hub-field"><span>Αγώνας</span><input class="hub-input" name="race" placeholder="π.χ. Round 4 — Monza" /></label>
      <label class="hub-field"><span>Εμπλεκόμενοι οδηγοί</span><input class="hub-input" name="drivers" placeholder="Χωρισμένοι με κόμμα" /></label>
      <label class="hub-field"><span>Περιγραφή *</span><textarea class="hub-textarea" name="description" rows="5" placeholder="Τι έγινε, σε ποιον γύρο, σε ποια στροφή…"></textarea></label>
      <label class="hub-field"><span>Βίντεο (URL)</span><input class="hub-input" name="video" placeholder="https://youtube.com/…" /></label>`,
    footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Άκυρο</button>
             <button class="hub-btn hub-btn--primary" type="button" data-save>Υποβολή</button>`,
  });

  root.querySelector("[data-save]").addEventListener("click", async (ev) => {
    const value = (name) => root.querySelector(`[name="${name}"]`).value.trim();
    if (!value("description")) return toastError(null, "Η περιγραφή είναι υποχρεωτική.");

    ev.target.disabled = true;
    const drivers = value("drivers")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const { error } = await db.from("incident_reports").insert({
      reporter_id: user.id,
      championship_id: value("championship") || null,
      race_name: value("race") || null,
      drivers_involved: drivers.length ? drivers : null,
      description: value("description"),
      video_url: value("video") || null,
      status: "pending",
    });

    ev.target.disabled = false;
    if (error) return toastError(error);
    toastOk("Η αναφορά υποβλήθηκε", "Οι αγωνοδίκες θα την εξετάσουν.");
    close();
    load();
  });
});
