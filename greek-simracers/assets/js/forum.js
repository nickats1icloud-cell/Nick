// Forum της κοινότητας — hash routing πάνω σε μία στατική σελίδα (forum.html):
//   #/                → λίστα κατηγοριών
//   #/category/<id>   → συζητήσεις μιας κατηγορίας + φόρμα νέας συζήτησης
//   #/thread/<id>     → μηνύματα μιας συζήτησης + φόρμα απάντησης
// Τα δεδομένα έρχονται από το Supabase (window.supabaseClient) με RLS:
// δημόσια ανάγνωση, εγγραφή μόνο για συνδεδεμένα μέλη.
(function () {
  const viewEl = document.getElementById("forum-view");
  if (!viewEl) return;

  // Κάθε πλοήγηση παίρνει νέο token ώστε αργές (stale) απαντήσεις από
  // προηγούμενο view να μην πατήσουν πάνω στο τρέχον.
  let renderToken = 0;

  /* ============ Βοηθητικά ============ */

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  // Περιεχόμενο post: escaped κείμενο, με τις αλλαγές γραμμής ως <br>.
  function formatContent(value) {
    return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");
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

  function plural(count, one, many) {
    return count + " " + (count === 1 ? one : many);
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

  /* ============ View 2: Συζητήσεις κατηγορίας (#/category/<id>) ============ */

  function threadRowHtml(thread) {
    const postCount = Array.isArray(thread.forum_posts) && thread.forum_posts[0]
      ? (thread.forum_posts[0].count || 0)
      : 0;
    const replies = Math.max(0, postCount - 1);

    return `
      <a class="card thread-row" href="#/thread/${encodeURIComponent(thread.id)}">
        <span class="thread-row__main">
          <span class="thread-row__title-line">
            ${thread.pinned ? '<span class="badge badge-primary">📌 Καρφιτσωμένο</span>' : ""}
            ${thread.locked ? '<span class="badge">🔒 Κλειδωμένο</span>' : ""}
            <span class="thread-row__title">${escapeHtml(thread.title)}</span>
          </span>
          <span class="thread-row__meta">
            <span>👤 ${escapeHtml(authorName(thread))}</span>
            <span>💬 ${escapeHtml(plural(replies, "απάντηση", "απαντήσεις"))}</span>
            <span>👁️ ${escapeHtml(plural(thread.views || 0, "προβολή", "προβολές"))}</span>
            <span>🕒 ${escapeHtml(timeAgo(thread.updated_at || thread.created_at))}</span>
          </span>
        </span>
        <span class="thread-row__chevron" aria-hidden="true">›</span>
      </a>
    `;
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
          <label for="new-thread-content">Πρώτο μήνυμα</label>
          <textarea id="new-thread-content" name="content" rows="5" required maxlength="5000" placeholder="Γράψε το μήνυμά σου εδώ…"></textarea>
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

  async function renderCategoryView(categoryId, token) {
    renderLoadingState("Φόρτωση συζητήσεων…");

    let catRes, threadsRes, session;
    try {
      [catRes, threadsRes, session] = await Promise.all([
        window.supabaseClient
          .from("forum_categories")
          .select("*")
          .eq("id", categoryId)
          .maybeSingle(),
        window.supabaseClient
          .from("forum_threads")
          .select("*, profiles(display_name), forum_posts(count)")
          .eq("category_id", categoryId)
          .order("pinned", { ascending: false })
          .order("updated_at", { ascending: false }),
        getSession(),
      ]);
    } catch (err) {
      if (token === renderToken) renderErrorState();
      return;
    }
    if (token !== renderToken) return;

    if (catRes.error || threadsRes.error) {
      renderErrorState("Δεν καταφέραμε να φορτώσουμε την κατηγορία αυτή τη στιγμή. Δοκίμασε να ανανεώσεις τη σελίδα σε λίγο.");
      return;
    }
    const category = catRes.data;
    if (!category) {
      renderNotFoundState("Η κατηγορία δεν βρέθηκε. Ίσως έχει διαγραφεί.");
      return;
    }

    const threads = threadsRes.data || [];

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

      ${threads.length === 0
        ? `<div class="state-message"><p>Δεν υπάρχουν συζητήσεις σε αυτή την κατηγορία ακόμα. Γίνε εσύ ο πρώτος που θα ανοίξει θέμα!</p></div>`
        : `<div class="thread-list">${threads.map(threadRowHtml).join("")}</div>`}
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

    if (!formEl) return;

    formEl.querySelector("[data-cancel]").addEventListener("click", () => {
      formEl.hidden = true;
      toggleBtn.setAttribute("aria-expanded", "false");
    });

    formEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      const titleInput = formEl.querySelector("#new-thread-title");
      const contentInput = formEl.querySelector("#new-thread-content");
      const statusEl = formEl.querySelector(".form-status");
      const submitBtn = formEl.querySelector('button[type="submit"]');

      const title = titleInput.value.trim();
      const content = contentInput.value.trim();
      if (!title || !content) {
        statusEl.dataset.state = "error";
        statusEl.textContent = "Συμπλήρωσε τίτλο και μήνυμα.";
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

  /* ============ View 3: Συζήτηση (#/thread/<id>) ============ */

  function postCardHtml(post, sessionUserId, isFirst) {
    const mine = sessionUserId && post.user_id === sessionUserId;
    return `
      <article class="card post-card${isFirst ? " post-card--op" : ""}">
        <header class="post-card__head">
          <span class="post-card__author">${escapeHtml(authorName(post))}</span>
          ${isFirst ? '<span class="badge badge-primary">Αρχικό μήνυμα</span>' : ""}
          <span class="post-card__time">${escapeHtml(timeAgo(post.created_at))}</span>
          ${mine ? `<button type="button" class="post-card__delete" data-delete-post="${escapeHtml(post.id)}" aria-label="Διαγραφή μηνύματος">🗑️ Διαγραφή</button>` : ""}
        </header>
        <div class="post-card__content">${formatContent(post.content)}</div>
      </article>
    `;
  }

  async function renderThreadView(threadId, token) {
    renderLoadingState("Φόρτωση συζήτησης…");

    // Καταμέτρηση προβολών — fire-and-forget, δεν μπλοκάρει το rendering.
    try {
      window.supabaseClient
        .rpc("increment_thread_views", { _thread_id: threadId })
        .then(() => {}, () => {});
    } catch (err) {
      /* αδιάφορο — οι προβολές είναι best-effort */
    }

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
          .select("*, profiles(display_name)")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true }),
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
    const category = thread.forum_categories;
    const sessionUserId = session ? session.user.id : null;

    let replyAreaHtml;
    if (thread.locked) {
      replyAreaHtml = `
        <div class="card forum-notice">
          🔒 <strong>Κλειδωμένο</strong> — η συζήτηση δεν δέχεται νέες απαντήσεις.
        </div>
      `;
    } else if (session) {
      replyAreaHtml = `
        <form class="card forum-form" id="reply-form">
          <h3 class="forum-form__title">Απάντηση</h3>
          <div class="field">
            <label for="reply-content">Το μήνυμά σου</label>
            <textarea id="reply-content" name="content" rows="4" required maxlength="5000" placeholder="Γράψε την απάντησή σου…"></textarea>
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
            <span>👁️ ${escapeHtml(plural(thread.views || 0, "προβολή", "προβολές"))}</span>
            <span>🕒 ${escapeHtml(timeAgo(thread.created_at))}</span>
          </p>
        </div>
      </header>

      ${posts.length === 0
        ? `<div class="state-message"><p>Δεν υπάρχουν μηνύματα σε αυτή τη συζήτηση ακόμα.</p></div>`
        : `<div class="post-list">${posts.map((post, i) => postCardHtml(post, sessionUserId, i === 0)).join("")}</div>`}

      <p class="form-status" id="thread-status" role="status" aria-live="polite"></p>

      ${replyAreaHtml}
    `;

    const threadStatusEl = viewEl.querySelector("#thread-status");

    // Διαγραφή δικών μου μηνυμάτων (το RLS το επιβάλλει ούτως ή άλλως server-side).
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
          threadStatusEl.dataset.state = "error";
          threadStatusEl.textContent = "Η διαγραφή απέτυχε. Δοκίμασε ξανά.";
        }
      });
    });

    const replyForm = viewEl.querySelector("#reply-form");
    if (!replyForm) return;

    replyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const contentInput = replyForm.querySelector("#reply-content");
      const statusEl = replyForm.querySelector(".form-status");
      const submitBtn = replyForm.querySelector('button[type="submit"]');

      const content = contentInput.value.trim();
      if (!content) {
        statusEl.dataset.state = "error";
        statusEl.textContent = "Γράψε ένα μήνυμα πριν την αποστολή.";
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

        router(); // ξαναφορτώνει τη συζήτηση με τη νέα απάντηση
      } catch (err) {
        statusEl.dataset.state = "error";
        statusEl.textContent = "Η αποστολή απέτυχε. Δοκίμασε ξανά.";
        submitBtn.disabled = false;
      }
    });
  }

  /* ============ Router ============ */

  function router() {
    const token = ++renderToken;

    if (!hasClient()) {
      renderErrorState();
      return;
    }

    const hash = window.location.hash || "#/";
    let match;
    if ((match = hash.match(/^#\/category\/([^/?#]+)/))) {
      renderCategoryView(decodeURIComponent(match[1]), token);
    } else if ((match = hash.match(/^#\/thread\/([^/?#]+)/))) {
      renderThreadView(decodeURIComponent(match[1]), token);
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
