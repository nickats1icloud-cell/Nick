/** Ειδοποιήσεις: ανάγνωση, διαγραφή, αποδοχή/απόρριψη αιτημάτων follow. */

import { mountShell } from "../shell.js";
import { requireUser } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import { $, esc, safeUrl, render, empty, fmtDateTime, confirmAction, toastOk } from "../ui.js";

await mountShell("");
const user = await requireUser();

if (user) {
  await load();

  $("#notif-read-all").addEventListener("click", async () => {
    await safe(db.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false));
    toastOk("Όλα σημάνθηκαν ως διαβασμένα");
    load();
  });

  $("#notif-clear").addEventListener("click", async () => {
    if (!(await confirmAction("Να διαγραφούν όλες οι ειδοποιήσεις;"))) return;
    await safe(db.from("notifications").delete().eq("user_id", user.id));
    toastOk("Καθαρίστηκαν");
    load();
  });
}

const ICONS = {
  follow_request: "👥",
  follow: "👥",
  comment: "💬",
  reply: "💬",
  like: "❤️",
  badge: "🎖",
  system: "📣",
};

async function load() {
  render("#notif-list", '<div class="hub-loading"><div class="hub-spinner"></div></div>');

  const rows =
    (await safe(
      db.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      [],
    )) || [];

  if (!rows.length) {
    render("#notif-list", empty("Καμία ειδοποίηση.", "🔔"));
    return;
  }

  render(
    "#notif-list",
    rows
      .map(
        (row) => `<article class="hub-row-item ${row.read ? "" : "hub-card--rail"}" data-notif="${esc(row.id)}" style="${row.read ? "" : "background:hsl(var(--brand)/0.06)"}">
          <span class="hub-row-item__glyph">${ICONS[row.type] || "🔔"}</span>
          <div class="hub-row-item__body">
            <p class="hub-row-item__title">${esc(row.title)}</p>
            ${row.message ? `<p class="u-small u-dim">${esc(row.message)}</p>` : ""}
            <p class="hub-row-item__meta">${fmtDateTime(row.created_at)}</p>
            ${
              row.type === "follow_request" && row.from_user_id
                ? `<div class="u-row" style="margin-top:8px">
                     <button class="hub-btn hub-btn--sm hub-btn--primary" type="button" data-accept="${esc(row.from_user_id)}" data-nid="${esc(row.id)}">Αποδοχή</button>
                     <button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-reject="${esc(row.from_user_id)}" data-nid="${esc(row.id)}">Απόρριψη</button>
                   </div>`
                : ""
            }
          </div>
          <div class="u-row" style="flex:none">
            ${row.link ? `<a class="hub-btn hub-btn--sm hub-btn--ghost" href="${safeUrl(row.link)}">Άνοιγμα</a>` : ""}
            <button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-del="${esc(row.id)}">🗑</button>
          </div>
        </article>`,
      )
      .join(""),
  );
}

$("#notif-list").addEventListener("click", async (ev) => {
  const del = ev.target.closest("[data-del]");
  if (del) {
    await safe(db.from("notifications").delete().eq("id", del.dataset.del));
    load();
    return;
  }

  const accept = ev.target.closest("[data-accept]");
  if (accept) {
    const request = await safe(
      db
        .from("follows")
        .select("id")
        .eq("follower_id", accept.dataset.accept)
        .eq("following_id", user.id)
        .eq("status", "pending")
        .maybeSingle(),
    );
    if (request) await safe(db.from("follows").update({ status: "accepted" }).eq("id", request.id));
    await safe(db.from("notifications").update({ read: true }).eq("id", accept.dataset.nid));
    toastOk("Το αίτημα έγινε δεκτό");
    load();
    return;
  }

  const reject = ev.target.closest("[data-reject]");
  if (reject) {
    await safe(
      db
        .from("follows")
        .delete()
        .eq("follower_id", reject.dataset.reject)
        .eq("following_id", user.id)
        .eq("status", "pending"),
    );
    await safe(db.from("notifications").update({ read: true }).eq("id", reject.dataset.nid));
    toastOk("Το αίτημα απορρίφθηκε");
    load();
  }
});
