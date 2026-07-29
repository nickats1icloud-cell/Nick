/** Συζήτηση: αρχικό μήνυμα, απαντήσεις, edit/delete, κλείδωμα από admin. */

import { mountShell } from "../shell.js";
import { session, authReady } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import {
  $, param, esc, timeAgo, empty, avatar, nameOf, byUserId, uniq, confirmAction, toastOk,
  toastError
} from "../ui.js";
import { renderMarkdown, editorHtml, attachEditor } from "../markdown.js";

await mountShell("forum");
await authReady();

const threadId = param("id");
const root = $("#thread-root");

if (!threadId) {
  root.innerHTML = empty("Δεν δόθηκε συζήτηση.", "💬", '<p style="margin-top:10px"><a href="forum.html">Πίσω στο forum →</a></p>');
} else {
  await load();
}

async function load() {
  root.innerHTML = '<div class="hub-loading"><div class="hub-spinner"></div></div>';

  const thread = await safe(
    db.from("forum_threads").select("*, forum_categories(id, name, icon)").eq("id", threadId).maybeSingle(),
  );

  if (!thread) {
    root.innerHTML = empty("Η συζήτηση δεν βρέθηκε.", "🚧", '<p style="margin-top:10px"><a href="forum.html">Πίσω στο forum →</a></p>');
    return;
  }

  document.title = `${thread.title} · Forum · Greek SimRacers`;
  safe(db.from("forum_threads").update({ views: (thread.views || 0) + 1 }).eq("id", threadId));

  const posts = (await safe(db.from("forum_posts").select("*").eq("thread_id", threadId).order("created_at"), [])) || [];
  const profiles =
    (await safe(
      db
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", uniq([thread.author_id, ...posts.map((p) => p.author_id)])),
      [],
    )) || [];
  const map = byUserId(profiles);
  const author = map.get(thread.author_id);
  const canEditThread = session.user?.id === thread.author_id || session.isAdmin;

  root.innerHTML = `
    <p>
      <a class="u-small u-dim" href="forum.html">Forum</a>
      ${thread.forum_categories ? ` <span class="u-faint">/</span> <a class="u-small u-dim" href="forum-category.html?id=${encodeURIComponent(thread.forum_categories.id)}">${esc(thread.forum_categories.name)}</a>` : ""}
    </p>

    <article class="hub-card hub-card--rail" style="margin-top:18px" id="thread-op">
      <div class="u-row u-row--wrap">
        <a class="u-row" href="profile.html?u=${encodeURIComponent(thread.author_id)}" style="gap:9px;color:inherit">
          ${avatar(author, "sm")}<span class="u-small">${esc(nameOf(author))}</span>
        </a>
        <span class="u-tiny u-faint">${timeAgo(thread.created_at)} πριν</span>
        <span class="u-spacer"></span>
        ${thread.pinned ? '<span class="hub-badge hub-badge--brand">📌 Pinned</span>' : ""}
        ${thread.locked ? '<span class="hub-badge hub-badge--warn">🔒 Κλειδωμένο</span>' : ""}
        ${canEditThread ? '<button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-tedit>✎</button><button class="hub-btn hub-btn--sm hub-btn--danger" type="button" data-tdel>🗑</button>' : ""}
      </div>
      <h1 style="font-size:1.6rem;margin-top:14px" data-ttitle>${esc(thread.title)}</h1>
      <div class="hub-prose" style="margin-top:14px" data-tbody>${renderMarkdown(thread.content)}</div>
      <p class="u-tiny u-faint" style="margin-top:16px">👁 ${thread.views || 0} προβολές · 💬 ${posts.length} απαντήσεις</p>
    </article>

    <h2 style="font-size:1.05rem;margin:26px 0 14px">Απαντήσεις <span class="u-faint">(${posts.length})</span></h2>
    <div class="u-stack" style="--gap:10px" id="thread-posts">
      ${
        posts.length
          ? posts
              .map((post) => {
                const poster = map.get(post.author_id);
                const mine = session.user?.id === post.author_id || session.isAdmin;
                return `<article class="hub-card" data-post="${esc(post.id)}">
                  <div class="u-row">
                    <a class="u-row" href="profile.html?u=${encodeURIComponent(post.author_id)}" style="gap:8px;color:inherit">
                      ${avatar(poster, "sm")}<span class="u-small">${esc(nameOf(poster))}</span>
                    </a>
                    <span class="u-tiny u-faint">${timeAgo(post.created_at)} πριν</span>
                    <span class="u-spacer"></span>
                    ${mine ? `<button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-pedit="${esc(post.id)}">✎</button><button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-pdel="${esc(post.id)}">🗑</button>` : ""}
                  </div>
                  <div class="hub-prose" style="margin-top:10px" data-pbody data-raw="${esc(post.content)}">${renderMarkdown(post.content)}</div>
                </article>`;
              })
              .join("")
          : empty("Καμία απάντηση ακόμα.", "💬")
      }
    </div>

    ${
      thread.locked
        ? '<p class="hub-empty" style="margin-top:20px">🔒 Η συζήτηση είναι κλειδωμένη.</p>'
        : session.user
          ? `<form class="hub-card" id="reply-form" style="margin-top:20px">
               <p class="hub-label">Απάντηση</p>
               ${editorHtml({ rows: 5, placeholder: "Γράψε την απάντησή σου…" })}
               <div class="u-row" style="justify-content:flex-end;margin-top:12px">
                 <button class="hub-btn hub-btn--primary" type="submit">Δημοσίευση</button>
               </div>
             </form>`
          : '<p class="u-small u-dim" style="margin-top:20px"><a href="auth.html">Συνδέσου</a> για να απαντήσεις.</p>'
    }`;

  const replyForm = $("#reply-form");
  if (replyForm) {
    attachEditor(replyForm);
    replyForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const area = replyForm.querySelector(".hub-editor__area");
      const content = area.value.trim();
      if (!content) return;

      const button = replyForm.querySelector('[type="submit"]');
      button.disabled = true;
      const { error } = await db.from("forum_posts").insert({ thread_id: threadId, author_id: session.user.id, content });
      button.disabled = false;
      if (error) return toastError(error);

      // Ανεβάζουμε τη συζήτηση στην κορυφή της κατηγορίας.
      safe(db.from("forum_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId));
      load();
    });
  }

  wireModeration(thread);
}

function wireModeration(thread) {
  root.querySelector("[data-tdel]")?.addEventListener("click", async () => {
    if (!(await confirmAction("Να διαγραφεί η συζήτηση και όλες οι απαντήσεις;"))) return;
    const { error } = await db.from("forum_threads").delete().eq("id", threadId);
    if (error) return toastError(error);
    toastOk("Η συζήτηση διαγράφηκε");
    location.href = thread.forum_categories ? `forum-category.html?id=${encodeURIComponent(thread.forum_categories.id)}` : "forum.html";
  });

  root.querySelector("[data-tedit]")?.addEventListener("click", () => {
    const card = $("#thread-op");
    const title = card.querySelector("[data-ttitle]");
    const body = card.querySelector("[data-tbody]");
    title.outerHTML = `<input class="hub-input" data-ttitle-input value="${esc(thread.title)}" style="margin-top:14px;font-size:1.1rem" />`;
    body.outerHTML = `<div data-tbody-edit style="margin-top:12px">${editorHtml({ value: thread.content, rows: 8 })}
      <div class="u-row" style="justify-content:flex-end;margin-top:10px">
        <button class="hub-btn hub-btn--ghost hub-btn--sm" type="button" data-tcancel>Άκυρο</button>
        <button class="hub-btn hub-btn--primary hub-btn--sm" type="button" data-tsave>Αποθήκευση</button>
      </div></div>`;
    attachEditor(card);

    card.querySelector("[data-tcancel]").addEventListener("click", load);
    card.querySelector("[data-tsave]").addEventListener("click", async (ev) => {
      ev.target.disabled = true;
      const { error } = await db
        .from("forum_threads")
        .update({
          title: card.querySelector("[data-ttitle-input]").value.trim(),
          content: card.querySelector(".hub-editor__area").value.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", threadId);
      if (error) {
        ev.target.disabled = false;
        return toastError(error);
      }
      toastOk("Αποθηκεύτηκε");
      load();
    });
  });

  const posts = $("#thread-posts");
  posts?.addEventListener("click", async (ev) => {
    const del = ev.target.closest("[data-pdel]");
    if (del) {
      if (!(await confirmAction("Να διαγραφεί η απάντηση;"))) return;
      await safe(db.from("forum_posts").delete().eq("id", del.dataset.pdel));
      load();
      return;
    }

    const edit = ev.target.closest("[data-pedit]");
    if (edit) {
      const card = edit.closest("[data-post]");
      const body = card.querySelector("[data-pbody]");
      const raw = body.dataset.raw;
      body.innerHTML = `${editorHtml({ value: raw, rows: 5 })}
        <div class="u-row" style="justify-content:flex-end;margin-top:8px">
          <button class="hub-btn hub-btn--sm hub-btn--primary" type="button" data-psave="${esc(edit.dataset.pedit)}">Αποθήκευση</button>
        </div>`;
      attachEditor(card);
      return;
    }

    const save = ev.target.closest("[data-psave]");
    if (save) {
      const value = save.closest("[data-pbody]").querySelector(".hub-editor__area").value.trim();
      if (!value) return;
      await safe(db.from("forum_posts").update({ content: value }).eq("id", save.dataset.psave));
      load();
    }
  });
}
