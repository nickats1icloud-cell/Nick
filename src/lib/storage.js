// Μικρό wrapper γύρω από το localStorage. Όλα μένουν στον browser σου —
// τίποτα δεν φεύγει σε server.

const PREFIX = 'nick.podcast.'

export function load(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function save(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // π.χ. γεμάτο localStorage ή ιδιωτική περιήγηση — δεν είναι κρίσιμο.
  }
}

export function remove(key) {
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    // αγνόησέ το
  }
}

/** Κρατάει το ιστορικό αναλύσεων ώστε να βλέπεις πρόοδο ανά επεισόδιο. */
export function pushHistory(entry, limit = 30) {
  const history = load('history', [])
  const filtered = history.filter((item) => item.id !== entry.id)
  const next = [...filtered, entry].slice(-limit)
  save('history', next)
  return next
}
