/** Λίστα άρθρων με φίλτρο κατηγορίας, αναζήτηση, likes και δημιουργία. */

import { mountShell } from "../shell.js";
import { session, onAuth } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import {
  $, $$, esc, safeUrl, render, avatar, nameOf, fmtDate, empty, skeletonCards,
  byUserId, uniq, debounce, openModal, toastOk, toastError, toast,
} from "../ui.js";
import { stripMarkdown, editorHtml, attachEditor } from "../markdown.js";

await mountShell("articles");

const state = { category: "", search: "", articles: [], likes: new Set() };

/* ------------------------------------------------------------ κατηγορίες ---- */

const categories = (await safe(db.from("article_categories").select("*").order("name"), [])) || [];

render(
  "#art-cats",
  [`<button class="hub-chip is-active" data-cat="" type="button">Όλα</button>`]
    .concat(categories.map((cat) => `<button class="hub-chip" data-cat="${esc(cat.id)}" type="button">${esc(cat.name)}</button>`))
    .join(""),
);

$("#art-cats").addEventListener("click", (ev) => {
  const chip = ev.target.closest("[data-cat]");
  if (!chip) return;
  state.category = chip.dataset.cat;
  $$("#art-cats .hub-chip").forEach((node) => node.classList.toggle("is-active", node === chip));
  paint();
});

$("#art-search").addEventListener("input", debounce((ev) => {
  state.search = ev.target.value.trim().toLowerCase();
  paint();
}, 200));

/* ---------------------------------------------------------------- λίστα ---- */

async function load() {
  render("#art-list", skeletonCards(6, 220));

  const rows =
    (await safe(
      db
        .from("articles")
        .select("*, article_categories(name, color), article_likes(count), article_comments(count)")
        .eq("published", true)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      [],
    )) || [];

  const authors = (await safe(db.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", uniq(rows.map((r) => r.author_id))), [])) || [];
  const map = byUserId(authors);
  state.articles = rows.map((row) => ({ ...row, author: map.get(row.author_id) }));

  if (session.user) {
    const mine = (await safe(db.from("article_likes").select("article_id").eq("user_id", session.user.id), [])) || [];
    state.likes = new Set(mine.map((row) => row.article_id));
  }

  paint();
}

function paint() {
  const list = state.articles.filter((article) => {
    if (state.category && article.category_id !== state.category) return false;
    if (!state.search) return true;
    return (
      article.title.toLowerCase().includes(state.search) ||
      String(article.content || "").toLowerCase().includes(state.search)
    );
  });

  if (!list.length) {
    render("#art-list", `<div style="grid-column:1/-1">${empty("Δεν βρέθηκαν άρθρα.", "📰")}</div>`);
    return;
  }

  render(
    "#art-list",
    list
      .map((article) => {
        const likes = article.article_likes?.[0]?.count ?? 0;
        const comments = article.article_comments?.[0]?.count ?? 0;
        const liked = state.likes.has(article.id);
        const cover = safeUrl(article.cover_url);
        return `<article class="hub-card hub-card--hover hub-card--pad-0 u-cut" style="display:flex;flex-direction:column">
          ${cover ? `<a href="article.html?id=${encodeURIComponent(article.id)}"><img src="${cover}" alt="" loading="lazy" style="width:100%;height:150px;object-fit:cover" /></a>` : ""}
          <div style="padding:16px;display:flex;flex-direction:column;gap:8px;flex:1">
            <div class="u-row u-row--wrap" style="gap:6px">
              ${article.pinned ? '<span class="hub-badge hub-badge--ember">📌 Pinned</span>' : ""}
              ${article.article_categories ? `<span class="hub-badge">${esc(article.article_categories.name)}</span>` : ""}
            </div>
            <h3 style="font-size:1rem"><a href="article.html?id=${encodeURIComponent(article.id)}" style="color:inherit">${esc(article.title)}</a></h3>
            <p class="u-small u-dim u-clamp-3">${esc(stripMarkdown(article.content, 150))}</p>
            <div class="u-row" style="margin-top:auto;padding-top:10px;border-top:1px solid hsl(var(--line-soft))">
              <a class="u-row" href="profile.html?u=${encodeURIComponent(article.author_id)}" style="gap:8px;color:inherit;min-width:0">
                ${avatar(article.author, "xs")}
                <span class="u-tiny u-truncate">${esc(nameOf(article.author))}</span>
              </a>
              <span class="u-spacer"></span>
              <button type="button" class="hub-btn hub-btn--sm hub-btn--ghost" data-like="${esc(article.id)}" style="${liked ? "color:hsl(var(--ember));border-color:hsl(var(--ember)/0.5)" : ""}">${liked ? "❤️" : "🤍"} ${likes}</button>
              <span class="u-tiny u-faint">💬 ${comments}</span>
              <span class="u-tiny u-faint">👁 ${article.views || 0}</span>
            </div>
            <p class="u-tiny u-faint">${fmtDate(article.created_at)}</p>
          </div>
        </article>`;
      })
      .join(""),
  );
}

/* ---------------------------------------------------------------- likes ---- */

$("#art-list").addEventListener("click", async (ev) => {
  const button = ev.target.closest("[data-like]");
  if (!button) return;
  if (!session.user) {
    toast("Χρειάζεται σύνδεση", { body: "Συνδέσου για να κάνεις like.", tone: "bad" });
    return;
  }
  const id = button.dataset.like;
  const liked = state.likes.has(id);

  if (liked) {
    state.likes.delete(id);
    await safe(db.from("article_likes").delete().eq("article_id", id).eq("user_id", session.user.id));
  } else {
    state.likes.add(id);
    await safe(db.from("article_likes").insert({ article_id: id, user_id: session.user.id }));
  }

  const article = state.articles.find((row) => row.id === id);
  if (article) {
    const current = article.article_likes?.[0]?.count ?? 0;
    article.article_likes = [{ count: Math.max(current + (liked ? -1 : 1), 0) }];
  }
  paint();
});

/* ------------------------------------------------------------ νέο άρθρο ---- */

onAuth((next) => {
  const button = $("#art-new");
  if (button) button.hidden = !next.user;
});

$("#art-new").addEventListener("click", () => {
  const { root, close } = openModal({
    title: "Νέο άρθρο",
    wide: true,
    body: `<label class="hub-field"><span>Τίτλος</span><input class="hub-input" name="title" maxlength="160" /></label>
      <label class="hub-field"><span>Κατηγορία</span>
        <select class="hub-select" name="category">
          <option value="">— Χωρίς κατηγορία —</option>
          ${categories.map((cat) => `<option value="${esc(cat.id)}">${esc(cat.name)}</option>`).join("")}
        </select>
      </label>
      <label class="hub-field"><span>Εικόνα εξωφύλλου (URL)</span><input class="hub-input" name="cover" placeholder="https://…" /></label>
      <div class="hub-field"><span class="hub-label">Περιεχόμενο (markdown)</span>${editorHtml({ placeholder: "Γράψε το άρθρο σου…", rows: 12 })}</div>`,
    footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Άκυρο</button>
             <button class="hub-btn hub-btn--primary" type="button" data-save>Δημοσίευση</button>`,
  });

  attachEditor(root);

  root.querySelector("[data-save]").addEventListener("click", async (ev) => {
    const title = root.querySelector('[name="title"]').value.trim();
    const content = root.querySelector(".hub-editor__area").value.trim();
    if (!title || !content) {
      toastError(null, "Ο τίτλος και το περιεχόμενο είναι υποχρεωτικά.");
      return;
    }
    ev.target.disabled = true;

    const { error } = await db.from("articles").insert({
      title,
      content,
      author_id: session.user.id,
      category_id: root.querySelector('[name="category"]').value || null,
      cover_url: root.querySelector('[name="cover"]').value.trim() || null,
      published: true,
    });

    ev.target.disabled = false;
    if (error) {
      toastError(error);
      return;
    }
    toastOk("Το άρθρο δημοσιεύτηκε");
    close();
    load();
  });
});

load();
