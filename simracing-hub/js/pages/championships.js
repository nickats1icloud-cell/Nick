/** Πρωταθλήματα με φίλτρο κατάστασης. */

import { mountShell } from "../shell.js";
import { db, safe } from "../supabase-client.js";
import { $, $$, esc, safeUrl, render, fmtDate, empty, skeletonCards } from "../ui.js";

await mountShell("championships");

const STATUS = {
  active: { label: "Ενεργό", badge: "hub-badge--ok" },
  upcoming: { label: "Ερχόμενο", badge: "hub-badge--ice" },
  completed: { label: "Ολοκληρωμένο", badge: "" },
};

let rows = [];
let filter = "all";

render("#champ-list", skeletonCards(3, 180));

rows = (await safe(db.from("championships").select("*").order("created_at", { ascending: false }), [])) || [];
paint();

$("#champ-filters").addEventListener("click", (ev) => {
  const chip = ev.target.closest("[data-filter]");
  if (!chip) return;
  filter = chip.dataset.filter;
  $$("#champ-filters .hub-chip").forEach((node) => node.classList.toggle("is-active", node === chip));
  paint();
});

function paint() {
  const list = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  if (!list.length) {
    render("#champ-list", empty("Δεν υπάρχουν πρωταθλήματα σε αυτή την κατηγορία.", "🏆"));
    return;
  }

  render(
    "#champ-list",
    list
      .map((row) => {
        const status = STATUS[row.status] || STATUS.upcoming;
        const progress = row.races_total > 0 ? Math.min((row.races_completed / row.races_total) * 100, 100) : 0;
        const image = safeUrl(row.image_url);
        return `<article class="champ">
          <div class="champ__media">
            ${image ? `<img src="${image}" alt="" loading="lazy" />` : '<span style="font-size:2.4rem;opacity:0.3">🏆</span>'}
            <div class="champ__badges">
              <span class="hub-badge ${status.badge}">${esc(status.label)}</span>
              <span class="hub-badge">${esc(row.category || "—")}</span>
            </div>
          </div>
          <div class="champ__body">
            <h2 style="font-size:1.15rem">${esc(row.title)}</h2>
            <p class="u-small u-dim">${esc(row.description || "")}</p>
            <div class="u-row u-row--wrap u-small u-faint" style="gap:16px">
              <span>🏁 Αγώνες ${row.races_completed}/${row.races_total}</span>
              <span>👥 ${row.participants} οδηγοί</span>
              ${row.start_date ? `<span>📅 ${fmtDate(row.start_date, { month: "short", year: "numeric" })}</span>` : ""}
            </div>
            <div class="hub-progress"><span style="width:${progress}%"></span></div>
          </div>
        </article>`;
      })
      .join(""),
  );
}
