// Forum της κοινότητας — hash routing πάνω σε μία στατική σελίδα (forum.html):
//   #/                          → λίστα κατηγοριών
//   #/category/<id>[/page/<n>]  → συζητήσεις κατηγορίας (σελιδοποίηση + αναζήτηση)
//   #/thread/<id>[/page/<n>]    → μηνύματα συζήτησης σε στυλ XenForo
// Τα δεδομένα έρχονται από το Supabase (window.supabaseClient) με RLS:
// δημόσια ανάγνωση, εγγραφή μόνο για συνδεδεμένα μέλη, moderation για admins
// (τα policies το επιβάλλουν server-side — το UI απλώς δείχνει/κρύβει κουμπιά).
(function () {
  const viewEl = document.getElementById("forum-view");
  if (!viewEl) return;

  const PAGE_SIZE = 20; // συζητήσεις ανά σελίδα ΚΑΙ μηνύματα ανά σελίδα

  // Κάθε πλοήγηση παίρνει νέο token ώστε αργές (stale) απαντήσεις από
  // προηγούμενο view να μην πατήσουν πάνω στο τρέχον.
  let renderToken = 0;

  /* ============ Βοηθητικά ============ */

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  function hasClient() {
    return typeof window.supabaseClient !== "undefined";
  }

  async function getSession() {
    try {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      return session || null;
    } catch (err) {
      return null;
    }
  }

  // Είναι ο τρέχων χρήστης admin; Ίδιο pattern με το auth.js — το RLS στο
  // user_roles επιστρέφει μόνο τις δικές του γραμμές.
  async function isAdminUser(userId) {
    if (!userId) return false;
    try {
      const { data, error } = await window.supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) return false;
      return Array.isArray(data) && data.some((r) => r.role === "admin");
    } catch (err) {
      return false;
    }
  }

  function authorName(row) {
    return (row && row.profiles && row.profiles.display_name) || "Μέλος";
  }

  // Σχετικός χρόνος στα ελληνικά: λ=λεπτά, ω=ώρες, μ=μέρες.
  function timeAgo(iso) {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const minutes = Math.floor(Math.max(0, Date.now() - then) / 60000);
    if (minutes < 1) return "μόλις τώρα";
    if (minutes < 60) return "πριν " + minutes + "λ";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return "πριν " + hours + "ω";
    const days = Math.floor(hours / 24);
    if (days < 30) return "πριν " + days + "μ";
    return new Date(iso).toLocaleDateString("el-GR", { day: "numeric", month: "short", year: "numeric" });
  }

  // «Μέλος από: Ιουλ 2026» για το πάνελ συντάκτη.
  function memberSince(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("el-GR", { month: "short", year: "numeric" });
  }

  function plural(count, one, many) {
    return count + " " + (count === 1 ? one : many);
  }

  /* ============ Avatars (αρχικό γράμμα + ντετερμινιστικό χρώμα) ============ */

  // Σταθερή απόχρωση ανά χρήστη: hash του user_id → hue 0-359.
  function avatarHue(userId) {
    const s = String(userId || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  function avatarHtml(userId, name, size) {
    const initial = (String(name || "Μ").trim().charAt(0) || "Μ").toUpperCase();
    return `<span class="forum-avatar forum-avatar--${size}" style="background:hsl(${avatarHue(userId)} 60% 45%)" aria-hidden="true">${escapeHtml(initial)}</span>`;
  }

  /* ============ BBCode ============ */
  // Η απόδοση γίνεται από το κοινό assets/js/bbcode.js, ώστε forum και
  // προσωπικά μηνύματα να μοιράζονται ακριβώς τους ίδιους κανόνες.

  function bbcodeToHtml(raw) {
    return window.GSRBBCode.toHtml(raw);
  }

  /* ============ Κοινές καταστάσεις ============ */

  function renderLoadingState(message) {
    viewEl.innerHTML = `
      <div class="state-message">
        <div class="spinner"></div>
        <p>${escapeHtml(message || "Φόρτωση…")}</p>
      </div>
    `;
  }

  function renderErrorState(message) {
    viewEl.innerHTML = `
      <div class="state-message">
        <p>${escapeHtml(message || "Δεν καταφέραμε να φορτώσουμε το forum αυτή τη στιγμή. Δοκίμασε να ανανεώσεις τη σελίδα σε λίγο.")}</p>
        <p style="margin-top:1rem;"><a class="btn btn-outline btn-sm" href="#/">← Πίσω στο Forum</a></p>
      </div>
    `;
  }

  function renderNotFoundState(message) {
    viewEl.innerHTML = `
      <div class="state-message">
        <p>${escapeHtml(message)}</p>
        <p style="margin-top:1rem;"><a class="btn btn-outline btn-sm" href="#/">← Πίσω στο Forum</a></p>
      </div>
    `;
  }

  function breadcrumbHtml(items) {
    // items: [{ label, href? }] — το τελευταίο είναι η τρέχουσα σελίδα.
    const parts = items.map((item, i) => {
      const isLast = i === items.length - 1;
      if (!isLast && item.href) {
        return `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`;
      }
      return `<span aria-current="page">${escapeHtml(item.label)}</span>`;
    });
    return `<nav class="forum-breadcrumb" aria-label="Πλοήγηση forum">${parts.join('<span class="forum-breadcrumb__sep" aria-hidden="true">›</span>')}</nav>`;
  }

  /* ============ Σελιδοποίηση (κοινό pager) ============ */

  // Πλήρες URL συζήτησης για κοινοποίηση (το hash routing χρειάζεται origin).
  function threadShareUrl(threadId) {
    return window.location.origin + window.location.pathname + "#/thread/" + encodeURIComponent(threadId);
  }

  function pageHref(base, n) {
    return n <= 1 ? base : base + "/page/" + n;
  }

  function pagerHtml(base, page, totalPages) {
    if (totalPages <= 1) return "";
    const item = (label, target, opts = {}) => {
      if (opts.current) return `<span class="forum-pager__btn is-current" aria-current="page">${label}</span>`;
      if (opts.disabled) return `<span class="forum-pager__btn is-disabled" aria-hidden="true">${label}</span>`;
      return `<a class="forum-pager__btn" href="${escapeHtml(pageHref(base, target))}" aria-label="${escapeHtml(opts.aria || "Σελίδα " + target)}">${label}</a>`;
    };
    const parts = [
      item("« Πρώτη", 1, { disabled: page === 1, aria: "Πρώτη σελίδα" }),
      item("‹ Προηγ.", page - 1, { disabled: page === 1, aria: "Προηγούμενη σελίδα" }),
    ];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let n = start; n <= end; n++) parts.push(item(String(n), n, { current: n === page }));
    parts.push(item("Επόμ. ›", page + 1, { disabled: page === totalPages, aria: "Επόμενη σελίδα" }));
    parts.push(item("Τελευταία »", totalPages, { disabled: page === totalPages, aria: "Τελευταία σελίδα" }));
    return `<nav class="forum-pager" aria-label="Σελιδοποίηση">${parts.join("")}</nav>`;
  }

  /* ============ Κοινά queries ============ */

  // Τελευταίο μήνυμα ανά συζήτηση: ΕΝΑ query για όλα τα threads της σελίδας
  // και reduce client-side στο πιο πρόσφατο ανά thread (μικρό page size).
  async function fetchLastPosts(threadIds) {
    if (!threadIds.length) return {};
    try {
      const { data, error } = await window.supabaseClient
        .from("forum_posts")
        .select("thread_id, created_at, profiles!forum_posts_user_id_fkey(display_name)")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false });
      if (error) return {};
      const map = {};
      (data || []).forEach((p) => {
        if (!map[p.thread_id]) map[p.thread_id] = p;
      });
      return map;
    } catch (err) {
      return {};
    }
  }

  // Στατιστικά συντακτών (view forum_user_stats) — ΕΝΑ query για όλη τη σελίδα.
  async function fetchUserStats(userIds) {
    if (!userIds.length) return {};
    try {
      const { data, error } = await window.supabaseClient
        .from("forum_user_stats")
        .select("*")
        .in("user_id", userIds);
      if (error) return {};
      const map = {};
      (data || []).forEach((r) => { map[r.user_id] = r; });
      return map;
    } catch (err) {
      return {};
    }
  }

  // Αντιδράσεις όλων των posts της σελίδας — ΕΝΑ query, map post_id → {count, mine}.
  async function fetchReactions(postIds, sessionUserId) {
    if (!postIds.length) return {};
    try {
      const { data, error } = await window.supabaseClient
        .from("forum_reactions")
        .select("post_id, user_id")
        .in("post_id", postIds);
      if (error) return {};
      const map = {};
      (data || []).forEach((r) => {
        const entry = map[r.post_id] || (map[r.post_id] = { count: 0, mine: false });
        entry.count += 1;
        if (sessionUserId && r.user_id === sessionUserId) entry.mine = true;
      });
      return map;
    } catch (err) {
      return {};
    }
  }

  /* ============ View 1: Λίστα κατηγοριών (#/) ============ */

  async function renderCategoryList(token) {
    renderLoadingState("Φόρτωση κατηγοριών…");

    let data, error;
    try {
      ({ data, error } = await window.supabaseClient
        .from("forum_categories")
        .select("*")
        .order("sort_order", { ascending: true }));
    } catch (err) {
      error = err;
    }
    if (token !== renderToken) return;
    if (error) {
      renderErrorState();
      return;
    }

    const categories = data || [];
    if (categories.length === 0) {
      renderNotFoundState("Δεν υπάρχουν κατηγορίες στο forum ακόμα. Έλα ξανά σύντομα.");
      return;
    }

    // Πλήθος συζητήσεων ανά κατηγορία (head+count — λίγες κατηγορίες, οπότε
    // ένα αίτημα ανά κατηγορία είναι μια χαρά). Σφάλμα σε μεμονωμένο count
    // δεν ρίχνει τη σελίδα — απλώς δεν δείχνουμε αριθμό.
    const counts = await Promise.all(categories.map(async (cat) => {
      try {
        const { count, error: countError } = await window.supabaseClient
          .from("forum_threads")
          .select("id", { count: "exact", head: true })
          .eq("category_id", cat.id);
        return countError ? null : (count ?? 0);
      } catch (err) {
        return null;
      }
    }));
    if (token !== renderToken) return;

    viewEl.innerHTML = `
      ${breadcrumbHtml([{ label: "Forum" }])}
      <div class="forum-cat-list">
        ${categories.map((cat, i) => `
          <a class="card forum-cat-card" href="#/category/${encodeURIComponent(cat.id)}">
            <span class="forum-cat-card__icon" aria-hidden="true">${escapeHtml(cat.icon || "💬")}</span>
            <span class="forum-cat-card__body">
              <span class="forum-cat-card__name">${escapeHtml(cat.name)}</span>
              ${cat.description ? `<span class="forum-cat-card__desc">${escapeHtml(cat.description)}</span>` : ""}
            </span>
            <span class="badge badge-primary forum-cat-card__count">${counts[i] === null ? "—" : escapeHtml(plural(counts[i], "θέμα", "θέματα"))}</span>
          </a>
        `).join("")}
      </div>
    `;
  }

  /* ============ View 2: Συζητήσεις κατηγορίας (#/category/<id>[/page/<n>]) ============ */

  // Γραμμή συζήτησης σε στυλ XenForo: avatar | τίτλος+meta | στατιστικά | τελευταίο μήνυμα.
  function threadRowHtml(thread, lastPost) {
    const postCount = Array.isArray(thread.forum_posts) && thread.forum_posts[0]
      ? (thread.forum_posts[0].count || 0)
      : 0;
    const replies = Math.max(0, postCount - 1);
    const lastPage = Math.max(1, Math.ceil(postCount / PAGE_SIZE));
    const threadBase = "#/thread/" + encodeURIComponent(thread.id);

    return `
      <div class="card thread-row">
        ${avatarHtml(thread.user_id, authorName(thread), "sm")}
        <div class="thread-row__main">
          <span class="thread-row__title-line">
            ${thread.pinned ? '<span class="badge badge-primary">📌 Καρφιτσωμένο</span>' : ""}
            ${thread.locked ? '<span class="badge">🔒 Κλειδωμένο</span>' : ""}
            <a class="thread-row__title" href="${threadBase}">${escapeHtml(thread.title)}</a>
          </span>
          <span class="thread-row__meta">
            <span>${escapeHtml(authorName(thread))}</span>
            <span class="thread-row__meta-sep" aria-hidden="true">·</span>
            <span>Ξεκίνησε ${escapeHtml(timeAgo(thread.created_at))}</span>
          </span>
        </div>
        <div class="thread-row__stats">
          <span>💬 ${escapeHtml(plural(replies, "απάντηση", "απαντήσεις"))}</span>
          <span>👁️ ${escapeHtml(plural(thread.views || 0, "προβολή", "προβολές"))}</span>
        </div>
        <a class="thread-row__last" href="${escapeHtml(pageHref(threadBase, lastPage))}" title="Μετάβαση στην τελευταία σελίδα">
          <span class="thread-row__last-label">Τελευταίο μήνυμα</span>
          ${lastPost
            ? `<span class="thread-row__last-name">${escapeHtml(authorName(lastPost))}</span>
               <span class="thread-row__last-time">${escapeHtml(timeAgo(lastPost.created_at))}</span>`
            : `<span class="thread-row__last-time">—</span>`}
        </a>
      </div>
    `;
  }

  function threadListHtml(threads, lastPosts) {
    if (threads.length === 0) {
      return `<div class="state-message"><p>Δεν υπάρχουν συζητήσεις σε αυτή την κατηγορία ακόμα. Γίνε εσύ ο πρώτος που θα ανοίξει θέμα!</p></div>`;
    }
    return `<div class="thread-list">${threads.map((t) => threadRowHtml(t, lastPosts[t.id])).join("")}</div>`;
  }

  function newThreadFormHtml() {
    return `
      <form class="card forum-form" id="new-thread-form" hidden>
        <h2 class="forum-form__title">Νέα Συζήτηση</h2>
        <div class="field">
          <label for="new-thread-title">Τίτλος</label>
          <input id="new-thread-title" name="title" type="text" required maxlength="150" placeholder="Π.χ. Setup για GT3 στη Monza">
        </div>
        <div class="field">
          <div id="new-thread-editor"></div>
        </div>
        <div class="forum-form__actions">
          <button type="submit" class="btn btn-primary btn-sm">Δημοσίευση</button>
          <button type="button" class="btn btn-outline btn-sm" data-cancel>Άκυρο</button>
        </div>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    `;
  }

  function authPromptHtml(message) {
    return `
      <div class="card forum-auth-prompt" hidden id="forum-auth-prompt">
        <p>${escapeHtml(message)}</p>
        <a class="btn btn-primary btn-sm" href="auth.html">Σύνδεση / Εγγραφή</a>
      </div>
    `;
  }

  async function renderCategoryView(categoryId, page, token) {
    renderLoadingState("Φόρτωση συζητήσεων…");

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // Καρφιτσωμένα πάντα πρώτα, μόνο στη σελίδα 1· η σελιδοποίηση μετράει
    // πάνω στα μη καρφιτσωμένα ώστε το range να βγαίνει σωστά.
    let catRes, pinnedRes, unpinnedRes, session;
    try {
      [catRes, pinnedRes, unpinnedRes, session] = await Promise.all([
        window.supabaseClient
          .from("forum_categories")
          .select("*")
          .eq("id", categoryId)
          .maybeSingle(),
        page === 1
          ? window.supabaseClient
              .from("forum_threads")
              .select("*, profiles(display_name), forum_posts(count)")
              .eq("category_id", categoryId)
              .eq("pinned", true)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        window.supabaseClient
          .from("forum_threads")
          .select("*, profiles(display_name), forum_posts(count)", { count: "exact" })
          .eq("category_id", categoryId)
          .eq("pinned", false)
          .order("updated_at", { ascending: false })
          .range(from, to),
        getSession(),
      ]);
    } catch (err) {
      if (token === renderToken) renderErrorState();
      return;
    }
    if (token !== renderToken) return;

    if (catRes.error || pinnedRes.error || unpinnedRes.error) {
      renderErrorState("Δεν καταφέραμε να φορτώσουμε την κατηγορία αυτή τη στιγμή. Δοκίμασε να ανανεώσεις τη σελίδα σε λίγο.");
      return;
    }
    const category = catRes.data;
    if (!category) {
      renderNotFoundState("Η κατηγορία δεν βρέθηκε. Ίσως έχει διαγραφεί.");
      return;
    }

    const unpinnedTotal = unpinnedRes.count ?? (unpinnedRes.data || []).length;
    const totalPages = Math.max(1, Math.ceil(unpinnedTotal / PAGE_SIZE));
    if (page > totalPages && page > 1) {
      renderCategoryView(categoryId, totalPages, token); // clamp σε ανύπαρκτη σελίδα
      return;
    }

    const threads = (pinnedRes.data || []).concat(unpinnedRes.data || []);
    const lastPosts = await fetchLastPosts(threads.map((t) => t.id));
    if (token !== renderToken) return;

    const catBase = "#/category/" + encodeURIComponent(categoryId);
    const defaultListHtml = threadListHtml(threads, lastPosts) + pagerHtml(catBase, page, totalPages);

    viewEl.innerHTML = `
      ${breadcrumbHtml([
        { label: "Forum", href: "#/" },
        { label: category.name },
      ])}

      <header class="forum-view-head">
        <div class="forum-view-head__text">
          <h2 class="forum-view-head__title">${escapeHtml(category.icon || "💬")} ${escapeHtml(category.name)}</h2>
          ${category.description ? `<p class="forum-view-head__desc">${escapeHtml(category.description)}</p>` : ""}
        </div>
        <button type="button" class="btn btn-primary" id="new-thread-toggle" aria-expanded="false">✏️ Νέα Συζήτηση</button>
      </header>

      ${session
        ? newThreadFormHtml()
        : authPromptHtml("Χρειάζεται να συνδεθείς για να ανοίξεις νέα συζήτηση.")}

      <div class="forum-search">
        <input type="search" id="thread-search" class="forum-search__input" autocomplete="off"
               placeholder="🔍 Αναζήτηση τίτλου σε αυτή την κατηγορία…"
               aria-label="Αναζήτηση συζητήσεων στην κατηγορία ${escapeHtml(category.name)}">
      </div>

      <div id="thread-list-area">${defaultListHtml}</div>
    `;

    // "Νέα Συζήτηση": δείχνει τη φόρμα (συνδεδεμένος) ή το prompt σύνδεσης.
    const toggleBtn = viewEl.querySelector("#new-thread-toggle");
    const formEl = viewEl.querySelector("#new-thread-form");
    const promptEl = viewEl.querySelector("#forum-auth-prompt");
    toggleBtn.addEventListener("click", () => {
      const target = formEl || promptEl;
      if (!target) return;
      target.hidden = !target.hidden;
      toggleBtn.setAttribute("aria-expanded", String(!target.hidden));
      if (!target.hidden && formEl) formEl.querySelector("#new-thread-title").focus();
    });

    wireCategorySearch(categoryId, token, defaultListHtml);

    if (!formEl) return;

    const newThreadEditor = window.GSREditor.create(formEl.querySelector("#new-thread-editor"), {
      label: "Πρώτο μήνυμα",
      placeholder: "Γράψε το μήνυμά σου εδώ…",
    });

    formEl.querySelector("[data-cancel]").addEventListener("click", () => {
      formEl.hidden = true;
      toggleBtn.setAttribute("aria-expanded", "false");
    });

    formEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      const titleInput = formEl.querySelector("#new-thread-title");
      const statusEl = formEl.querySelector(".form-status");
      const submitBtn = formEl.querySelector('button[type="submit"]');

      const title = titleInput.value.trim();
      const content = newThreadEditor.getValue();
      if (!title || !content) {
        statusEl.dataset.state = "error";
        statusEl.textContent = "Συμπλήρωσε τίτλο και μήνυμα.";
        return;
      }
      if (content.length > window.GSREditor.MAX_LENGTH) {
        statusEl.dataset.state = "error";
        statusEl.textContent = "Το μήνυμα είναι πολύ μεγάλο.";
        return;
      }

      submitBtn.disabled = true;
      statusEl.dataset.state = "";
      statusEl.textContent = "Δημοσίευση…";

      try {
        // Ξαναδιαβάζουμε το session την ώρα του submit (μπορεί να έχει λήξει).
        const freshSession = await getSession();
        if (!freshSession) {
          statusEl.dataset.state = "error";
          statusEl.textContent = "Η σύνδεσή σου έληξε. Συνδέσου ξανά για να δημοσιεύσεις.";
          submitBtn.disabled = false;
          return;
        }

        const { data: thread, error: threadError } = await window.supabaseClient
          .from("forum_threads")
          .insert({ category_id: categoryId, user_id: freshSession.user.id, title: title })
          .select("id")
          .single();
        if (threadError || !thread) throw threadError || new Error("insert failed");

        // Το πρώτο μήνυμα της συζήτησης. Αν αποτύχει, η συζήτηση υπάρχει ήδη —
        // προχωράμε σε αυτήν και το μέλος μπορεί να γράψει το μήνυμα ως απάντηση.
        await window.supabaseClient
          .from("forum_posts")
          .insert({ thread_id: thread.id, user_id: freshSession.user.id, content: content });

        window.location.hash = "#/thread/" + encodeURIComponent(thread.id);
      } catch (err) {
        statusEl.dataset.state = "error";
        statusEl.textContent = "Κάτι πήγε στραβά κατά τη δημοσίευση. Δοκίμασε ξανά.";
        submitBtn.disabled = false;
      }
    });
  }

  // Αναζήτηση τίτλων στην κατηγορία: server-side ilike, debounce 300ms,
  // ελάχιστο 2 χαρακτήρες· ο καθαρισμός επαναφέρει τη σελιδοποιημένη λίστα.
  function wireCategorySearch(categoryId, token, defaultListHtml) {
    const input = viewEl.querySelector("#thread-search");
    const listArea = viewEl.querySelector("#thread-list-area");
    if (!input || !listArea) return;

    let timer = null;
    let searchSeq = 0; // δικό της token — παλιά αποτελέσματα αγνοούνται

    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const term = input.value.trim();
        const seq = ++searchSeq;

        if (term.length < 2) {
          if (token === renderToken) listArea.innerHTML = defaultListHtml;
          return;
        }

        listArea.innerHTML = `<div class="state-message"><div class="spinner"></div><p>Αναζήτηση…</p></div>`;

        try {
          // Escape των ειδικών χαρακτήρων του LIKE ώστε ο όρος να είναι literal.
          const pattern = "%" + term.replace(/[\\%_]/g, (m) => "\\" + m) + "%";
          const { data, error } = await window.supabaseClient
            .from("forum_threads")
            .select("*, profiles(display_name), forum_posts(count)")
            .eq("category_id", categoryId)
            .ilike("title", pattern)
            .order("updated_at", { ascending: false })
            .limit(50);
          if (token !== renderToken || seq !== searchSeq) return;
          if (error) throw error;

          const results = data || [];
          const lastPosts = await fetchLastPosts(results.map((t) => t.id));
          if (token !== renderToken || seq !== searchSeq) return;

          const summary = `<p class="forum-search__summary" role="status">${escapeHtml(plural(results.length, "αποτέλεσμα", "αποτελέσματα"))} για «${escapeHtml(term)}»</p>`;
          listArea.innerHTML = summary + (results.length
            ? `<div class="thread-list">${results.map((t) => threadRowHtml(t, lastPosts[t.id])).join("")}</div>`
            : `<div class="state-message"><p>Δεν βρέθηκαν συζητήσεις με αυτόν τον τίτλο.</p></div>`);
        } catch (err) {
          if (token !== renderToken || seq !== searchSeq) return;
          listArea.innerHTML = `<div class="state-message"><p>Η αναζήτηση απέτυχε. Δοκίμασε ξανά.</p></div>`;
        }
      }, 300);
    });
  }

  /* ============ View 3: Συζήτηση (#/thread/<id>[/page/<n>]) ============ */

  // Το «σώμα» ενός post: περιεχόμενο (BBCode) + σημείωση επεξεργασίας.
  function postBodyHtml(post) {
    let html = `<div class="post-block__content">${bbcodeToHtml(post.content)}</div>`;
    if (post.edited_at) {
      html += `<p class="post-block__edited">Τελευταία επεξεργασία: ${escapeHtml(timeAgo(post.edited_at))}</p>`;
    }
    return html;
  }

  // Post σε στυλ XenForo: αριστερά πάνελ συντάκτη, δεξιά το περιεχόμενο.
  function postBlockHtml(post, number, stats, react, ctx) {
    const mine = ctx.sessionUserId && post.user_id === ctx.sessionUserId;
    const s = stats || null;
    // Το όνομα έρχεται από το embed· αν λείψει, το πάνελ στατιστικών το έχει ήδη.
    const name = (post.profiles && post.profiles.display_name) || (s && s.display_name) || "Μέλος";
    const r = react || { count: 0, mine: false };
    const created = new Date(post.created_at);
    const createdTitle = Number.isNaN(created.getTime()) ? "" : created.toLocaleString("el-GR");

    const reactBtn = ctx.sessionUserId
      ? `<button type="button" class="post-react${r.mine ? " is-active" : ""}" data-react-post="${escapeHtml(post.id)}" aria-pressed="${r.mine ? "true" : "false"}" aria-label="Μου αρέσει">👍 <span class="post-react__count">${r.count}</span></button>`
      : `<button type="button" class="post-react" disabled title="Συνδέσου για να αντιδράσεις" aria-label="Μου αρέσει (απαιτείται σύνδεση)">👍 <span class="post-react__count">${r.count}</span></button>`;

    return `
      <article class="card post-block${number === 1 ? " post-block--op" : ""}">
        <aside class="post-block__author">
          ${avatarHtml(post.user_id, name, "lg")}
          <a class="post-block__name" href="profile.html#/user/${encodeURIComponent(post.user_id)}">${escapeHtml(name)}</a>
          ${s && s.is_admin ? '<span class="badge badge-primary post-block__role">Διαχειριστής</span>' : ""}
          ${s ? `<span class="post-block__stat">Μηνύματα: ${escapeHtml(String(s.post_count ?? 0))}</span>` : ""}
          ${s && s.joined_at ? `<span class="post-block__stat">Μέλος από: ${escapeHtml(memberSince(s.joined_at))}</span>` : ""}
        </aside>
        <div class="post-block__main">
          <header class="post-block__head">
            <time class="post-block__time" datetime="${escapeHtml(post.created_at || "")}" title="${escapeHtml(createdTitle)}">${escapeHtml(timeAgo(post.created_at))}</time>
            <span class="post-block__num">#${number}</span>
          </header>
          <div class="post-block__body" data-post-body="${escapeHtml(post.id)}">${postBodyHtml(post)}</div>
          ${s && s.signature ? `<div class="post-block__signature">${escapeHtml(s.signature)}</div>` : ""}
          <footer class="post-block__actions">
            ${reactBtn}
            <span class="post-block__actions-spacer"></span>
            ${ctx.canQuote ? `<button type="button" class="post-action" data-quote-post="${escapeHtml(post.id)}">❝ Παράθεση</button>` : ""}
            ${mine ? `<button type="button" class="post-action" data-edit-post="${escapeHtml(post.id)}">✏️ Επεξεργασία</button>` : ""}
            ${(mine || ctx.isAdmin) ? `<button type="button" class="post-action post-action--danger" data-delete-post="${escapeHtml(post.id)}" aria-label="Διαγραφή μηνύματος">🗑️ Διαγραφή</button>` : ""}
          </footer>
        </div>
      </article>
    `;
  }

  function modActionsHtml(thread) {
    return `
      <div class="forum-mod-actions" role="group" aria-label="Ενέργειες διαχείρισης">
        <button type="button" class="post-action" data-mod="pin">📌 ${thread.pinned ? "Ξεκαρφίτσωμα" : "Καρφίτσωμα"}</button>
        <button type="button" class="post-action" data-mod="lock">🔒 ${thread.locked ? "Ξεκλείδωμα" : "Κλείδωμα"}</button>
        <button type="button" class="post-action post-action--danger" data-mod="delete-thread">🗑️ Διαγραφή θέματος</button>
      </div>
    `;
  }

  async function renderThreadView(threadId, page, token) {
    renderLoadingState("Φόρτωση συζήτησης…");

    // Καταμέτρηση προβολών — fire-and-forget, δεν μπλοκάρει το rendering.
    try {
      window.supabaseClient
        .rpc("increment_thread_views", { _thread_id: threadId })
        .then(() => {}, () => {});
    } catch (err) {
      /* αδιάφορο — οι προβολές είναι best-effort */
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let threadRes, postsRes, session;
    try {
      [threadRes, postsRes, session] = await Promise.all([
        window.supabaseClient
          .from("forum_threads")
          .select("*, profiles(display_name), forum_categories(id, name)")
          .eq("id", threadId)
          .maybeSingle(),
        window.supabaseClient
          .from("forum_posts")
          .select("*, profiles!forum_posts_user_id_fkey(display_name)", { count: "exact" })
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true })
          .range(from, to),
        getSession(),
      ]);
    } catch (err) {
      if (token === renderToken) renderErrorState();
      return;
    }
    if (token !== renderToken) return;

    if (threadRes.error || postsRes.error) {
      renderErrorState("Δεν καταφέραμε να φορτώσουμε τη συζήτηση αυτή τη στιγμή. Δοκίμασε να ανανεώσεις τη σελίδα σε λίγο.");
      return;
    }
    const thread = threadRes.data;
    if (!thread) {
      renderNotFoundState("Η συζήτηση δεν βρέθηκε. Ίσως έχει διαγραφεί.");
      return;
    }

    const posts = postsRes.data || [];
    const totalPosts = postsRes.count ?? posts.length;
    const totalPages = Math.max(1, Math.ceil(totalPosts / PAGE_SIZE));
    if (page > totalPages && page > 1) {
      renderThreadView(threadId, totalPages, token); // clamp σε ανύπαρκτη σελίδα
      return;
    }

    const sessionUserId = session ? session.user.id : null;

    // Στατιστικά συντακτών + αντιδράσεις + ρόλος admin — παράλληλα, batched.
    const userIds = [...new Set(posts.map((p) => p.user_id).filter(Boolean))];
    const postIds = posts.map((p) => p.id);
    let statsMap, reactMap, isAdmin;
    try {
      [statsMap, reactMap, isAdmin] = await Promise.all([
        fetchUserStats(userIds),
        fetchReactions(postIds, sessionUserId),
        sessionUserId ? isAdminUser(sessionUserId) : Promise.resolve(false),
      ]);
    } catch (err) {
      statsMap = {}; reactMap = {}; isAdmin = false;
    }
    if (token !== renderToken) return;

    const category = thread.forum_categories;
    const threadBase = "#/thread/" + encodeURIComponent(threadId);
    const isLastPage = page >= totalPages;
    const ctx = {
      sessionUserId: sessionUserId,
      isAdmin: isAdmin,
      // Η «Παράθεση» έχει νόημα μόνο όταν υπάρχει φόρμα απάντησης στη σελίδα.
      canQuote: Boolean(sessionUserId && !thread.locked && isLastPage),
    };

    let replyAreaHtml;
    if (thread.locked) {
      replyAreaHtml = `
        <div class="card forum-notice">
          🔒 <strong>Κλειδωμένο</strong> — η συζήτηση δεν δέχεται νέες απαντήσεις.
        </div>
      `;
    } else if (!isLastPage) {
      replyAreaHtml = `
        <div class="card forum-notice">
          💬 Η φόρμα απάντησης βρίσκεται στο τέλος της συζήτησης.
          <a href="${escapeHtml(pageHref(threadBase, totalPages))}">Απάντησε στην τελευταία σελίδα →</a>
        </div>
      `;
    } else if (session) {
      replyAreaHtml = `
        <form class="card forum-form" id="reply-form">
          <h3 class="forum-form__title">Απάντηση</h3>
          <div class="field">
            <div id="reply-editor"></div>
          </div>
          <div class="forum-form__actions">
            <button type="submit" class="btn btn-primary btn-sm">Αποστολή</button>
          </div>
          <p class="form-status" role="status" aria-live="polite"></p>
        </form>
      `;
    } else {
      replyAreaHtml = `
        <div class="card forum-auth-prompt">
          <p>Θέλεις να απαντήσεις; Χρειάζεται να συνδεθείς πρώτα.</p>
          <a class="btn btn-primary btn-sm" href="auth.html">Σύνδεση / Εγγραφή</a>
        </div>
      `;
    }

    const pager = pagerHtml(threadBase, page, totalPages);

    viewEl.innerHTML = `
      ${breadcrumbHtml([
        { label: "Forum", href: "#/" },
        category
          ? { label: category.name, href: "#/category/" + encodeURIComponent(category.id) }
          : { label: "Κατηγορία", href: "#/" },
        { label: thread.title },
      ])}

      <header class="forum-view-head forum-view-head--thread">
        <div class="forum-view-head__text">
          <h2 class="forum-view-head__title">${escapeHtml(thread.title)}</h2>
          <p class="thread-detail__meta">
            ${thread.pinned ? '<span class="badge badge-primary">📌 Καρφιτσωμένο</span>' : ""}
            ${thread.locked ? '<span class="badge">🔒 Κλειδωμένο</span>' : ""}
            <span>👤 ${escapeHtml(authorName(thread))}</span>
            <span>💬 ${escapeHtml(plural(totalPosts, "μήνυμα", "μηνύματα"))}</span>
            <span>👁️ ${escapeHtml(plural(thread.views || 0, "προβολή", "προβολές"))}</span>
            <span>🕒 ${escapeHtml(timeAgo(thread.created_at))}</span>
          </p>
          ${isAdmin ? modActionsHtml(thread) : ""}
          <div class="thread-detail__share" data-share
               data-share-title="${escapeHtml(thread.title)}"
               data-share-url="${escapeHtml(threadShareUrl(threadId))}"
               data-share-label="Μοιράσου τη συζήτηση"></div>
        </div>
      </header>

      ${pager}

      ${posts.length === 0
        ? `<div class="state-message"><p>Δεν υπάρχουν μηνύματα σε αυτή τη συζήτηση ακόμα.</p></div>`
        : `<div class="post-list">${posts.map((post, i) => postBlockHtml(post, from + i + 1, statsMap[post.user_id], reactMap[post.id], ctx)).join("")}</div>`}

      ${pager}

      <p class="form-status" id="thread-status" role="status" aria-live="polite"></p>

      ${replyAreaHtml}
    `;

    // Τα κουμπιά κοινοποίησης μπαίνουν μετά το render του view.
    if (window.GSRShare) window.GSRShare.refresh(viewEl);

    const threadStatusEl = viewEl.querySelector("#thread-status");
    const postsById = {};
    posts.forEach((p) => { postsById[p.id] = p; });

    function reportError(message) {
      threadStatusEl.dataset.state = "error";
      threadStatusEl.textContent = message;
    }

    /* ---- Moderation συζήτησης (μόνο admins — το RLS το επιβάλλει server-side) ---- */

    viewEl.querySelectorAll("[data-mod]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset.mod;
        if (action === "delete-thread" && !window.confirm("Σίγουρα θέλεις να διαγράψεις ΟΛΟΚΛΗΡΗ τη συζήτηση; Η ενέργεια δεν αναιρείται.")) return;
        btn.disabled = true;
        try {
          if (action === "delete-thread") {
            const { error } = await window.supabaseClient
              .from("forum_threads")
              .delete()
              .eq("id", threadId);
            if (error) throw error;
            window.location.hash = "#/category/" + encodeURIComponent(thread.category_id);
            return;
          }
          const patch = action === "pin" ? { pinned: !thread.pinned } : { locked: !thread.locked };
          const { error } = await window.supabaseClient
            .from("forum_threads")
            .update(patch)
            .eq("id", threadId);
          if (error) throw error;
          router(); // φρέσκο re-render με τη νέα κατάσταση
        } catch (err) {
          btn.disabled = false;
          reportError("Η ενέργεια διαχείρισης απέτυχε. Δοκίμασε ξανά.");
        }
      });
    });

    /* ---- Διαγραφή post (δικού μου, ή οποιουδήποτε αν είμαι admin) ---- */

    viewEl.querySelectorAll("[data-delete-post]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!window.confirm("Σίγουρα θέλεις να διαγράψεις αυτό το μήνυμα;")) return;
        btn.disabled = true;
        try {
          const { error } = await window.supabaseClient
            .from("forum_posts")
            .delete()
            .eq("id", btn.dataset.deletePost);
          if (error) throw error;
          router(); // φρέσκο re-render της συζήτησης
        } catch (err) {
          btn.disabled = false;
          reportError("Η διαγραφή απέτυχε. Δοκίμασε ξανά.");
        }
      });
    });

    /* ---- Αντιδράσεις 👍 (toggle με optimistic update) ---- */

    viewEl.querySelectorAll("[data-react-post]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!sessionUserId || btn.dataset.busy) return;
        btn.dataset.busy = "1";
        const countEl = btn.querySelector(".post-react__count");
        const wasActive = btn.getAttribute("aria-pressed") === "true";
        const oldCount = parseInt(countEl.textContent, 10) || 0;
        const apply = (active, count) => {
          btn.setAttribute("aria-pressed", String(active));
          btn.classList.toggle("is-active", active);
          countEl.textContent = String(Math.max(0, count));
        };

        apply(!wasActive, oldCount + (wasActive ? -1 : 1)); // optimistic

        let error = null;
        try {
          if (wasActive) {
            ({ error } = await window.supabaseClient
              .from("forum_reactions")
              .delete()
              .eq("post_id", btn.dataset.reactPost)
              .eq("user_id", sessionUserId));
          } else {
            ({ error } = await window.supabaseClient
              .from("forum_reactions")
              .insert({ post_id: btn.dataset.reactPost, user_id: sessionUserId, reaction: "like" }));
          }
        } catch (err) {
          error = err;
        }
        if (error) apply(wasActive, oldCount); // revert σε αποτυχία
        delete btn.dataset.busy;
      });
    });

    /* ---- Επεξεργασία δικών μου posts (inline) ---- */

    viewEl.querySelectorAll("[data-edit-post]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const postId = btn.dataset.editPost;
        const post = postsById[postId];
        const body = viewEl.querySelector(`[data-post-body="${window.CSS && CSS.escape ? CSS.escape(postId) : postId}"]`);
        if (!post || !body || body.dataset.editing) return;
        body.dataset.editing = "1";

        const fieldId = "edit-content-" + postId;
        body.innerHTML = `
          <div class="field">
            <div id="${escapeHtml(fieldId)}"></div>
          </div>
          <div class="forum-form__actions">
            <button type="button" class="btn btn-primary btn-sm" data-edit-save>Αποθήκευση</button>
            <button type="button" class="btn btn-outline btn-sm" data-edit-cancel>Άκυρο</button>
          </div>
          <p class="form-status" role="status" aria-live="polite"></p>
        `;

        const editEditor = window.GSREditor.create(body.querySelector("#" + (window.CSS && CSS.escape ? CSS.escape(fieldId) : fieldId)), {
          label: "Επεξεργασία μηνύματος",
          value: post.content,
        });
        const statusEl = body.querySelector(".form-status");
        editEditor.focus();

        function closeEditor() {
          delete body.dataset.editing;
          body.innerHTML = postBodyHtml(post);
        }

        body.querySelector("[data-edit-cancel]").addEventListener("click", closeEditor);

        body.querySelector("[data-edit-save]").addEventListener("click", async () => {
          const newContent = editEditor.getValue();
          if (!newContent) {
            statusEl.dataset.state = "error";
            statusEl.textContent = "Το μήνυμα δεν μπορεί να είναι κενό.";
            return;
          }
          const saveBtn = body.querySelector("[data-edit-save]");
          saveBtn.disabled = true;
          statusEl.dataset.state = "";
          statusEl.textContent = "Αποθήκευση…";
          try {
            const freshSession = await getSession();
            if (!freshSession) {
              statusEl.dataset.state = "error";
              statusEl.textContent = "Η σύνδεσή σου έληξε. Συνδέσου ξανά για να αποθηκεύσεις.";
              saveBtn.disabled = false;
              return;
            }
            const editedAt = new Date().toISOString();
            const { error } = await window.supabaseClient
              .from("forum_posts")
              .update({ content: newContent, edited_at: editedAt })
              .eq("id", postId);
            if (error) throw error;
            post.content = newContent;
            post.edited_at = editedAt;
            closeEditor();
          } catch (err) {
            statusEl.dataset.state = "error";
            statusEl.textContent = "Η αποθήκευση απέτυχε. Δοκίμασε ξανά.";
            saveBtn.disabled = false;
          }
        });
      });
    });

    /* ---- Φόρμα απάντησης (μόνο στην τελευταία σελίδα) + Παράθεση ---- */

    const replyForm = viewEl.querySelector("#reply-form");
    if (replyForm) {
      const replyEditor = window.GSREditor.create(replyForm.querySelector("#reply-editor"), {
        label: "Το μήνυμά σου",
        placeholder: "Γράψε την απάντησή σου…",
      });

      // «Παράθεση»: μπαίνει ως πραγματικό μπλοκ παράθεσης μέσα στον editor.
      viewEl.querySelectorAll("[data-quote-post]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const post = postsById[btn.dataset.quotePost];
          if (!post) return;
          replyEditor.appendQuote(authorName(post), post.content);
        });
      });

      replyForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const statusEl = replyForm.querySelector(".form-status");
        const submitBtn = replyForm.querySelector('button[type="submit"]');

        const content = replyEditor.getValue();
        if (!content) {
          statusEl.dataset.state = "error";
          statusEl.textContent = "Γράψε ένα μήνυμα πριν την αποστολή.";
          return;
        }
        if (content.length > window.GSREditor.MAX_LENGTH) {
          statusEl.dataset.state = "error";
          statusEl.textContent = "Το μήνυμα είναι πολύ μεγάλο.";
          return;
        }

        submitBtn.disabled = true;
        statusEl.dataset.state = "";
        statusEl.textContent = "Αποστολή…";

        try {
          const freshSession = await getSession();
          if (!freshSession) {
            statusEl.dataset.state = "error";
            statusEl.textContent = "Η σύνδεσή σου έληξε. Συνδέσου ξανά για να απαντήσεις.";
            submitBtn.disabled = false;
            return;
          }

          const { error } = await window.supabaseClient
            .from("forum_posts")
            .insert({ thread_id: threadId, user_id: freshSession.user.id, content: content });
          if (error) throw error;

          // Η νέα απάντηση προσγειώνεται στην (πιθανώς νέα) τελευταία σελίδα.
          const newLastPage = Math.max(1, Math.ceil((totalPosts + 1) / PAGE_SIZE));
          const target = pageHref(threadBase, newLastPage);
          if (window.location.hash === target) {
            router(); // ίδια σελίδα — απλό re-render
          } else {
            window.location.hash = target;
          }
        } catch (err) {
          statusEl.dataset.state = "error";
          statusEl.textContent = "Η αποστολή απέτυχε. Δοκίμασε ξανά.";
          submitBtn.disabled = false;
        }
      });
    }
  }

  /* ============ Router ============ */

  function parsePage(value) {
    const n = parseInt(value || "1", 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }

  function router() {
    const token = ++renderToken;

    if (!hasClient()) {
      renderErrorState();
      return;
    }

    const hash = window.location.hash || "#/";
    let match;
    if ((match = hash.match(/^#\/category\/([^/?#]+)(?:\/page\/(\d+))?/))) {
      renderCategoryView(decodeURIComponent(match[1]), parsePage(match[2]), token);
    } else if ((match = hash.match(/^#\/thread\/([^/?#]+)(?:\/page\/(\d+))?/))) {
      renderThreadView(decodeURIComponent(match[1]), parsePage(match[2]), token);
    } else {
      renderCategoryList(token);
    }
  }

  window.addEventListener("hashchange", () => {
    // Σε αλλαγή view γυρνάμε στην αρχή του περιεχομένου του forum.
    const top = document.getElementById("forum");
    if (top) top.scrollIntoView({ block: "start" });
    router();
  });

  router();
})();
