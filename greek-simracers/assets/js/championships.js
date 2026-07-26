const STATUS_FILTERS = [
  { label: "Όλα", value: "all" },
  { label: "Ενεργά", value: "active" },
  { label: "Ερχόμενα", value: "upcoming" },
  { label: "Ολοκληρωμένα", value: "completed" },
];

const STATUS_LABELS = {
  active: "Ενεργό",
  upcoming: "Ερχόμενο",
  completed: "Ολοκληρωμένο",
};

const STATUS_BADGE_CLASS = {
  active: "badge-success",
  upcoming: "badge-primary",
  completed: "badge",
};

let championships = [];
let selectedFilter = "all";

const gridEl = document.getElementById("championships-grid");
const filtersEl = document.getElementById("championships-filters");
const statsEl = document.getElementById("championships-stats");

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function renderLoadingState() {
  gridEl.innerHTML = `
    <div class="state-message">
      <div class="spinner"></div>
      <p>Φόρτωση πρωταθλημάτων…</p>
    </div>
  `;
}

function renderErrorState() {
  gridEl.innerHTML = `
    <div class="state-message">
      <p>Δεν καταφέραμε να φορτώσουμε τα πρωταθλήματα αυτή τη στιγμή. Δοκίμασε να ανανεώσεις τη σελίδα σε λίγο.</p>
    </div>
  `;
}

function renderEmptyState() {
  gridEl.innerHTML = `
    <div class="state-message">
      <p>Δεν υπάρχουν πρωταθλήματα σε αυτή την κατηγορία προς το παρόν.</p>
    </div>
  `;
}

function renderFilters() {
  filtersEl.innerHTML = STATUS_FILTERS.map((filter) => `
    <button type="button" class="pill${filter.value === selectedFilter ? " is-active" : ""}" data-filter="${filter.value}" aria-pressed="${filter.value === selectedFilter}">
      ${filter.label}
    </button>
  `).join("");

  filtersEl.querySelectorAll(".pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      selectedFilter = pill.dataset.filter;
      renderFilters();
      renderFilteredChampionships();
    });
  });
}

function getProgress(champ) {
  if (!champ.races_total) return 0;
  return Math.min(100, Math.round((champ.races_completed / champ.races_total) * 100));
}

function formatStartDate(startDate) {
  if (!startDate) return null;
  return new Date(startDate).toLocaleDateString("el-GR", { month: "short", year: "numeric" });
}

function getFilteredChampionships() {
  if (selectedFilter === "all") return championships;
  return championships.filter((champ) => champ.status === selectedFilter);
}

function createChampionshipCard(champ) {
  const card = document.createElement("article");
  card.className = "card champ-card";
  // Το id επιτρέπει deep link από το dropdown του μενού (?champ=<id>).
  card.id = `champ-${champ.id}`;

  const statusLabel = STATUS_LABELS[champ.status] || champ.status;
  const statusClass = STATUS_BADGE_CLASS[champ.status] || "badge";
  const progress = getProgress(champ);
  const formattedDate = formatStartDate(champ.start_date);

  const mediaContent = champ.image_url
    ? `<img src="${escapeHtml(champ.image_url)}" alt="${escapeHtml(champ.title)}" loading="lazy">`
    : `<span class="champ-card__media-icon" aria-hidden="true">🏆</span>`;

  card.innerHTML = `
    <div class="champ-card__media">${mediaContent}</div>
    <div class="champ-card__body">
      <div class="champ-card__top">
        <span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span>
        <span class="badge">${escapeHtml(champ.category)}</span>
      </div>
      <h3 class="champ-card__title">${escapeHtml(champ.title)}</h3>
      ${champ.description ? `<p class="champ-card__desc">${escapeHtml(champ.description)}</p>` : ""}
      <div class="champ-card__meta">
        <span class="champ-card__meta-item">🏁 Αγώνες ${champ.races_completed}/${champ.races_total}</span>
        <span class="champ-card__meta-item">👥 ${champ.participants} οδηγοί</span>
        ${formattedDate ? `<span class="champ-card__meta-item">📅 ${formattedDate}</span>` : ""}
      </div>
      <div class="champ-progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
        <div class="champ-progress__bar" style="width:${progress}%"></div>
      </div>
      <a class="btn btn-outline champ-card__cta" href="championship.html?id=${encodeURIComponent(champ.id)}">
        Βαθμολογίες &amp; καλεντάρι
      </a>
    </div>
  `;

  return card;
}

function renderFilteredChampionships() {
  const filtered = getFilteredChampionships();

  if (filtered.length === 0) {
    renderEmptyState();
    return;
  }

  gridEl.innerHTML = "";
  filtered.forEach((champ) => gridEl.appendChild(createChampionshipCard(champ)));
}

function renderStats() {
  if (championships.length === 0) {
    statsEl.innerHTML = "";
    return;
  }

  const totalRaces = championships.reduce((sum, champ) => sum + (champ.races_total || 0), 0);
  const totalParticipants = championships.reduce((sum, champ) => sum + (champ.participants || 0), 0);
  const categoryCount = new Set(championships.map((champ) => champ.category)).size;

  const stats = [
    { icon: "🏆", value: championships.length, label: "Πρωταθλήματα" },
    { icon: "🏁", value: totalRaces, label: "Αγώνες" },
    { icon: "👥", value: totalParticipants, label: "Οδηγοί" },
    { icon: "📁", value: categoryCount, label: "Κατηγορίες" },
  ];

  statsEl.innerHTML = `
    <div class="grid grid-4 champs-stats">
      ${stats.map((stat) => `
        <div class="champs-stat">
          <span class="champs-stat__icon" aria-hidden="true">${stat.icon}</span>
          <span class="champs-stat__value">${stat.value}</span>
          <span class="champs-stat__label">${stat.label}</span>
        </div>
      `).join("")}
    </div>
  `;
}

async function loadChampionships() {
  renderLoadingState();

  const { data, error } = await supabaseClient
    .from("championships")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    renderErrorState();
    return;
  }

  championships = data || [];
  renderFilteredChampionships();
  renderStats();
  focusRequestedChampionship();
}

// Αν ήρθαμε από το dropdown του μενού (?champ=<id>), πάμε στην κάρτα και
// την τονίζουμε για λίγο ώστε να είναι προφανές ποια είναι.
function focusRequestedChampionship() {
  const requested = new URLSearchParams(window.location.search).get("champ");
  if (!requested) return;

  const card = document.getElementById(`champ-${requested}`);
  if (!card) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  card.classList.add("champ-card--focused");
  setTimeout(() => card.classList.remove("champ-card--focused"), 2600);
}

renderFilters();
loadChampionships();
