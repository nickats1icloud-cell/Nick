/**
 * Προφίλ οδηγού. `profile.html` = το δικό μου, `profile.html?u=<user_id>` =
 * κάποιου άλλου. Περιλαμβάνει: στοιχεία, badges, likes, follow/followers,
 * σχόλια τοίχου, επεξεργασία, αλλαγή email/κωδικού, ανέβασμα avatar.
 */

import { mountShell } from "../shell.js";
import { session, authReady, requireUser } from "../auth.js";
import { db, safe, countRows } from "../supabase-client.js";
import {
  $, param, esc, safeUrl, avatar, nameOf, fmtDate, timeAgo, isOnline, empty, byUserId,
  uniq, openModal, confirmAction, toastOk, toastError, toast
} from "../ui.js";
import { SIM_OPTIONS, SETUP_OPTIONS } from "../config.js";

await mountShell("");
await authReady();

const root = $("#profile-root");
const targetId = param("u") || session.user?.id;

if (!targetId) {
  await requireUser();
} else {
  await load();
}

const SETUP_LABEL = Object.fromEntries(SETUP_OPTIONS.map((opt) => [opt.value, opt.label]));

async function load() {
  root.innerHTML = '<div class="hub-loading"><div class="hub-spinner"></div></div>';

  const profile = await safe(db.from("profiles").select("*").eq("user_id", targetId).maybeSingle());

  if (!profile) {
    root.innerHTML = empty("Το προφίλ δεν βρέθηκε ή δεν είναι ορατό.", "🚧", '<p style="margin-top:10px"><a href="members.html">Δες όλα τα μέλη →</a></p>');
    return;
  }

  const isMe = session.user?.id === targetId;
  document.title = `${nameOf(profile)} · Greek SimRacers`;

  const [badges, likeCount, myLike, followers, following, followState] = await Promise.all([
    safe(db.from("user_achievements").select("*, achievement_badges(*)").eq("user_id", targetId).order("awarded_at", { ascending: false }), []),
    countRows("profile_likes", (q) => q.eq("profile_user_id", targetId)),
    session.user
      ? safe(db.from("profile_likes").select("id").eq("user_id", session.user.id).eq("profile_user_id", targetId).maybeSingle())
      : Promise.resolve(null),
    countRows("follows", (q) => q.eq("following_id", targetId).eq("status", "accepted")),
    countRows("follows", (q) => q.eq("follower_id", targetId).eq("status", "accepted")),
    session.user && !isMe
      ? safe(db.from("follows").select("status").eq("follower_id", session.user.id).eq("following_id", targetId).maybeSingle())
      : Promise.resolve(null),
  ]);

  const facts = [
    ["🎮", "Αγαπημένο sim", profile.favorite_sim],
    ["🖥", "Setup", SETUP_LABEL[profile.setup_type] || profile.setup_type],
    ["🏁", "Αγαπημένη πίστα", profile.favorite_track],
    ["📍", "Τοποθεσία", profile.location],
    ["🌍", "Εθνικότητα", profile.nationality],
    ["⏳", "Χρόνια sim racing", profile.years_simracing],
    ["💬", "Discord", profile.discord_username],
  ].filter(([, , value]) => value);

  root.innerHTML = `
    <div class="profile__banner"></div>
    <div class="profile__card">
      <div class="u-between" style="align-items:flex-start">
        <div class="profile__avatar-slot">
          <span class="hub-avatar-wrap">
            ${avatar(profile)}
            ${profile.show_online !== false && isOnline(profile.last_seen) ? '<span class="hub-avatar-wrap__status" style="background:hsl(var(--ok))"></span>' : ""}
          </span>
          ${isMe ? '<button class="profile__upload" type="button" data-avatar title="Αλλαγή φωτογραφίας">📷</button><input type="file" accept="image/*" hidden data-avatar-input />' : ""}
        </div>

        <div class="u-row u-row--wrap" style="padding-top:14px">
          ${
            isMe
              ? `<button class="hub-btn hub-btn--sm" type="button" data-edit>✎ Επεξεργασία</button>
                 <button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-account>🔐 Λογαριασμός</button>
                 <button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-requests>👥 Αιτήματα</button>`
              : `<button class="hub-btn hub-btn--sm ${myLike ? "hub-btn--primary" : "hub-btn--ghost"}" type="button" data-like>${myLike ? "❤️" : "🤍"} <span data-like-count>${likeCount}</span></button>
                 ${session.user ? `<button class="hub-btn hub-btn--sm ${followState ? "hub-btn--ghost" : "hub-btn--primary"}" type="button" data-follow>${followState?.status === "accepted" ? "Ακολουθείς" : followState?.status === "pending" ? "Σε αναμονή" : "Ακολούθησε"}</button>` : ""}`
          }
        </div>
      </div>

      <h1 style="font-size:1.7rem">${esc(nameOf(profile))}</h1>
      ${profile.username ? `<p class="u-small u-faint">@${esc(profile.username)}</p>` : ""}
      ${profile.bio ? `<p class="u-dim" style="margin-top:12px;max-width:60ch;white-space:pre-wrap">${esc(profile.bio)}</p>` : ""}

      <div class="profile__meta">
        <span>📅 Μέλος από ${fmtDate(profile.created_at, { month: "long", year: "numeric" })}</span>
        ${profile.website_url ? `<a href="${safeUrl(profile.website_url)}" target="_blank" rel="noopener noreferrer">🔗 Website</a>` : ""}
      </div>

      <div class="profile__counts">
        <div class="profile__count"><b>${followers}</b><span>Ακόλουθοι</span></div>
        <div class="profile__count"><b>${following}</b><span>Ακολουθεί</span></div>
        <div class="profile__count"><b>${likeCount}</b><span>Likes</span></div>
        <div class="profile__count"><b>${(badges || []).length}</b><span>Badges</span></div>
      </div>
    </div>

    <div class="u-grid" style="grid-template-columns:minmax(0,1.4fr) minmax(260px,1fr);margin-top:20px;align-items:start">
      <div class="u-stack" style="--gap:16px">
        <section class="hub-card">
          <h2 style="font-size:1rem;margin-bottom:14px">🏎 Αγωνιστικό προφίλ</h2>
          ${
            facts.length
              ? `<div class="u-grid u-grid--2" style="gap:10px">${facts
                  .map(
                    ([icon, label, value]) => `<div>
                      <p class="u-tiny u-faint">${icon} ${esc(label)}</p>
                      <p class="u-small">${esc(value)}</p>
                    </div>`,
                  )
                  .join("")}</div>`
              : '<p class="u-small u-faint">Δεν έχουν συμπληρωθεί στοιχεία ακόμα.</p>'
          }
        </section>

        <section class="hub-card" id="wall"></section>
      </div>

      <aside class="hub-card">
        <h2 style="font-size:1rem;margin-bottom:14px">🎖 Badges</h2>
        ${
          (badges || []).length
            ? `<div class="u-grid u-grid--2" style="gap:10px">${badges
                .map((row) => {
                  const badge = row.achievement_badges;
                  if (!badge) return "";
                  return `<div class="hub-card u-center" style="padding:12px" title="${esc(badge.description || "")}">
                    <p style="font-size:1.5rem">${esc(badge.icon || "🏅")}</p>
                    <p class="u-tiny" style="margin-top:4px">${esc(badge.name)}</p>
                    <p class="u-tiny u-faint">${fmtDate(row.awarded_at, { month: "short", year: "numeric" })}</p>
                  </div>`;
                })
                .join("")}</div>`
            : '<p class="u-small u-faint">Κανένα badge ακόμα.</p>'
        }
      </aside>
    </div>`;

  wire(profile, isMe);
  loadWall();
}

/* ------------------------------------------------------ τοίχος σχολίων ---- */

async function loadWall() {
  const host = $("#wall");
  const rows =
    (await safe(
      db.from("profile_comments").select("*").eq("profile_user_id", targetId).order("created_at", { ascending: false }),
      [],
    )) || [];

  const profiles =
    (await safe(db.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", uniq(rows.map((r) => r.author_id))), [])) || [];
  const map = byUserId(profiles);

  host.innerHTML = `
    <h2 style="font-size:1rem;margin-bottom:14px">💬 Τοίχος <span class="u-faint">(${rows.length})</span></h2>
    ${
      session.user
        ? `<form id="wall-form" style="margin-bottom:16px">
             <textarea class="hub-textarea" rows="3" placeholder="Άφησε ένα μήνυμα…" maxlength="1000"></textarea>
             <div class="u-row" style="justify-content:flex-end;margin-top:8px">
               <button class="hub-btn hub-btn--primary hub-btn--sm" type="submit">Δημοσίευση</button>
             </div>
           </form>`
        : '<p class="u-small u-dim" style="margin-bottom:14px"><a href="auth.html">Συνδέσου</a> για να γράψεις.</p>'
    }
    <div class="u-stack" style="--gap:10px">
      ${
        rows.length
          ? rows
              .map((comment) => {
                const author = map.get(comment.author_id);
                const canDelete = session.user?.id === comment.author_id || session.user?.id === targetId || session.isAdmin;
                return `<div class="hub-card" style="background:hsl(var(--surface-2))">
                  <div class="u-row">
                    <a class="u-row" href="profile.html?u=${encodeURIComponent(comment.author_id)}" style="gap:8px;color:inherit">
                      ${avatar(author, "xs")}<span class="u-small">${esc(nameOf(author))}</span>
                    </a>
                    <span class="u-tiny u-faint">${timeAgo(comment.created_at)} πριν</span>
                    <span class="u-spacer"></span>
                    ${canDelete ? `<button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-wdel="${esc(comment.id)}">🗑</button>` : ""}
                  </div>
                  <p class="u-small" style="margin-top:8px;white-space:pre-wrap">${esc(comment.content)}</p>
                </div>`;
              })
              .join("")
          : '<p class="u-small u-faint">Κανένα μήνυμα ακόμα.</p>'
      }
    </div>`;

  host.querySelector("#wall-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const area = ev.target.querySelector("textarea");
    const content = area.value.trim();
    if (!content) return;
    const { error } = await db
      .from("profile_comments")
      .insert({ profile_user_id: targetId, author_id: session.user.id, content });
    if (error) return toastError(error);
    area.value = "";
    loadWall();
  });

  host.addEventListener("click", async (ev) => {
    const del = ev.target.closest("[data-wdel]");
    if (!del) return;
    if (!(await confirmAction("Να διαγραφεί το μήνυμα;"))) return;
    await safe(db.from("profile_comments").delete().eq("id", del.dataset.wdel));
    loadWall();
  });
}

/* ------------------------------------------------------------ ενέργειες ---- */

function wire(profile, isMe) {
  root.querySelector("[data-like]")?.addEventListener("click", async (ev) => {
    if (!session.user) return toast("Χρειάζεται σύνδεση", { tone: "bad" });
    const button = ev.currentTarget;
    const counter = button.querySelector("[data-like-count]");
    const on = button.classList.contains("hub-btn--primary");

    button.classList.toggle("hub-btn--primary", !on);
    button.classList.toggle("hub-btn--ghost", on);
    counter.textContent = String(Math.max(Number(counter.textContent) + (on ? -1 : 1), 0));
    button.firstChild.textContent = on ? "🤍 " : "❤️ ";

    if (on) await safe(db.from("profile_likes").delete().eq("user_id", session.user.id).eq("profile_user_id", targetId));
    else await safe(db.from("profile_likes").insert({ user_id: session.user.id, profile_user_id: targetId }));
  });

  root.querySelector("[data-follow]")?.addEventListener("click", async (ev) => {
    const button = ev.currentTarget;
    button.disabled = true;
    const active = !button.classList.contains("hub-btn--primary");

    if (active) {
      await safe(db.from("follows").delete().eq("follower_id", session.user.id).eq("following_id", targetId));
      toastOk("Σταμάτησες να ακολουθείς");
    } else {
      const { error } = await db
        .from("follows")
        .insert({ follower_id: session.user.id, following_id: targetId, status: "pending" });
      if (error) {
        button.disabled = false;
        return toastError(error);
      }
      toastOk("Στάλθηκε αίτημα");
    }
    load();
  });

  if (!isMe) return;

  root.querySelector("[data-edit]")?.addEventListener("click", () => openEdit(profile));
  root.querySelector("[data-account]")?.addEventListener("click", openAccount);
  root.querySelector("[data-requests]")?.addEventListener("click", openRequests);

  const uploadButton = root.querySelector("[data-avatar]");
  const uploadInput = root.querySelector("[data-avatar-input]");
  uploadButton?.addEventListener("click", () => uploadInput.click());
  uploadInput?.addEventListener("change", async () => {
    const file = uploadInput.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toastError(null, "Μέγιστο μέγεθος 3MB.");

    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${session.user.id}/avatar.${ext}`;

    const { error } = await db.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toastError(error, "Απέτυχε το ανέβασμα.");

    const { data } = db.storage.from("avatars").getPublicUrl(path);
    await safe(db.from("profiles").update({ avatar_url: `${data.publicUrl}?v=${Date.now()}` }).eq("user_id", session.user.id));
    toastOk("Η φωτογραφία ενημερώθηκε");
    load();
  });
}

/* ----------------------------------------------------- επεξεργασία ---- */

function openEdit(profile) {
  const { root: modal, close } = openModal({
    title: "Επεξεργασία προφίλ",
    wide: true,
    body: `
      <div class="u-grid u-grid--2" style="gap:14px">
        <label class="hub-field"><span>Εμφανιζόμενο όνομα</span><input class="hub-input" name="display_name" maxlength="60" value="${esc(profile.display_name || "")}" /></label>
        <label class="hub-field"><span>Username</span><input class="hub-input" name="username" maxlength="30" value="${esc(profile.username || "")}" /></label>
      </div>
      <label class="hub-field"><span>Bio</span><textarea class="hub-textarea" name="bio" rows="3" maxlength="500">${esc(profile.bio || "")}</textarea></label>
      <div class="u-grid u-grid--2" style="gap:14px">
        <label class="hub-field"><span>Τοποθεσία</span><input class="hub-input" name="location" value="${esc(profile.location || "")}" /></label>
        <label class="hub-field"><span>Εθνικότητα</span><input class="hub-input" name="nationality" value="${esc(profile.nationality || "")}" /></label>
      </div>
      <label class="hub-field"><span>Αγαπημένο sim</span>
        <select class="hub-select" name="favorite_sim">
          <option value="">— Επίλεξε —</option>
          ${SIM_OPTIONS.map((sim) => `<option ${profile.favorite_sim === sim ? "selected" : ""}>${esc(sim)}</option>`).join("")}
        </select>
      </label>
      <div class="u-grid u-grid--2" style="gap:14px">
        <label class="hub-field"><span>Setup</span>
          <select class="hub-select" name="setup_type">
            <option value="">— Επίλεξε —</option>
            ${SETUP_OPTIONS.map((opt) => `<option value="${opt.value}" ${profile.setup_type === opt.value ? "selected" : ""}>${esc(opt.label)}</option>`).join("")}
          </select>
        </label>
        <label class="hub-field"><span>Χρόνια sim racing</span><input class="hub-input" name="years_simracing" value="${esc(profile.years_simracing || "")}" /></label>
      </div>
      <div class="u-grid u-grid--2" style="gap:14px">
        <label class="hub-field"><span>Αγαπημένη πίστα</span><input class="hub-input" name="favorite_track" value="${esc(profile.favorite_track || "")}" /></label>
        <label class="hub-field"><span>Discord</span><input class="hub-input" name="discord_username" value="${esc(profile.discord_username || "")}" /></label>
      </div>
      <label class="hub-field"><span>Website</span><input class="hub-input" name="website_url" placeholder="https://…" value="${esc(profile.website_url || "")}" /></label>
      <label class="hub-check"><input type="checkbox" name="show_online" ${profile.show_online !== false ? "checked" : ""} /> Εμφάνιση κατάστασης «online»</label>`,
    footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Άκυρο</button>
             <button class="hub-btn hub-btn--primary" type="button" data-save>Αποθήκευση</button>`,
  });

  modal.querySelector("[data-save]").addEventListener("click", async (ev) => {
    const text = (name) => modal.querySelector(`[name="${name}"]`).value.trim() || null;
    ev.target.disabled = true;

    const { error } = await db
      .from("profiles")
      .update({
        display_name: text("display_name"),
        username: text("username"),
        bio: text("bio"),
        location: text("location"),
        nationality: text("nationality"),
        favorite_sim: text("favorite_sim"),
        setup_type: text("setup_type"),
        years_simracing: text("years_simracing"),
        favorite_track: text("favorite_track"),
        discord_username: text("discord_username"),
        website_url: text("website_url"),
        show_online: modal.querySelector('[name="show_online"]').checked,
      })
      .eq("user_id", session.user.id);

    ev.target.disabled = false;
    if (error) return toastError(error);
    toastOk("Το προφίλ ενημερώθηκε");
    close();
    load();
  });
}

/* ---------------------------------------------------------- λογαριασμός ---- */

function openAccount() {
  const { root: modal } = openModal({
    title: "Ρυθμίσεις λογαριασμού",
    body: `<label class="hub-field"><span>Νέο email</span><input class="hub-input" type="email" name="email" value="${esc(session.user.email || "")}" /></label>
      <button class="hub-btn hub-btn--block" type="button" data-email>Αλλαγή email</button>
      <hr />
      <label class="hub-field"><span>Νέος κωδικός</span><input class="hub-input" type="password" name="password" minlength="6" autocomplete="new-password" /></label>
      <button class="hub-btn hub-btn--block" type="button" data-password>Αλλαγή κωδικού</button>`,
  });

  modal.querySelector("[data-email]").addEventListener("click", async (ev) => {
    const email = modal.querySelector('[name="email"]').value.trim();
    if (!email) return;
    ev.target.disabled = true;
    const { error } = await db.auth.updateUser({ email });
    ev.target.disabled = false;
    if (error) return toastError(error);
    toastOk("Έλεγξε το email σου", "Στάλθηκε link επιβεβαίωσης.");
  });

  modal.querySelector("[data-password]").addEventListener("click", async (ev) => {
    const password = modal.querySelector('[name="password"]').value;
    if (password.length < 6) return toastError(null, "Τουλάχιστον 6 χαρακτήρες.");
    ev.target.disabled = true;
    const { error } = await db.auth.updateUser({ password });
    ev.target.disabled = false;
    if (error) return toastError(error);
    toastOk("Ο κωδικός άλλαξε");
  });
}

/* ------------------------------------------------- αιτήματα ακολούθησης ---- */

async function openRequests() {
  const rows =
    (await safe(
      db.from("follows").select("*").eq("following_id", session.user.id).eq("status", "pending").order("created_at", { ascending: false }),
      [],
    )) || [];

  const profiles =
    (await safe(db.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", uniq(rows.map((r) => r.follower_id))), [])) || [];
  const map = byUserId(profiles);

  const { root: modal, close } = openModal({
    title: `Αιτήματα ακολούθησης (${rows.length})`,
    body: rows.length
      ? `<div class="u-stack" style="--gap:8px">${rows
          .map((row) => {
            const profile = map.get(row.follower_id);
            return `<div class="hub-row-item">
              ${avatar(profile, "sm")}
              <div class="hub-row-item__body"><p class="hub-row-item__title">${esc(nameOf(profile))}</p><p class="hub-row-item__meta">${timeAgo(row.created_at)} πριν</p></div>
              <button class="hub-btn hub-btn--sm hub-btn--primary" type="button" data-accept="${esc(row.id)}">Αποδοχή</button>
              <button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-reject="${esc(row.id)}">Απόρριψη</button>
            </div>`;
          })
          .join("")}</div>`
      : empty("Δεν υπάρχουν εκκρεμή αιτήματα.", "👥"),
  });

  modal.addEventListener("click", async (ev) => {
    const accept = ev.target.closest("[data-accept]");
    if (accept) {
      await safe(db.from("follows").update({ status: "accepted" }).eq("id", accept.dataset.accept));
      toastOk("Το αίτημα έγινε δεκτό");
      close();
      load();
      return;
    }
    const reject = ev.target.closest("[data-reject]");
    if (reject) {
      await safe(db.from("follows").delete().eq("id", reject.dataset.reject));
      toastOk("Το αίτημα απορρίφθηκε");
      close();
      load();
    }
  });
}
