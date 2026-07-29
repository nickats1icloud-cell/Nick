/**
 * ui.js — μικρά, χωρίς εξαρτήσεις helpers που χρησιμοποιούν όλες οι σελίδες:
 * DOM shortcuts, escaping, μορφοποίηση ημερομηνιών/χρόνων, toasts, modals,
 * avatars, skeletons.
 *
 * Κανόνας ασφαλείας: ΟΤΙΔΗΠΟΤΕ έρχεται από τη βάση περνάει από `esc()` πριν
 * μπει σε template string. Τα μόνα σημεία που γράφουν raw HTML είναι το
 * `markdown.js` (που κάνει το δικό του escaping) και τα στατικά templates.
 */

/* --------------------------------------------------------------------------
   DOM
   -------------------------------------------------------------------------- */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, html) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? "" : String(value));
  }
  if (html !== undefined) node.innerHTML = html;
  return node;
}

/** Αντικαθιστά το περιεχόμενο ενός container με HTML string. */
export function render(target, html) {
  const node = typeof target === "string" ? $(target) : target;
  if (node) node.innerHTML = html;
  return node;
}


/** Παράμετρος από το query string (π.χ. `?id=…`). */
export const param = (name) => new URLSearchParams(location.search).get(name);

/* --------------------------------------------------------------------------
   Escaping & κείμενο
   -------------------------------------------------------------------------- */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Ασφαλές attribute για URL — μπλοκάρει `javascript:` κ.λπ. */
export function safeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(https?:|mailto:|tel:|\/|\.|#|\?)/i.test(raw)) return esc(raw);
  return "";
}

const initials = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();

/** Το πιο «ανθρώπινο» όνομα από ένα profile row. */
export function nameOf(profile, fallback = "Άγνωστος") {
  if (!profile) return fallback;
  return profile.display_name || profile.username || fallback;
}

/* --------------------------------------------------------------------------
   Ημερομηνίες & χρόνοι
   -------------------------------------------------------------------------- */

const EL = "el-GR";

export function fmtDate(value, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(EL, opts);
}

export function fmtDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(EL, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "5λ", "3ω", "2μ" — ίδια λογική με το αρχικό CommunitySection. */
export function timeAgo(value) {
  if (!value) return "";
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return "μόλις τώρα";
  if (mins < 60) return `${mins}λ`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ω`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `${days}μ`;
  return fmtDate(value, { day: "numeric", month: "short" });
}

/** 83421 → "1:23.421" */
export function fmtLap(ms) {
  if (!ms || ms <= 0) return "—";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/** "1:23.421" ή "83.421" → ms. Επιστρέφει null αν δεν παρσάρεται. */
export function parseLap(text) {
  const raw = String(text || "").trim();
  const match = raw.match(/^(?:(\d+):)?(\d{1,2})[.,](\d{1,3})$/);
  if (!match) return null;
  const [, min, sec, frac] = match;
  const millis = Number(frac.padEnd(3, "0"));
  return (Number(min || 0) * 60 + Number(sec)) * 1000 + millis;
}

export const fmtPrice = (value) => `${Number(value || 0).toFixed(2)}€`;

/** Ο χρήστης θεωρείται online αν έχει φανεί τα τελευταία 5 λεπτά. */
export function isOnline(lastSeen) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

/* --------------------------------------------------------------------------
   Κομμάτια HTML που επαναχρησιμοποιούνται
   -------------------------------------------------------------------------- */

export function avatar(profile, size = "") {
  const url = safeUrl(profile?.avatar_url);
  const cls = `hub-avatar ${size ? `hub-avatar--${size}` : ""}`;
  if (url) return `<img class="${cls}" src="${url}" alt="" loading="lazy" />`;
  return `<span class="${cls} hub-avatar--fallback">${esc(initials(nameOf(profile, "?")))}</span>`;
}

export function spinner(label = "Φόρτωση…") {
  return `<div class="hub-loading"><div class="hub-spinner"></div><p class="u-small" style="margin-top:10px">${esc(label)}</p></div>`;
}

export function empty(message, icon = "🏁", extraHtml = "") {
  return `<div class="hub-empty"><div class="hub-empty__icon">${icon}</div><p>${esc(message)}</p>${extraHtml}</div>`;
}

export function skeletonCards(count = 6, height = 150) {
  return Array.from({ length: count })
    .map(() => `<div class="hub-skel" style="height:${height}px"></div>`)
    .join("");
}

/* --------------------------------------------------------------------------
   Toasts
   -------------------------------------------------------------------------- */

function toastHost() {
  let host = $(".hub-toasts");
  if (!host) {
    host = el("div", { class: "hub-toasts", role: "status", "aria-live": "polite" });
    document.body.appendChild(host);
  }
  return host;
}

/**
 * toast("Τίτλος", { body: "…", tone: "ok" | "bad" | "info" })
 */
export function toast(title, { body = "", tone = "info", ms = 4200 } = {}) {
  const node = el(
    "div",
    { class: `hub-toast hub-toast--${tone}` },
    `<p class="hub-toast__title">${esc(title)}</p>${body ? `<p class="hub-toast__body">${esc(body)}</p>` : ""}`,
  );
  toastHost().appendChild(node);
  setTimeout(() => {
    node.style.transition = "opacity 200ms ease, transform 200ms ease";
    node.style.opacity = "0";
    node.style.transform = "translateY(8px)";
    setTimeout(() => node.remove(), 220);
  }, ms);
  return node;
}

export const toastOk = (title, body) => toast(title, { body, tone: "ok" });

/** Μεταφράζει ένα σφάλμα Supabase σε toast. */
export function toastError(error, fallback = "Κάτι πήγε στραβά") {
  toast("Σφάλμα", { body: error?.message || fallback, tone: "bad" });
}

/* --------------------------------------------------------------------------
   Modal
   -------------------------------------------------------------------------- */

/**
 * openModal({ title, body, footer, wide, onMount })
 * Επιστρέφει { root, close }. Κλείνει με Esc, κλικ στο backdrop ή [data-close].
 */
export function openModal({ title = "", body = "", footer = "", wide = false, onMount } = {}) {
  const root = el(
    "div",
    { class: "hub-modal", role: "dialog", "aria-modal": "true" },
    `<div class="hub-modal__box ${wide ? "hub-modal__box--wide" : ""}">
       <div class="hub-modal__head">
         <h3>${esc(title)}</h3>
         <button type="button" class="hub-modal__x" data-close aria-label="Κλείσιμο">×</button>
       </div>
       <div class="hub-modal__body">${body}</div>
       ${footer ? `<div class="hub-modal__foot">${footer}</div>` : ""}
     </div>`,
  );

  const close = () => {
    root.remove();
    document.body.classList.remove("is-locked");
    document.removeEventListener("keydown", onKey);
  };

  function onKey(ev) {
    if (ev.key === "Escape") close();
  }

  root.addEventListener("click", (ev) => {
    if (ev.target === root || ev.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.classList.add("is-locked");
  document.body.appendChild(root);

  const box = $(".hub-modal__box", root);
  box.querySelector("input, textarea, select, button:not([data-close])")?.focus();
  onMount?.(root, close);

  return { root, close };
}

/** Επιβεβαίωση (αντικαθιστά το window.confirm ώστε να ταιριάζει στο θέμα). */
export function confirmAction(message, { title = "Επιβεβαίωση", danger = true } = {}) {
  return new Promise((resolve) => {
    const { root, close } = openModal({
      title,
      body: `<p>${esc(message)}</p>`,
      footer: `<button type="button" class="hub-btn hub-btn--ghost" data-close>Άκυρο</button>
               <button type="button" class="hub-btn ${danger ? "hub-btn--danger" : "hub-btn--primary"}" data-yes>Ναι</button>`,
    });
    root.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-yes]")) {
        resolve(true);
        close();
      } else if (ev.target === root || ev.target.closest("[data-close]")) {
        resolve(false);
      }
    });
  });
}

/* --------------------------------------------------------------------------
   Λοιπά
   -------------------------------------------------------------------------- */

/** Φτιάχνει Map<user_id, profile> από array προφίλ. */
export const byUserId = (rows) => new Map((rows || []).map((row) => [row.user_id, row]));

/** Μοναδικά, χωρίς null. */
export const uniq = (values) => Array.from(new Set((values || []).filter(Boolean)));

export function debounce(fn, ms = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

