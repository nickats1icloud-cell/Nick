/**
 * Αρχική σελίδα: hero με ζωντανά στατιστικά, τελευταία πρωταθλήματα,
 * podcasts, τελευταίες συζητήσεις και Discord widget.
 */

import { mountShell } from "../shell.js";
import { onAuth, settings, loadSettings } from "../auth.js";
import { db, safe, countRows } from "../supabase-client.js";
import { particleField } from "../fx.js";
import { $, $$, esc, safeUrl, timeAgo, render, empty, spinner, skeletonCards } from "../ui.js";

await mountShell("home");
particleField($("#hero-canvas"), { count: 40 });

/* ------------------------------------------------------------------ CTA ---- */

onAuth((state) => {
  const actions = $("#hero-actions");
  const join = $("#home-join");
  if (!actions) return;
  const first = actions.firstElementChild;
  if (state.user) {
    first.textContent = "Το προφίλ μου";
    first.href = "profile.html";
    if (join) join.style.display = "none";
  } else {
    first.textContent = "Γίνε μέλος";
    first.href = "auth.html";
    if (join) join.style.display = "";
  }
});

/* ----------------------------------------------------------- στατιστικά ---- */

async function loadStats() {
  const [members, threads, posts, episodes, champs] = await Promise.all([
    countRows("profiles", (q) => q.eq("is_approved", true)),
    countRows("forum_threads"),
    countRows("forum_posts"),
    countRows("podcast_episodes", (q) => q.eq("published", true)),
    countRows("championships"),
  ]);

  const stats = [
    [members || "1.000+", "Μέλη"],
    [threads, "Συζητήσεις"],
    [episodes, "Επεισόδια"],
  ];
  render(
    "#hero-stats",
    stats
      .map(
        ([value, label]) =>
          `<div class="hub-stat"><div class="hub-stat__value">${esc(value)}</div><div class="hub-stat__label">${esc(label)}</div></div>`,
      )
      .join(""),
  );

  // «Τηλεμετρία»: μπάρες με σχετικές τιμές, καθαρά διακοσμητικές
  const max = Math.max(members, threads, posts, champs, 1);
  const bars = [
    ["Μέλη", members, ""],
    ["Threads", threads, ""],
    ["Απαντήσεις", posts, "hero__bar--ice"],
    ["Πρωταθλήματα", champs, "hero__bar--ice"],
  ];
  render(
    "#hero-telemetry",
    bars
      .map(
        ([label, value, cls]) => `<div class="hero__gauge">
          <div class="hero__gauge-row"><span>${esc(label)}</span><span>${esc(value)}</span></div>
          <div class="hero__bar ${cls}"><span style="width:${Math.max((value / max) * 100, 4)}%"></span></div>
        </div>`,
      )
      .join(""),
  );

  // Φωτάκια εκκίνησης που ανάβουν διαδοχικά
  const lights = $$("#hero-lights i");
  lights.forEach((light, index) => setTimeout(() => light.classList.add("on"), 400 + index * 180));
  setTimeout(() => lights.forEach((light) => light.classList.remove("on")), 400 + lights.length * 180 + 900);
}

/* --------------------------------------------------------- πρωταθλήματα ---- */

async function loadChampionships() {
  render("#home-champs", `<div class="u-grid u-grid--3">${skeletonCards(3, 120)}</div>`);
  const rows =
    (await safe(
      db.from("championships").select("*").order("created_at", { ascending: false }).limit(3),
      [],
    )) || [];

  if (!rows.length) {
    render("#home-champs", empty("Δεν υπάρχουν πρωταθλήματα ακόμα.", "🏆"));
    return;
  }

  render(
    "#home-champs",
    `<div class="u-grid u-grid--3">${rows
      .map((row) => {
        const progress = row.races_total > 0 ? (row.races_completed / row.races_total) * 100 : 0;
        return `<a class="hub-card hub-card--hover u-cut" href="championships.html">
          <div class="u-between" style="margin-bottom:10px">
            <span class="hub-badge ${row.status === "active" ? "hub-badge--ok" : row.status === "completed" ? "" : "hub-badge--ice"}">${esc(row.status === "active" ? "Ενεργό" : row.status === "completed" ? "Ολοκληρωμένο" : "Ερχόμενο")}</span>
            <span class="hub-badge">${esc(row.category || "—")}</span>
          </div>
          <h3 style="font-size:1rem">${esc(row.title)}</h3>
          <p class="u-small u-dim u-clamp-2" style="margin-top:6px">${esc(row.description || "")}</p>
          <div class="hub-progress" style="margin-top:14px"><span style="width:${progress}%"></span></div>
          <p class="u-tiny u-faint" style="margin-top:6px">Αγώνες ${row.races_completed}/${row.races_total} · ${row.participants} οδηγοί</p>
        </a>`;
      })
      .join("")}</div>`,
  );
}

/* -------------------------------------------------------------- podcasts ---- */

const spotifyId = (url) => (String(url || "").match(/episode\/([A-Za-z0-9]+)/) || [])[1] || null;

async function loadPodcasts() {
  render("#home-podcasts", spinner());
  const rows =
    (await safe(
      db
        .from("podcast_episodes")
        .select("*")
        .eq("published", true)
        .order("episode_number", { ascending: false })
        .limit(3),
      [],
    )) || [];

  if (!rows.length) {
    render("#home-podcasts", empty("Δεν υπάρχουν επεισόδια ακόμα.", "🎧"));
    return;
  }

  render(
    "#home-podcasts",
    `<div class="u-stack" style="--gap:12px">${rows
      .map((ep) => {
        const id = spotifyId(ep.spotify_url);
        return `<article class="pod">
          <div class="pod__row">
            <div class="pod__num"><span class="u-tiny">EP</span><b>#${esc(ep.episode_number ?? "—")}</b></div>
            <span class="pod__play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
            <div style="min-width:0;flex:1">
              ${ep.category ? `<span class="hub-badge">${esc(ep.category)}</span>` : ""}
              <h3 style="font-size:0.95rem;margin-top:5px">${esc(ep.title)}</h3>
              <p class="u-tiny u-faint">${esc(ep.host || "")}${ep.duration ? ` · ${esc(ep.duration)}` : ""}</p>
            </div>
            ${ep.spotify_url ? `<a class="hub-btn hub-btn--sm hub-btn--ghost" href="${safeUrl(ep.spotify_url)}" target="_blank" rel="noopener noreferrer">Spotify ↗</a>` : ""}
          </div>
          ${id ? `<div class="pod__embed"><iframe src="https://open.spotify.com/embed/episode/${esc(id)}?utm_source=generator" loading="lazy" allow="clipboard-write; encrypted-media; picture-in-picture" title="${esc(ep.title)}"></iframe></div>` : ""}
        </article>`;
      })
      .join("")}</div>`,
  );
}

/* --------------------------------------------------------------- forum ---- */

async function loadThreads() {
  render("#home-threads", spinner());
  const threads =
    (await safe(
      db
        .from("forum_threads")
        .select("id, title, views, updated_at, category_id, pinned")
        .order("updated_at", { ascending: false })
        .limit(5),
      [],
    )) || [];

  if (!threads.length) {
    render(
      "#home-threads",
      empty("Δεν υπάρχουν συζητήσεις ακόμα.", "💬", '<p style="margin-top:10px"><a href="forum.html">Ξεκίνα μια νέα συζήτηση →</a></p>'),
    );
    return;
  }

  const catIds = Array.from(new Set(threads.map((t) => t.category_id).filter(Boolean)));
  const cats = (await safe(db.from("forum_categories").select("id, name, icon").in("id", catIds), [])) || [];
  const catMap = new Map(cats.map((c) => [c.id, c]));

  const counts = await Promise.all(threads.map((t) => countRows("forum_posts", (q) => q.eq("thread_id", t.id))));

  render(
    "#home-threads",
    threads
      .map((thread, index) => {
        const cat = catMap.get(thread.category_id);
        return `<a class="hub-row-item" href="forum-thread.html?id=${encodeURIComponent(thread.id)}">
          <span class="hub-row-item__glyph">${esc(cat?.icon || "💬")}</span>
          <div class="hub-row-item__body">
            <p class="hub-row-item__title u-truncate">${esc(thread.title)}${thread.pinned ? ' <span class="hub-badge hub-badge--ember">Pinned</span>' : ""}</p>
            <p class="hub-row-item__meta">${cat ? `<span class="hub-badge">${esc(cat.name)}</span>` : ""}<span>${timeAgo(thread.updated_at)} πριν</span></p>
          </div>
          <div class="hub-row-item__side"><span>💬 ${counts[index]}</span><span>👁 ${thread.views || 0}</span></div>
        </a>`;
      })
      .join(""),
  );
}

/* -------------------------------------------------------------- discord ---- */

async function loadDiscord() {
  await loadSettings();
  const target = $("#home-discord");
  const invite = safeUrl(settings.discord_invite) || "#";
  const logo = `<span class="discord__logo"><svg viewBox="0 0 24 24"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03z"/></svg></span>`;

  const shell = (headExtra, bodyHtml) => `<div class="discord">
    <div class="discord__head">
      ${logo}
      <div style="min-width:0;flex:1">
        <h3 style="font-size:0.9rem">${esc(settings.site_name)}</h3>
        ${headExtra}
      </div>
      <a class="hub-btn hub-btn--sm" href="${invite}" target="_blank" rel="noopener noreferrer" style="background:#5865f2;border-color:#5865f2;color:#fff">Σύνδεση ↗</a>
    </div>
    <div class="discord__list">${bodyHtml}</div>
  </div>`;

  target.innerHTML = shell("", spinner("Σύνδεση…"));

  try {
    const res = await fetch(`https://discord.com/api/guilds/${settings.discord_server_id}/widget.json`);
    if (!res.ok) throw new Error("widget off");
    const data = await res.json();
    const members = (data.members || []).slice(0, 15);
    const dots = { online: "--ok", idle: "--warn", dnd: "--bad" };

    target.innerHTML = shell(
      `<p class="u-tiny u-faint"><i class="hub-dot" style="display:inline-block;vertical-align:middle"></i> ${esc(data.presence_count ?? 0)} online</p>`,
      members.length
        ? members
            .map(
              (member) => `<div class="discord__member">
                <span class="hub-avatar-wrap">
                  ${member.avatar_url ? `<img class="hub-avatar hub-avatar--xs" src="${safeUrl(member.avatar_url)}" alt="" loading="lazy" />` : `<span class="hub-avatar hub-avatar--xs hub-avatar--fallback">${esc((member.username || "?")[0])}</span>`}
                  <span class="hub-avatar-wrap__status" style="background:hsl(var(${dots[member.status] || "--ink-faint"}))"></span>
                </span>
                <span style="min-width:0">
                  <span class="u-small u-truncate" style="display:block">${esc(member.username)}</span>
                  ${member.game ? `<span class="u-tiny u-faint u-truncate" style="display:block">🎮 ${esc(member.game.name)}</span>` : ""}
                </span>
              </div>`,
            )
            .join("")
        : '<p class="u-small u-faint u-center" style="padding:18px 0">Κανένα μέλος online</p>',
    );
  } catch {
    target.innerHTML = shell(
      "",
      `<div class="u-center" style="padding:20px 0">
        <p class="u-small u-dim">Το widget του server δεν είναι ενεργό.</p>
        <a class="u-small" href="${invite}" target="_blank" rel="noopener noreferrer">Σύνδεση στο Discord →</a>
      </div>`,
    );
  }
}

/* ---------------------------------------------------------------- boot ---- */

loadStats();
loadChampionships();
loadPodcasts();
loadThreads();
loadDiscord();
