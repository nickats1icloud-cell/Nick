/** Προβολή άρθρου: περιεχόμενο, likes, σχόλια, edit/delete για τον συγγραφέα. */

import { mountShell } from "../shell.js";
import { session, authReady } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import {
  $, param, esc, safeUrl, avatar, nameOf, fmtDate, timeAgo, empty, byUserId, uniq,
  openModal, confirmAction, toastOk, toastError, toast
} from "../ui.js";
import { renderMarkdown, editorHtml, attachEditor } from "../markdown.js";

await mountShell("articles");
await authReady();

const id = param("id");
const root = $("#art-root");

if (!id) {
  root.innerHTML = empty("Δεν δόθηκε άρθρο.", "📰", '<p style="margin-top:10px"><a href="articles.html">Πίσω στα άρθρα →</a></p>');
} else {
  await load();
}

async function load() {
  root.innerHTML = '<div class="hub-loading"><div class="hub-spinner"></div></div>';

  const article = await safe(
    db.from("articles").select("*, article_categories(name)").eq("id", id).maybeSingle(),
  );

  if (!article) {
    root.innerHTML = empty("Το άρθρο δεν βρέθηκε.", "🚧", '<p style="margin-top:10px"><a href="articles.html">Πίσω στα άρθρα →</a></p>');
    return;
  }

  // Μετρητής προβολών (best-effort — μπορεί να μπλοκάρει το RLS).
  safe(db.from("articles").update({ views: (article.views || 0) + 1 }).eq("id", id));

  const author = await safe(
    db.from("profiles").select("user_id, display_name, username, avatar_url").eq("user_id", article.author_id).maybeSingle(),
  );

  const likes = (await safe(db.from("article_likes").select("user_id").eq("article_id", id), [])) || [];
  const liked = session.user ? likes.some((row) => row.user_id === session.user.id) : false;
  const isAuthor = session.user?.id === article.author_id;
  const canModerate = isAuthor || session.isAdmin;

  root.innerHTML = `
    <p><a class="u-small u-dim" href="articles.html">← Πίσω στα άρθρα</a></p>

    <header style="margin:18px 0 22px">
      <div class="u-row u-row--wrap" style="gap:6px">
        ${article.pinned ? '<span class="hub-badge hub-badge--ember">📌 Pinned</span>' : ""}
        ${article.article_categories ? `<span class="hub-badge">${esc(article.article_categories.name)}</span>` : ""}
        ${article.published ? "" : '<span class="hub-badge hub-badge--warn">Πρόχειρο</span>'}
      </div>
      <h1 style="margin-top:12px">${esc(article.title)}</h1>
      <div class="u-row u-row--wrap" style="margin-top:16px;gap:12px">
        <a class="u-row" href="profile.html?u=${encodeURIComponent(article.author_id)}" style="gap:9px;color:inherit">
          ${avatar(author, "sm")}<span class="u-small">${esc(nameOf(author))}</span>
        </a>
        <span class="u-tiny u-faint">${fmtDate(article.created_at)}</span>
        <span class="u-tiny u-faint">👁 ${article.views || 0}</span>
        <span class="u-spacer"></span>
        ${canModerate ? '<button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-edit>Επεξεργασία</button><button class="hub-btn hub-btn--sm hub-btn--danger" type="button" data-delete>Διαγραφή</button>' : ""}
      </div>
    </header>

    ${article.cover_url ? `<img src="${safeUrl(article.cover_url)}" alt="" style="width:100%;border-radius:var(--r-md);margin-bottom:24px" />` : ""}

    <div class="hub-prose">${renderMarkdown(article.content)}</div>

    <div class="u-row" style="margin:28px 0;padding-top:18px;border-top:1px solid hsl(var(--line-soft))">
      <button class="hub-btn ${liked ? "hub-btn--primary" : "hub-btn--ghost"}" type="button" data-like>
        ${liked ? "❤️" : "🤍"} <span data-like-count>${likes.length}</span>
      </button>
    </div>

    <section id="comments"></section>`;

  root.querySelector("[data-like]")?.addEventListener("click", async (ev) => {
    if (!session.user) {
      toast("Χρειάζεται σύνδεση", { body: "Συνδέσου για να κάνεις like.", tone: "bad" });
      return;
    }
    const button = ev.currentTarget;
    const counter = button.querySelector("[data-like-count]");
    const on = button.classList.contains("hub-btn--primary");

    button.classList.toggle("hub-btn--primary", !on);
    button.classList.toggle("hub-btn--ghost", on);
    button.firstChild.textContent = on ? "🤍 " : "❤️ ";
    counter.textContent = String(Math.max(Number(counter.textContent) + (on ? -1 : 1), 0));

    if (on) await safe(db.from("article_likes").delete().eq("article_id", id).eq("user_id", session.user.id));
    else await safe(db.from("article_likes").insert({ article_id: id, user_id: session.user.id }));
  });

  root.querySelector("[data-delete]")?.addEventListener("click", async () => {
    if (!(await confirmAction("Να διαγραφεί οριστικά αυτό το άρθρο;"))) return;
    const { error } = await db.from("articles").delete().eq("id", id);
    if (error) return toastError(error);
    toastOk("Το άρθρο διαγράφηκε");
    location.href = "articles.html";
  });

  root.querySelector("[data-edit]")?.addEventListener("click", () => openEditor(article));

  loadComments();
}

/* -------------------------------------------------------------- σχόλια ---- */

async function loadComments() {
  const host = $("#comments");
  host.innerHTML = '<div class="hub-loading"><div class="hub-spinner"></div></div>';

  const rows = (await safe(db.from("article_comments").select("*").eq("article_id", id).order("created_at"), [])) || [];
  const profiles =
    (await safe(db.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", uniq(rows.map((r) => r.author_id))), [])) || [];
  const map = byUserId(profiles);

  host.innerHTML = `
    <h2 style="font-size:1.1rem;margin-bottom:16px">Σχόλια <span class="u-faint">(${rows.length})</span></h2>

    ${
      session.user
        ? `<form id="comment-form" class="hub-card" style="margin-bottom:18px">
             <textarea class="hub-textarea" name="content" rows="3" placeholder="Γράψε ένα σχόλιο…" maxlength="2000"></textarea>
             <div class="u-row" style="justify-content:flex-end;margin-top:10px">
               <button class="hub-btn hub-btn--primary hub-btn--sm" type="submit">Σχολιασμός</button>
             </div>
           </form>`
        : `<p class="u-small u-dim" style="margin-bottom:18px"><a href="auth.html">Συνδέσου</a> για να σχολιάσεις.</p>`
    }

    <div class="u-stack" style="--gap:10px">
      ${
        rows.length
          ? rows
              .map((comment) => {
                const author = map.get(comment.author_id);
                const mine = session.user?.id === comment.author_id;
                return `<div class="hub-card" data-comment="${esc(comment.id)}">
                  <div class="u-row">
                    <a class="u-row" href="profile.html?u=${encodeURIComponent(comment.author_id)}" style="gap:8px;color:inherit">
                      ${avatar(author, "sm")}<span class="u-small">${esc(nameOf(author))}</span>
                    </a>
                    <span class="u-tiny u-faint">${timeAgo(comment.created_at)} πριν</span>
                    <span class="u-spacer"></span>
                    ${mine || session.isAdmin ? `<button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-cedit="${esc(comment.id)}">✎</button><button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-cdel="${esc(comment.id)}">🗑</button>` : ""}
                  </div>
                  <p class="u-small" style="margin-top:10px;white-space:pre-wrap" data-cbody>${esc(comment.content)}</p>
                </div>`;
              })
              .join("")
          : empty("Κανένα σχόλιο ακόμα. Γίνε ο πρώτος!", "💬")
      }
    </div>`;

  host.querySelector("#comment-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const area = ev.target.elements.content;
    const content = area.value.trim();
    if (!content) return;
    const { error } = await db.from("article_comments").insert({ article_id: id, author_id: session.user.id, content });
    if (error) return toastError(error);
    area.value = "";
    loadComments();
  });

  host.addEventListener("click", async (ev) => {
    const del = ev.target.closest("[data-cdel]");
    if (del) {
      if (!(await confirmAction("Να διαγραφεί το σχόλιο;"))) return;
      await safe(db.from("article_comments").delete().eq("id", del.dataset.cdel));
      loadComments();
      return;
    }

    const edit = ev.target.closest("[data-cedit]");
    if (edit) {
      const card = edit.closest("[data-comment]");
      const body = card.querySelector("[data-cbody]");
      const current = body.textContent;
      body.innerHTML = `<textarea class="hub-textarea" rows="3">${esc(current)}</textarea>
        <div class="u-row" style="justify-content:flex-end;margin-top:8px">
          <button class="hub-btn hub-btn--sm hub-btn--primary" type="button" data-csave="${esc(edit.dataset.cedit)}">Αποθήκευση</button>
        </div>`;
      return;
    }

    const save = ev.target.closest("[data-csave]");
    if (save) {
      const value = save.closest("[data-cbody]").querySelector("textarea").value.trim();
      if (!value) return;
      await safe(db.from("article_comments").update({ content: value }).eq("id", save.dataset.csave));
      loadComments();
    }
  });
}

/* ------------------------------------------------------- επεξεργασία ---- */

async function openEditor(article) {
  const categories = (await safe(db.from("article_categories").select("id, name").order("name"), [])) || [];

  const { root: modal, close } = openModal({
    title: "Επεξεργασία άρθρου",
    wide: true,
    body: `<label class="hub-field"><span>Τίτλος</span><input class="hub-input" name="title" value="${esc(article.title)}" /></label>
      <label class="hub-field"><span>Κατηγορία</span>
        <select class="hub-select" name="category">
          <option value="">— Χωρίς κατηγορία —</option>
          ${categories.map((cat) => `<option value="${esc(cat.id)}" ${cat.id === article.category_id ? "selected" : ""}>${esc(cat.name)}</option>`).join("")}
        </select>
      </label>
      <label class="hub-field"><span>Εικόνα εξωφύλλου (URL)</span><input class="hub-input" name="cover" value="${esc(article.cover_url || "")}" /></label>
      <div class="hub-field"><span class="hub-label">Περιεχόμενο</span>${editorHtml({ value: article.content, rows: 12 })}</div>`,
    footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Άκυρο</button>
             <button class="hub-btn hub-btn--primary" type="button" data-save>Αποθήκευση</button>`,
  });

  attachEditor(modal);

  modal.querySelector("[data-save]").addEventListener("click", async (ev) => {
    ev.target.disabled = true;
    const { error } = await db
      .from("articles")
      .update({
        title: modal.querySelector('[name="title"]').value.trim(),
        content: modal.querySelector(".hub-editor__area").value.trim(),
        category_id: modal.querySelector('[name="category"]').value || null,
        cover_url: modal.querySelector('[name="cover"]').value.trim() || null,
      })
      .eq("id", article.id);
    ev.target.disabled = false;
    if (error) return toastError(error);
    toastOk("Αποθηκεύτηκε");
    close();
    load();
  });
}
