// Championship Hub — η σελίδα ενός πρωταθλήματος.
//
// Όλα έρχονται από το Supabase: πρωτάθλημα, σεζόν, αγώνες, οδηγοί, ομάδες
// και βαθμολογίες. Οι βαθμολογίες δεν είναι αποθηκευμένες — υπολογίζονται
// από τα αποτελέσματα στις όψεις hub_driver_standings / hub_team_standings,
// οπότε δεν γίνεται ποτέ να διαφωνούν με τους αγώνες.
(function () {
  const H = window.GSRHub;
  const C = window.GSRCharts;

  const $ = (sel) => document.querySelector(sel);
  const params = new URLSearchParams(window.location.search);

  const el = {
    hero: $("#champ-hero"),
    seasons: $("#season-picker"),
    next: $("#next-race"),
    drivers: $("#driver-standings"),
    teams: $("#team-standings"),
    calendar: $("#calendar-grid"),
    grid: $("#drivers-grid"),
    chartPoints: $("#chart-points"),
    chartProgress: $("#chart-progress"),
  };

  let championship = null;
  let seasons = [];
  let season = null;

  // ---------- Βοηθητικά ----------

  const DATE_FMT = new Intl.DateTimeFormat("el-GR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : DATE_FMT.format(date);
  }

  function fail(host, text) {
    if (host) host.innerHTML = H.errorState({ text });
  }

  // ---------- Hero ----------

  function renderHero() {
    const finished = seasonEvents.filter((e) => e.status === "finished").length;
    const stats = [
      { label: "Αγώνες", value: `${finished}/${seasonEvents.length}`, raw: true },
      { label: "Οδηγοί", value: driverRows.length },
      { label: "Ομάδες", value: teamRows.length },
    ];

    const status = championship.status === "active" ? "live" : championship.status === "upcoming" ? "upcoming" : "finished";
    const statusLabel = { live: "Σε εξέλιξη", upcoming: "Έρχεται", finished: "Ολοκληρώθηκε" }[status];

    el.hero.innerHTML =
      '<div class="hub-hero">' +
      (championship.image_url
        ? `<img class="hub-hero__media" src="${H.esc(H.safeUrl(championship.image_url))}" alt="" loading="lazy">`
        : "") +
      '<div class="hub-hero__scrim"></div>' +
      '<div class="hub-hero__body">' +
      `<span class="state-badge state-badge--${status}">${H.esc(statusLabel)}</span>` +
      `<h1 class="hub-hero__title">${H.esc(championship.title)}</h1>` +
      `<p class="hub-hero__sub">${H.esc(championship.description || "")}</p>` +
      `<div class="hub-hero__stats">${stats.map(H.statCard).join("")}</div>` +
      "</div></div>";
  }

  function renderSeasonPicker() {
    if (seasons.length <= 1) {
      el.seasons.hidden = true;
      return;
    }
    el.seasons.hidden = false;
    el.seasons.innerHTML =
      '<span class="stat-card__label">Σεζόν</span>' +
      '<div class="season-picker__options">' +
      seasons
        .map(
          (s) =>
            `<button type="button" class="season-chip${s.id === season.id ? " is-active" : ""}" ` +
            `data-season="${H.esc(s.id)}" aria-pressed="${s.id === season.id}">${H.esc(s.name)}</button>`
        )
        .join("") +
      "</div>";
  }

  // ---------- Επόμενος αγώνας ----------

  function renderNextRace() {
    const next = seasonEvents.find((e) => e.status === "live") ||
      seasonEvents.find((e) => e.status === "upcoming");

    if (!next) {
      el.next.hidden = true;
      return;
    }

    el.next.hidden = false;
    const track = next.hub_tracks;
    el.next.innerHTML =
      '<div class="next-race">' +
      '<div class="next-race__info">' +
      H.stateBadge(next.status === "live" ? "live" : "upcoming") +
      `<h2 class="next-race__title">${H.esc(next.name)}</h2>` +
      (track
        ? `<p class="hub-card__sub">${H.esc(track.country_flag || "")} ${H.esc(track.name)}` +
          (track.length_km ? ` · ${H.esc(track.length_km)} χλμ` : "") +
          (track.corners ? ` · ${H.esc(track.corners)} στροφές` : "") +
          "</p>"
        : "") +
      `<p class="hub-card__sub">${H.esc(formatDate(next.starts_at))}</p>` +
      "</div>" +
      `<div class="next-race__countdown" data-countdown="${H.esc(next.starts_at || "")}"></div>` +
      "</div>";

    startCountdown(el.next.querySelector("[data-countdown]"));
  }

  // Κρατάμε το τρέχον interval ώστε η αλλαγή σεζόν να μην αφήνει πίσω
  // χρονόμετρα που μετράνε για στοιχεία που δεν υπάρχουν πια.
  let countdownTimer = null;

  function startCountdown(node) {
    clearInterval(countdownTimer);
    if (!node || !node.dataset.countdown) return;
    const target = new Date(node.dataset.countdown).getTime();
    if (Number.isNaN(target)) return;

    const units = [
      ["ημέρες", 86400000],
      ["ώρες", 3600000],
      ["λεπτά", 60000],
      ["δευτ.", 1000],
    ];

    function tick() {
      let left = target - Date.now();
      if (left <= 0) {
        node.innerHTML = '<span class="countdown__live">Ξεκίνησε</span>';
        clearInterval(countdownTimer);
        return;
      }
      node.innerHTML = units
        .map(([label, ms]) => {
          const value = Math.floor(left / ms);
          left -= value * ms;
          return (
            '<span class="countdown__unit">' +
            `<span class="countdown__value">${String(value).padStart(2, "0")}</span>` +
            `<span class="countdown__label">${label}</span></span>`
          );
        })
        .join("");
    }

    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  // ---------- Βαθμολογίες ----------

  function renderStandings() {
    if (!driverRows.length) {
      el.drivers.innerHTML = H.emptyState({
        title: "Δεν υπάρχει ακόμη βαθμολογία",
        text: "Θα εμφανιστεί μόλις καταχωρηθούν τα αποτελέσματα του πρώτου αγώνα.",
      });
    } else {
      H.dataTable(el.drivers, {
        caption: "Βαθμολογία οδηγών",
        searchPlaceholder: "Αναζήτηση οδηγού ή ομάδας…",
        sortKey: "position",
        pageSize: 10,
        columns: [
          { key: "position", label: "Θέση", className: "pos" },
          {
            key: "display_name",
            label: "Οδηγός",
            format: (value, row) =>
              (row.country_flag ? H.esc(row.country_flag) + " " : "") +
              (row.car_number ? `<span class="driver-card__number">#${H.esc(row.car_number)}</span> ` : "") +
              H.esc(value),
          },
          { key: "team_name", label: "Ομάδα" },
          { key: "car", label: "Αυτοκίνητο" },
          { key: "starts", label: "Εκκιν.", className: "num" },
          { key: "wins", label: "Νίκες", className: "num" },
          { key: "podiums", label: "Βάθρα", className: "num" },
          { key: "points", label: "Πόντοι", className: "num" },
        ],
        rows: driverRows,
      });
    }

    if (!teamRows.length) {
      el.teams.innerHTML = H.emptyState({
        title: "Καμία ομάδα",
        text: "Δεν έχουν καταχωρηθεί ομάδες για αυτή τη σεζόν.",
      });
      return;
    }

    H.dataTable(el.teams, {
      caption: "Βαθμολογία ομάδων",
      searchable: false,
      sortKey: "position",
      pageSize: 10,
      columns: [
        { key: "position", label: "Θέση", className: "pos" },
        { key: "name", label: "Ομάδα" },
        { key: "car", label: "Αυτοκίνητο" },
        { key: "driver_count", label: "Οδηγοί", className: "num" },
        { key: "wins", label: "Νίκες", className: "num" },
        { key: "points", label: "Πόντοι", className: "num" },
      ],
      rows: teamRows,
    });
  }

  // ---------- Καλεντάρι & οδηγοί ----------

  function renderCalendar() {
    if (!seasonEvents.length) {
      el.calendar.innerHTML = H.emptyState({
        title: "Δεν υπάρχει καλεντάρι",
        text: "Το πρόγραμμα της σεζόν δεν έχει ανακοινωθεί ακόμη.",
      });
      return;
    }

    el.calendar.innerHTML = seasonEvents
      .map((event) => {
        const track = event.hub_tracks;
        const winner = winnersByEvent[event.id];
        return (
          '<div class="col-4">' +
          H.raceCard({
            name: event.round ? `R${event.round} · ${event.name}` : event.name,
            track: track ? `${track.country_flag || ""} ${track.name}` : "",
            date: formatDate(event.starts_at),
            state: event.status === "finished" ? "finished" : event.status,
            image_url: event.image_url || (track && track.image_url),
            winner: winner ? winner.name : "",
            fastest_lap: winner ? winner.bestLap : "",
          }) +
          "</div>"
        );
      })
      .join("");
  }

  function renderDrivers() {
    if (!driverRows.length) {
      el.grid.innerHTML = H.emptyState({
        title: "Καμία συμμετοχή",
        text: "Δεν έχουν δηλωθεί οδηγοί για αυτή τη σεζόν.",
      });
      return;
    }

    el.grid.innerHTML = driverRows
      .map(
        (row) =>
          '<div class="col-3">' +
          H.driverCard({
            name: row.display_name,
            number: row.car_number,
            flag: row.country_flag,
            country: row.country,
            team: row.team_name,
            car: row.car,
            position: row.position,
            points: row.points,
            photo_url: row.photo_url,
          }) +
          "</div>"
      )
      .join("");
  }

  // ---------- Γραφήματα ----------

  function renderCharts() {
    if (!driverRows.length) {
      el.chartPoints.closest(".hub-section").hidden = true;
      return;
    }

    C.barChart(el.chartPoints, {
      title: "Πόντοι ανά οδηγό",
      items: driverRows.slice(0, 8).map((row) => ({ label: row.display_name, value: Number(row.points) })),
    });

    // Αθροιστικοί πόντοι ανά γύρο, για τους πέντε πρώτους.
    const rounds = seasonEvents
      .filter((e) => e.status === "finished")
      .sort((a, b) => (a.round || 0) - (b.round || 0));

    if (rounds.length < 2) {
      el.chartProgress.closest(".chart-card").hidden = true;
      return;
    }

    C.lineChart(el.chartProgress, {
      title: "Εξέλιξη βαθμολογίας",
      labels: rounds.map((e) => `R${e.round || ""}`),
      formatY: (v) => Math.round(v),
      series: driverRows.slice(0, 5).map((driver) => {
        let total = 0;
        return {
          name: driver.display_name,
          values: rounds.map((event) => {
            const result = results.find((r) => r.event_id === event.id && r.driver_id === driver.driver_id);
            total += result ? Number(result.points) : 0;
            return total;
          }),
        };
      }),
    });
  }

  // ---------- Φόρτωση ----------

  let seasonEvents = [];
  let driverRows = [];
  let teamRows = [];
  let results = [];
  let winnersByEvent = {};

  function showSkeletons() {
    el.drivers.innerHTML = H.skeletonTable(8);
    el.teams.innerHTML = H.skeletonTable(5);
    el.calendar.innerHTML = `<div class="col-12"><div class="grid-12">${["col-4", "col-4", "col-4"]
      .map((c) => `<div class="${c}">${H.skeletonCards(1)}</div>`)
      .join("")}</div></div>`;
    el.grid.innerHTML = ["col-3", "col-3", "col-3", "col-3"]
      .map((c) => `<div class="${c}">${H.skeletonCards(1, false)}</div>`)
      .join("");
  }

  async function loadSeason(selected) {
    season = selected;
    showSkeletons();
    renderSeasonPicker();

    const [eventsRes, driversRes, teamsRes] = await Promise.all([
      supabaseClient
        .from("hub_events")
        .select("*, hub_tracks(name, country, country_flag, length_km, corners, image_url)")
        .eq("season_id", season.id)
        .order("round", { ascending: true }),
      supabaseClient.from("hub_driver_standings").select("*").eq("season_id", season.id).order("position"),
      supabaseClient.from("hub_team_standings").select("*").eq("season_id", season.id).order("position"),
    ]);

    if (eventsRes.error || driversRes.error || teamsRes.error) {
      fail(el.drivers, "Δεν καταφέραμε να φορτώσουμε τη βαθμολογία.");
      fail(el.calendar, "Δεν καταφέραμε να φορτώσουμε το καλεντάρι.");
      return;
    }

    seasonEvents = eventsRes.data || [];
    driverRows = (driversRes.data || []).map((row) => ({ ...row, points: Number(row.points) }));
    teamRows = (teamsRes.data || []).map((row) => ({ ...row, points: Number(row.points) }));

    // Τα αποτελέσματα χρειάζονται για τους νικητές και το γράφημα εξέλιξης.
    results = [];
    winnersByEvent = {};
    if (seasonEvents.length) {
      const resultsRes = await supabaseClient
        .from("hub_results")
        .select("event_id, driver_id, position, points, best_lap")
        .in("event_id", seasonEvents.map((e) => e.id));

      if (!resultsRes.error) {
        results = resultsRes.data || [];
        const nameById = {};
        driverRows.forEach((d) => { nameById[d.driver_id] = d.display_name; });
        results
          .filter((r) => r.position === 1)
          .forEach((r) => {
            winnersByEvent[r.event_id] = { name: nameById[r.driver_id] || "", bestLap: r.best_lap || "" };
          });
      }
    }

    renderHero();
    renderNextRace();
    renderStandings();
    renderCalendar();
    renderDrivers();
    renderCharts();
  }

  async function load() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) {
      fail(el.hero, "Δεν υπάρχει σύνδεση με τη βάση.");
      return;
    }

    const id = params.get("id");
    let query = supabaseClient.from("championships").select("*");
    query = id ? query.eq("id", id) : query.eq("status", "active");

    const { data, error } = await query.order("created_at", { ascending: false }).limit(1);

    if (error || !data || !data.length) {
      el.hero.innerHTML = H.errorState({
        title: "Το πρωτάθλημα δεν βρέθηκε",
        text: "Ίσως ο σύνδεσμος είναι παλιός. Δες όλα τα πρωταθλήματα.",
        onRetry: false,
      });
      return;
    }

    championship = data[0];
    document.title = `${championship.title} — Greek SimRacers`;

    const seasonsRes = await supabaseClient
      .from("hub_seasons")
      .select("*")
      .eq("championship_id", championship.id)
      .order("year", { ascending: false })
      .order("created_at", { ascending: false });

    seasons = seasonsRes.data || [];

    if (!seasons.length) {
      renderHeroWithoutSeason();
      return;
    }

    el.seasons.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-season]");
      if (!btn) return;
      const picked = seasons.find((s) => s.id === btn.dataset.season);
      if (picked && picked.id !== season.id) loadSeason(picked);
    });

    await loadSeason(seasons.find((s) => s.is_active) || seasons[0]);
  }

  // Πρωτάθλημα χωρίς σεζόν: δείχνουμε ό,τι ξέρουμε και το λέμε καθαρά.
  function renderHeroWithoutSeason() {
    seasonEvents = [];
    driverRows = [];
    teamRows = [];
    renderHero();
    el.seasons.hidden = true;
    el.next.hidden = true;
    const message = H.emptyState({
      title: "Η σεζόν δεν έχει στηθεί ακόμη",
      text: "Μόλις προστεθούν σεζόν, αγώνες και οδηγοί, όλα εμφανίζονται εδώ αυτόματα.",
      actionHref: "championships.html",
      actionLabel: "Όλα τα πρωταθλήματα",
    });
    el.drivers.innerHTML = message;
    el.teams.innerHTML = "";
    el.calendar.innerHTML = "";
    el.grid.innerHTML = "";
    el.chartPoints.closest(".hub-section").hidden = true;
  }

  document.addEventListener("DOMContentLoaded", load);
})();
