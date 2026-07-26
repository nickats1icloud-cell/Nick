// Σελίδα «Προβλέψεις»: κοινοτικές προβλέψεις αποτελεσμάτων αγώνων.
// Δεδομένα από Supabase (prediction_events + prediction_picks). Η κατανομή
// των ψήφων υπολογίζεται client-side από όλα τα picks (public read), ενώ
// η ψήφος του χρήστη γίνεται upsert (UNIQUE(event_id, user_id) + RLS).

const STATUS_FILTERS = [
  { label: "Όλα", value: "all" },
  { label: "Ανοιχτές", value: "open" },
  { label: "Κλειστές", value: "closed" },
  { label: "Ολοκληρωμένες", value: "settled" },
];

const STATUS_LABELS = {
  open: "Ανοιχτή",
  closed: "Κλειστή",
  settled: "Ολοκληρώθηκε",
};

const STATUS_BADGE_CLASS = {
  open: "badge-success",
  closed: "",
  settled: "badge-primary",
};

let events = [];
let pickStats = new Map(); // event_id -> { counts: Map(option -> n), total }
let myPicks = new Map(); // event_id -> επιλογή του συνδεδεμένου χρήστη
let currentUser = null;
let selectedFilter = "all";
let busyEventId = null; // event με upsert σε εξέλιξη (κλειδώνει τα κουμπιά του)

const listEl = document.getElementById("predictions-list");
const filtersEl = document.getElementById("predictions-filters");

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function renderLoadingState() {
  listEl.innerHTML = `
    <div class="state-message">
      <div class="spinner"></div>
      <p>Φόρτωση προβλέψεων…</p>
    </div>
  `;
}

function renderErrorState() {
  listEl.innerHTML = `
    <div class="state-message">
      <p>Δεν καταφέραμε να φορτώσουμε τις προβλέψεις αυτή τη στιγμή. Δοκίμασε να ανανεώσεις τη σελίδα σε λίγο.</p>
    </div>
  `;
}

function renderEmptyState() {
  const message = selectedFilter === "all"
    ? "Δεν υπάρχουν προβλέψεις ακόμη — μείνε συντονισμένος!"
    : "Δεν υπάρχουν προβλέψεις σε αυτή την κατηγορία προς το παρόν.";
  listEl.innerHTML = `
    <div class="state-message">
      <p>${message}</p>
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
      renderFilteredEvents();
    });
  });
}

function formatClosesAt(closesAt) {
  if (!closesAt) return null;
  return new Date(closesAt).toLocaleString("el-GR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Χτίζει τα στατιστικά κατανομής από όλα τα picks και κρατά
// τις ψήφους του συνδεδεμένου χρήστη για προεπιλογή.
function buildPickStats(picks) {
  pickStats = new Map();
  myPicks = new Map();

  picks.forEach((pick) => {
    let stats = pickStats.get(pick.event_id);
    if (!stats) {
      stats = { counts: new Map(), total: 0 };
      pickStats.set(pick.event_id, stats);
    }
    stats.counts.set(pick.pick, (stats.counts.get(pick.pick) || 0) + 1);
    stats.total += 1;

    if (currentUser && pick.user_id === currentUser.id) {
      myPicks.set(pick.event_id, pick.pick);
    }
  });
}

// Αισιόδοξη (optimistic) ενημέρωση της κατανομής: μεταφέρει την ψήφο του
// χρήστη από τη fromOption στη toOption. Με fromOption = null προστίθεται
// νέα ψήφος, με toOption = null αφαιρείται (χρησιμοποιείται για revert).
function applyPick(eventId, fromOption, toOption) {
  let stats = pickStats.get(eventId);
  if (!stats) {
    stats = { counts: new Map(), total: 0 };
    pickStats.set(eventId, stats);
  }

  if (fromOption != null) {
    stats.counts.set(fromOption, Math.max(0, (stats.counts.get(fromOption) || 0) - 1));
    stats.total = Math.max(0, stats.total - 1);
  }

  if (toOption != null) {
    stats.counts.set(toOption, (stats.counts.get(toOption) || 0) + 1);
    stats.total += 1;
    myPicks.set(eventId, toOption);
  } else {
    myPicks.delete(eventId);
  }
}

function getEventOptions(event) {
  return Array.isArray(event.options) ? event.options : [];
}

function renderOptionRow(event, option, index) {
  const stats = pickStats.get(event.id);
  const count = (stats && stats.counts.get(option)) || 0;
  const total = (stats && stats.total) || 0;
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  const isMine = myPicks.get(event.id) === option;
  const isWinner = event.status === "settled" && event.result === option;
  const interactive = Boolean(currentUser) && event.status === "open";

  const votesLabel = count === 1 ? "ψήφος" : "ψήφοι";
  const inner = `
    <span class="pred-option__label">
      ${escapeHtml(option)}
      ${isWinner ? '<span class="pred-option__check" aria-hidden="true">✓</span>' : ""}
      ${isMine ? '<span class="pred-option__mine-tag">η πρόβλεψή σου</span>' : ""}
    </span>
    <span class="pred-option__stats">${percent}% · ${count} ${votesLabel}</span>
    <span class="pred-option__bar" aria-hidden="true"><span class="pred-option__bar-fill" style="width:${percent}%"></span></span>
  `;

  const classes = `pred-option${isMine ? " is-mine" : ""}${isWinner ? " is-winner" : ""}`;

  if (interactive) {
    return `
      <li class="${classes}">
        <button type="button" class="pred-option__btn" data-event-id="${escapeHtml(event.id)}" data-option-index="${index}" aria-pressed="${isMine}"${busyEventId === event.id ? " disabled" : ""}>
          ${inner}
        </button>
      </li>
    `;
  }

  return `
    <li class="${classes}">
      <div class="pred-option__row">${inner}</div>
    </li>
  `;
}

function renderCardFooter(event) {
  if (event.status === "settled") {
    const hit = myPicks.get(event.id) === event.result;
    return `
      <div class="pred-card__foot">
        <p class="pred-card__result">Αποτέλεσμα: <strong>${escapeHtml(event.result)}</strong></p>
        ${hit ? '<p class="pred-card__hit">Το βρήκες! 🎯</p>' : ""}
      </div>
    `;
  }

  if (event.status === "open") {
    if (!currentUser) {
      return `
        <div class="pred-card__foot">
          <a class="pred-card__cta" href="auth.html">Συνδέσου για να ψηφίσεις →</a>
        </div>
      `;
    }
    return `
      <div class="pred-card__foot">
        <p class="form-status" data-status-for="${escapeHtml(event.id)}" role="status"></p>
      </div>
    `;
  }

  // closed
  return `
    <div class="pred-card__foot">
      <p class="pred-card__pending">Οι ψήφοι έκλεισαν — σε αναμονή αποτελέσματος.</p>
    </div>
  `;
}

function createEventCard(event) {
  const card = document.createElement("article");
  card.className = "card pred-card";
  card.dataset.eventId = event.id;

  const statusLabel = STATUS_LABELS[event.status] || event.status;
  const statusClass = STATUS_BADGE_CLASS[event.status] || "";
  const closesAt = formatClosesAt(event.closes_at);
  const closesPrefix = event.status === "open" ? "Κλείνει" : "Έκλεισε";
  const options = getEventOptions(event);
  const stats = pickStats.get(event.id);
  const total = (stats && stats.total) || 0;
  const totalLabel = total === 1 ? "πρόβλεψη" : "προβλέψεις";

  card.innerHTML = `
    <div class="pred-card__top">
      <span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span>
      <span class="pred-card__meta">
        ${closesAt ? `<span class="pred-card__closes">🕒 ${closesPrefix}: ${closesAt}</span>` : ""}
        <span class="pred-card__total">👥 ${total} ${totalLabel}</span>
      </span>
    </div>
    <h3 class="pred-card__title">${escapeHtml(event.title)}</h3>
    ${event.description ? `<p class="pred-card__desc">${escapeHtml(event.description)}</p>` : ""}
    <ul class="pred-card__options">
      ${options.map((option, index) => renderOptionRow(event, option, index)).join("")}
    </ul>
    ${renderCardFooter(event)}
  `;

  return card;
}

function getFilteredEvents() {
  if (selectedFilter === "all") return events;
  return events.filter((event) => event.status === selectedFilter);
}

function renderFilteredEvents() {
  const filtered = getFilteredEvents();

  if (filtered.length === 0) {
    renderEmptyState();
    return;
  }

  listEl.innerHTML = "";
  filtered.forEach((event) => listEl.appendChild(createEventCard(event)));
}

function showStatus(eventId, message, state) {
  const statusEl = listEl.querySelector(`[data-status-for="${eventId}"]`);
  if (!statusEl) return;
  statusEl.textContent = message;
  if (state) {
    statusEl.dataset.state = state;
  } else {
    delete statusEl.dataset.state;
  }
}

async function submitPick(event, option) {
  const previous = myPicks.get(event.id);
  if (previous === option) return; // ίδια επιλογή — τίποτα να αλλάξει

  // Αισιόδοξη ενημέρωση: δείχνουμε αμέσως τη νέα κατανομή.
  applyPick(event.id, previous ?? null, option);
  busyEventId = event.id;
  renderFilteredEvents();
  showStatus(event.id, "Αποθήκευση πρόβλεψης…");

  const { error } = await window.supabaseClient
    .from("prediction_picks")
    .upsert(
      { event_id: event.id, user_id: currentUser.id, pick: option },
      { onConflict: "event_id,user_id" }
    );

  busyEventId = null;

  if (error) {
    // Επαναφορά στην προηγούμενη κατάσταση.
    applyPick(event.id, option, previous ?? null);
    renderFilteredEvents();
    showStatus(event.id, "Κάτι πήγε στραβά — η πρόβλεψή σου δεν αποθηκεύτηκε. Δοκίμασε ξανά.", "error");
    return;
  }

  renderFilteredEvents();
  showStatus(
    event.id,
    previous ? "Η πρόβλεψή σου ενημερώθηκε ✔" : "Η πρόβλεψή σου καταχωρήθηκε ✔",
    "success"
  );
}

listEl.addEventListener("click", (e) => {
  const button = e.target.closest(".pred-option__btn");
  if (!button || busyEventId) return;

  const event = events.find((ev) => ev.id === button.dataset.eventId);
  if (!event || event.status !== "open" || !currentUser) return;

  const option = getEventOptions(event)[Number(button.dataset.optionIndex)];
  if (option == null) return;

  submitPick(event, option);
});

async function loadPredictions() {
  renderLoadingState();

  if (typeof window.supabaseClient === "undefined") {
    renderErrorState();
    return;
  }

  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    currentUser = (session && session.user) || null;
  } catch (err) {
    currentUser = null;
  }

  const [eventsRes, picksRes] = await Promise.all([
    window.supabaseClient
      .from("prediction_events")
      .select("*")
      .order("created_at", { ascending: false }),
    window.supabaseClient
      .from("prediction_picks")
      .select("event_id, user_id, pick"),
  ]);

  if (eventsRes.error || picksRes.error) {
    renderErrorState();
    return;
  }

  events = eventsRes.data || [];
  buildPickStats(picksRes.data || []);
  renderFilteredEvents();
}

renderFilters();
loadPredictions();
