// Ανάγνωση των αρχείων αποτελεσμάτων του Le Mans Ultimate.
//
// Το παιχνίδι γράφει ένα .xml ανά session στο
// `…\Le Mans Ultimate\UserData\Log\Results\` (π.χ. `2026_06_20_10_29_59-35R1.xml`,
// όπου το τελευταίο γράμμα είναι P/Q/R για Practice/Qualify/Race).
//
// Το parsing γίνεται εξ ολοκλήρου στον browser — κανένα αρχείο δεν φεύγει
// από τον υπολογιστή του χρήστη.

/** Το κείμενο του πρώτου child element με ένα από τα δοσμένα ονόματα. */
function childText(parent, ...names) {
  if (!parent) return ''
  for (const name of names) {
    for (const child of parent.children) {
      if (child.tagName === name) return (child.textContent || '').trim()
    }
  }
  return ''
}

function childNumber(parent, ...names) {
  const raw = childText(parent, ...names)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Βρίσκει τον κόμβο της session, προτιμώντας τον αγώνα. */
function findSessionNode(doc) {
  const candidates = ['Race', 'Qualify', 'Practice3', 'Practice2', 'Practice1', 'Practice']
  for (const tag of candidates) {
    const nodes = doc.getElementsByTagName(tag)
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const node = nodes[i]
      if (node.getElementsByTagName('Driver').length) {
        return { node, type: tag.startsWith('Practice') ? 'Practice' : tag }
      }
    }
  }
  return null
}

/** Τα άμεσα `<Driver>` παιδιά ενός κόμβου. */
function directDrivers(node) {
  return Array.from(node.children).filter((c) => c.tagName === 'Driver')
}

/** Ο καλύτερος γύρος από τα `<Lap>` στοιχεία, όταν λείπει το `BestLapTime`. */
function bestLapFromLaps(driverNode) {
  let best = null
  for (const lap of driverNode.getElementsByTagName('Lap')) {
    const t = Number((lap.textContent || '').trim())
    if (Number.isFinite(t) && t > 0 && (best === null || t < best)) best = t
  }
  return best
}

/** «2026_06_20_10_29_59-35R1.xml» → ISO ημερομηνία. */
function dateFromFileName(fileName) {
  const m = /(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})/.exec(fileName || '')
  if (!m) return ''
  return `${m[1]}-${m[2]}-${m[3]}`
}

let seq = 0
function uid(prefix) {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq}`
}

/**
 * Διαβάζει ένα results XML και επιστρέφει ένα event.
 * Πετάει `Error` με μήνυμα στα ελληνικά όταν το αρχείο δεν αναγνωρίζεται.
 */
export function parseResultsXml(text, fileName = '') {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Το αρχείο δεν είναι έγκυρο XML.')
  }

  const session = findSessionNode(doc)
  if (!session) {
    throw new Error(
      'Δεν βρέθηκαν αποτελέσματα οδηγών. Σιγουρέψου ότι είναι αρχείο από τον φάκελο UserData\\Log\\Results.',
    )
  }

  const results = doc.getElementsByTagName('RaceResults')[0] || doc.documentElement
  const track = childText(results, 'TrackVenue', 'TrackName') || 'Άγνωστη πίστα'
  const layout = childText(results, 'TrackCourse', 'TrackEvent')

  const entries = directDrivers(session.node).map((node) => {
    const laps = childNumber(node, 'Laps', 'LapsCompleted')
    return {
      id: uid('entry'),
      name: childText(node, 'Name', 'DriverName') || 'Άγνωστος',
      team: childText(node, 'TeamName', 'Team'),
      vehicle: childText(node, 'VehName', 'CarType', 'CarNumber'),
      carClass: childText(node, 'CarClass', 'Class') || 'Χωρίς κλάση',
      position: childNumber(node, 'Position') ?? 999,
      gridPos: childNumber(node, 'GridPos', 'GridPosition') ?? 0,
      laps: laps ?? node.getElementsByTagName('Lap').length,
      bestLap: childNumber(node, 'BestLapTime') ?? bestLapFromLaps(node),
      finishStatus: childText(node, 'FinishStatus') || '',
    }
  })

  if (!entries.length) {
    throw new Error('Το αρχείο δεν περιέχει οδηγούς.')
  }

  entries.sort((a, b) => a.position - b.position)

  return {
    id: uid('event'),
    fileName,
    label: [track, layout].filter(Boolean).join(' — '),
    track,
    layout,
    sessionType: session.type,
    date: dateFromFileName(fileName) || childText(results, 'TimeString').slice(0, 10),
    multiplier: 1,
    entries,
    adjustments: {},
  }
}

/** Δευτερόλεπτα → «1:32.456». */
export function formatLapTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(3).padStart(6, '0')}`
}

/** Οι κλάσεις ενός event, με τη σειρά που εμφανίζονται. */
export function classesOf(event) {
  const seen = []
  for (const e of event.entries) {
    if (!seen.includes(e.carClass)) seen.push(e.carClass)
  }
  return seen
}
