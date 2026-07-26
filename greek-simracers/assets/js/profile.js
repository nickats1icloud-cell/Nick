// Προφίλ μέλους σε στυλ forum: δημόσιο προφίλ (ορατό σε όλους) και
// ρυθμίσεις λογαριασμού (μόνο για τον κάτοχο).
//   #/            → το δικό σου προφίλ, ή πρόσκληση σύνδεσης
//   #/user/<id>   → δημόσιο προφίλ μέλους
//   #/settings    → ρυθμίσεις
(function () {
  const view = document.getElementById("profile-view");
  if (!view) return;

  const SIM_OPTIONS = [
    "Assetto Corsa",
    "Assetto Corsa Competizione",
    "iRacing",
    "rFactor 2",
    "Automobilista 2",
    "Gran Turismo",
    "F1 Series",
    "Le Mans Ultimate",
    "Άλλο",
  ];

  const SETUP_LABELS = {
    wheel: "Τιμόνι",
    controller: "Controller",
    keyboard: "Πληκτρολόγιο",
  };

  // Κάθε render παίρνει έναν αριθμό· αν αλλάξει το view όσο τρέχει ένα
  // async fetch, το παλιό αποτέλεσμα αγνοείται.
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

  function avatarHue(userId) {
    const s = String(userId || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  function avatarHtml(userId, name, size) {
    const initial = (String(name || "Μ").trim().charAt(0) || "Μ").toUpperCase();
    return `<span class="profile-avatar profile-avatar--${size}" style="background:hsl(${avatarHue(userId)} 60% 45%)" aria-hidden="true">${escapeHtml(initial)}</span>`;
  }

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

  function memberSince(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("el-GR", { month: "short", year: "numeric" });
  }

  // Καθαρίζει τα BBCode tags για την προεπισκόπηση κειμένου.
  function stripBBCode(text) {
    return String(text || "")
      .replace(/\[quote[^\]]*\][\s\S]*?\[\/quote\]/gi, "")
      .replace(/\[\/?[a-z]+(?:=[^\]]*)?\]/gi, "")
      .trim();
  }

  function truncate(text, max) {
    const s = String(text || "");
    return s.length > max ? s.slice(0, max).trimEnd() + "…" : s;
  }

  function renderState(html) {
    view.innerHTML = `<div class="state-message">${html}</div>`;
  }

  function renderLoading(message) {
    renderState(`<div class="spinner"></div><p>${escapeHtml(message)}</p>`);
  }

  function renderError(message) {
    renderState(`<p>${escapeHtml(message)}</p>`);
  }

  function renderAuthRequired(message) {
    renderState(
      `<p>${escapeHtml(message)}</p>` +
        `<p style="margin-top:1rem;"><a class="btn btn-primary" href="auth.html">Σύνδεση / Εγγραφή</a></p>`
    );
  }

  async function getSession() {
    try {
      const { data } = await window.supabaseClient.auth.getSession();
      return data && data.session ? data.session : null;
    } catch (err) {
      return null;
    }
  }

  /* ============ Δημόσιο προφίλ ============ */

  async function renderPublicProfile(userId) {
    const token = ++renderToken;
    renderLoading("Φόρτωση προφίλ…");

    let profile;
    let stats;
    let posts;
    let session;
    try {
      const [profileRes, statsRes, postsRes, currentSession] = await Promise.all([
        window.supabaseClient
          .from("profiles")
          .select("user_id, display_name, favorite_sim, setup_type, favorite_track, bio, created_at")
          .eq("user_id", userId)
          .maybeSingle(),
        window.supabaseClient
          .from("forum_user_stats")
          .select("post_count, is_admin, joined_at")
          .eq("user_id", userId)
          .maybeSingle(),
        window.supabaseClient
          .from("forum_posts")
          .select("id, content, created_at, thread_id, forum_threads(id, title)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
        getSession(),
      ]);
      if (token !== renderToken) return;
      if (profileRes.error) throw profileRes.error;
      profile = profileRes.data;
      stats = statsRes.data || {};
      posts = postsRes.data || [];
      session = currentSession;
    } catch (err) {
      if (token !== renderToken) return;
      renderError("Δεν καταφέραμε να φορτώσουμε το προφίλ. Δοκίμασε ξανά σε λίγο.");
      return;
    }

    if (!profile) {
      renderError("Το μέλος δεν βρέθηκε.");
      return;
    }

    const isOwn = session && session.user && session.user.id === userId;
    const name = profile.display_name || "Μέλος";
    const joined = memberSince(stats.joined_at || profile.created_at);

    const chips = [];
    if (profile.favorite_sim) chips.push(["🎮 Αγαπημένο sim", profile.favorite_sim]);
    if (profile.setup_type) chips.push(["🕹️ Setup", SETUP_LABELS[profile.setup_type] || profile.setup_type]);
    if (profile.favorite_track) chips.push(["📍 Αγαπημένη πίστα", profile.favorite_track]);

    const actions = isOwn
      ? '<a class="btn btn-outline" href="#/settings">⚙️ Ρυθμίσεις</a>'
      : session
        ? `<a class="btn btn-primary" href="messages.html#/chat/${encodeURIComponent(userId)}">✉️ Στείλε μήνυμα</a>`
        : "";

    const postsHtml = posts.length
      ? posts
          .map((post) => {
            const thread = post.forum_threads || {};
            const title = thread.title || "Συζήτηση";
            const href = thread.id ? `forum.html#/thread/${encodeURIComponent(thread.id)}` : "forum.html";
            const snippet = truncate(stripBBCode(post.content), 200) || "(χωρίς κείμενο)";
            return `
              <article class="card profile-post">
                <a class="profile-post__thread" href="${href}">${escapeHtml(title)}</a>
                <p class="profile-post__snippet">${escapeHtml(snippet)}</p>
                <span class="profile-post__time">${escapeHtml(timeAgo(post.created_at))}</span>
              </article>`;
          })
          .join("")
      : '<p class="profile-empty">Δεν έχει γράψει μηνύματα στο forum ακόμα.</p>';

    view.innerHTML = `
      <div class="card profile-header">
        ${avatarHtml(userId, name, "lg")}
        <div class="profile-header__main">
          <h1 class="profile-header__name">
            ${escapeHtml(name)}
            ${stats.is_admin ? '<span class="badge badge-primary">Διαχειριστής</span>' : ""}
          </h1>
          <div class="profile-header__meta">
            <span>Μέλος από ${escapeHtml(joined)}</span>
            <span>Μηνύματα: ${Number(stats.post_count || 0)}</span>
          </div>
          ${
            chips.length
              ? `<div class="profile-chips">${chips
                  .map(
                    ([label, value]) =>
                      `<span class="profile-chip"><span class="profile-chip__label">${escapeHtml(label)}</span>${escapeHtml(value)}</span>`
                  )
                  .join("")}</div>`
              : ""
          }
          ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ""}
          ${actions ? `<div class="profile-header__actions">${actions}</div>` : ""}
        </div>
      </div>

      <section class="profile-posts">
        <h2 class="profile-posts__title">Πρόσφατα μηνύματα</h2>
        ${postsHtml}
      </section>`;
  }

  /* ============ Ρυθμίσεις ============ */

  async function renderSettings() {
    const token = ++renderToken;
    renderLoading("Φόρτωση ρυθμίσεων…");

    const session = await getSession();
    if (token !== renderToken) return;
    if (!session) {
      renderAuthRequired("Πρέπει να συνδεθείς για να δεις τις ρυθμίσεις σου.");
      return;
    }

    let profile;
    try {
      const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("display_name, favorite_sim, setup_type, favorite_track, bio, signature")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (token !== renderToken) return;
      if (error) throw error;
      profile = data || {};
    } catch (err) {
      if (token !== renderToken) return;
      renderError("Δεν καταφέραμε να φορτώσουμε τις ρυθμίσεις σου.");
      return;
    }

    const simOptions = SIM_OPTIONS.map(
      (sim) =>
        `<option value="${escapeHtml(sim)}"${profile.favorite_sim === sim ? " selected" : ""}>${escapeHtml(sim)}</option>`
    ).join("");

    const setupOptions = Object.keys(SETUP_LABELS)
      .map(
        (key) =>
          `<option value="${key}"${profile.setup_type === key ? " selected" : ""}>${escapeHtml(SETUP_LABELS[key])}</option>`
      )
      .join("");

    view.innerHTML = `
      <div class="profile-settings">
        <div class="profile-settings__head">
          <h1 class="profile-settings__title">⚙️ Ρυθμίσεις</h1>
          <a class="btn btn-outline btn-sm" href="#/user/${encodeURIComponent(session.user.id)}">← Στο προφίλ μου</a>
        </div>

        <div class="pill-filters" role="tablist" aria-label="Ενότητες ρυθμίσεων">
          <button type="button" class="pill is-active" role="tab" aria-selected="true" data-tab="profile">Προφίλ</button>
          <button type="button" class="pill" role="tab" aria-selected="false" data-tab="account">Λογαριασμός</button>
        </div>

        <section class="card profile-panel" data-panel="profile">
          <form id="settings-profile-form" novalidate>
            <div class="field">
              <label for="set-name">Όνομα εμφάνισης</label>
              <input id="set-name" name="display_name" type="text" maxlength="40" value="${escapeHtml(profile.display_name || "")}">
            </div>
            <div class="field">
              <label for="set-sim">Αγαπημένο sim</label>
              <select id="set-sim" name="favorite_sim">
                <option value="">— Δεν επέλεξα —</option>
                ${simOptions}
              </select>
            </div>
            <div class="field">
              <label for="set-setup">Τύπος setup</label>
              <select id="set-setup" name="setup_type">
                <option value="">— Δεν επέλεξα —</option>
                ${setupOptions}
              </select>
            </div>
            <div class="field">
              <label for="set-track">Αγαπημένη πίστα</label>
              <input id="set-track" name="favorite_track" type="text" maxlength="60" value="${escapeHtml(profile.favorite_track || "")}">
            </div>
            <div class="field">
              <label for="set-bio">Λίγα λόγια για σένα</label>
              <textarea id="set-bio" name="bio" rows="4" maxlength="500">${escapeHtml(profile.bio || "")}</textarea>
              <span class="profile-counter" data-counter-for="set-bio"></span>
            </div>
            <div class="field">
              <label for="set-signature">Υπογραφή</label>
              <textarea id="set-signature" name="signature" rows="3" maxlength="300">${escapeHtml(profile.signature || "")}</textarea>
              <span class="profile-hint">Θα εμφανίζεται κάτω από τα μηνύματά σου στο forum.</span>
              <span class="profile-counter" data-counter-for="set-signature"></span>
            </div>
            <button type="submit" class="btn btn-primary">Αποθήκευση</button>
            <p class="form-status" id="settings-profile-status" role="status"></p>
          </form>
        </section>

        <section class="card profile-panel" data-panel="account" hidden>
          <div class="field">
            <label for="set-email">Email</label>
            <input id="set-email" type="email" value="${escapeHtml(session.user.email || "")}" readonly>
          </div>

          <form id="settings-password-form" novalidate>
            <div class="field">
              <label for="set-pass">Νέος κωδικός</label>
              <input id="set-pass" type="password" autocomplete="new-password" minlength="6">
            </div>
            <div class="field">
              <label for="set-pass2">Επιβεβαίωση κωδικού</label>
              <input id="set-pass2" type="password" autocomplete="new-password" minlength="6">
            </div>
            <button type="submit" class="btn btn-primary">Αλλαγή κωδικού</button>
            <p class="form-status" id="settings-password-status" role="status"></p>
          </form>

          <div class="profile-signout">
            <button type="button" class="btn btn-outline" id="settings-signout">Αποσύνδεση</button>
          </div>
        </section>
      </div>`;

    wireSettings(session);
  }

  function wireSettings(session) {
    const tabs = view.querySelectorAll("[data-tab]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((other) => {
          const active = other === tab;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-selected", String(active));
        });
        view.querySelectorAll("[data-panel]").forEach((panel) => {
          panel.hidden = panel.dataset.panel !== tab.dataset.tab;
        });
      });
    });

    view.querySelectorAll("[data-counter-for]").forEach((counter) => {
      const field = view.querySelector("#" + counter.dataset.counterFor);
      if (!field) return;
      const update = () => {
        counter.textContent = `${field.value.length}/${field.maxLength}`;
      };
      field.addEventListener("input", update);
      update();
    });

    const profileForm = view.querySelector("#settings-profile-form");
    const profileStatus = view.querySelector("#settings-profile-status");
    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = profileForm.querySelector('button[type="submit"]');
      const displayName = profileForm.display_name.value.trim();
      if (!displayName) {
        setStatus(profileStatus, "error", "Το όνομα εμφάνισης δεν μπορεί να είναι κενό.");
        return;
      }
      button.disabled = true;
      setStatus(profileStatus, "", "Αποθήκευση…");
      try {
        const { error } = await window.supabaseClient
          .from("profiles")
          .update({
            display_name: displayName,
            favorite_sim: profileForm.favorite_sim.value || null,
            setup_type: profileForm.setup_type.value || null,
            favorite_track: profileForm.favorite_track.value.trim() || null,
            bio: profileForm.bio.value.trim() || null,
            signature: profileForm.signature.value.trim() || null,
          })
          .eq("user_id", session.user.id);
        if (error) throw error;
        setStatus(profileStatus, "success", "Οι ρυθμίσεις αποθηκεύτηκαν.");
      } catch (err) {
        setStatus(profileStatus, "error", "Η αποθήκευση απέτυχε. Δοκίμασε ξανά.");
      } finally {
        button.disabled = false;
      }
    });

    const passwordForm = view.querySelector("#settings-password-form");
    const passwordStatus = view.querySelector("#settings-password-status");
    passwordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const pass = view.querySelector("#set-pass").value;
      const pass2 = view.querySelector("#set-pass2").value;
      if (pass.length < 6) {
        setStatus(passwordStatus, "error", "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.");
        return;
      }
      if (pass !== pass2) {
        setStatus(passwordStatus, "error", "Οι δύο κωδικοί δεν ταιριάζουν.");
        return;
      }
      const button = passwordForm.querySelector('button[type="submit"]');
      button.disabled = true;
      setStatus(passwordStatus, "", "Αλλαγή κωδικού…");
      try {
        const { error } = await window.supabaseClient.auth.updateUser({ password: pass });
        if (error) throw error;
        passwordForm.reset();
        setStatus(passwordStatus, "success", "Ο κωδικός άλλαξε με επιτυχία.");
      } catch (err) {
        setStatus(passwordStatus, "error", "Η αλλαγή κωδικού απέτυχε. Δοκίμασε ξανά.");
      } finally {
        button.disabled = false;
      }
    });

    view.querySelector("#settings-signout").addEventListener("click", async () => {
      await window.supabaseClient.auth.signOut();
      window.location.href = "index.html";
    });
  }

  function setStatus(el, state, message) {
    if (!el) return;
    el.textContent = message;
    if (state) el.setAttribute("data-state", state);
    else el.removeAttribute("data-state");
  }

  /* ============ Routing ============ */

  async function route() {
    if (!hasClient()) {
      renderError("Η σύνδεση με τον διακομιστή δεν είναι διαθέσιμη αυτή τη στιγμή. Δοκίμασε να ανανεώσεις τη σελίδα.");
      return;
    }

    const hash = window.location.hash || "#/";
    const userMatch = hash.match(/^#\/user\/([^/?]+)/);
    if (userMatch) {
      renderPublicProfile(decodeURIComponent(userMatch[1]));
      return;
    }
    if (hash.startsWith("#/settings")) {
      renderSettings();
      return;
    }

    // #/ → το δικό σου προφίλ, αλλιώς πρόσκληση σύνδεσης.
    renderLoading("Φόρτωση προφίλ…");
    const session = await getSession();
    if (!session) {
      renderAuthRequired("Συνδέσου για να δεις το προφίλ σου.");
      return;
    }
    window.location.replace("#/user/" + encodeURIComponent(session.user.id));
  }

  window.addEventListener("hashchange", route);
  route();
})();
