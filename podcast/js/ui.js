/*
 * Κοινό "κέλυφος" κάθε σελίδας: navbar, mobile drawer, footer, theme toggle,
 * scroll reveal, counters, accordions και το canvas του hero.
 *
 * Κάθε σελίδα καλεί `initPage()` μία φορά.
 */

import { SITE, NAV } from "./data/site.js";
import { icon } from "./icons.js";
import { esc } from "./format.js";
import { getTheme, setTheme } from "./store.js";
import { initPlayer } from "./player.js";
import { wireEpisodeActions } from "./render.js";
import { initPalette, openPalette } from "./palette.js";

/* ---------------- Θέμα ---------------- */

/** Εφαρμόζεται όσο πιο νωρίς γίνεται ώστε να μην "αναβοσβήνει" η σελίδα. */
export function applyStoredTheme() {
  const stored = getTheme();
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const light = stored ? stored === "light" : prefersLight;
  document.documentElement.classList.toggle("light", light);
}

function toggleTheme() {
  const light = document.documentElement.classList.toggle("light");
  setTheme(light ? "light" : "dark");
}

/* ---------------- Navbar / Drawer ---------------- */

function currentPage() {
  const file = location.pathname.split("/").pop();
  return file && file !== "" ? file : "index.html";
}

function navLinks(className) {
  const page = currentPage();
  return NAV.map((item) => {
    const active = item.href === page ? ' aria-current="page"' : "";
    return `<a class="${className}" href="${item.href}"${active}>${esc(item.label)}</a>`;
  }).join("");
}

function mountNav() {
  const header = document.createElement("header");
  header.className = "nav";
  header.innerHTML = `
    <div class="container nav__inner">
      <a class="brand" href="index.html">
        <span class="brand__mark">${icon("mic")}</span>
        <span class="brand__text">Greek SimRacers<small>PODCAST</small></span>
      </a>
      <nav class="nav__links" aria-label="Κύρια πλοήγηση">${navLinks("nav__link")}</nav>
      <div class="nav__actions">
        <button class="nav__search" data-open-palette aria-label="Αναζήτηση επεισοδίων">
          ${icon("search")}<span>Αναζήτηση</span><kbd>Ctrl K</kbd>
        </button>
        <button class="icon-btn theme-toggle" data-theme-toggle aria-label="Εναλλαγή θέματος">
          <span class="icon-moon">${icon("moon")}</span><span class="icon-sun">${icon("sun")}</span>
        </button>
        <button class="icon-btn nav__burger" data-drawer-open aria-label="Μενού" aria-expanded="false">
          ${icon("menu")}
        </button>
      </div>
    </div>`;
  document.body.prepend(header);

  const drawer = document.createElement("div");
  drawer.className = "drawer";
  drawer.innerHTML = `
    <div class="drawer__scrim" data-drawer-close></div>
    <nav class="drawer__panel" aria-label="Πλοήγηση για κινητά">
      ${navLinks("")}
      <div class="row" style="margin-top:1.25rem">
        <a class="btn btn--primary" href="subscribe.html">${icon("headphones")} Ακρόασε τώρα</a>
        <button class="btn btn--ghost" data-open-palette>${icon("search")} Αναζήτηση</button>
      </div>
    </nav>`;
  document.body.appendChild(drawer);

  const burger = header.querySelector("[data-drawer-open]");
  const setDrawer = (open) => {
    drawer.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) drawer.querySelector("a")?.focus();
  };

  burger.addEventListener("click", () => setDrawer(!drawer.classList.contains("is-open")));
  drawer.addEventListener("click", (event) => {
    if (event.target.closest("[data-drawer-close]") || event.target.closest("a")) {
      setDrawer(false);
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer.classList.contains("is-open")) setDrawer(false);
  });

  // Σκιά/border μόλις φύγει ο χρήστης από την κορυφή.
  const onScroll = () => header.classList.toggle("is-stuck", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

/* ---------------- Footer ---------------- */

function socialIcon(id) {
  return icon(id) || icon("link");
}

function mountFooter() {
  const footer = document.createElement("footer");
  footer.className = "footer";
  footer.innerHTML = `
    <div class="container footer__grid">
      <div>
        <a class="brand" href="index.html">
          <span class="brand__mark">${icon("mic")}</span>
          <span class="brand__text">Greek SimRacers<small>PODCAST</small></span>
        </a>
        <p style="margin-top:1rem;color:hsl(var(--muted-foreground));font-size:.9rem;max-width:34ch">
          ${esc(SITE.description)}
        </p>
        <div class="social" style="margin-top:1.25rem">
          ${SITE.socials
            .map(
              (s) =>
                `<a class="icon-btn" href="${esc(s.url)}" aria-label="${esc(s.name)}" rel="noopener">${socialIcon(s.id)}</a>`
            )
            .join("")}
        </div>
      </div>
      <div>
        <h4>Πλοήγηση</h4>
        <div class="footer__links">${navLinks("")}</div>
      </div>
      <div>
        <h4>Άκου</h4>
        <div class="footer__links">
          ${SITE.platforms
            .map((p) => `<a href="${esc(p.url)}" rel="noopener">${esc(p.name)}</a>`)
            .join("")}
        </div>
      </div>
      <div>
        <h4>Κοινότητα</h4>
        <div class="footer__links">
          <a href="${esc(SITE.communityUrl)}">greeksimracers.gr</a>
          <a href="contact.html">Γίνε καλεσμένος</a>
          <a href="contact.html">Χορηγίες</a>
          <a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a>
        </div>
      </div>
    </div>
    <div class="container footer__bottom">
      <span>© ${new Date().getFullYear()} ${esc(SITE.name)} · Φτιαγμένο στην Ελλάδα</span>
      <span>Ηχογραφείται κάθε Τετάρτη, βγαίνει κάθε Πέμπτη 20:00</span>
    </div>`;
  document.body.appendChild(footer);
}

/* ---------------- Scroll reveal ---------------- */

export function initReveal(root = document) {
  const nodes = root.querySelectorAll("[data-reveal]:not(.is-visible)");
  if (!nodes.length) return;

  if (!("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );

  nodes.forEach((node) => observer.observe(node));
}

/* ---------------- Counters ---------------- */

export function initCounters(root = document) {
  const nodes = root.querySelectorAll("[data-count]");
  if (!nodes.length) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const run = (node) => {
    const target = Number(node.dataset.count) || 0;
    const suffix = node.dataset.suffix || "";
    const format = (value) =>
      value >= 1000 ? Math.round(value).toLocaleString("el-GR") : Math.round(value);

    if (reduced) {
      node.textContent = format(target) + suffix;
      return;
    }

    const duration = 1200;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = format(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          run(entry.target);
          obs.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.4 }
  );

  nodes.forEach((node) => observer.observe(node));
}

/* ---------------- Accordions ---------------- */

export function initAccordions(root = document) {
  root.querySelectorAll(".acc").forEach((acc) => {
    acc.addEventListener("click", (event) => {
      const button = event.target.closest(".acc__btn");
      if (!button) return;
      const open = button.getAttribute("aria-expanded") === "true";
      // Ένα ανοιχτό τη φορά — κρατάει τη λίστα ευανάγνωστη.
      acc.querySelectorAll(".acc__btn").forEach((other) =>
        other.setAttribute("aria-expanded", "false")
      );
      button.setAttribute("aria-expanded", String(!open));
    });
  });
}

/* ---------------- Hero canvas ---------------- */

export function initHeroCanvas(canvas) {
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    canvas.remove();
    return;
  }

  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let raf = null;
  let particles = [];

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.max(14, Math.min(46, Math.round(width / 26)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      len: 40 + Math.random() * 120,
      speed: 0.6 + Math.random() * 2.4,
      alpha: 0.06 + Math.random() * 0.16,
    }));
  };

  const draw = () => {
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      const gradient = ctx.createLinearGradient(p.x, p.y, p.x + p.len, p.y);
      gradient.addColorStop(0, `rgba(249,115,22,0)`);
      gradient.addColorStop(0.5, `rgba(249,115,22,${p.alpha})`);
      gradient.addColorStop(1, `rgba(99,102,241,0)`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.len, p.y);
      ctx.stroke();

      p.x += p.speed;
      if (p.x > width + p.len) {
        p.x = -p.len;
        p.y = Math.random() * height;
      }
    }
    raf = requestAnimationFrame(draw);
  };

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  };

  resize();
  draw();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!raf) draw();
  });
}

/* ---------------- Init ---------------- */

/** Καλείται από κάθε σελίδα. */
export function initPage() {
  applyStoredTheme();
  mountNav();
  mountFooter();

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-theme-toggle]")) toggleTheme();
    if (event.target.closest("[data-open-palette]")) openPalette();
  });

  initPlayer();
  wireEpisodeActions();
  initPalette();
  initReveal();
  initCounters();
  initAccordions();
  initHeroCanvas(document.querySelector("[data-hero-canvas]"));
}
