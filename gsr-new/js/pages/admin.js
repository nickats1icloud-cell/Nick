/**
 * Admin panel.
 *
 * Το αρχικό React Admin.tsx ήταν ~2.700 γραμμές με χειρόγραφο UI ανά ενότητα.
 * Εδώ οι 15 ενότητες περιγράφονται δηλωτικά (πίνακας, στήλες, πεδία φόρμας)
 * και ένας κοινός CRUD renderer τις φτιάχνει όλες. Ό,τι αλλάζει ανά ενότητα
 * είναι δεδομένα, όχι κώδικας.
 *
 * Η πραγματική εξουσιοδότηση είναι στα RLS policies της βάσης — ο έλεγχος
 * `requireAdmin()` εδώ απλώς κρύβει UI που θα αποτύγχανε.
 */

import { mountShell } from "../shell.js";
import { requireAdmin, session, settings, invalidateSettings } from "../auth.js";
import { db, safe, countRows } from "../supabase-client.js";
import {
  $, esc, render, avatar, nameOf, fmtDate, fmtDateTime, fmtPrice, fmtLap, parseLap,
  empty, byUserId, uniq, openModal, confirmAction, toastOk, toastError,
} from "../ui.js";
import { editorHtml, attachEditor } from "../markdown.js";

await mountShell("");
const admin = await requireAdmin();
// Ο έλεγχος έχει ήδη ξεκινήσει redirect· «παγώνουμε» το module ώστε να μην
// τρέξει τίποτα άλλο όσο φεύγει η σελίδα.
if (!admin) await new Promise(() => {});

/**
 * Αντικαθιστά ΟΛΟΚΛΗΡΟ το #admin-panel με νέο node. Έτσι όλοι οι listeners
 * που είχε κολλήσει η προηγούμενη ενότητα πεθαίνουν μαζί του — αλλιώς, επειδή
 * το panel είναι μόνιμο στοιχείο, θα συσσωρεύονταν σε κάθε εναλλαγή.
 */
function setPanel(html) {
  const fresh = document.createElement("div");
  fresh.className = "admin__panel";
  fresh.id = "admin-panel";
  fresh.innerHTML = html;
  $("#admin-panel").replaceWith(fresh);
  return fresh;
}

/* ==========================================================================
   Ορισμοί ενοτήτων
   ========================================================================== */

const text = (name, label, extra = {}) => ({ name, label, type: "text", ...extra });
const area = (name, label, extra = {}) => ({ name, label, type: "textarea", ...extra });
const num = (name, label, extra = {}) => ({ name, label, type: "number", ...extra });
const bool = (name, label) => ({ name, label, type: "checkbox" });
const pick = (name, label, options) => ({ name, label, type: "select", options });

const SECTIONS = {
  dashboard: { icon: "📊", label: "Dashboard", custom: renderDashboard },

  users: { icon: "👥", label: "Χρήστες", custom: renderUsers },

  articles: {
    icon: "📰",
    label: "Άρθρα",
    table: "articles",
    order: ["created_at", false],
    columns: [
      ["title", "Τίτλος"],
      ["published", "Δημοσιευμένο", (row) => badge(row.published, "Ναι", "Πρόχειρο")],
      ["pinned", "Pinned", (row) => (row.pinned ? "📌" : "—")],
      ["views", "Προβολές"],
      ["created_at", "Ημ/νία", (row) => fmtDate(row.created_at)],
    ],
    fields: [text("title", "Τίτλος"), text("cover_url", "Εικόνα (URL)"), bool("published", "Δημοσιευμένο"), bool("pinned", "Καρφιτσωμένο"), { name: "content", label: "Περιεχόμενο", type: "markdown" }],
    canCreate: false,
  },

  forum: {
    icon: "💬",
    label: "Forum",
    table: "forum_threads",
    order: ["updated_at", false],
    columns: [
      ["title", "Τίτλος"],
      ["pinned", "Pinned", (row) => (row.pinned ? "📌" : "—")],
      ["locked", "Κλειδωμένο", (row) => (row.locked ? "🔒" : "—")],
      ["views", "Προβολές"],
      ["updated_at", "Ενημέρωση", (row) => fmtDate(row.updated_at)],
    ],
    fields: [text("title", "Τίτλος"), bool("pinned", "Καρφιτσωμένο"), bool("locked", "Κλειδωμένο"), area("content", "Περιεχόμενο", { rows: 6 })],
    canCreate: false,
  },

  podcasts: {
    icon: "🎙",
    label: "Podcasts",
    table: "podcast_episodes",
    order: ["episode_number", false],
    columns: [
      ["episode_number", "#"],
      ["title", "Τίτλος"],
      ["host", "Host"],
      ["category", "Κατηγορία"],
      ["duration", "Διάρκεια"],
      ["published", "Δημοσιευμένο", (row) => badge(row.published, "Ναι", "Όχι")],
    ],
    fields: [
      num("episode_number", "Αριθμός επεισοδίου"),
      text("title", "Τίτλος"),
      text("host", "Host"),
      text("category", "Κατηγορία"),
      text("duration", "Διάρκεια (π.χ. 48:12)"),
      text("spotify_url", "Spotify URL"),
      area("description", "Περιγραφή"),
      bool("published", "Δημοσιευμένο"),
    ],
  },

  articleCats: {
    icon: "🏷",
    label: "Κατηγορίες άρθρων",
    table: "article_categories",
    order: ["name", true],
    columns: [
      ["name", "Όνομα"],
      ["slug", "Slug"],
      ["color", "Χρώμα"],
    ],
    fields: [text("name", "Όνομα"), text("slug", "Slug"), text("color", "Χρώμα (π.χ. #ff6b2c)")],
  },

  forumCats: {
    icon: "🗂",
    label: "Κατηγορίες forum",
    table: "forum_categories",
    order: ["sort_order", true],
    columns: [
      ["icon", "Εικονίδιο"],
      ["name", "Όνομα"],
      ["description", "Περιγραφή"],
      ["sort_order", "Σειρά"],
    ],
    fields: [text("name", "Όνομα"), text("icon", "Εικονίδιο (emoji)"), area("description", "Περιγραφή", { rows: 2 }), num("sort_order", "Σειρά"), text("color", "Χρώμα")],
  },

  championships: {
    icon: "🏆",
    label: "Πρωταθλήματα",
    table: "championships",
    order: ["created_at", false],
    columns: [
      ["title", "Τίτλος"],
      ["category", "Κατηγορία"],
      ["status", "Κατάσταση"],
      ["races", "Αγώνες", (row) => `${row.races_completed}/${row.races_total}`],
      ["participants", "Οδηγοί"],
    ],
    fields: [
      text("title", "Τίτλος"),
      text("category", "Κατηγορία"),
      pick("status", "Κατάσταση", [
        ["upcoming", "Ερχόμενο"],
        ["active", "Ενεργό"],
        ["completed", "Ολοκληρωμένο"],
      ]),
      num("races_completed", "Αγώνες ολοκληρωμένοι"),
      num("races_total", "Σύνολο αγώνων"),
      num("participants", "Συμμετέχοντες"),
      { name: "start_date", label: "Ημ/νία έναρξης", type: "date" },
      text("image_url", "Εικόνα (URL)"),
      area("description", "Περιγραφή"),
    ],
  },

  badges: {
    icon: "🎖",
    label: "Badges",
    table: "achievement_badges",
    order: ["category", true],
    columns: [
      ["icon", "Εικονίδιο"],
      ["name", "Όνομα"],
      ["category", "Κατηγορία"],
      ["requirement", "Προϋπόθεση"],
    ],
    fields: [text("name", "Όνομα"), text("icon", "Εικονίδιο (emoji)"), text("category", "Κατηγορία"), text("requirement", "Προϋπόθεση"), area("description", "Περιγραφή", { rows: 2 })],
    extraActions: (row) => `<button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-award="${esc(row.id)}">Απονομή</button>`,
    onAction: async (action, row) => {
      if (action !== "award") return false;
      await awardBadge(row);
      return true;
    },
  },

  predictions: {
    icon: "🎯",
    label: "Predictions",
    table: "prediction_events",
    order: ["deadline", false],
    columns: [
      ["title", "Τίτλος"],
      ["deadline", "Προθεσμία", (row) => fmtDateTime(row.deadline)],
      ["status", "Κατάσταση"],
    ],
    fields: [
      text("title", "Τίτλος"),
      area("description", "Περιγραφή", { rows: 2 }),
      { name: "deadline", label: "Προθεσμία", type: "datetime-local" },
      { name: "event_date", label: "Ημ/νία αγώνα", type: "datetime-local" },
      pick("status", "Κατάσταση", [
        ["open", "Ανοιχτό"],
        ["closed", "Κλειστό"],
      ]),
      { name: "results", label: "Αποτελέσματα (JSON: {\"p1\":\"…\"})", type: "json" },
    ],
  },

  incidents: {
    icon: "⚠️",
    label: "Incidents",
    table: "incident_reports",
    order: ["created_at", false],
    columns: [
      ["race_name", "Αγώνας"],
      ["status", "Κατάσταση"],
      ["description", "Περιγραφή", (row) => esc(String(row.description || "").slice(0, 60))],
      ["created_at", "Ημ/νία", (row) => fmtDate(row.created_at)],
    ],
    fields: [
      pick("status", "Κατάσταση", [
        ["pending", "Σε εξέταση"],
        ["reviewing", "Υπό εξέταση"],
        ["resolved", "Επιλύθηκε"],
        ["dismissed", "Απορρίφθηκε"],
      ]),
      area("admin_notes", "Σχόλιο αγωνοδικών", { rows: 4 }),
    ],
    canCreate: false,
  },

  teams: {
    icon: "🏁",
    label: "Ομάδες",
    table: "teams",
    order: ["created_at", false],
    columns: [
      ["name", "Όνομα"],
      ["tag", "Tag"],
      ["created_at", "Ημ/νία", (row) => fmtDate(row.created_at)],
    ],
    fields: [text("name", "Όνομα"), text("tag", "Tag"), text("logo_url", "Λογότυπο (URL)"), area("description", "Περιγραφή", { rows: 3 })],
    canCreate: false,
  },

  laptimes: {
    icon: "⏱",
    label: "Lap Times",
    table: "lap_times",
    order: ["lap_time_ms", true],
    columns: [
      ["track_name", "Πίστα"],
      ["car_name", "Αυτοκίνητο"],
      ["sim_name", "Sim"],
      ["lap_time_ms", "Χρόνος", (row) => fmtLap(row.lap_time_ms)],
      ["verified", "Επαληθευμένο", (row) => badge(row.verified, "✓", "—")],
    ],
    fields: [
      text("track_name", "Πίστα"),
      text("car_name", "Αυτοκίνητο"),
      text("sim_name", "Sim"),
      { name: "lap_time_ms", label: "Χρόνος (μ:δδ.χχχ)", type: "lap" },
      text("conditions", "Συνθήκες"),
      text("video_url", "Video (URL)"),
      bool("verified", "Επαληθευμένο"),
    ],
    canCreate: false,
  },

  support: { icon: "🎫", label: "Support", custom: renderSupport },

  shopProducts: {
    icon: "🛍",
    label: "Προϊόντα",
    table: "shop_products",
    order: ["created_at", false],
    columns: [
      ["name", "Όνομα"],
      ["category", "Κατηγορία"],
      ["price", "Τιμή", (row) => fmtPrice(row.price)],
      ["stock", "Απόθεμα"],
      ["active", "Ενεργό", (row) => badge(row.active, "Ναι", "Όχι")],
    ],
    fields: [
      text("name", "Όνομα"),
      text("category", "Κατηγορία"),
      num("price", "Τιμή", { step: "0.01" }),
      num("original_price", "Αρχική τιμή", { step: "0.01" }),
      num("stock", "Απόθεμα"),
      text("badge", "Ετικέτα (π.χ. NEW)"),
      text("image_url", "Εικόνα (URL)"),
      { name: "sizes", label: "Μεγέθη (χωρισμένα με κόμμα)", type: "csv" },
      area("description", "Περιγραφή"),
      bool("active", "Ενεργό"),
    ],
  },

  orders: { icon: "📦", label: "Παραγγελίες", custom: renderOrders },

  settings: { icon: "⚙️", label: "Ρυθμίσεις", custom: renderSettings },
};

const badge = (value, yes, no) =>
  value ? `<span class="hub-badge hub-badge--ok">${esc(yes)}</span>` : `<span class="hub-badge">${esc(no)}</span>`;

/* ==========================================================================
   Πλοήγηση
   ========================================================================== */

let active = location.hash.slice(1) || "dashboard";
if (!SECTIONS[active]) active = "dashboard";

render(
  "#admin-nav",
  Object.entries(SECTIONS)
    .map(
      ([key, section]) =>
        `<button class="admin__nav ${key === active ? "is-active" : ""}" type="button" data-section="${key}">
          <span>${section.icon}</span>${esc(section.label)}
        </button>`,
    )
    .join(""),
);

$("#admin-nav").addEventListener("click", (ev) => {
  const button = ev.target.closest("[data-section]");
  if (!button) return;
  active = button.dataset.section;
  location.hash = active;
  document.querySelectorAll(".admin__nav").forEach((node) => node.classList.toggle("is-active", node === button));
  show();
});

function show() {
  const section = SECTIONS[active];
  if (section.custom) section.custom();
  else renderCrud(active, section);
}

show();

/* ==========================================================================
   Γενικός CRUD renderer
   ========================================================================== */

async function renderCrud(key, section) {
  setPanel('<div class="hub-loading"><div class="hub-spinner"></div></div>');

  const [column, ascending] = section.order;
  const rows = (await safe(db.from(section.table).select("*").order(column, { ascending }), [])) || [];

  render(
    "#admin-panel",
    `<div class="u-between">
      <h2 style="font-size:1.2rem">${section.icon} ${esc(section.label)} <span class="u-faint u-small">(${rows.length})</span></h2>
      ${section.canCreate === false ? "" : '<button class="hub-btn hub-btn--primary hub-btn--sm" type="button" data-new>+ Νέο</button>'}
    </div>

    ${
      rows.length
        ? `<div class="hub-table-wrap"><table class="hub-table">
            <thead><tr>${section.columns.map(([, label]) => `<th>${esc(label)}</th>`).join("")}<th></th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (row) => `<tr data-row="${esc(row.id)}">
                    ${section.columns.map(([field, , format]) => `<td>${format ? format(row) : esc(row[field] ?? "—")}</td>`).join("")}
                    <td style="white-space:nowrap">
                      ${section.extraActions ? section.extraActions(row) : ""}
                      <button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-edit="${esc(row.id)}">✎</button>
                      <button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-del="${esc(row.id)}">🗑</button>
                    </td>
                  </tr>`,
                )
                .join("")}
            </tbody>
          </table></div>`
        : empty("Δεν υπάρχουν εγγραφές.", section.icon)
    }`,
  );

  const panel = $("#admin-panel");

  panel.querySelector("[data-new]")?.addEventListener("click", () => openForm(section, null, () => renderCrud(key, section)));

  panel.addEventListener("click", async (ev) => {
    const edit = ev.target.closest("[data-edit]");
    if (edit) {
      const row = rows.find((item) => String(item.id) === edit.dataset.edit);
      openForm(section, row, () => renderCrud(key, section));
      return;
    }

    const del = ev.target.closest("[data-del]");
    if (del) {
      if (!(await confirmAction("Να διαγραφεί οριστικά αυτή η εγγραφή;"))) return;
      const { error } = await db.from(section.table).delete().eq("id", del.dataset.del);
      if (error) return toastError(error);
      toastOk("Διαγράφηκε");
      renderCrud(key, section);
      return;
    }

    if (section.onAction) {
      for (const attr of ["award"]) {
        const node = ev.target.closest(`[data-${attr}]`);
        if (node) {
          const row = rows.find((item) => String(item.id) === node.dataset[attr]);
          if (await section.onAction(attr, row)) renderCrud(key, section);
        }
      }
    }
  });
}

/* -------------------------------------------------------------- φόρμες ---- */

function fieldHtml(field, row) {
  const raw = row?.[field.name];
  const label = `<span>${esc(field.label)}</span>`;

  if (field.type === "checkbox") {
    return `<label class="hub-check"><input type="checkbox" name="${field.name}" ${raw ? "checked" : ""} /> ${esc(field.label)}</label>`;
  }
  if (field.type === "textarea") {
    return `<label class="hub-field">${label}<textarea class="hub-textarea" name="${field.name}" rows="${field.rows || 4}">${esc(raw ?? "")}</textarea></label>`;
  }
  if (field.type === "markdown") {
    return `<div class="hub-field"><span class="hub-label">${esc(field.label)}</span>${editorHtml({ name: field.name, value: raw ?? "", rows: 10 })}</div>`;
  }
  if (field.type === "select") {
    return `<label class="hub-field">${label}<select class="hub-select" name="${field.name}">
      ${field.options.map(([value, text2]) => `<option value="${esc(value)}" ${raw === value ? "selected" : ""}>${esc(text2)}</option>`).join("")}
    </select></label>`;
  }
  if (field.type === "json") {
    return `<label class="hub-field">${label}<textarea class="hub-textarea u-mono" name="${field.name}" rows="4">${esc(raw ? JSON.stringify(raw, null, 2) : "")}</textarea></label>`;
  }
  if (field.type === "csv") {
    return `<label class="hub-field">${label}<input class="hub-input" name="${field.name}" value="${esc(Array.isArray(raw) ? raw.join(", ") : "")}" /></label>`;
  }
  if (field.type === "lap") {
    return `<label class="hub-field">${label}<input class="hub-input u-mono" name="${field.name}" value="${esc(raw ? fmtLap(raw) : "")}" placeholder="1:23.456" /></label>`;
  }
  if (field.type === "date" || field.type === "datetime-local") {
    const value = raw ? String(raw).slice(0, field.type === "date" ? 10 : 16) : "";
    return `<label class="hub-field">${label}<input class="hub-input" type="${field.type}" name="${field.name}" value="${esc(value)}" /></label>`;
  }
  return `<label class="hub-field">${label}<input class="hub-input" type="${field.type}" name="${field.name}" value="${esc(raw ?? "")}" ${field.step ? `step="${field.step}"` : ""} /></label>`;
}

function readField(form, field) {
  const node = form.querySelector(`[name="${field.name}"]`);
  if (!node) return undefined;

  if (field.type === "checkbox") return node.checked;
  const value = node.value.trim();

  if (field.type === "number") return value === "" ? null : Number(value);
  if (field.type === "csv") return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : null;
  if (field.type === "lap") return parseLap(value);
  if (field.type === "json") {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`Μη έγκυρο JSON στο πεδίο «${field.label}»`);
    }
  }
  if (field.type === "datetime-local" || field.type === "date") return value ? new Date(value).toISOString() : null;
  return value || null;
}

function openForm(section, row, done) {
  const { root, close } = openModal({
    title: `${row ? "Επεξεργασία" : "Νέο"} · ${section.label}`,
    wide: section.fields.some((field) => field.type === "markdown"),
    body: section.fields.map((field) => fieldHtml(field, row)).join(""),
    footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Άκυρο</button>
             <button class="hub-btn hub-btn--primary" type="button" data-save>Αποθήκευση</button>`,
  });

  if (section.fields.some((field) => field.type === "markdown")) attachEditor(root);

  root.querySelector("[data-save]").addEventListener("click", async (ev) => {
    let payload;
    try {
      payload = {};
      section.fields.forEach((field) => {
        const value = readField(root, field);
        if (value !== undefined) payload[field.name] = value;
      });
    } catch (err) {
      return toastError(err);
    }

    ev.target.disabled = true;
    const query = row
      ? db.from(section.table).update(payload).eq("id", row.id)
      : db.from(section.table).insert(payload);
    const { error } = await query;
    ev.target.disabled = false;

    if (error) return toastError(error);
    toastOk("Αποθηκεύτηκε");
    close();
    done();
  });
}

/* ==========================================================================
   Ενότητες με δικό τους UI
   ========================================================================== */

async function renderDashboard() {
  setPanel('<div class="hub-loading"><div class="hub-spinner"></div></div>');

  const [users, pending, articles, threads, posts, episodes, champs, tickets, orders, laps] = await Promise.all([
    countRows("profiles"),
    countRows("profiles", (q) => q.eq("is_approved", false)),
    countRows("articles"),
    countRows("forum_threads"),
    countRows("forum_posts"),
    countRows("podcast_episodes"),
    countRows("championships"),
    countRows("support_tickets", (q) => q.neq("status", "closed")),
    countRows("shop_orders", (q) => q.eq("status", "pending")),
    countRows("lap_times"),
  ]);

  const tiles = [
    ["👥", users, "Χρήστες"],
    ["⏳", pending, "Σε αναμονή έγκρισης"],
    ["📰", articles, "Άρθρα"],
    ["💬", threads, "Συζητήσεις"],
    ["↩️", posts, "Απαντήσεις"],
    ["🎙", episodes, "Επεισόδια"],
    ["🏆", champs, "Πρωταθλήματα"],
    ["🎫", tickets, "Ανοιχτά tickets"],
    ["📦", orders, "Εκκρεμείς παραγγελίες"],
    ["⏱", laps, "Lap times"],
  ];

  render(
    "#admin-panel",
    `<h2 style="font-size:1.2rem">📊 Επισκόπηση</h2>
     <div class="admin__stats">
       ${tiles
         .map(
           ([icon, value, label]) => `<div class="hub-card u-center">
             <p style="font-size:1.4rem">${icon}</p>
             <p class="hub-stat__value">${value}</p>
             <p class="hub-stat__label">${esc(label)}</p>
           </div>`,
         )
         .join("")}
     </div>
     ${pending > 0 ? `<div class="hub-card hub-card--rail"><p><strong>${pending}</strong> λογαριασμοί περιμένουν έγκριση. <button class="hub-btn hub-btn--sm hub-btn--primary" type="button" data-goto="users">Διαχείριση χρηστών</button></p></div>` : ""}`,
  );

  $("#admin-panel").querySelector("[data-goto]")?.addEventListener("click", () => {
    active = "users";
    location.hash = "users";
    document.querySelectorAll(".admin__nav").forEach((node) => node.classList.toggle("is-active", node.dataset.section === "users"));
    show();
  });
}

/* ---------------------------------------------------------------- users ---- */

async function renderUsers() {
  setPanel('<div class="hub-loading"><div class="hub-spinner"></div></div>');

  const [profiles, roles] = await Promise.all([
    safe(db.from("profiles").select("*").order("created_at", { ascending: false }), []),
    safe(db.from("user_roles").select("user_id, role"), []),
  ]);

  const roleMap = new Map();
  (roles || []).forEach((row) => roleMap.set(row.user_id, row.role));

  const draw = (filter = "all", search = "") => {
    const list = (profiles || []).filter((profile) => {
      if (filter === "approved" && !profile.is_approved) return false;
      if (filter === "pending" && profile.is_approved) return false;
      if (filter === "admin" && roleMap.get(profile.user_id) !== "admin") return false;
      if (!search) return true;
      return `${profile.display_name || ""} ${profile.username || ""}`.toLowerCase().includes(search);
    });

    render(
      "#admin-panel",
      `<div class="u-between">
        <h2 style="font-size:1.2rem">👥 Χρήστες <span class="u-faint u-small">(${list.length})</span></h2>
        <div class="u-row">
          <input class="hub-input" id="user-search" placeholder="Αναζήτηση…" value="${esc(search)}" style="max-width:200px" />
          <select class="hub-select" id="user-filter" style="max-width:170px">
            <option value="all" ${filter === "all" ? "selected" : ""}>Όλοι</option>
            <option value="approved" ${filter === "approved" ? "selected" : ""}>Εγκεκριμένοι</option>
            <option value="pending" ${filter === "pending" ? "selected" : ""}>Σε αναμονή</option>
            <option value="admin" ${filter === "admin" ? "selected" : ""}>Admins</option>
          </select>
        </div>
      </div>

      <div class="hub-table-wrap"><table class="hub-table">
        <thead><tr><th>Μέλος</th><th>Sim</th><th>Εγγραφή</th><th>Κατάσταση</th><th>Ρόλος</th><th></th></tr></thead>
        <tbody>
          ${list
            .map((profile) => {
              const role = roleMap.get(profile.user_id);
              return `<tr>
                <td><a class="u-row" href="profile.html?u=${encodeURIComponent(profile.user_id)}" style="gap:8px;color:inherit">${avatar(profile, "xs")}<span>${esc(nameOf(profile))}</span></a></td>
                <td class="u-small u-dim">${esc(profile.favorite_sim || "—")}</td>
                <td class="u-small u-faint">${fmtDate(profile.created_at)}</td>
                <td>${badge(profile.is_approved, "Εγκεκριμένος", "Σε αναμονή")}</td>
                <td>${role ? `<span class="hub-badge hub-badge--brand">${esc(role)}</span>` : '<span class="u-faint">—</span>'}</td>
                <td style="white-space:nowrap">
                  <button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-approve="${esc(profile.user_id)}" data-value="${profile.is_approved ? "0" : "1"}">${profile.is_approved ? "Ανάκληση" : "Έγκριση"}</button>
                  <button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-role="${esc(profile.user_id)}" data-current="${esc(role || "")}">${role === "admin" ? "− Admin" : "+ Admin"}</button>
                </td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table></div>`,
    );

    $("#user-filter").addEventListener("change", (ev) => draw(ev.target.value, search));
    $("#user-search").addEventListener("change", (ev) => draw(filter, ev.target.value.trim().toLowerCase()));

    $("#admin-panel").addEventListener("click", async (ev) => {
      const approve = ev.target.closest("[data-approve]");
      if (approve) {
        const next = approve.dataset.value === "1";
        const { error } = await db.from("profiles").update({ is_approved: next }).eq("user_id", approve.dataset.approve);
        if (error) return toastError(error);
        toastOk(next ? "Ο λογαριασμός εγκρίθηκε" : "Η έγκριση ανακλήθηκε");
        renderUsers();
        return;
      }

      const role = ev.target.closest("[data-role]");
      if (role) {
        const userId = role.dataset.role;
        if (role.dataset.current === "admin") {
          if (userId === session.user.id && !(await confirmAction("Αφαιρείς τα δικά σου δικαιώματα admin. Σίγουρα;"))) return;
          const { error } = await db.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
          if (error) return toastError(error);
          toastOk("Ο ρόλος admin αφαιρέθηκε");
        } else {
          const { error } = await db.from("user_roles").insert({ user_id: userId, role: "admin" });
          if (error) return toastError(error);
          toastOk("Δόθηκε ρόλος admin");
        }
        renderUsers();
      }
    });
  };

  draw();
}

/* ------------------------------------------------------------- απονομή ---- */

async function awardBadge(badgeRow) {
  const profiles = (await safe(db.from("profiles").select("user_id, display_name, username").eq("is_approved", true), [])) || [];

  return new Promise((resolve) => {
    const { root, close } = openModal({
      title: `Απονομή · ${badgeRow.name}`,
      body: `<label class="hub-field"><span>Μέλος</span>
        <select class="hub-select" name="member">
          ${profiles.map((profile) => `<option value="${esc(profile.user_id)}">${esc(nameOf(profile))}</option>`).join("")}
        </select></label>`,
      footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Άκυρο</button>
               <button class="hub-btn hub-btn--primary" type="button" data-save>Απονομή</button>`,
    });

    root.querySelector("[data-save]").addEventListener("click", async (ev) => {
      ev.target.disabled = true;
      const { error } = await db.from("user_achievements").insert({
        badge_id: badgeRow.id,
        user_id: root.querySelector('[name="member"]').value,
        awarded_by: session.user.id,
      });
      ev.target.disabled = false;
      if (error) {
        toastError(error);
        return;
      }
      toastOk("Το badge απονεμήθηκε");
      close();
      resolve(false);
    });

    root.addEventListener("click", (ev) => {
      if (ev.target === root || ev.target.closest("[data-close]")) resolve(false);
    });
  });
}

/* ------------------------------------------------------------- support ---- */

async function renderSupport() {
  setPanel('<div class="hub-loading"><div class="hub-spinner"></div></div>');

  const tickets = (await safe(db.from("support_tickets").select("*").order("updated_at", { ascending: false }), [])) || [];
  const profiles = (await safe(db.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", uniq(tickets.map((t) => t.user_id))), [])) || [];
  const map = byUserId(profiles);

  render(
    "#admin-panel",
    `<h2 style="font-size:1.2rem">🎫 Support tickets <span class="u-faint u-small">(${tickets.length})</span></h2>
     ${
       tickets.length
         ? `<div class="hub-table-wrap"><table class="hub-table">
             <thead><tr><th>Θέμα</th><th>Χρήστης</th><th>Προτεραιότητα</th><th>Κατάσταση</th><th>Ενημέρωση</th><th></th></tr></thead>
             <tbody>
               ${tickets
                 .map(
                   (ticket) => `<tr>
                     <td>${esc(ticket.subject)}</td>
                     <td class="u-small">${esc(nameOf(map.get(ticket.user_id)))}</td>
                     <td><span class="hub-badge">${esc(ticket.priority)}</span></td>
                     <td><span class="hub-badge ${ticket.status === "closed" ? "" : "hub-badge--ok"}">${esc(ticket.status)}</span></td>
                     <td class="u-small u-faint">${fmtDate(ticket.updated_at)}</td>
                     <td style="white-space:nowrap">
                       <a class="hub-btn hub-btn--sm hub-btn--ghost" href="support.html">Άνοιγμα</a>
                       <button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-status="${esc(ticket.id)}" data-next="${ticket.status === "closed" ? "open" : "closed"}">${ticket.status === "closed" ? "Άνοιγμα" : "Κλείσιμο"}</button>
                     </td>
                   </tr>`,
                 )
                 .join("")}
             </tbody>
           </table></div>`
         : empty("Δεν υπάρχουν tickets.", "🎫")
     }`,
  );

  $("#admin-panel").addEventListener("click", async (ev) => {
    const button = ev.target.closest("[data-status]");
    if (!button) return;
    const { error } = await db
      .from("support_tickets")
      .update({ status: button.dataset.next, updated_at: new Date().toISOString() })
      .eq("id", button.dataset.status);
    if (error) return toastError(error);
    toastOk("Ενημερώθηκε");
    renderSupport();
  });
}

/* ---------------------------------------------------------- παραγγελίες ---- */

const ORDER_STATUS = [
  ["pending", "Σε αναμονή"],
  ["confirmed", "Επιβεβαιωμένη"],
  ["shipped", "Απεστάλη"],
  ["delivered", "Παραδόθηκε"],
  ["cancelled", "Ακυρώθηκε"],
];

async function renderOrders() {
  setPanel('<div class="hub-loading"><div class="hub-spinner"></div></div>');

  const orders =
    (await safe(db.from("shop_orders").select("*, shop_order_items(*)").order("created_at", { ascending: false }), [])) || [];

  render(
    "#admin-panel",
    `<h2 style="font-size:1.2rem">📦 Παραγγελίες <span class="u-faint u-small">(${orders.length})</span></h2>
     ${
       orders.length
         ? `<div class="u-stack" style="--gap:12px">${orders
             .map(
               (order) => `<div class="hub-card">
                 <div class="u-between">
                   <div>
                     <p><strong>#${esc(String(order.id).slice(0, 8))}</strong> · ${esc(order.full_name)}</p>
                     <p class="u-tiny u-faint">${fmtDateTime(order.created_at)} · ${esc(order.email)}${order.phone ? ` · ${esc(order.phone)}` : ""}</p>
                     <p class="u-tiny u-faint">${esc(order.address)}, ${esc(order.city)} ${esc(order.postal_code)}</p>
                   </div>
                   <div class="u-row">
                     <strong style="color:hsl(var(--brand))">${fmtPrice(order.total)}</strong>
                     <select class="hub-select" data-order="${esc(order.id)}" style="max-width:170px">
                       ${ORDER_STATUS.map(([value, label]) => `<option value="${value}" ${order.status === value ? "selected" : ""}>${esc(label)}</option>`).join("")}
                     </select>
                   </div>
                 </div>
                 <div class="u-stack" style="--gap:3px;margin-top:10px">
                   ${(order.shop_order_items || [])
                     .map((item) => `<p class="u-small u-dim">${item.quantity}× ${esc(item.product_name)}${item.size ? ` (${esc(item.size)})` : ""} — ${fmtPrice(item.price * item.quantity)}</p>`)
                     .join("")}
                 </div>
                 ${order.notes ? `<p class="u-small u-faint" style="margin-top:8px">📝 ${esc(order.notes)}</p>` : ""}
               </div>`,
             )
             .join("")}</div>`
         : empty("Δεν υπάρχουν παραγγελίες.", "📦")
     }`,
  );

  $("#admin-panel").addEventListener("change", async (ev) => {
    const select = ev.target.closest("[data-order]");
    if (!select) return;
    const { error } = await db.from("shop_orders").update({ status: select.value }).eq("id", select.dataset.order);
    if (error) return toastError(error);
    toastOk("Η κατάσταση ενημερώθηκε");
  });
}

/* -------------------------------------------------------------- ρυθμίσεις ---- */

const SETTING_FIELDS = [
  ["site_name", "Όνομα site"],
  ["site_tagline", "Tagline"],
  ["footer_text", "Κείμενο footer"],
  ["contact_email", "Email επικοινωνίας"],
  ["support_hours", "Ώρες υποστήριξης"],
  ["discord_server_id", "Discord server ID"],
  ["discord_invite", "Discord invite"],
  ["youtube_url", "YouTube"],
  ["facebook_url", "Facebook"],
  ["spotify_url", "Spotify"],
  ["footer_custom_links", 'Επιπλέον links footer (JSON: [{"label":"…","url":"…"}])'],
  ["registration_enabled", "Εγγραφές ανοιχτές (true/false)"],
  ["maintenance_mode", "Λειτουργία συντήρησης (true/false)"],
];

function renderSettings() {
  render(
    "#admin-panel",
    `<h2 style="font-size:1.2rem">⚙️ Ρυθμίσεις</h2>
     <div class="hub-card u-stack" style="--gap:14px">
       ${SETTING_FIELDS.map(
         ([key, label]) => `<label class="hub-field"><span>${esc(label)}</span>
           <input class="hub-input" data-setting="${key}" value="${esc(settings[key] ?? "")}" />
         </label>`,
       ).join("")}
       <button class="hub-btn hub-btn--primary" type="button" data-save-settings>Αποθήκευση ρυθμίσεων</button>
       <p class="u-tiny u-faint">Οι ρυθμίσεις αποθηκεύονται στον πίνακα <code>site_settings</code> και ισχύουν σε όλο το site.</p>
     </div>`,
  );

  $("#admin-panel").querySelector("[data-save-settings]").addEventListener("click", async (ev) => {
    ev.target.disabled = true;

    const rows = SETTING_FIELDS.map(([key]) => ({
      key,
      value: $(`#admin-panel [data-setting="${key}"]`).value.trim() || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await db.from("site_settings").upsert(rows, { onConflict: "key" });
    ev.target.disabled = false;

    if (error) return toastError(error);
    await invalidateSettings();
    toastOk("Οι ρυθμίσεις αποθηκεύτηκαν", "Ανανέωσε τη σελίδα για να δεις τις αλλαγές παντού.");
  });
}
