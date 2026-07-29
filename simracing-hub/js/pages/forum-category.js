/** Threads μιας κατηγορίας + δημιουργία νέας συζήτησης. */

import { mountShell } from "../shell.js";
import { session, authReady } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import {
  $, param, esc, render, timeAgo, empty, avatar, nameOf, byUserId, uniq,
  openModal, toastOk, toastError, toast,
} from "../ui.js";
import { editorHtml, attachEditor } from "../markdown.js";

await mountShell("forum");
await authReady();

const categoryId = param("id");

// Χωρίς `?id=` δεν έχει νόημα η σελίδα — γυρνάμε στο forum και σταματάμε εδώ
// (χωρίς το `return` το module θα συνέχιζε να τρέχει queries με null id).
if (!categoryId) location.replace("forum.html");

const category = categoryId
  ? await safe(db.from("forum_categories").select("*").eq("id", categoryId).maybeSingle())
  : null;

if (!categoryId) {
  // η πλοήγηση είναι σε εξέλιξη· δεν ζωγραφίζουμε τίποτα
} else if (!category) {
  $("#cat-title").textContent = "Η κατηγορία δεν βρέθηκε";
  render("#cat-threads", empty("Δοκίμασε από την αρχική του forum.", "🚧"));
} else {
  document.title = `${category.name} · Forum · Greek SimRacers`;
  $("#cat-title").innerHTML = `${esc(category.icon || "💬")} <span class="u-heat-text">${esc(category.name)}</span>`;
  $("#cat-desc").textContent = category.description || "";
  await loadThreads();
}

async function loadThreads() {
  render("#cat-threads", '<div class="hub-loading"><div class="hub-spinner"></div></div>');

  const threads =
    (await safe(
      db
        .from("forum_threads")
        .select("*, forum_posts(count)")
        .eq("category_id", categoryId)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false }),
      [],
    )) || [];

  if (!threads.length) {
    render("#cat-threads", empty("Καμία συζήτηση εδώ ακόμα. Ξεκίνα εσύ!", "💬"));
    return;
  }

  const profiles =
    (await safe(db.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", uniq(threads.map((t) => t.author_id))), [])) || [];
  const map = byUserId(profiles);

  render(
    "#cat-threads",
    threads
      .map((thread) => {
        const author = map.get(thread.author_id);
        const replies = thread.forum_posts?.[0]?.count ?? 0;
        return `<a class="hub-row-item" href="forum-thread.html?id=${encodeURIComponent(thread.id)}">
          ${avatar(author, "sm")}
          <div class="hub-row-item__body">
            <p class="hub-row-item__title">
              ${thread.pinned ? '<span class="hub-badge hub-badge--ember">📌</span> ' : ""}
              ${thread.locked ? '<span class="hub-badge hub-badge--warn">🔒</span> ' : ""}
              ${esc(thread.title)}
            </p>
            <p class="hub-row-item__meta"><span>${esc(nameOf(author))}</span><span>·</span><span>${timeAgo(thread.updated_at)} πριν</span></p>
          </div>
          <div class="hub-row-item__side"><span>💬 ${replies}</span><span>👁 ${thread.views || 0}</span></div>
        </a>`;
      })
      .join(""),
  );
}

/* ------------------------------------------------------- νέα συζήτηση ---- */

$("#cat-new").addEventListener("click", () => {
  if (!session.user) {
    toast("Χρειάζεται σύνδεση", { body: "Συνδέσου για να ανοίξεις συζήτηση.", tone: "bad" });
    return;
  }

  const { root, close } = openModal({
    title: "Νέα συζήτηση",
    wide: true,
    body: `<label class="hub-field"><span>Τίτλος</span><input class="hub-input" name="title" maxlength="160" placeholder="Τι θέλεις να συζητήσεις;" /></label>
      <div class="hub-field"><span class="hub-label">Μήνυμα</span>${editorHtml({ rows: 8, placeholder: "Γράψε το πρώτο μήνυμα…" })}</div>`,
    footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Άκυρο</button>
             <button class="hub-btn hub-btn--primary" type="button" data-save>Δημοσίευση</button>`,
  });

  attachEditor(root);

  root.querySelector("[data-save]").addEventListener("click", async (ev) => {
    const title = root.querySelector('[name="title"]').value.trim();
    const content = root.querySelector(".hub-editor__area").value.trim();
    if (!title || !content) {
      toastError(null, "Συμπλήρωσε τίτλο και μήνυμα.");
      return;
    }
    ev.target.disabled = true;

    const { data, error } = await db
      .from("forum_threads")
      .insert({ category_id: categoryId, author_id: session.user.id, title, content })
      .select()
      .single();

    ev.target.disabled = false;
    if (error) return toastError(error);

    toastOk("Η συζήτηση δημιουργήθηκε");
    close();
    location.href = `forum-thread.html?id=${encodeURIComponent(data.id)}`;
  });
});
