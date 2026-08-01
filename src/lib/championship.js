// Υπολογισμός βαθμολογίας πρωταθλήματος από τα events του League Control.
//
// Οι βαθμοί δίνονται ανά κλάση (Hypercar / LMP2 / LMGT3 …), όπως και στο
// πραγματικό WEC: κάθε κλάση είναι ξεχωριστό πρωτάθλημα.

export const POINT_PRESETS = {
  wec: {
    label: 'WEC (25-18-15-12-10-8-6-4-2-1)',
    points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  },
  top15: {
    label: 'Top 15 (20-17-15-13-11-10-9-8-7-6-5-4-3-2-1)',
    points: [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  },
  simple: {
    label: 'Απλό (10-8-6-5-4-3-2-1)',
    points: [10, 8, 6, 5, 4, 3, 2, 1],
  },
  custom: {
    label: 'Custom',
    points: [],
  },
}

export const DEFAULT_SETTINGS = {
  pointsKey: 'wec',
  customPoints: '25, 18, 15, 12, 10, 8, 6, 4, 2, 1',
  polePoints: 0,
  fastestLapPoints: 0,
  // 0 = χωρίς περιορισμό· αλλιώς ο γρήγορος γύρος μετράει μόνο για το top-N.
  fastestLapTopN: 0,
  // Ποσοστό των γύρων του νικητή της κλάσης για να θεωρηθεί κάποιος
  // κατατασσόμενος — στο WEC είναι 70%.
  minLapsPercent: 70,
  // Πόσα χειρότερα αποτελέσματα αφαιρούνται από το σύνολο.
  dropWorst: 0,
}

/** Ο πίνακας βαθμών που ισχύει με βάση τις ρυθμίσεις. */
export function pointsTable(settings) {
  if (settings.pointsKey === 'custom') {
    return String(settings.customPoints || '')
      .split(/[,\s]+/)
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
  }
  return POINT_PRESETS[settings.pointsKey]?.points ?? POINT_PRESETS.wec.points
}

/** Κλειδί ταυτοποίησης οδηγού μεταξύ αγώνων (με βάση το όνομα). */
export function driverKey(name) {
  return String(name || '').trim().toLowerCase()
}

function adjustmentFor(event, entryId) {
  return event.adjustments?.[entryId] || {}
}

/**
 * Το αποτέλεσμα ενός event ανά κλάση: θέσεις, βαθμοί, ποινές.
 * Επιστρέφει `Map<carClass, Array<row>>`.
 */
export function scoreEvent(event, settings) {
  const table = pointsTable(settings)
  const byClass = new Map()

  for (const entry of event.entries) {
    if (!byClass.has(entry.carClass)) byClass.set(entry.carClass, [])
    byClass.get(entry.carClass).push(entry)
  }

  const output = new Map()

  for (const [carClass, entries] of byClass) {
    const sorted = [...entries].sort((a, b) => a.position - b.position)
    const winnerLaps = sorted.length ? sorted[0].laps : 0
    const threshold = (winnerLaps * settings.minLapsPercent) / 100

    // Γρήγορος γύρος της κλάσης, μεταξύ όσων δεν έχουν αποκλειστεί.
    let fastest = null
    sorted.forEach((entry, i) => {
      const adj = adjustmentFor(event, entry.id)
      if (adj.excluded) return
      if (settings.fastestLapTopN > 0 && i + 1 > settings.fastestLapTopN) return
      if (!Number.isFinite(entry.bestLap) || entry.bestLap <= 0) return
      if (fastest === null || entry.bestLap < fastest.bestLap) fastest = entry
    })

    let classPos = 0
    const rows = sorted.map((entry) => {
      const adj = adjustmentFor(event, entry.id)
      const classified = entry.laps >= threshold && !adj.excluded
      // Ο αποκλεισμένος δεν πιάνει θέση: όσοι είναι πίσω του προάγονται.
      if (!adj.excluded) classPos += 1

      const base = adj.excluded ? 0 : classified ? (table[classPos - 1] ?? 0) : 0
      const pole =
        !adj.excluded && classified && entry.gridPos === 1 ? Number(settings.polePoints) || 0 : 0
      const fl =
        !adj.excluded && classified && fastest && fastest.id === entry.id
          ? Number(settings.fastestLapPoints) || 0
          : 0
      const penalty = Number(adj.penalty) || 0
      const multiplier = Number(event.multiplier) || 1
      const total = adj.excluded ? 0 : Math.max(0, (base + pole + fl) * multiplier - penalty)

      return {
        entry,
        classPos: adj.excluded ? null : classPos,
        classified,
        excluded: !!adj.excluded,
        note: adj.note || '',
        base,
        pole,
        fl,
        penalty,
        multiplier,
        points: total,
        isFastest: !!(fastest && fastest.id === entry.id),
      }
    })

    output.set(carClass, rows)
  }

  return output
}

/**
 * Συνολική βαθμολογία πρωταθλήματος ανά κλάση.
 * Επιστρέφει πίνακα `{ carClass, rows }`, ταξινομημένο ανά κλάση.
 */
export function computeStandings(events, settings) {
  const perClass = new Map()

  events.forEach((event) => {
    const scored = scoreEvent(event, settings)
    for (const [carClass, rows] of scored) {
      if (!perClass.has(carClass)) perClass.set(carClass, new Map())
      const drivers = perClass.get(carClass)

      rows.forEach((row) => {
        const key = driverKey(row.entry.name)
        if (!drivers.has(key)) {
          drivers.set(key, {
            key,
            name: row.entry.name,
            team: row.entry.team,
            results: {},
            wins: 0,
            podiums: 0,
          })
        }
        const driver = drivers.get(key)
        if (row.entry.team) driver.team = row.entry.team
        driver.results[event.id] = row
        if (row.classPos === 1) driver.wins += 1
        if (row.classPos !== null && row.classPos <= 3) driver.podiums += 1
      })
    }
  })

  const drop = Math.max(0, Number(settings.dropWorst) || 0)

  return Array.from(perClass, ([carClass, drivers]) => {
    const rows = Array.from(drivers.values()).map((driver) => {
      const scores = events
        .filter((e) => driver.results[e.id])
        .map((e) => ({ eventId: e.id, points: driver.results[e.id].points }))

      // Αφαιρούμε τα χειρότερα αποτελέσματα, αν το ζητά η ρύθμιση.
      const dropped = new Set()
      if (drop > 0 && scores.length > drop) {
        ;[...scores]
          .sort((a, b) => a.points - b.points)
          .slice(0, drop)
          .forEach((s) => dropped.add(s.eventId))
      }

      const total = scores
        .filter((s) => !dropped.has(s.eventId))
        .reduce((sum, s) => sum + s.points, 0)

      return { ...driver, dropped, total, starts: scores.length }
    })

    rows.sort((a, b) => b.total - a.total || b.wins - a.wins || a.name.localeCompare(b.name, 'el'))
    rows.forEach((row, i) => {
      row.rank = i > 0 && rows[i - 1].total === row.total ? rows[i - 1].rank : i + 1
    })

    return { carClass, rows }
  }).sort((a, b) => a.carClass.localeCompare(b.carClass, 'el'))
}

/** Η βαθμολογία ως CSV, για άνοιγμα σε spreadsheet. */
export function standingsToCsv(standings, events) {
  const escape = (v) => {
    const s = String(v ?? '')
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const lines = []
  standings.forEach(({ carClass, rows }) => {
    lines.push(escape(carClass))
    lines.push(
      ['Θέση', 'Οδηγός', 'Ομάδα', ...events.map((e) => e.label || e.track), 'Σύνολο']
        .map(escape)
        .join(','),
    )
    rows.forEach((row) => {
      lines.push(
        [
          row.rank,
          row.name,
          row.team,
          ...events.map((e) => {
            const r = row.results[e.id]
            if (!r) return ''
            return row.dropped.has(e.id) ? `(${r.points})` : r.points
          }),
          row.total,
        ]
          .map(escape)
          .join(','),
      )
    })
    lines.push('')
  })

  return lines.join('\n')
}
