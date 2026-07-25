const ALL_CATEGORIES_LABEL = "Όλα";

let episodes = [];
let selectedCategory = ALL_CATEGORIES_LABEL;
let searchTerm = "";
let expandedEpisodeId = null;

const episodesListEl = document.getElementById("episodes-list");
const categoryFiltersEl = document.getElementById("category-filters");
const searchInputEl = document.getElementById("episode-search");

function renderLoadingState() {
  episodesListEl.innerHTML = `
    <div class="state-message">
      <div class="spinner"></div>
      <p>Φόρτωση επεισοδίων…</p>
    </div>
  `;
}

function renderErrorState() {
  episodesListEl.innerHTML = `
    <div class="state-message">
      <p>Δεν καταφέραμε να φορτώσουμε τα επεισόδια αυτή τη στιγμή. Δοκίμασε να ανανεώσεις τη σελίδα σε λίγο.</p>
    </div>
  `;
}

function renderEmptyState() {
  episodesListEl.innerHTML = `
    <div class="state-message">
      <p>Δεν βρέθηκαν επεισόδια με αυτά τα κριτήρια.</p>
    </div>
  `;
}

function renderNoEpisodesAtAllState() {
  episodesListEl.innerHTML = `
    <div class="state-message">
      <p>Δεν υπάρχουν διαθέσιμα επεισόδια προς το παρόν. Έλα ξανά σύντομα.</p>
    </div>
  `;
}

function getSpotifyEmbedId(url) {
  if (!url) return null;
  const match = url.match(/episode\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function getDistinctCategories() {
  const categories = new Set();
  episodes.forEach((episode) => {
    if (episode.category) categories.add(episode.category);
  });
  return Array.from(categories);
}

function renderCategoryFilters() {
  const categories = [ALL_CATEGORIES_LABEL, ...getDistinctCategories()];

  if (categories.length <= 1) {
    categoryFiltersEl.innerHTML = "";
    return;
  }

  categoryFiltersEl.innerHTML = categories
    .map((category) => {
      const isActive = category === selectedCategory;
      return `
        <button type="button" class="pill${isActive ? " is-active" : ""}" data-category="${escapeHtml(category)}" aria-pressed="${isActive}">
          ${escapeHtml(category)}
        </button>
      `;
    })
    .join("");

  categoryFiltersEl.querySelectorAll(".pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      selectedCategory = pill.dataset.category;
      renderCategoryFilters();
      renderFilteredEpisodes();
    });
  });
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function getFilteredEpisodes() {
  const term = searchTerm.trim().toLowerCase();
  return episodes.filter((episode) => {
    const matchesCategory = selectedCategory === ALL_CATEGORIES_LABEL || episode.category === selectedCategory;
    const matchesSearch =
      !term ||
      episode.title?.toLowerCase().includes(term) ||
      episode.host?.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });
}

function createEpisodeCard(episode) {
  const card = document.createElement("article");
  card.className = "episode-card";

  const toggleId = `episode-toggle-${episode.id}`;
  const panelId = `episode-panel-${episode.id}`;
  const isExpanded = expandedEpisodeId === episode.id;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "episode-row";
  toggle.id = toggleId;
  toggle.setAttribute("aria-expanded", String(isExpanded));
  toggle.setAttribute("aria-controls", panelId);

  toggle.innerHTML = `
    <span class="episode-row__number">EP ${String(episode.episode_number ?? "").padStart(2, "0")}</span>
    <span class="episode-row__info">
      <span class="episode-row__title">${escapeHtml(episode.title)}</span>
      <span class="episode-row__meta">
        ${episode.host ? `<span class="episode-row__host">${escapeHtml(episode.host)}</span>` : ""}
        ${episode.category ? `<span class="badge badge-primary">${escapeHtml(episode.category)}</span>` : ""}
        ${episode.duration ? `<span class="episode-row__duration">${escapeHtml(episode.duration)}</span>` : ""}
      </span>
    </span>
    <span class="episode-row__chevron" aria-hidden="true">▾</span>
  `;

  toggle.addEventListener("click", () => {
    expandedEpisodeId = expandedEpisodeId === episode.id ? null : episode.id;
    renderFilteredEpisodes();
  });

  const panel = document.createElement("div");
  panel.className = "episode-panel";
  panel.id = panelId;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-labelledby", toggleId);
  if (!isExpanded) panel.hidden = true;

  const embedId = getSpotifyEmbedId(episode.spotify_url);
  let panelBody = "";

  if (episode.description) {
    panelBody += `<p class="episode-panel__description">${escapeHtml(episode.description)}</p>`;
  }

  if (embedId) {
    panelBody += `
      <iframe
        class="episode-panel__embed"
        src="https://open.spotify.com/embed/episode/${embedId}?utm_source=generator&theme=0"
        width="100%"
        height="152"
        frameborder="0"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      ></iframe>
    `;
  } else if (episode.spotify_url) {
    panelBody += `
      <a class="episode-panel__spotify-link" href="${escapeHtml(episode.spotify_url)}" target="_blank" rel="noopener noreferrer">
        Άκουσέ το στο Spotify ↗
      </a>
    `;
  }

  panel.innerHTML = panelBody;

  card.appendChild(toggle);
  card.appendChild(panel);
  return card;
}

function renderFilteredEpisodes() {
  const filtered = getFilteredEpisodes();

  if (filtered.length === 0) {
    renderEmptyState();
    return;
  }

  episodesListEl.innerHTML = "";
  const list = document.createElement("div");
  list.className = "episodes__list";
  filtered.forEach((episode) => list.appendChild(createEpisodeCard(episode)));
  episodesListEl.appendChild(list);
}

async function loadEpisodes() {
  renderLoadingState();

  let data, error;
  try {
    ({ data, error } = await supabaseClient
      .from("podcast_episodes")
      .select("*")
      .eq("published", true)
      .order("episode_number", { ascending: false }));
  } catch (fetchException) {
    error = fetchException;
  }

  if (error) {
    renderErrorState();
    return;
  }

  episodes = data || [];

  if (episodes.length === 0) {
    renderNoEpisodesAtAllState();
    return;
  }

  renderCategoryFilters();
  renderFilteredEpisodes();
}

searchInputEl.addEventListener("input", (event) => {
  searchTerm = event.target.value;
  if (episodes.length > 0) renderFilteredEpisodes();
});

loadEpisodes();
