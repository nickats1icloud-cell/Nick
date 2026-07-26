// Ζωντανά δεδομένα για την αρχική: μετρητές, τελευταίες συζητήσεις,
// ανοιχτή πρόβλεψη, ενεργό πρωτάθλημα, νέο επεισόδιο και προϊόντα.
// Κάθε ενότητα αποτυγχάνει μόνη της — μια χαλασμένη κλήση δεν ρίχνει τη σελίδα.
(function () {
  if (typeof window.supabaseClient === "undefined") return;
  const sb = window.supabaseClient;

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const minutes = Math.floor(Math.max(0, Date.now() - then) / 60000);
    if (minutes < 1) return "μόλις τώρα";
    if (minutes < 60) return "πριν " + minutes + "λ";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return "πριν " + hours + "ω";
    const days = Math.floor(hours / 24);
    if (days < 30) return "πριν " + days + "μ";
    return new Date(iso).toLocaleDateString("el-GR", { day: "numeric", month: "short" });
  }

  function avatarHue(userId) {
    const s = String(userId || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  function avatarHtml(userId, name) {
    const initial = (String(name || "Μ").trim().charAt(0) || "Μ").toUpperCase();
    return `<span class="home-avatar" style="background:hsl(${avatarHue(userId)} 60% 45%)" aria-hidden="true">${escapeHtml(initial)}</span>`;
  }

  // Ο μετρητής ξεκινά από το «—», οπότε γράφουμε τον αριθμό και αφήνουμε
  // το motion.js να τον ανεβάσει με animation όταν φανεί.
  function setStat(key, value) {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (!el) return;
    el.textContent = String(value);
    el.setAttribute("data-countup", "");
    if (window.gsrMotion) window.gsrMotion.refresh();
  }

  async function loadStats() {
    const counts = await Promise.allSettled([
      sb.from("profiles").select("user_id", { count: "exact", head: true }),
      sb.from("forum_threads").select("id", { count: "exact", head: true }),
      sb.from("podcast_episodes").select("id", { count: "exact", head: true }).eq("published", true),
      sb.from("championships").select("id", { count: "exact", head: true }),
    ]);
    const keys = ["members", "threads", "episodes", "championships"];
    counts.forEach((res, i) => {
      if (res.status === "fulfilled" && !res.value.error) {
        setStat(keys[i], res.value.count ?? 0);
      } else {
        const el = document.querySelector(`[data-stat="${keys[i]}"]`);
        if (el) el.textContent = "—";
      }
    });
  }

  async function loadThreads() {
    const box = document.getElementById("home-threads");
    if (!box) return;
    try {
      const { data, error } = await sb
        .from("forum_threads")
        .select("id, title, created_at, updated_at, views, profiles!forum_threads_user_id_fkey(display_name), forum_categories(name, icon)")
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      const threads = data || [];
      if (!threads.length) {
        box.innerHTML = `<div class="state-message"><p>Δεν υπάρχουν συζητήσεις ακόμα.</p>
          <p style="margin-top:1rem;"><a class="btn btn-primary btn-sm" href="forum.html">Ξεκίνα την πρώτη →</a></p></div>`;
        return;
      }
      box.innerHTML = threads
        .map((t) => {
          const author = (t.profiles && t.profiles.display_name) || "Μέλος";
          const cat = t.forum_categories || {};
          return `
            <a class="thread-row" href="forum.html#/thread/${encodeURIComponent(t.id)}">
              ${avatarHtml(t.id, author)}
              <span class="thread-row__body">
                <span class="thread-row__title">${escapeHtml(t.title)}</span>
                <span class="thread-row__meta">
                  ${cat.name ? `<span class="thread-row__cat">${escapeHtml((cat.icon || "") + " " + cat.name)}</span>` : ""}
                  <span>${escapeHtml(author)}</span>
                  <span>${escapeHtml(timeAgo(t.updated_at || t.created_at))}</span>
                </span>
              </span>
              <span class="thread-row__views">👁️ ${Number(t.views || 0)}</span>
            </a>`;
        })
        .join("");
    } catch (err) {
      box.innerHTML = `<div class="state-message"><p>Δεν καταφέραμε να φορτώσουμε τις συζητήσεις.</p></div>`;
    }
  }

  async function loadPrediction() {
    const box = document.getElementById("home-prediction");
    if (!box) return;
    try {
      const { data, error } = await sb
        .from("prediction_events")
        .select("id, title, options")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const event = (data || [])[0];
      if (!event) {
        box.hidden = true;
        return;
      }
      const options = Array.isArray(event.options) ? event.options.slice(0, 3) : [];
      box.innerHTML = `
        <span class="badge badge-success">Ανοιχτή πρόβλεψη</span>
        <h3 class="prediction-teaser__title">${escapeHtml(event.title)}</h3>
        <ul class="prediction-teaser__options">
          ${options.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}
        </ul>
        <a class="btn btn-outline btn-sm" href="predictions.html">Ψήφισε →</a>`;
    } catch (err) {
      box.hidden = true;
    }
  }

  async function loadChampionship() {
    const section = document.getElementById("home-championship-section");
    const box = document.getElementById("home-championship");
    if (!section || !box) return;
    try {
      // Προτεραιότητα στο ενεργό· αν δεν υπάρχει, δείχνουμε το ερχόμενο.
      let { data, error } = await sb
        .from("championships")
        .select("id, title, description, status, races_completed, races_total, participants, category, start_date")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!data || !data.length) {
        const upcoming = await sb
          .from("championships")
          .select("id, title, description, status, races_completed, races_total, participants, category, start_date")
          .eq("status", "upcoming")
          .order("created_at", { ascending: false })
          .limit(1);
        if (upcoming.error) throw upcoming.error;
        data = upcoming.data;
      }
      const champ = (data || [])[0];
      if (!champ) return;

      const total = Number(champ.races_total) || 0;
      const done = Number(champ.races_completed) || 0;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const isActive = champ.status === "active";

      box.innerHTML = `
        <div class="spotlight__label">
          <span class="badge ${isActive ? "badge-success" : "badge-primary"}">${isActive ? "Ενεργό τώρα" : "Ερχόμενο"}</span>
          <span class="badge">${escapeHtml(champ.category || "")}</span>
        </div>
        <h2 class="spotlight__title">${escapeHtml(champ.title)}</h2>
        <p class="spotlight__desc">${escapeHtml(champ.description || "")}</p>
        <div class="spotlight__bar" role="img" aria-label="Πρόοδος ${pct}%">
          <span style="width:${pct}%"></span>
        </div>
        <div class="spotlight__meta">
          <span>🏁 Αγώνες ${done}/${total}</span>
          <span>👥 ${Number(champ.participants || 0)} οδηγοί</span>
          ${champ.start_date ? `<span>📅 ${escapeHtml(new Date(champ.start_date).toLocaleDateString("el-GR", { month: "short", year: "numeric" }))}</span>` : ""}
        </div>
        <a class="btn btn-primary" href="championships.html">Όλα τα πρωταθλήματα →</a>`;
      section.hidden = false;
      if (window.gsrMotion) window.gsrMotion.refresh();
    } catch (err) {
      /* το section μένει κρυφό */
    }
  }

  async function loadEpisode() {
    const box = document.getElementById("home-episode");
    if (!box) return;
    try {
      const { data, error } = await sb
        .from("podcast_episodes")
        .select("episode_number, title, description, host, duration, spotify_url")
        .eq("published", true)
        .order("episode_number", { ascending: false })
        .limit(1);
      if (error) throw error;
      const ep = (data || [])[0];
      if (!ep) {
        box.innerHTML = `<p class="podcast-home__loading">Σύντομα το πρώτο μας επεισόδιο!</p>`;
        return;
      }
      box.innerHTML = `
        <div class="episode-card">
          <span class="episode-card__num">EP ${String(ep.episode_number || 1).padStart(2, "0")}</span>
          <h3 class="episode-card__title">${escapeHtml(ep.title)}</h3>
          <p class="episode-card__desc">${escapeHtml(ep.description || "")}</p>
          <div class="episode-card__meta">
            ${ep.host ? `<span>🎙️ ${escapeHtml(ep.host)}</span>` : ""}
            ${ep.duration ? `<span>⏱️ ${escapeHtml(ep.duration)}</span>` : ""}
          </div>
        </div>`;
    } catch (err) {
      box.innerHTML = `<p class="podcast-home__loading">Δεν καταφέραμε να φορτώσουμε το επεισόδιο.</p>`;
    }
  }

  const PRODUCT_IMAGES = {
    "tshirt-black": "assets/images/shop/tshirt-black.png",
    "tshirt-white": "assets/images/shop/tshirt-white.png",
    "hoodie-navy": "assets/images/shop/hoodie-navy.png",
    "cap-blue": "assets/images/shop/cap-blue.png",
    "keychain-helmet": "assets/images/shop/keychain-helmet.png",
    "keychain-wheel": "assets/images/shop/keychain-wheel.png",
  };

  async function loadProducts() {
    const section = document.getElementById("home-shop-section");
    const grid = document.getElementById("home-products");
    if (!section || !grid) return;
    try {
      const { data, error } = await sb
        .from("shop_products")
        .select("id, name, price, original_price, image_url, category, badge")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      const products = data || [];
      if (!products.length) return;

      grid.innerHTML = products
        .map((p) => {
          const img = PRODUCT_IMAGES[p.image_url] || PRODUCT_IMAGES["tshirt-black"];
          return `
            <a class="card product-mini fx-lift" href="shop.html" data-reveal="up">
              <div class="product-mini__media">
                <img src="${img}" alt="${escapeHtml(p.name)}" loading="lazy">
                ${p.badge ? `<span class="badge badge-primary product-mini__badge">${escapeHtml(p.badge)}</span>` : ""}
              </div>
              <div class="product-mini__body">
                <span class="product-mini__cat">${escapeHtml(p.category || "")}</span>
                <h3 class="product-mini__name">${escapeHtml(p.name)}</h3>
                <span class="product-mini__price">
                  €${Number(p.price).toFixed(2)}
                  ${p.original_price ? `<s>€${Number(p.original_price).toFixed(2)}</s>` : ""}
                </span>
              </div>
            </a>`;
        })
        .join("");
      section.hidden = false;
      if (window.gsrMotion) window.gsrMotion.refresh();
    } catch (err) {
      /* το section μένει κρυφό */
    }
  }

  loadStats();
  loadThreads();
  loadPrediction();
  loadChampionship();
  loadEpisode();
  loadProducts();
})();
