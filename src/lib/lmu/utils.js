// Μικρά βοηθητικά: ids, αριθμοί, μορφοποίηση χρόνου και ημερομηνιών.

/**
 * Νέο id. Είναι κανονικό UUID ώστε τα ids που φτιάχνει ο browser να μπαίνουν
 * αυτούσια ως primary keys στη βάση (Postgres uuid) — έτσι το ίδιο state
 * δουλεύει και τοπικά και με backend, χωρίς μετάφραση.
 * Το `prefix` κρατιέται για συμβατότητα με παλιές κλήσεις και αγνοείται.
 */
export function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback για παλιά περιβάλλοντα / μη-secure context.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Είναι έγκυρο UUID; (τα σταθερά ids του demo seed δεν είναι) */
export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''))
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** Ασφαλής μετατροπή σε αριθμό με fallback (τα inputs δίνουν strings). */
export function num(value, fallback = 0) {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

export function round(value, decimals = 0) {
  const f = 10 ** decimals
  return Math.round(num(value) * f) / f
}

export function sum(list, pick = (x) => x) {
  return list.reduce((acc, item) => acc + num(pick(item)), 0)
}

/** 1:23.456 — χρόνος γύρου. */
export function formatLap(seconds) {
  const s = num(seconds)
  if (s <= 0) return '—'
  const m = Math.floor(s / 60)
  const rest = s - m * 60
  return `${m}:${rest.toFixed(3).padStart(6, '0')}`
}

/**
 * Διαβάζει χρόνο γύρου από κείμενο: «1:32.456», «1:32», «92.4» ή «92».
 * Επιστρέφει δευτερόλεπτα, ή 0 αν δεν βγάζει νόημα.
 */
export function parseLap(text) {
  const raw = String(text ?? '').trim().replace(',', '.')
  if (!raw) return 0
  const parts = raw.split(':')
  if (parts.length === 2) {
    const m = num(parts[0])
    const s = num(parts[1])
    return m >= 0 && s >= 0 ? m * 60 + s : 0
  }
  return Math.max(0, num(raw))
}

/** 2:45:30 ή 45:30 — διάρκεια από δευτερόλεπτα. */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(num(seconds)))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (v) => String(v).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/** 4ω 30′ — φιλική μορφή για διάρκειες σε λεπτά. */
export function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(num(minutes)))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h && m) return `${h}ω ${m}′`
  if (h) return `${h}ω`
  return `${m}′`
}

/** Ώρα αγώνα από την εκκίνηση: +1:20:00 */
export function formatClock(seconds) {
  return `+${formatDuration(seconds)}`
}

/**
 * ISO timestamp (από τη βάση) → τιμή για `<input type="datetime-local">`, στην
 * τοπική ώρα του χρήστη. Η βάση κρατά απόλυτο χρόνο (timestamptz), τα inputs
 * θέλουν τοπικό «YYYY-MM-DDTHH:mm».
 */
export function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (v) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

/** Το αντίστροφο: τοπική τιμή input → απόλυτο ISO για τη βάση (ή null). */
export function fromLocalInput(local) {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('el-GR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('el-GR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** «σε 3 ημέρες» / «πριν 2 ώρες» — για το countdown του επόμενου αγώνα. */
export function relativeTime(iso) {
  if (!iso) return '—'
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return '—'
  const diffMs = target - Date.now()
  const abs = Math.abs(diffMs)
  const day = 86400000
  const hour = 3600000
  const min = 60000
  let value
  let unit
  if (abs >= day) {
    value = Math.round(abs / day)
    unit = value === 1 ? 'ημέρα' : 'ημέρες'
  } else if (abs >= hour) {
    value = Math.round(abs / hour)
    unit = value === 1 ? 'ώρα' : 'ώρες'
  } else {
    value = Math.max(1, Math.round(abs / min))
    unit = value === 1 ? 'λεπτό' : 'λεπτά'
  }
  return diffMs >= 0 ? `σε ${value} ${unit}` : `πριν ${value} ${unit}`
}

/** Αρχικά ονόματος για τα avatar των οδηγών. */
export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

/** Σταθερή σειρά ταξινόμησης με ελληνικό collation. */
export function byName(a, b) {
  return String(a?.name || '').localeCompare(String(b?.name || ''), 'el')
}

/** Ordinal θέσης: 1ος, 2ος, … (αρκεί το «ος» για τα δικά μας κείμενα). */
export function ordinal(position) {
  const p = num(position)
  return p > 0 ? `${p}ος` : '—'
}
