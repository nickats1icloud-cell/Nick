/** Racing teams: λίστα, roster, δημιουργία/επεξεργασία, συμμετοχή. */

import { mountShell } from "../shell.js";
import { session, onAuth, authReady } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import {
  $, esc, safeUrl, render, avatar, nameOf, empty, skeletonCards, debounce,
  openModal, confirmAction, toastOk, toastError, byUserId,
} from "../ui.js";

await mountShell("teams");
await authReady();

const state = { teams: [], members: [], profiles: new Map(), search: "" };

onAuth((next) => {
  const button = $("#team-new");
  if (button) button.hidden = !next.user;
});

$("#team-search").addEventListener("input", debounce((ev) => {
  state.search = ev.target.value.trim().toLowerCase();
  paint();
}, 200));

async function load() {
  render("#team-list", skeletonCards(6, 220));

  const [teams, members, profiles] = await Promise.all([
    safe(db.from("teams").select("*").order("created_at", { ascending: false }), []),
    safe(db.from("team_members").select("*"), []),
    safe(db.from("profiles").select("user_id, display_name, username, avatar_url"), []),
  ]);

  state.teams = teams || [];
  state.members = members || [];
  state.profiles = byUserId(profiles);
  paint();
}

function rosterOf(teamId) {
  return state.members.filter((row) => row.team_id === teamId);
}

function paint() {
  const list = state.teams.filter((team) => {
    if (!state.search) return true;
    return `${team.name} ${team.tag || ""} ${team.description || ""}`.toLowerCase().includes(state.search);
  });

  if (!list.length) {
    render("#team-list", `<div style="grid-column:1/-1">${empty("Δεν υπάρχουν ομάδες ακόμα.", "👥")}</div>`);
    return;
  }

  render(
    "#team-list",
    list
      .map((team) => {
        const roster = rosterOf(team.id);
        const mine = session.user && roster.some((row) => row.user_id === session.user.id);
        const isOwner = session.user?.id === team.owner_id;
        const logo = safeUrl(team.logo_url);
        return `<article class="hub-card hub-card--hover u-cut" data-team="${esc(team.id)}">
          <div class="u-row" style="gap:12px">
            ${logo ? `<img class="hub-avatar hub-avatar--lg" src="${logo}" alt="" loading="lazy" />` : `<span class="hub-avatar hub-avatar--lg hub-avatar--fallback">${esc((team.tag || team.name || "?")[0])}</span>`}
            <div style="min-width:0;flex:1">
              <h3 style="font-size:1rem">${esc(team.name)}</h3>
              ${team.tag ? `<span class="hub-badge hub-badge--brand">${esc(team.tag)}</span>` : ""}
              <p class="u-tiny u-faint" style="margin-top:4px">${roster.length} μέλη</p>
            </div>
          </div>

          ${team.description ? `<p class="u-small u-dim u-clamp-3" style="margin-top:12px">${esc(team.description)}</p>` : ""}

          <div class="u-row u-row--wrap" style="margin-top:14px;gap:4px">
            ${roster
              .slice(0, 6)
              .map((row) => {
                const profile = state.profiles.get(row.user_id);
                return `<a href="profile.html?u=${encodeURIComponent(row.user_id)}" title="${esc(nameOf(profile))}">${avatar(profile, "xs")}</a>`;
              })
              .join("")}
            ${roster.length > 6 ? `<span class="u-tiny u-faint">+${roster.length - 6}</span>` : ""}
          </div>

          <div class="u-row" style="margin-top:14px;padding-top:12px;border-top:1px solid hsl(var(--line-soft))">
            <button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-view="${esc(team.id)}">Roster</button>
            <span class="u-spacer"></span>
            ${isOwner ? `<button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-edit="${esc(team.id)}">✎</button>` : ""}
            ${
              session.user && !isOwner
                ? `<button class="hub-btn hub-btn--sm ${mine ? "hub-btn--ghost" : "hub-btn--primary"}" type="button" data-join="${esc(team.id)}">${mine ? "Αποχώρηση" : "Συμμετοχή"}</button>`
                : ""
            }
          </div>
        </article>`;
      })
      .join(""),
  );
}

/* -------------------------------------------------------------- roster ---- */

$("#team-list").addEventListener("click", async (ev) => {
  const view = ev.target.closest("[data-view]");
  if (view) {
    const team = state.teams.find((row) => row.id === view.dataset.view);
    const roster = rosterOf(team.id);
    openModal({
      title: `Roster · ${team.name}`,
      body: roster.length
        ? `<div class="u-stack" style="--gap:8px">${roster
            .map((row) => {
              const profile = state.profiles.get(row.user_id);
              return `<a class="hub-row-item" href="profile.html?u=${encodeURIComponent(row.user_id)}">
                ${avatar(profile, "sm")}
                <div class="hub-row-item__body"><p class="hub-row-item__title">${esc(nameOf(profile))}</p></div>
                <span class="hub-badge ${row.user_id === team.owner_id ? "hub-badge--brand" : ""}">${esc(row.user_id === team.owner_id ? "Owner" : row.role || "member")}</span>
              </a>`;
            })
            .join("")}</div>`
        : empty("Η ομάδα δεν έχει μέλη ακόμα.", "👥"),
    });
    return;
  }

  const join = ev.target.closest("[data-join]");
  if (join) {
    const teamId = join.dataset.join;
    const existing = state.members.find((row) => row.team_id === teamId && row.user_id === session.user.id);
    join.disabled = true;

    if (existing) {
      if (!(await confirmAction("Να αποχωρήσεις από την ομάδα;"))) {
        join.disabled = false;
        return;
      }
      const { error } = await db.from("team_members").delete().eq("id", existing.id);
      if (error) {
        join.disabled = false;
        return toastError(error);
      }
      toastOk("Αποχώρησες από την ομάδα");
    } else {
      const { error } = await db.from("team_members").insert({ team_id: teamId, user_id: session.user.id, role: "member" });
      if (error) {
        join.disabled = false;
        return toastError(error);
      }
      toastOk("Μπήκες στην ομάδα");
    }
    load();
    return;
  }

  const edit = ev.target.closest("[data-edit]");
  if (edit) openTeamForm(state.teams.find((row) => row.id === edit.dataset.edit));
});

/* ---------------------------------------------------- δημιουργία/edit ---- */

$("#team-new").addEventListener("click", () => openTeamForm(null));

function openTeamForm(team) {
  const { root, close } = openModal({
    title: team ? "Επεξεργασία ομάδας" : "Νέα ομάδα",
    body: `<label class="hub-field"><span>Όνομα</span><input class="hub-input" name="name" maxlength="80" value="${esc(team?.name || "")}" /></label>
      <label class="hub-field"><span>Tag (π.χ. GSR)</span><input class="hub-input" name="tag" maxlength="10" value="${esc(team?.tag || "")}" /></label>
      <label class="hub-field"><span>Λογότυπο (URL)</span><input class="hub-input" name="logo" placeholder="https://…" value="${esc(team?.logo_url || "")}" /></label>
      <label class="hub-field"><span>Περιγραφή</span><textarea class="hub-textarea" name="description" rows="4">${esc(team?.description || "")}</textarea></label>`,
    footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Άκυρο</button>
             ${team ? '<button class="hub-btn hub-btn--danger" type="button" data-del>Διαγραφή</button>' : ""}
             <button class="hub-btn hub-btn--primary" type="button" data-save>${team ? "Αποθήκευση" : "Δημιουργία"}</button>`,
  });

  root.querySelector("[data-save]").addEventListener("click", async (ev) => {
    const values = {
      name: root.querySelector('[name="name"]').value.trim(),
      tag: root.querySelector('[name="tag"]').value.trim() || null,
      logo_url: root.querySelector('[name="logo"]').value.trim() || null,
      description: root.querySelector('[name="description"]').value.trim() || null,
    };
    if (!values.name) return toastError(null, "Το όνομα είναι υποχρεωτικό.");
    ev.target.disabled = true;

    if (team) {
      const { error } = await db.from("teams").update(values).eq("id", team.id);
      if (error) {
        ev.target.disabled = false;
        return toastError(error);
      }
      toastOk("Αποθηκεύτηκε");
    } else {
      const { data, error } = await db
        .from("teams")
        .insert({ ...values, owner_id: session.user.id })
        .select()
        .single();
      if (error) {
        ev.target.disabled = false;
        return toastError(error);
      }
      await safe(db.from("team_members").insert({ team_id: data.id, user_id: session.user.id, role: "owner" }));
      toastOk("Η ομάδα δημιουργήθηκε");
    }

    close();
    load();
  });

  root.querySelector("[data-del]")?.addEventListener("click", async () => {
    if (!(await confirmAction("Να διαγραφεί η ομάδα;"))) return;
    const { error } = await db.from("teams").delete().eq("id", team.id);
    if (error) return toastError(error);
    toastOk("Η ομάδα διαγράφηκε");
    close();
    load();
  });
}

load();
