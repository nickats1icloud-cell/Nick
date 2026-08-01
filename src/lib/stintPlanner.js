// Καθαρή λογική για τον Stint Planner endurance ομάδων:
// υπολογισμός stints, χειρισμός ζωνών ώρας, αυτόματη ανάθεση οδηγών,
// εξαγωγή σε .ics και κωδικοποίηση του πλάνου σε shareable link.
//
// Δεν υπάρχει backend — όλα τρέχουν στον browser.

export const MINUTE_MS = 60000

// Εφεδρική λίστα ζωνών για browsers χωρίς `Intl.supportedValuesOf`.
const FALLBACK_ZONES = [
  'UTC',
  'Europe/Athens',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Lisbon',
  'Europe/Warsaw',
  'Europe/Bucharest',
  'Europe/Istanbul',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
]

/** Η ζώνη ώρας του χρήστη. */
export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/**
 * Όλες οι διαθέσιμες ζώνες ώρας, αλφαβητικά. Το `Intl.supportedValuesOf`
 * δεν επιστρέφει πάντα το «UTC» ούτε κατ' ανάγκη τη ζώνη του χρήστη, οπότε
 * τα προσθέτουμε ρητά — αλλιώς το dropdown θα έδειχνε λάθος ζώνη.
 */
export function listTimeZones() {
  let zones = FALLBACK_ZONES
  if (typeof Intl.supportedValuesOf === 'function') {
    try {
      zones = Intl.supportedValuesOf('timeZone')
    } catch {
      // Κρατάμε τη στατική λίστα.
    }
  }
  return Array.from(new Set([...zones, 'UTC', browserTimeZone()])).sort()
}

const partsCache = new Map()

function formatterFor(tz) {
  let f = partsCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      // Χωρίς το h23 τα μεσάνυχτα βγαίνουν «24» σε κάποιες υλοποιήσεις.
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsCache.set(tz, f)
  }
  return f
}

/** Τα πεδία ημερομηνίας/ώρας μιας στιγμής, όπως φαίνονται στη ζώνη `tz`. */
export function zonedParts(instantMs, tz) {
  const out = {}
  for (const p of formatterFor(tz).formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return out
}

/** Το offset της ζώνης `tz` σε λεπτά, για τη συγκεκριμένη στιγμή. */
export function tzOffsetMinutes(instantMs, tz) {
  const p = zonedParts(instantMs, tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return (asUtc - instantMs + (instantMs % 1000)) / MINUTE_MS
}

/**
 * Μετατρέπει «ώρα ρολογιού» μιας ζώνης σε πραγματική στιγμή (epoch ms).
 * Το δεύτερο πέρασμα διορθώνει τα σύνορα της θερινής ώρας.
 */
export function wallTimeToInstant(fields, tz) {
  const wall = Date.UTC(
    fields.year,
    fields.month - 1,
    fields.day,
    fields.hour,
    fields.minute,
    0,
  )
  let guess = wall - tzOffsetMinutes(wall, tz) * MINUTE_MS
  guess = wall - tzOffsetMinutes(guess, tz) * MINUTE_MS
  return guess
}

/** Διαβάζει ένα `<input type="datetime-local">` ως στιγμή στη ζώνη `tz`. */
export function localInputToInstant(value, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || '')
  if (!m) return NaN
  return wallTimeToInstant(
    {
      year: +m[1],
      month: +m[2],
      day: +m[3],
      hour: +m[4],
      minute: +m[5],
    },
    tz,
  )
}

/** Τιμή για `<input type="datetime-local">` από στιγμή, στη ζώνη `tz`. */
export function instantToLocalInput(instantMs, tz) {
  const p = zonedParts(instantMs, tz)
  const pad = (n) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** Ώρα («14:35») μιας στιγμής στη ζώνη `tz`. */
export function formatTime(instantMs, tz) {
  const p = zonedParts(instantMs, tz)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/** Ημερομηνία + ώρα («15/08 14:35») μιας στιγμής στη ζώνη `tz`. */
export function formatDateTime(instantMs, tz) {
  const p = zonedParts(instantMs, tz)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(p.day)}/${pad(p.month)} ${pad(p.hour)}:${pad(p.minute)}`
}

/** Λεπτά από τα μεσάνυχτα, στη ζώνη `tz`. */
export function minutesOfDay(instantMs, tz) {
  const p = zonedParts(instantMs, tz)
  return p.hour * 60 + p.minute
}

/** «HH:MM» → λεπτά από τα μεσάνυχτα. */
export function parseClock(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || '')
  if (!m) return 0
  return (+m[1] % 24) * 60 + (+m[2] % 60)
}

/** Διάρκεια σε λεπτά → «6ω 30λ». */
export function formatDuration(minutes) {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h && m) return `${h}ω ${m}λ`
  if (h) return `${h}ω`
  return `${m}λ`
}

/** Χιλιοστά → «01:23:45», με πρόθεμα ημερών όταν ξεπερνά το 24ωρο. */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`
  return days ? `${days}μ ${clock}` : clock
}

/**
 * Είναι ο οδηγός μέσα στο ημερήσιο παράθυρο διαθεσιμότητάς του σε όλη
 * τη διάρκεια του stint; Δειγματοληπτούμε ανά 5 λεπτά ώστε να πιάνουμε
 * και stints που «κόβουν» το παράθυρο στη μέση.
 */
export function isDriverAvailable(driver, startMs, endMs) {
  const from = parseClock(driver.from)
  const to = parseClock(driver.to)
  if (from === to) return true // 24ωρη διαθεσιμότητα

  const inWindow = (mins) =>
    from < to ? mins >= from && mins <= to : mins >= from || mins <= to

  const step = 5 * MINUTE_MS
  for (let t = startMs; t < endMs; t += step) {
    if (!inWindow(minutesOfDay(t, driver.tz))) return false
  }
  return inWindow(minutesOfDay(endMs, driver.tz))
}

/**
 * Σπάει τον αγώνα σε stints. Ο χρόνος του pit stop μετράει μέσα στη
 * συνολική διάρκεια, όπως και στην πραγματικότητα.
 */
export function buildStints({ startMs, durationMin, stintMin, pitSec }) {
  const stints = []
  const raceEnd = startMs + durationMin * MINUTE_MS
  const stintMs = Math.max(1, stintMin) * MINUTE_MS
  const pitMs = Math.max(0, pitSec) * 1000

  let cursor = startMs
  let guard = 0
  while (cursor < raceEnd && guard < 500) {
    const end = Math.min(cursor + stintMs, raceEnd)
    stints.push({
      index: stints.length + 1,
      start: cursor,
      end,
      minutes: (end - cursor) / MINUTE_MS,
    })
    cursor = end + pitMs
    guard += 1
  }
  return stints
}

function pickLeastLoaded(pool, minutesByDriver) {
  let best = pool[0]
  for (const d of pool) {
    if ((minutesByDriver.get(d.id) || 0) < (minutesByDriver.get(best.id) || 0)) {
      best = d
    }
  }
  return best
}

/**
 * Αναθέτει οδηγούς στα stints: προτεραιότητα σε όποιον είναι διαθέσιμος
 * και έχει οδηγήσει τα λιγότερα λεπτά. Αν δεν είναι κανείς διαθέσιμος,
 * το stint σημειώνεται ως ακάλυπτο αλλά ανατίθεται εφεδρικά.
 */
export function assignDrivers(stints, drivers, { allowBackToBack = false } = {}) {
  const minutesByDriver = new Map(drivers.map((d) => [d.id, 0]))
  let previous = null

  return stints.map((stint) => {
    if (!drivers.length) {
      return { ...stint, driverId: null, status: 'empty' }
    }

    const available = drivers.filter((d) => isDriverAvailable(d, stint.start, stint.end))
    const narrow = (pool) => {
      if (allowBackToBack || pool.length < 2) return pool
      const rotated = pool.filter((d) => d.id !== previous)
      return rotated.length ? rotated : pool
    }

    let chosen
    let status
    if (available.length) {
      chosen = pickLeastLoaded(narrow(available), minutesByDriver)
      status = 'ok'
    } else {
      chosen = pickLeastLoaded(narrow(drivers), minutesByDriver)
      status = 'uncovered'
    }

    minutesByDriver.set(chosen.id, (minutesByDriver.get(chosen.id) || 0) + stint.minutes)
    previous = chosen.id

    return { ...stint, driverId: chosen.id, status }
  })
}

/** Σύνοψη ανά οδηγό: πλήθος stints και συνολικά λεπτά οδήγησης. */
export function summarise(assigned, drivers) {
  return drivers.map((d) => {
    const mine = assigned.filter((s) => s.driverId === d.id)
    return {
      driver: d,
      stints: mine.length,
      minutes: mine.reduce((sum, s) => sum + s.minutes, 0),
      uncovered: mine.filter((s) => s.status === 'uncovered').length,
    }
  })
}

const ICS_LINE_END = '\r\n'

function icsStamp(instantMs) {
  return new Date(instantMs).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function icsEscape(text) {
  return String(text).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
}

/** Το πλάνο ως αρχείο .ics, ένα event ανά stint. */
export function buildIcs(plan, assigned, driversById) {
  const now = icsStamp(Date.now())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nick//LMU Stint Planner//EL',
    'CALSCALE:GREGORIAN',
  ]

  assigned.forEach((stint) => {
    const driver = driversById.get(stint.driverId)
    const who = driver ? driver.name : 'Χωρίς οδηγό'
    lines.push(
      'BEGIN:VEVENT',
      `UID:stint-${stint.index}-${stint.start}@nick-lmu`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsStamp(stint.start)}`,
      `DTEND:${icsStamp(stint.end)}`,
      `SUMMARY:${icsEscape(`Stint ${stint.index} — ${who} (${plan.name})`)}`,
      `DESCRIPTION:${icsEscape(
        [
          `Διάρκεια ${formatDuration(stint.minutes)}.`,
          stint.status === 'uncovered' ? 'ΠΡΟΣΟΧΗ: εκτός δηλωμένης διαθεσιμότητας.' : '',
        ]
          .filter(Boolean)
          .join(' '),
      )}`,
      'END:VEVENT',
    )
  })

  lines.push('END:VCALENDAR')
  return lines.join(ICS_LINE_END) + ICS_LINE_END
}

/** Το πλάνο ως απλό κείμενο, για επικόλληση σε Discord. */
export function buildPlainText(plan, assigned, driversById) {
  const rows = assigned.map((s) => {
    const driver = driversById.get(s.driverId)
    const who = driver ? driver.name : '—'
    const flag = s.status === 'uncovered' ? ' ⚠️' : ''
    const local = driver ? ` (τοπική ${formatTime(s.start, driver.tz)})` : ''
    return `${String(s.index).padStart(2, ' ')}. ${formatDateTime(s.start, plan.raceTz)}–${formatTime(
      s.end,
      plan.raceTz,
    )}  ${who}${local}${flag}`
  })
  return [`${plan.name} — πλάνο stints (${plan.raceTz})`, ...rows].join('\n')
}

/** Κωδικοποίηση του πλάνου σε ασφαλές για URL string. */
export function encodePlan(plan) {
  const bytes = new TextEncoder().encode(JSON.stringify(plan))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Αποκωδικοποίηση πλάνου από URL. Επιστρέφει `null` αν είναι άκυρο. */
export function decodePlan(encoded) {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const plan = JSON.parse(new TextDecoder().decode(bytes))
    return plan && Array.isArray(plan.drivers) ? plan : null
  } catch {
    return null
  }
}
