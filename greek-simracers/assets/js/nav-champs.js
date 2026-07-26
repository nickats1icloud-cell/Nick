// Dropdown «Πρωταθλήματα» στο κύριο μενού — η αρχή του Championship Hub.
//
// Το μενού έχει δύο μέρη:
//   1. σταθερούς συνδέσμους προς τις ενότητες του hub, και
//   2. τη ζωντανή λίστα των πρωταθλημάτων από τη βάση (κανένα όνομα δεν
//      είναι γραμμένο στον κώδικα — προστίθεται πρωτάθλημα, εμφανίζεται εδώ).
//
// Χωρίς JavaScript ή χωρίς σύνδεση στη βάση, το κουμπί παραμένει σύνδεσμος
// προς τη σελίδα των πρωταθλημάτων και τίποτα δεν σπάει.
(function () {
  const CACHE_KEY = "gsr:nav-champs";
  const CACHE_TTL = 5 * 60 * 1000; // 5 λεπτά — αρκετά για να μη χτυπάμε τη βάση σε κάθε σελίδα
  const MAX_ITEMS = 6;

  const STATUS_LABEL = {
    active: "Σε εξέλιξη",
    upcoming: "Έρχεται",
    completed: "Ολοκληρώθηκε",
  };
  // Σειρά προτεραιότητας: πρώτα ό,τι τρέχει τώρα.
  const STATUS_ORDER = { active: 0, upcoming: 1, completed: 2 };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---------- Συμπεριφορά μενού ----------

  function setupDropdown(drop) {
    const btn = drop.querySelector(".nav-drop__btn");
    const menu = drop.querySelector(".nav-drop__menu");
    if (!btn || !menu) return null;

    let hoverTimer = null;
    const canHover = window.matchMedia("(hover: hover) and (min-width: 1121px)");

    function setOpen(open) {
      drop.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      menu.hidden = !open;
    }

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      // Στο desktop το μενού έχει ήδη ανοίξει με το hover, οπότε το κλικ
      // κάνει αυτό που περιμένει ο χρήστης: πάει στη σελίδα των
      // πρωταθλημάτων. Σε αφή (χωρίς hover) το κλικ ανοιγοκλείνει.
      if (canHover.matches) {
        window.location.href = "championships.html";
        return;
      }
      setOpen(menu.hidden);
    });

    // Στο desktop ανοίγει και με το ποντίκι, με μικρή καθυστέρηση στο κλείσιμο
    // ώστε να προλαβαίνει ο κέρσορας να φτάσει στο μενού.
    drop.addEventListener("pointerenter", () => {
      if (!canHover.matches) return;
      clearTimeout(hoverTimer);
      setOpen(true);
    });

    drop.addEventListener("pointerleave", () => {
      if (!canHover.matches) return;
      hoverTimer = setTimeout(() => setOpen(false), 180);
    });

    // Escape κλείνει και επιστρέφει την εστίαση στο κουμπί.
    drop.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !menu.hidden) {
        setOpen(false);
        btn.focus();
      }
      if (event.key === "ArrowDown" && event.target === btn) {
        event.preventDefault();
        setOpen(true);
        const first = menu.querySelector("a");
        if (first) first.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (!menu.hidden && !drop.contains(event.target)) setOpen(false);
    });

    // Αν φύγει η εστίαση εντελώς από το dropdown (Tab), κλείνει.
    drop.addEventListener("focusout", () => {
      setTimeout(() => {
        if (!drop.contains(document.activeElement)) setOpen(false);
      }, 0);
    });

    return { setOpen };
  }

  // ---------- Ζωντανή λίστα πρωταθλημάτων ----------

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || Date.now() - parsed.at > CACHE_TTL) return null;
      return parsed.items;
    } catch (err) {
      return null;
    }
  }

  function writeCache(items) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
    } catch (err) {
      /* private mode ή γεμάτο storage — απλά δεν κρατάμε cache */
    }
  }

  function renderList(host, items) {
    if (!items.length) {
      host.closest("[data-nav-champs-group]").hidden = true;
      return;
    }

    host.innerHTML = items
      .map((champ) => {
        const status = STATUS_LABEL[champ.status] || champ.status || "";
        return (
          `<a class="nav-drop__champ" href="championship.html?id=${encodeURIComponent(champ.id)}">` +
          `<span class="nav-drop__champ-name">${escapeHtml(champ.title)}</span>` +
          `<span class="nav-drop__champ-meta">` +
          `<span class="nav-drop__dot nav-drop__dot--${escapeHtml(champ.status || "unknown")}" aria-hidden="true"></span>` +
          `${escapeHtml(status)}${champ.category ? " · " + escapeHtml(champ.category) : ""}` +
          `</span></a>`
        );
      })
      .join("");

    host.closest("[data-nav-champs-group]").hidden = false;
  }

  async function loadChampionships(host) {
    const cached = readCache();
    if (cached) {
      renderList(host, cached);
      return;
    }

    if (typeof supabaseClient === "undefined" || !supabaseClient) return;

    const { data, error } = await supabaseClient
      .from("championships")
      .select("id, title, status, category")
      .order("created_at", { ascending: false });

    if (error || !data) return;

    const items = data
      .slice()
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
      .slice(0, MAX_ITEMS);

    writeCache(items);
    renderList(host, items);
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-nav-drop]").forEach(setupDropdown);

    const host = document.querySelector("[data-nav-champs]");
    if (host) loadChampionships(host);
  });
})();
