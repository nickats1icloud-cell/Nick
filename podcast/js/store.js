/*
 * Τοπική αποθήκευση (localStorage) — θέμα, αγαπημένα, πρόοδος ακρόασης,
 * λίστα "για αργότερα", ρυθμίσεις player. Όλα με namespace `gsrp:` ώστε να
 * μην μπερδεύονται με το κύριο site της κοινότητας.
 *
 * Κάθε πρόσβαση περνάει από try/catch: σε private mode ή με μπλοκαρισμένα
 * cookies το localStorage πετάει, και δεν θέλουμε να σπάει το site.
 */

const NS = "gsrp:";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ---------- Θέμα ---------- */

export function getTheme() {
  return read("theme", null);
}

export function setTheme(theme) {
  write("theme", theme);
}

/* ---------- Αγαπημένα ---------- */

export function getFavorites() {
  const value = read("favorites", []);
  return Array.isArray(value) ? value : [];
}

export function isFavorite(id) {
  return getFavorites().includes(id);
}

/** Κάνει toggle και επιστρέφει την νέα κατάσταση (true = αγαπημένο). */
export function toggleFavorite(id) {
  const favorites = getFavorites();
  const index = favorites.indexOf(id);
  if (index === -1) favorites.push(id);
  else favorites.splice(index, 1);
  write("favorites", favorites);
  return index === -1;
}

/* ---------- Λίστα "για αργότερα" ---------- */

export function getQueue() {
  const value = read("queue", []);
  return Array.isArray(value) ? value : [];
}

export function toggleQueue(id) {
  const queue = getQueue();
  const index = queue.indexOf(id);
  if (index === -1) queue.push(id);
  else queue.splice(index, 1);
  write("queue", queue);
  return index === -1;
}

/* ---------- Πρόοδος ακρόασης ---------- */

/** { [episodeId]: { time: seconds, duration: seconds, at: timestamp } } */
export function getProgressMap() {
  const value = read("progress", {});
  return value && typeof value === "object" ? value : {};
}

export function getProgress(id) {
  return getProgressMap()[id] || null;
}

export function saveProgress(id, time, duration) {
  if (!id || !Number.isFinite(time)) return;
  const map = getProgressMap();
  map[id] = { time: Math.round(time), duration: Math.round(duration || 0), at: Date.now() };
  write("progress", map);
}

export function clearProgress(id) {
  const map = getProgressMap();
  delete map[id];
  write("progress", map);
}

/** Ποσοστό 0-100 που έχει ακουστεί. */
export function progressPercent(id, duration) {
  const entry = getProgress(id);
  const total = duration || entry?.duration || 0;
  if (!entry || !total) return 0;
  return Math.min(100, Math.round((entry.time / total) * 100));
}

/** Το τελευταίο επεισόδιο που άκουγε ο χρήστης (για «Συνέχισε»). */
export function lastPlayed() {
  const map = getProgressMap();
  let latest = null;
  for (const [id, entry] of Object.entries(map)) {
    if (!latest || entry.at > latest.at) latest = { id, ...entry };
  }
  return latest;
}

/* ---------- Ρυθμίσεις player ---------- */

export function getPlayerPrefs() {
  const prefs = read("player", {});
  return { rate: 1, volume: 1, muted: false, ...(prefs || {}) };
}

export function savePlayerPrefs(patch) {
  write("player", { ...getPlayerPrefs(), ...patch });
}
