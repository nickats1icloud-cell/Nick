import { initAuth, onAuthChange, signOut } from "./auth.js";
import { SOCIAL_LINKS } from "./config.js";

const NAV_LINKS = [
  { href: "home.html", label: "Αρχική", page: "home" },
  { href: "articles.html", label: "Άρθρα", page: "articles" },
  { href: "forum.html", label: "Forum", page: "forum" },
  { href: "championships.html", label: "Αγώνες", page: "championships" },
  { href: "members.html", label: "Μέλη", page: "members" },
  { href: "contact.html", label: "Επικοινωνία", page: "contact" },
];

function navbarHtml(activePage) {
  const links = NAV_LINKS.map(
    (link) =>
      `<a class="gsr-navbar__link${link.page === activePage ? " gsr-navbar__link--active" : ""}" href="${link.href}">${link.label}</a>`,
  ).join("");

  return `
    <header class="gsr-navbar">
      <div class="gsr__container gsr-navbar__inner">
        <a href="home.html" class="gsr-navbar__brand">
          <img src="assets/logo.png" alt="Greek Simracers" class="gsr-navbar__logo" />
          <span class="gsr-navbar__wordmark">Greek<span class="gsr__text-gradient">SimRacers</span></span>
        </a>

        <nav class="gsr-navbar__links" aria-label="Κύριο μενού">${links}</nav>

        <div class="gsr-navbar__actions">
          <button type="button" class="gsr__btn gsr__btn--ghost gsr__btn--sm" id="theme-toggle" aria-label="Εναλλαγή θέματος">🌙</button>
          <div id="auth-slot"></div>
          <button type="button" class="gsr-navbar__burger" id="nav-burger" aria-label="Μενού" aria-expanded="false">☰</button>
        </div>
      </div>
      <nav class="gsr-navbar__mobile" id="nav-mobile" aria-label="Κινητό μενού" hidden>${links}</nav>
    </header>
  `;
}

function footerHtml() {
  const year = new Date().getFullYear();
  return `
    <footer class="gsr-footer">
      <div class="gsr__container gsr-footer__grid">
        <div>
          <a href="home.html" class="gsr-navbar__brand">
            <img src="assets/logo.png" alt="Greek Simracers" class="gsr-navbar__logo" />
          </a>
          <p class="gsr-footer__tagline">Η ελληνική κοινότητα sim racing.</p>
          <div class="gsr-footer__social">
            <a href="${SOCIAL_LINKS.discord}" aria-label="Discord">Discord</a>
            <a href="${SOCIAL_LINKS.youtube}" aria-label="YouTube">YouTube</a>
            <a href="${SOCIAL_LINKS.facebook}" aria-label="Facebook">Facebook</a>
          </div>
        </div>
        <div>
          <h4>Πλοήγηση</h4>
          <a href="home.html">Αρχική</a>
          <a href="articles.html">Άρθρα</a>
          <a href="forum.html">Forum</a>
        </div>
        <div>
          <h4>Κοινότητα</h4>
          <a href="auth.html">Εγγραφή</a>
          <a href="about.html">Σχετικά με εμάς</a>
          <a href="contact.html">Επικοινωνία</a>
        </div>
        <div>
          <h4>Νομικά</h4>
          <a href="terms.html">Όροι Χρήσης</a>
          <a href="privacy.html">Πολιτική Απορρήτου</a>
        </div>
      </div>
      <div class="gsr__container gsr-footer__bottom">
        <span>© ${year} Greek Simracers. Με επιφύλαξη παντός δικαιώματος.</span>
        <span>Made with ❤️ in Greece</span>
      </div>
    </footer>
  `;
}

function authSlotHtml({ user }) {
  if (!user) {
    return `<a href="auth.html" class="gsr__btn gsr__btn--primary gsr__btn--sm">Σύνδεση</a>`;
  }
  const name = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email;
  return `
    <span class="gsr-navbar__user">${name}</span>
    <button type="button" class="gsr__btn gsr__btn--outline gsr__btn--sm" id="signout-btn">Έξοδος</button>
  `;
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
}

function wireTheme() {
  const stored = localStorage.getItem("gsr-theme") || "dark";
  applyTheme(stored);
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const next = document.documentElement.classList.contains("light") ? "dark" : "light";
    localStorage.setItem("gsr-theme", next);
    applyTheme(next);
  });
}

function wireMobileMenu() {
  const burger = document.getElementById("nav-burger");
  const mobile = document.getElementById("nav-mobile");
  burger?.addEventListener("click", () => {
    const isOpen = !mobile.hidden;
    mobile.hidden = isOpen;
    burger.setAttribute("aria-expanded", String(!isOpen));
  });
}

function wireAuthSlot() {
  const slot = document.getElementById("auth-slot");
  onAuthChange((state) => {
    if (slot) slot.innerHTML = authSlotHtml(state);
    document.getElementById("signout-btn")?.addEventListener("click", async () => {
      await signOut();
      window.location.href = "home.html";
    });
  });
}

/**
 * Renders the shared navbar/footer into #site-header / #site-footer and
 * wires up theme toggle, mobile menu, and auth-aware UI. Call once per page:
 *   <div id="site-header"></div> ... <div id="site-footer"></div>
 *   <script type="module">
 *     import { mountShell } from "./js/partials.js";
 *     mountShell(document.body.dataset.page);
 *   </script>
 */
export async function mountShell(activePage) {
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  if (header) header.innerHTML = navbarHtml(activePage);
  if (footer) footer.innerHTML = footerHtml();

  wireTheme();
  wireMobileMenu();
  wireAuthSlot();
  try {
    await initAuth();
  } catch (err) {
    // Το shell (nav/footer/θέμα) πρέπει να δουλεύει ακόμα κι αν το
    // Supabase είναι αρρύθμιστο ή μη προσβάσιμο.
    console.warn("Auth initialization failed:", err);
  }
}
