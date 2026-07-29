/**
 * shell.js — το κοινό «κέλυφος» κάθε σελίδας: navbar (με dropdowns,
 * ειδοποιήσεις, θέμα, mobile drawer), footer, κουμπί επιστροφής στην κορυφή
 * και τα διακοσμητικά backgrounds.
 *
 * Κάθε σελίδα καλεί `mountShell("<page-key>")` μία φορά.
 */

import { db, safe } from "./supabase-client.js";
import { initAuth, onAuth, session, settings, loadSettings, signOut } from "./auth.js";
import { $, $$, el, esc, safeUrl, fmtDateTime } from "./ui.js";

/* --------------------------------------------------------------------------
   Χάρτης πλοήγησης
   -------------------------------------------------------------------------- */

const COMMUNITY = [
  { href: "articles.html", key: "articles", label: "Άρθρα", glyph: "📰", desc: "Νέα & αναλύσεις" },
  { href: "forum.html", key: "forum", label: "Forum", glyph: "💬", desc: "Συζητήσεις" },
  { href: "teams.html", key: "teams", label: "Ομάδες", glyph: "👥", desc: "Racing teams" },
  { href: "driver-of-the-month.html", key: "dotm", label: "Οδηγός Μήνα", glyph: "🏅", desc: "Ψηφοφορία" },
];

const RACING = [
  { href: "championships.html", key: "championships", label: "Αγώνες", glyph: "🏆", desc: "Πρωταθλήματα" },
  { href: "predictions.html", key: "predictions", label: "Predictions", glyph: "🎯", desc: "Πρόβλεψε & κέρδισε" },
  { href: "lap-times.html", key: "laptimes", label: "Lap Times", glyph: "⏱", desc: "Χρόνοι γύρου" },
  { href: "incidents.html", key: "incidents", label: "Incidents", glyph: "⚠️", desc: "Αναφορές" },
  { href: "achievements.html", key: "achievements", label: "Badges", glyph: "🎖", desc: "Επιτεύγματα" },
];

const MAIN = [
  { href: "home.html", key: "home", label: "Αρχική" },
  { dropdown: "community", label: "Κοινότητα", items: COMMUNITY },
  { dropdown: "racing", label: "Racing", items: RACING },
  { href: "members.html", key: "members", label: "Μέλη" },
  { href: "games-hub.html", key: "games", label: "Games Hub" },
  { href: "podcasts.html", key: "podcasts", label: "Podcasts" },
  { href: "shop.html", key: "shop", label: "Shop" },
  { href: "contact.html", key: "contact", label: "Επικοινωνία" },
];

/* --------------------------------------------------------------------------
   Social icons
   -------------------------------------------------------------------------- */

const ICONS = {
  discord:
    '<svg viewBox="0 0 24 24"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03z"/></svg>',
  youtube:
    '<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
  spotify:
    '<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
};

const BRAND_COLORS = { discord: "#5865F2", youtube: "#FF0000", facebook: "#1877F2", spotify: "#1DB954" };

function socialLinks() {
  return [
    { key: "discord", label: "Discord", href: settings.discord_invite },
    { key: "youtube", label: "YouTube", href: settings.youtube_url },
    { key: "facebook", label: "Facebook", href: settings.facebook_url },
    { key: "spotify", label: "Spotify", href: settings.spotify_url },
  ];
}

function socialsHtml() {
  return socialLinks()
    .map(
      (item) =>
        `<a class="hub-social" href="${safeUrl(item.href) || "#"}" target="_blank" rel="noopener noreferrer"
            title="${esc(item.label)}" aria-label="${esc(item.label)}" style="--brand-color:${BRAND_COLORS[item.key]}">${ICONS[item.key]}</a>`,
    )
    .join("");
}

/* --------------------------------------------------------------------------
   Θέμα
   -------------------------------------------------------------------------- */

const THEME_KEY = "hub-theme";

export function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle("theme-light", theme === "light");
  root.classList.toggle("theme-dark", theme !== "light");
  root.style.colorScheme = theme === "light" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, theme);
  $$("[data-theme-toggle]").forEach((btn) => {
    btn.textContent = theme === "light" ? "🌙" : "☀️";
    btn.setAttribute("aria-label", theme === "light" ? "Σκοτεινό θέμα" : "Φωτεινό θέμα");
  });
}

export function currentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/* --------------------------------------------------------------------------
   Navbar
   -------------------------------------------------------------------------- */

function dropdownHtml(id, label, items, active) {
  const isActive = items.some((item) => item.key === active);
  return `<div class="hub-drop" data-drop="${id}">
    <button type="button" class="hub-drop__btn ${isActive ? "is-active" : ""}" aria-expanded="false">
      ${esc(label)}<span class="hub-drop__caret">▼</span>
    </button>
    <div class="hub-drop__menu">
      ${items
        .map(
          (item) => `<a class="hub-drop__item ${item.key === active ? "is-active" : ""}" href="${item.href}">
            <span class="hub-drop__glyph">${item.glyph}</span>
            <span><span class="hub-drop__label">${esc(item.label)}</span><br /><span class="hub-drop__desc">${esc(item.desc)}</span></span>
          </a>`,
        )
        .join("")}
    </div>
  </div>`;
}

function navHtml(active) {
  const links = MAIN.map((item) =>
    item.dropdown
      ? dropdownHtml(item.dropdown, item.label, item.items, active)
      : `<a class="hub-nav__link ${item.key === active ? "is-active" : ""}" href="${item.href}">${esc(item.label)}</a>`,
  ).join("");

  return `<nav class="hub-nav" aria-label="Κύρια πλοήγηση">
    <div class="u-shell hub-nav__inner">
      <a class="hub-nav__brand" href="home.html">
        <img class="hub-nav__logo" src="assets/logo.png" alt="" />
        <span class="hub-nav__word">Greek<em>SimRacers</em></span>
      </a>

      <div class="hub-nav__links">${links}</div>

      <div class="hub-nav__tools">
        <div class="hub-nav__socials">${socialsHtml()}</div>
        <button type="button" class="hub-icon-btn" data-theme-toggle>☀️</button>
        <div id="nav-auth" class="u-row" style="gap:6px"></div>
        <button type="button" class="hub-nav__burger" data-burger aria-expanded="false" aria-label="Μενού">☰</button>
      </div>
    </div>
  </nav>
  <div class="hub-drawer" data-drawer hidden>
    <div class="u-shell">
      ${MAIN.filter((item) => !item.dropdown)
        .map(
          (item) =>
            `<a class="hub-drawer__link ${item.key === active ? "is-active" : ""}" href="${item.href}">${esc(item.label)}</a>`,
        )
        .join("")}
      <div class="hub-drawer__group">
        <p class="hub-drawer__title">Κοινότητα</p>
        ${COMMUNITY.map(
          (item) =>
            `<a class="hub-drawer__link ${item.key === active ? "is-active" : ""}" href="${item.href}"><span>${item.glyph}</span>${esc(item.label)}</a>`,
        ).join("")}
      </div>
      <div class="hub-drawer__group">
        <p class="hub-drawer__title">Racing</p>
        ${RACING.map(
          (item) =>
            `<a class="hub-drawer__link ${item.key === active ? "is-active" : ""}" href="${item.href}"><span>${item.glyph}</span>${esc(item.label)}</a>`,
        ).join("")}
      </div>
      <div class="hub-drawer__group" id="drawer-auth"></div>
      <div class="hub-drawer__group u-row u-row--wrap">${socialsHtml()}</div>
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   Footer
   -------------------------------------------------------------------------- */

function footerHtml() {
  let custom = [];
  try {
    if (settings.footer_custom_links) custom = JSON.parse(settings.footer_custom_links);
  } catch {
    /* αγνόησε λάθος JSON από το admin panel */
  }

  const columns = [
    {
      title: "Πλοήγηση",
      links: [
        ["home.html", "Αρχική"],
        ["articles.html", "Άρθρα"],
        ["forum.html", "Forum"],
        ["games-hub.html", "Games Hub"],
        ["podcasts.html", "Podcasts"],
        ["shop.html", "Shop"],
      ],
    },
    {
      title: "Κοινότητα",
      links: [
        ["auth.html", "Εγγραφή"],
        ["members.html", "Μέλη"],
        ["about.html", "Σχετικά με εμάς"],
        ["contact.html", "Επικοινωνία"],
        ["support.html", "Support"],
      ],
    },
    {
      title: "Νομικά",
      links: [
        ["terms.html", "Όροι Χρήσης"],
        ["privacy.html", "Πολιτική Απορρήτου"],
        ["privacy.html#cookies", "Cookies"],
        ["privacy.html#gdpr", "GDPR"],
      ],
    },
  ];

  return `<footer class="hub-footer">
    <div class="u-shell">
      <div class="hub-footer__grid">
        <div>
          <a class="hub-nav__brand" href="home.html">
            <img class="hub-nav__logo" src="assets/logo.png" alt="" />
            <span class="hub-nav__word">Greek<em>SimRacers</em></span>
          </a>
          <p class="hub-footer__tagline">${esc(settings.site_tagline)}</p>
          <div class="hub-footer__socials">${socialsHtml()}</div>
        </div>
        ${columns
          .map(
            (col) => `<div class="hub-footer__col">
              <h4>${esc(col.title)}</h4>
              ${col.links.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join("")}
            </div>`,
          )
          .join("")}
      </div>
      ${
        custom.length
          ? `<div class="u-row u-row--wrap u-center" style="justify-content:center;gap:18px;padding-bottom:18px">
              ${custom
                .map(
                  (link) =>
                    `<a class="u-small u-dim" href="${safeUrl(link.url) || "#"}" ${/^https?:/i.test(link.url || "") ? 'target="_blank" rel="noopener noreferrer"' : ""}>${esc(link.label)}</a>`,
                )
                .join("")}
            </div>`
          : ""
      }
      <div class="hub-footer__bottom">
        <span>© ${new Date().getFullYear()} ${esc(settings.site_name)}. Όλα τα δικαιώματα κατοχυρωμένα.</span>
        <span>${esc(settings.footer_text)}</span>
      </div>
    </div>
  </footer>`;
}

/* --------------------------------------------------------------------------
   Ειδοποιήσεις (καμπανάκι)
   -------------------------------------------------------------------------- */

let notifChannel = null;

async function fetchNotifications() {
  if (!session.user) return [];
  return (
    (await safe(
      db
        .from("notifications")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      [],
    )) || []
  );
}

function notifPopoverHtml(rows) {
  const items = rows.length
    ? rows
        .map(
          (row) => `<a class="hub-notifs__item ${row.read ? "" : "is-unread"}" href="${safeUrl(row.link) || "notifications.html"}">
            <strong>${esc(row.title)}</strong>
            <span class="u-tiny">${esc(row.message || "")}</span>
            <span class="u-tiny u-faint" style="display:block;margin-top:3px">${fmtDateTime(row.created_at)}</span>
          </a>`,
        )
        .join("")
    : '<p class="u-small u-faint u-center" style="padding:26px 0">Καμία ειδοποίηση</p>';

  return `<div class="hub-notifs">
    <div class="hub-notifs__head"><span>Ειδοποιήσεις</span><a class="u-tiny" href="notifications.html">Προβολή όλων</a></div>
    <div class="hub-notifs__list">${items}</div>
  </div>`;
}

function mountBell(container) {
  const wrap = el("div", { style: "position:relative" });
  wrap.innerHTML = `<button type="button" class="hub-icon-btn" data-bell aria-label="Ειδοποιήσεις">🔔<span class="hub-icon-btn__count u-hide" data-bell-count>0</span></button>`;
  container.appendChild(wrap);

  const button = $("[data-bell]", wrap);
  const counter = $("[data-bell-count]", wrap);
  let popover = null;

  const refresh = async () => {
    const rows = await fetchNotifications();
    const unread = rows.filter((row) => !row.read).length;
    counter.textContent = unread > 9 ? "9+" : String(unread);
    counter.classList.toggle("u-hide", unread === 0);
    if (popover) {
      popover.remove();
      popover = wrap.appendChild(el("div", {}, notifPopoverHtml(rows)).firstElementChild);
    }
    return rows;
  };

  button.addEventListener("click", async () => {
    if (popover) {
      popover.remove();
      popover = null;
      return;
    }
    const rows = await fetchNotifications();
    popover = wrap.appendChild(el("div", {}, notifPopoverHtml(rows)).firstElementChild);
    // Μαρκάρισμα ως διαβασμένα (όπως στο αρχικό Navbar)
    if (rows.some((row) => !row.read)) {
      await safe(
        db.from("notifications").update({ read: true }).eq("user_id", session.user.id).eq("read", false),
      );
      counter.classList.add("u-hide");
    }
  });

  document.addEventListener("click", (ev) => {
    if (popover && !wrap.contains(ev.target)) {
      popover.remove();
      popover = null;
    }
  });

  refresh();

  // Realtime: νέα ειδοποίηση → ανανέωση μετρητή
  if (notifChannel) db.removeChannel(notifChannel);
  notifChannel = db
    .channel("hub-notifications")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` },
      refresh,
    )
    .subscribe();
}

/* --------------------------------------------------------------------------
   Περιοχή σύνδεσης στο navbar
   -------------------------------------------------------------------------- */

function renderAuthArea() {
  const slot = $("#nav-auth");
  const drawerSlot = $("#drawer-auth");
  if (!slot) return;

  slot.innerHTML = "";

  if (!session.user) {
    slot.innerHTML = `<a class="hub-btn hub-btn--primary hub-btn--sm" href="auth.html">Σύνδεση</a>`;
    if (drawerSlot) drawerSlot.innerHTML = `<a class="hub-btn hub-btn--primary hub-btn--block" href="auth.html">Σύνδεση / Εγγραφή</a>`;
    if (notifChannel) {
      db.removeChannel(notifChannel);
      notifChannel = null;
    }
    return;
  }

  mountBell(slot);

  const label = esc(session.profile?.display_name || session.user.email?.split("@")[0] || "Προφίλ");
  slot.insertAdjacentHTML(
    "beforeend",
    `<a class="hub-btn hub-btn--ghost hub-btn--sm" href="profile.html" style="max-width:150px"><span class="u-truncate">${label}</span></a>
     ${session.isAdmin ? '<a class="hub-btn hub-btn--sm" href="admin.html" style="border-color:hsl(var(--ember)/0.5);color:hsl(var(--ember))">Admin</a>' : ""}
     <button type="button" class="hub-btn hub-btn--ghost hub-btn--sm" data-signout>Έξοδος</button>`,
  );

  if (drawerSlot) {
    drawerSlot.innerHTML = `
      <a class="hub-drawer__link" href="profile.html"><span>👤</span>Προφίλ</a>
      <a class="hub-drawer__link" href="notifications.html"><span>🔔</span>Ειδοποιήσεις</a>
      <a class="hub-drawer__link" href="support.html"><span>🎧</span>Support</a>
      ${session.isAdmin ? '<a class="hub-drawer__link" href="admin.html"><span>🛡</span>Admin Panel</a>' : ""}
      <button type="button" class="hub-btn hub-btn--ghost hub-btn--block" data-signout style="margin-top:8px">Αποσύνδεση</button>`;
  }

  $$("[data-signout]").forEach((button) => button.addEventListener("click", signOut));
}

/* --------------------------------------------------------------------------
   Mount
   -------------------------------------------------------------------------- */

function wireNav() {
  // Dropdowns. Ανοίγουν με hover σε desktop και με click παντού.
  // Το `via` ξεχωρίζει τα δύο: ένα μενού που άνοιξε με hover ΔΕΝ πρέπει να
  // κλείσει από το κλικ που ακολουθεί (αλλιώς το κλικ φαίνεται «νεκρό»), και
  // ένα που άνοιξε με κλικ δεν πρέπει να φύγει μόλις βγει ο κέρσορας.
  const canHover = window.matchMedia?.("(hover: hover)").matches ?? false;

  $$("[data-drop]").forEach((drop) => {
    const button = $(".hub-drop__btn", drop);
    let timer;

    const open = (via) => {
      clearTimeout(timer);
      $$("[data-drop]").forEach((other) => {
        if (other !== drop) other.classList.remove("is-open");
      });
      drop.classList.add("is-open");
      drop.dataset.via = via;
      button.setAttribute("aria-expanded", "true");
    };

    const close = () => {
      clearTimeout(timer);
      drop.classList.remove("is-open");
      delete drop.dataset.via;
      button.setAttribute("aria-expanded", "false");
    };

    button.addEventListener("click", () => {
      if (drop.dataset.via === "click") close();
      else open("click");
    });

    if (canHover) {
      drop.addEventListener("mouseenter", () => {
        if (!drop.classList.contains("is-open")) open("hover");
        else clearTimeout(timer);
      });
      drop.addEventListener("mouseleave", () => {
        if (drop.dataset.via !== "hover") return;
        timer = setTimeout(close, 160);
      });
    }

    document.addEventListener("click", (ev) => {
      if (!drop.contains(ev.target)) close();
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") close();
    });
  });

  // Mobile drawer
  const burger = $("[data-burger]");
  const drawer = $("[data-drawer]");
  burger?.addEventListener("click", () => {
    const open = drawer.hidden;
    drawer.hidden = !open;
    burger.textContent = open ? "✕" : "☰";
    burger.setAttribute("aria-expanded", String(open));
  });

  // Θέμα
  $$("[data-theme-toggle]").forEach((button) =>
    button.addEventListener("click", () => applyTheme(document.documentElement.classList.contains("theme-light") ? "dark" : "light")),
  );
}

function mountToTop() {
  const button = el("button", { class: "hub-totop", type: "button", "aria-label": "Επιστροφή στην κορυφή" }, "↑");
  button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  document.body.appendChild(button);
  const update = () => button.classList.toggle("is-shown", window.scrollY > 500);
  window.addEventListener("scroll", update, { passive: true });
  update();
}

function mountBackdrop() {
  if ($(".hub-fx")) return;
  document.body.insertAdjacentHTML(
    "afterbegin",
    '<div class="hub-fx" aria-hidden="true"><div class="hub-fx__grid"></div><div class="hub-fx__glow hub-fx__glow--a"></div><div class="hub-fx__glow hub-fx__glow--b"></div></div>',
  );
}

/**
 * Στήνει navbar + footer + βοηθητικά. Επιστρέφει promise που λύνεται όταν
 * είναι γνωστή η κατάσταση σύνδεσης.
 *
 * @param {string} active — key της τρέχουσας σελίδας (βλ. MAIN/COMMUNITY/RACING)
 * @param {{ backdrop?: boolean, footer?: boolean }} opts
 */
export async function mountShell(active, { backdrop = true, footer = true } = {}) {
  applyTheme(currentTheme());

  // Το κέλυφος στήνεται ΑΜΕΣΩΣ με τις προεπιλογές του config.js. Δεν
  // περιμένουμε τη βάση: αν το Supabase αργεί ή είναι εκτός, η σελίδα πρέπει
  // να έχει πλοήγηση ούτως ή άλλως. Τα `site_settings` έρχονται μετά και
  // ενημερώνουν όσα κομμάτια τα χρησιμοποιούν.
  const navSlot = $("[data-shell-nav]") || document.body;
  navSlot.insertAdjacentHTML("afterbegin", navHtml(active));

  const footSlot = footer ? $("[data-shell-footer]") || document.body.appendChild(el("div")) : null;
  if (footSlot) footSlot.innerHTML = footerHtml();

  if (backdrop) mountBackdrop();
  wireNav();
  mountToTop();

  initAuth();
  onAuth(() => renderAuthArea());

  loadSettings().then(() => {
    // Ξαναγράφουμε μόνο ό,τι εξαρτάται από ρυθμίσεις.
    $(".hub-nav__socials").innerHTML = socialsHtml();
    if (footSlot) footSlot.innerHTML = footerHtml();
    document.title = document.title.replace("{site}", settings.site_name);
  });

  return session;
}

