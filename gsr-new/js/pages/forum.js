/** Επισκόπηση forum: κατηγορίες με πλήθος threads και τελευταία δραστηριότητα. */

import { mountShell } from "../shell.js";
import { db, safe, countRows } from "../supabase-client.js";
import { esc, render, timeAgo, empty, skeletonCards } from "../ui.js";

await mountShell("forum");

const [threads, posts, members] = await Promise.all([
  countRows("forum_threads"),
  countRows("forum_posts"),
  countRows("profiles", (q) => q.eq("is_approved", true)),
]);

render(
  "#forum-stats",
  [
    [threads, "Συζητήσεις"],
    [posts, "Απαντήσεις"],
    [members, "Μέλη"],
  ]
    .map(
      ([value, label]) =>
        `<div class="hub-stat"><div class="hub-stat__value">${esc(value)}</div><div class="hub-stat__label">${esc(label)}</div></div>`,
    )
    .join(""),
);

render("#forum-cats", skeletonCards(4, 130));

const categories = (await safe(db.from("forum_categories").select("*").order("sort_order"), [])) || [];

if (!categories.length) {
  render("#forum-cats", `<div style="grid-column:1/-1">${empty("Δεν υπάρχουν κατηγορίες ακόμα.", "💬")}</div>`);
} else {
  const enriched = await Promise.all(
    categories.map(async (cat) => {
      const [count, last] = await Promise.all([
        countRows("forum_threads", (q) => q.eq("category_id", cat.id)),
        safe(
          db
            .from("forum_threads")
            .select("id, title, updated_at")
            .eq("category_id", cat.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ),
      ]);
      return { ...cat, count, last };
    }),
  );

  render(
    "#forum-cats",
    enriched
      .map(
        (cat) => `<a class="hub-card hub-card--hover hub-card--rail u-cut" href="forum-category.html?id=${encodeURIComponent(cat.id)}">
          <div class="u-row" style="gap:12px">
            <span class="hub-row-item__glyph" style="font-size:1.2rem">${esc(cat.icon || "💬")}</span>
            <div style="min-width:0;flex:1">
              <h3 style="font-size:1rem">${esc(cat.name)}</h3>
              <p class="u-small u-dim u-clamp-2">${esc(cat.description || "")}</p>
            </div>
            <span class="hub-badge hub-badge--brand">${cat.count}</span>
          </div>
          ${
            cat.last
              ? `<p class="u-tiny u-faint" style="margin-top:14px;padding-top:10px;border-top:1px solid hsl(var(--line-soft))">
                   Τελευταίο: <span class="u-truncate">${esc(cat.last.title)}</span> · ${timeAgo(cat.last.updated_at)} πριν
                 </p>`
              : '<p class="u-tiny u-faint" style="margin-top:14px">Καμία συζήτηση ακόμα</p>'
          }
        </a>`,
      )
      .join(""),
  );
}
