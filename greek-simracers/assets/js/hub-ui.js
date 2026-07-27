// Championship Hub — επαναχρησιμοποιήσιμα UI components.
//
// Καθαρές συναρτήσεις που παίρνουν δεδομένα και γυρίζουν HTML string ή
// στοιχείο DOM. Καμία σύνδεση με τη βάση εδώ: τα δεδομένα τα φέρνει ο
// καλών. Έτσι το ίδιο component δουλεύει με Supabase, με cache ή με
// δείγμα δεδομένων στο style guide.
(function () {
  // ---------- Βοηθητικά ----------

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Μόνο http(s) και σχετικές διαδρομές — ποτέ javascript: από τη βάση.
  function safeUrl(value) {
    const url = String(value == null ? "" : value).trim();
    if (!url) return "";
    if (/^(https?:)?\/\//i.test(url) || /^[\w./?=&#%-]+$/.test(url)) return url;
    return "";
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString("el-GR") : "—";
  }

  // Εικονίδιο διεπαφής από το κοινό sprite. Αντικαθιστά τα emoji: το ίδιο
  // σχήμα σε κάθε συσκευή, και παίρνει χρώμα από το CSS.
  function icon(name) {
    return `<svg class="ui-icon" aria-hidden="true" focusable="false"><use href="#gsr-ui-${name}"></use></svg>`;
  }

  const STATE_LABELS = {
    live: "Live",
    upcoming: "Επόμενος",
    finished: "Ολοκληρώθηκε",
    penalty: "Ποινή",
  };

  function stateBadge(state) {
    if (!state) return "";
    const key = String(state).toLowerCase();
    const label = STATE_LABELS[key] || state;
    return `<span class="state-badge state-badge--${esc(key)}">${esc(label)}</span>`;
  }

  function media(url, alt) {
    const src = safeUrl(url);
    return src
      ? `<div class="hub-card__media"><img src="${esc(src)}" alt="${esc(alt || "")}" loading="lazy"></div>`
      : "";
  }

  // ---------- Κάρτες ----------

  // Οδηγός: φωτογραφία, όνομα, σημαία, ομάδα, αυτοκίνητο, θέση, πόντοι.
  function driverCard(driver) {
    const href = safeUrl(driver.href);
    const tag = href ? "a" : "article";
    const attrs = href ? ` href="${esc(href)}"` : "";

    return (
      `<${tag} class="hub-card driver-card"${attrs}>` +
      '<div class="driver-card__top">' +
      (safeUrl(driver.photo_url)
        ? `<img class="driver-card__photo" src="${esc(safeUrl(driver.photo_url))}" alt="" loading="lazy">`
        : '<div class="driver-card__photo" aria-hidden="true"></div>') +
      "<div>" +
      (driver.number ? `<span class="driver-card__number">#${esc(driver.number)}</span>` : "") +
      `<h3 class="driver-card__name">${esc(driver.name)}</h3>` +
      `<span class="driver-card__flag">${esc(driver.flag || "")} ${esc(driver.country || "")}</span>` +
      "</div>" +
      (driver.position
        ? '<div class="driver-card__pos">' +
          `<span class="driver-card__pos-value">P${esc(driver.position)}</span>` +
          '<span class="driver-card__pos-label">Θέση</span>' +
          "</div>"
        : "") +
      "</div>" +
      '<div class="hub-card__body">' +
      '<div class="hub-card__meta">' +
      (driver.team ? `<span>${icon("users")}${esc(driver.team)}</span>` : "") +
      (driver.car ? `<span>${icon("car")}${esc(driver.car)}</span>` : "") +
      "</div></div>" +
      '<div class="hub-card__foot">' +
      '<span class="stat-card__label">Πόντοι</span>' +
      `<strong>${num(driver.points)}</strong>` +
      "</div>" +
      `</${tag}>`
    );
  }

  // Ομάδα: λογότυπο, όνομα, οδηγοί, αυτοκίνητο, θέση, πόντοι.
  function teamCard(team) {
    const drivers = Array.isArray(team.drivers) ? team.drivers : [];
    return (
      '<article class="hub-card team-card">' +
      '<div class="driver-card__top">' +
      (safeUrl(team.logo_url)
        ? `<img class="driver-card__photo" src="${esc(safeUrl(team.logo_url))}" alt="" loading="lazy">`
        : '<div class="driver-card__photo" aria-hidden="true"></div>') +
      "<div>" +
      `<h3 class="driver-card__name">${esc(team.name)}</h3>` +
      `<span class="driver-card__flag">${esc(team.car || "")}</span>` +
      "</div>" +
      (team.position
        ? '<div class="driver-card__pos">' +
          `<span class="driver-card__pos-value">P${esc(team.position)}</span>` +
          '<span class="driver-card__pos-label">Θέση</span></div>'
        : "") +
      "</div>" +
      '<div class="hub-card__body">' +
      (drivers.length
        ? `<p class="hub-card__sub">${drivers.map(esc).join(" · ")}</p>`
        : "") +
      "</div>" +
      '<div class="hub-card__foot">' +
      '<span class="stat-card__label">Πόντοι</span>' +
      `<strong>${num(team.points)}</strong>` +
      "</div></article>"
    );
  }

  // Αγώνας: εικόνα πίστας, όνομα, ημερομηνία, κατάσταση, νικητής, γρηγορότερος γύρος.
  function raceCard(race) {
    return (
      '<article class="hub-card race-card">' +
      media(race.image_url, race.track || race.name) +
      '<div class="hub-card__body">' +
      '<div class="hub-card__meta">' +
      stateBadge(race.state) +
      (race.date ? `<span>${icon("calendar")}${esc(race.date)}</span>` : "") +
      "</div>" +
      `<h3 class="hub-card__title">${esc(race.name)}</h3>` +
      (race.track ? `<p class="hub-card__sub">${esc(race.track)}</p>` : "") +
      "</div>" +
      (race.winner || race.fastest_lap
        ? '<div class="hub-card__foot">' +
          (race.winner ? `<span>${icon("trophy")}${esc(race.winner)}</span>` : "<span></span>") +
          (race.fastest_lap ? `<span>${icon("zap")}${esc(race.fastest_lap)}</span>` : "") +
          "</div>"
        : "") +
      "</article>"
    );
  }

  // Πίστα: εικόνα, χώρα, μήκος, στροφές, ρεκόρ γύρου.
  function trackCard(track) {
    return (
      '<article class="hub-card track-card">' +
      media(track.image_url, track.name) +
      '<div class="hub-card__body">' +
      `<h3 class="hub-card__title">${esc(track.name)}</h3>` +
      `<p class="hub-card__sub">${esc(track.country || "")}</p>` +
      '<div class="hub-card__meta">' +
      (track.length ? `<span>${icon("ruler")}${esc(track.length)}</span>` : "") +
      (track.corners ? `<span>${icon("corner")}${esc(track.corners)} στροφές</span>` : "") +
      "</div></div>" +
      (track.lap_record
        ? '<div class="hub-card__foot"><span class="stat-card__label">Ρεκόρ γύρου</span>' +
          `<strong>${esc(track.lap_record)}</strong></div>`
        : "") +
      "</article>"
    );
  }

  // Νέα / ανακοίνωση.
  function newsCard(item) {
    const href = safeUrl(item.href);
    const tag = href ? "a" : "article";
    const attrs = href ? ` href="${esc(href)}"` : "";
    return (
      `<${tag} class="hub-card news-card"${attrs}>` +
      media(item.image_url, item.title) +
      '<div class="hub-card__body">' +
      '<div class="hub-card__meta">' +
      (item.category ? `<span>${esc(item.category)}</span>` : "") +
      (item.date ? `<span>${esc(item.date)}</span>` : "") +
      "</div>" +
      `<h3 class="hub-card__title">${esc(item.title)}</h3>` +
      (item.excerpt ? `<p class="hub-card__sub">${esc(item.excerpt)}</p>` : "") +
      "</div>" +
      (item.author
        ? `<div class="hub-card__foot"><span class="hub-card__sub">${esc(item.author)}</span></div>`
        : "") +
      `</${tag}>`
    );
  }

  // ---------- Στατιστικά ----------

  function statCard(stat) {
    return (
      '<div class="stat-card">' +
      `<span class="stat-card__label">${esc(stat.label)}</span>` +
      `<span class="stat-card__value">${stat.raw ? esc(stat.value) : num(stat.value)}</span>` +
      (stat.hint ? `<p class="stat-card__hint">${esc(stat.hint)}</p>` : "") +
      "</div>"
    );
  }

  function progressCard(stat) {
    const pct = Math.max(0, Math.min(100, Number(stat.percent) || 0));
    return (
      '<div class="stat-card">' +
      `<span class="stat-card__label">${esc(stat.label)}</span>` +
      `<span class="stat-card__value">${pct}%</span>` +
      '<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" ' +
      `aria-valuenow="${pct}" aria-label="${esc(stat.label)}">` +
      `<div class="progress-track__bar" style="width:${pct}%"></div></div>` +
      (stat.hint ? `<p class="stat-card__hint">${esc(stat.hint)}</p>` : "") +
      "</div>"
    );
  }

  function rankingCard(title, rows) {
    return (
      '<div class="stat-card">' +
      `<span class="stat-card__label">${esc(title)}</span>` +
      '<ol class="rank-list" style="margin-top:0.75rem">' +
      rows
        .map(
          (row, i) =>
            `<li><span class="rank-list__pos">${i + 1}</span>` +
            `<span>${esc(row.name)}</span>` +
            `<span class="rank-list__value">${row.raw ? esc(row.value) : num(row.value)}</span></li>`
        )
        .join("") +
      "</ol></div>"
    );
  }

  // ---------- Καταστάσεις ----------

  function skeletonCards(count, withMedia) {
    let html = "";
    for (let i = 0; i < (count || 3); i += 1) {
      html +=
        '<div class="hub-card" aria-hidden="true">' +
        (withMedia === false ? "" : '<div class="skeleton skeleton--media"></div>') +
        '<div class="hub-card__body">' +
        '<div class="skeleton skeleton--title"></div>' +
        '<div class="skeleton skeleton--text"></div>' +
        '<div class="skeleton skeleton--text" style="width:70%"></div>' +
        "</div></div>";
    }
    return html;
  }

  function skeletonTable(rows) {
    let html = '<div class="stack-sm" aria-hidden="true">';
    for (let i = 0; i < (rows || 6); i += 1) {
      html += '<div class="skeleton skeleton--row"></div>';
    }
    return html + "</div>";
  }

  function emptyState(options) {
    const opts = options || {};
    const action = opts.actionHref
      ? `<a class="btn btn-outline" href="${esc(safeUrl(opts.actionHref))}">${esc(opts.actionLabel || "Δες περισσότερα")}</a>`
      : "";
    return (
      '<div class="hub-state">' +
      `<span class="hub-state__icon">${icon(opts.icon || "flag")}</span>` +
      `<h3 class="hub-state__title">${esc(opts.title || "Δεν υπάρχουν δεδομένα")}</h3>` +
      `<p class="hub-state__text">${esc(opts.text || "")}</p>` +
      action +
      "</div>"
    );
  }

  function errorState(options) {
    const opts = options || {};
    const retry = opts.onRetry === false ? "" : '<button type="button" class="btn btn-outline" data-hub-retry>Δοκίμασε ξανά</button>';
    return (
      '<div class="hub-state hub-state--error" role="alert">' +
      `<span class="hub-state__icon">${icon(opts.icon || "alert")}</span>` +
      `<h3 class="hub-state__title">${esc(opts.title || "Κάτι πήγε στραβά")}</h3>` +
      `<p class="hub-state__text">${esc(opts.text || "Δεν καταφέραμε να φορτώσουμε τα δεδομένα. Έλεγξε τη σύνδεσή σου.")}</p>` +
      retry +
      "</div>"
    );
  }

  // ---------- Πίνακας δεδομένων ----------
  //
  // dataTable(host, { columns, rows, pageSize, searchable, caption })
  //   columns: [{ key, label, align, className, format }]
  // Ταξινόμηση με κλικ στην κεφαλίδα, αναζήτηση, σελιδοποίηση, και στο
  // κινητό μετατροπή σε κάρτες (τα data-label μπαίνουν αυτόματα).
  function dataTable(host, config) {
    const columns = config.columns || [];
    const allRows = config.rows || [];
    const pageSize = config.pageSize || 10;
    let sortKey = config.sortKey || null;
    let sortDir = config.sortDir || "asc";
    let query = "";
    let page = 1;

    host.classList.add("data-table__wrap");
    host.innerHTML =
      (config.searchable === false
        ? ""
        : '<div class="data-table__tools">' +
          `<input type="search" class="data-table__search" placeholder="${esc(config.searchPlaceholder || "Αναζήτηση…")}" aria-label="${esc(config.searchPlaceholder || "Αναζήτηση")}">` +
          "</div>") +
      '<div class="data-table__scroll"><table class="data-table">' +
      (config.caption ? `<caption class="sr-only">${esc(config.caption)}</caption>` : "") +
      "<thead><tr></tr></thead><tbody></tbody></table></div>" +
      '<div class="data-table__pager"><span data-pager-info></span>' +
      '<span class="data-table__pager-btns">' +
      '<button type="button" data-page-prev>Προηγούμενη</button>' +
      '<button type="button" data-page-next>Επόμενη</button>' +
      "</span></div>";

    const headRow = host.querySelector("thead tr");
    const body = host.querySelector("tbody");
    const info = host.querySelector("[data-pager-info]");
    const prev = host.querySelector("[data-page-prev]");
    const next = host.querySelector("[data-page-next]");
    const search = host.querySelector(".data-table__search");

    headRow.innerHTML = columns
      .map(
        (col) =>
          `<th scope="col" class="${esc(col.className || "")}">` +
          (col.sortable === false
            ? esc(col.label)
            : `<button type="button" class="data-table__sort" data-key="${esc(col.key)}">${esc(col.label)}</button>`) +
          "</th>"
      )
      .join("");

    function filtered() {
      let rows = allRows;
      if (query) {
        const q = query.toLowerCase();
        rows = rows.filter((row) =>
          columns.some((col) => String(row[col.key] ?? "").toLowerCase().includes(q))
        );
      }
      if (sortKey) {
        rows = rows.slice().sort((a, b) => {
          const av = a[sortKey];
          const bv = b[sortKey];
          const bothNumeric = typeof av === "number" && typeof bv === "number";
          const cmp = bothNumeric
            ? av - bv
            : String(av ?? "").localeCompare(String(bv ?? ""), "el");
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
      return rows;
    }

    function render() {
      const rows = filtered();
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      page = Math.min(page, pages);
      const slice = rows.slice((page - 1) * pageSize, page * pageSize);

      body.innerHTML = slice.length
        ? slice
            .map(
              (row) =>
                "<tr>" +
                columns
                  .map(
                    (col) =>
                      `<td data-label="${esc(col.label)}" class="${esc(col.className || "")}">` +
                      (col.format ? col.format(row[col.key], row) : esc(row[col.key] ?? "—")) +
                      "</td>"
                  )
                  .join("") +
                "</tr>"
            )
            .join("")
        : `<tr><td colspan="${columns.length}">${esc(config.emptyText || "Καμία εγγραφή.")}</td></tr>`;

      info.textContent = rows.length
        ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, rows.length)} από ${rows.length}`
        : "0 εγγραφές";
      prev.disabled = page <= 1;
      next.disabled = page >= pages;

      headRow.querySelectorAll(".data-table__sort").forEach((btn) => {
        const active = btn.dataset.key === sortKey;
        btn.setAttribute("aria-sort", active ? (sortDir === "asc" ? "ascending" : "descending") : "none");
        btn.closest("th").setAttribute("aria-sort", active ? (sortDir === "asc" ? "ascending" : "descending") : "none");
      });
    }

    headRow.addEventListener("click", (event) => {
      const btn = event.target.closest(".data-table__sort");
      if (!btn) return;
      const key = btn.dataset.key;
      if (sortKey === key) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        sortDir = "asc";
      }
      page = 1;
      render();
    });

    if (search) {
      search.addEventListener("input", () => {
        query = search.value.trim();
        page = 1;
        render();
      });
    }

    prev.addEventListener("click", () => { page -= 1; render(); });
    next.addEventListener("click", () => { page += 1; render(); });

    render();
    return { render, setRows(rows) { allRows.length = 0; allRows.push(...rows); page = 1; render(); } };
  }

  window.GSRHub = {
    esc,
    icon,
    safeUrl,
    stateBadge,
    driverCard,
    teamCard,
    raceCard,
    trackCard,
    newsCard,
    statCard,
    progressCard,
    rankingCard,
    skeletonCards,
    skeletonTable,
    emptyState,
    errorState,
    dataTable,
  };
})();
