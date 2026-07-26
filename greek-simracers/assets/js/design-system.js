// Ζωντανός οδηγός του design system. Τα δεδομένα εδώ είναι δείγμα και
// υπάρχουν μόνο για να φαίνεται πώς συμπεριφέρεται κάθε component — η
// εφαρμογή διαβάζει πάντα από τη βάση.
(function () {
  const H = window.GSRHub;
  const C = window.GSRCharts;
  if (!H || !C) return;

  const $ = (sel) => document.querySelector(sel);
  const wrap = (cls, html) => `<div class="${cls}">${html}</div>`;

  // ---------- Πλέγμα ----------
  $("#grid-demo").innerHTML =
    wrap("col-6", '<div class="stat-card"><span class="stat-card__label">col-6</span><span class="stat-card__value">½</span></div>') +
    wrap("col-3", '<div class="stat-card"><span class="stat-card__label">col-3</span><span class="stat-card__value">¼</span></div>') +
    wrap("col-3", '<div class="stat-card"><span class="stat-card__label">col-3</span><span class="stat-card__value">¼</span></div>') +
    wrap("col-4", '<div class="stat-card"><span class="stat-card__label">col-4</span><span class="stat-card__value">⅓</span></div>') +
    wrap("col-8", '<div class="stat-card"><span class="stat-card__label">col-8</span><span class="stat-card__value">⅔</span></div>');

  // ---------- Σήματα ----------
  $("#badges-demo").innerHTML = ["live", "upcoming", "finished", "penalty"]
    .map((s) => H.stateBadge(s))
    .join("");

  // ---------- Κάρτες ----------
  $("#cards-demo").innerHTML =
    wrap(
      "col-4",
      H.driverCard({
        number: 12,
        name: "Νίκος Ατσιδάκος",
        flag: "🇬🇷",
        country: "Ελλάδα",
        team: "GSR Racing",
        car: "BMW M4 GT3",
        position: 3,
        points: 245,
      })
    ) +
    wrap(
      "col-4",
      H.teamCard({
        name: "GSR Racing",
        car: "BMW M4 GT3",
        drivers: ["Ν. Ατσιδάκος", "Γ. Παπαδόπουλος"],
        position: 2,
        points: 418,
      })
    ) +
    wrap(
      "col-4",
      H.raceCard({
        name: "12 Ώρες Sebring",
        track: "Sebring International Raceway",
        date: "15 Μαρτίου",
        state: "live",
        winner: "Ν. Ατσιδάκος",
        fastest_lap: "1:47.312",
      })
    ) +
    wrap(
      "col-6",
      H.trackCard({
        name: "Circuit de la Sarthe",
        country: "Γαλλία",
        length: "13.626 χλμ",
        corners: 38,
        lap_record: "3:14.791",
      })
    ) +
    wrap(
      "col-6",
      H.newsCard({
        title: "Ανακοινώθηκε το καλεντάρι της νέας σεζόν",
        category: "Ανακοίνωση",
        date: "12 Ιουνίου",
        author: "GSR Stewards",
        excerpt: "Οκτώ αγώνες, τέσσερις ήπειροι και ένα νέο σύστημα βαθμολογίας.",
      })
    );

  // ---------- Στατιστικά ----------
  $("#stats-demo").innerHTML =
    wrap("col-3", H.statCard({ label: "Νίκες", value: 24, hint: "σε 61 εκκινήσεις" })) +
    wrap("col-3", H.statCard({ label: "Βάθρα", value: 41 })) +
    wrap("col-3", H.progressCard({ label: "Συνέπεια", percent: 92, hint: "διακύμανση χρόνων γύρου" })) +
    wrap(
      "col-3",
      H.rankingCard("Top 5 οδηγοί", [
        { name: "Ν. Ατσιδάκος", value: 245 },
        { name: "Γ. Παπαδόπουλος", value: 231 },
        { name: "Μ. Δημητρίου", value: 198 },
        { name: "Κ. Ιωάννου", value: 176 },
        { name: "Σ. Νικολάου", value: 154 },
      ])
    );

  // ---------- Πίνακας ----------
  const STANDINGS = [
    { pos: 1, driver: "Ν. Ατσιδάκος", team: "GSR Racing", car: "BMW M4 GT3", wins: 6, points: 245 },
    { pos: 2, driver: "Γ. Παπαδόπουλος", team: "Hellenic Motorsport", car: "Ferrari 296", wins: 5, points: 231 },
    { pos: 3, driver: "Μ. Δημητρίου", team: "Aegean Racing", car: "Porsche 911 GT3 R", wins: 3, points: 198 },
    { pos: 4, driver: "Κ. Ιωάννου", team: "GSR Racing", car: "BMW M4 GT3", wins: 2, points: 176 },
    { pos: 5, driver: "Σ. Νικολάου", team: "Olympus Racing", car: "Audi R8 LMS", wins: 1, points: 154 },
    { pos: 6, driver: "Δ. Γεωργίου", team: "Hellenic Motorsport", car: "Ferrari 296", wins: 1, points: 141 },
    { pos: 7, driver: "Α. Βασιλείου", team: "Aegean Racing", car: "Mercedes AMG GT3", wins: 0, points: 118 },
    { pos: 8, driver: "Θ. Λαμπρόπουλος", team: "Olympus Racing", car: "Audi R8 LMS", wins: 0, points: 96 },
    { pos: 9, driver: "Ε. Σταύρου", team: "Ionian Speed", car: "Lamborghini Huracán", wins: 0, points: 74 },
    { pos: 10, driver: "Π. Κωνσταντίνου", team: "Ionian Speed", car: "Lamborghini Huracán", wins: 0, points: 52 },
    { pos: 11, driver: "Χ. Μανωλάκης", team: "Thraki Racing", car: "McLaren 720S", wins: 0, points: 38 },
    { pos: 12, driver: "Ι. Ρούσσος", team: "Thraki Racing", car: "McLaren 720S", wins: 0, points: 21 },
  ];

  H.dataTable($("#table-demo"), {
    caption: "Βαθμολογία οδηγών",
    searchPlaceholder: "Αναζήτηση οδηγού ή ομάδας…",
    sortKey: "pos",
    pageSize: 8,
    columns: [
      { key: "pos", label: "Θέση", className: "pos" },
      { key: "driver", label: "Οδηγός" },
      { key: "team", label: "Ομάδα" },
      { key: "car", label: "Αυτοκίνητο" },
      { key: "wins", label: "Νίκες", className: "num" },
      { key: "points", label: "Πόντοι", className: "num" },
    ],
    rows: STANDINGS,
  });

  // ---------- Γραφήματα ----------
  C.lineChart($("#chart-line"), {
    title: "Εξέλιξη χρόνων γύρου ανά αγώνα",
    labels: ["Monza", "Spa", "Sebring", "Bathurst", "Suzuka", "Le Mans", "Imola", "Nürburgring"],
    // Δευτερόλεπτα σε λεπτά:δευτερόλεπτα. Στρογγυλοποιούμε πρώτα, αλλιώς
    // ένα 119.6 θα γινόταν "1:60".
    formatY: (v) => {
      const total = Math.round(v);
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    },
    series: [
      { name: "Ν. Ατσιδάκος", values: [108.4, 107.9, 107.3, 107.6, 106.8, 106.4, 106.1, 105.7] },
      { name: "Γ. Παπαδόπουλος", values: [109.1, 108.6, 108.2, 107.9, 107.7, 107.2, 107.4, 106.9] },
    ],
  });

  C.barChart($("#chart-bar"), {
    title: "Πόντοι πρωταθλήματος",
    items: STANDINGS.slice(0, 6).map((row) => ({ label: row.driver, value: row.points })),
  });

  C.radarChart($("#chart-radar"), {
    title: "Σύγκριση οδηγών",
    axes: ["Ταχύτητα", "Συνέπεια", "Κατατακτήριες", "Εκκίνηση", "Διαχείριση ελαστικών", "Βροχή"],
    series: [
      { name: "Ν. Ατσιδάκος", values: [92, 88, 95, 78, 84, 90] },
      { name: "Γ. Παπαδόπουλος", values: [86, 94, 82, 90, 88, 76] },
    ],
  });

  C.donutChart($("#chart-donut"), {
    title: "Χρήση αυτοκινήτων",
    centerLabel: "οδηγοί",
    items: [
      { label: "BMW M4 GT3", value: 8 },
      { label: "Ferrari 296", value: 6 },
      { label: "Porsche 911", value: 5 },
      { label: "Audi R8", value: 4 },
      { label: "Λοιπά", value: 3 },
    ],
  });

  // ---------- Καταστάσεις ----------
  $("#skeleton-demo").innerHTML = wrap("col-12", H.skeletonCards(2));

  $("#empty-demo").innerHTML = H.emptyState({
    icon: "🏁",
    title: "Δεν υπάρχουν αγώνες",
    text: "Το καλεντάρι της σεζόν δεν έχει ανακοινωθεί ακόμη.",
    actionHref: "championships.html",
    actionLabel: "Δες τα πρωταθλήματα",
  });

  $("#error-demo").innerHTML = H.errorState({
    title: "Πρόβλημα σύνδεσης",
    text: "Δεν καταφέραμε να φορτώσουμε τη βαθμολογία. Έλεγξε τη σύνδεσή σου.",
  });

  $("#error-demo").addEventListener("click", (event) => {
    if (event.target.closest("[data-hub-retry]")) window.location.reload();
  });
})();
