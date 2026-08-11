// Βαθμολογίες: από τα αποτελέσματα των αγώνων βγαίνει η κατάταξη ομάδων και
// οδηγών, ξεχωριστά για κάθε κατηγορία (όπως στο WEC).
//
// Κανόνες που εφαρμόζονται:
//  • βαθμοί από τον πίνακα του πρωταθλήματος, με βάση τη θέση *στην κατηγορία*
//  • διπλοί βαθμοί σε αγώνες που το ορίζει ο διοργανωτής (π.χ. Le Mans)
//  • βαθμός pole / γρηγορότερου γύρου
//  • ελάχιστο ποσοστό γύρων του νικητή για να βαθμολογηθείς
//  • αφαίρεση των χειρότερων N αποτελεσμάτων (drop rounds)
//  • ισοβαθμία: περισσότερες νίκες, μετά καλύτερες θέσεις με τη σειρά

import { DEFAULT_SCORING } from './constants.js'
import { num } from './utils.js'

const SCORING_STATUSES = ['FINISHED']

function pointsForPosition(table, position) {
  if (!position || position < 1) return 0
  return num(table?.[position - 1], 0)
}

/**
 * Ταξινομεί τις συμμετοχές ενός αγώνα μέσα σε μια κατηγορία και βγάζει τη θέση
 * κατηγορίας. Αν ο διοργανωτής έχει δώσει χειροκίνητα classPosition, σέβεται
 * αυτό· αλλιώς προκύπτει από τη γενική θέση.
 */
export function classifyEvent({ result, teams, classId }) {
  const inClass = (result?.entries || []).filter((entry) => {
    const team = teams.find((t) => t.id === entry.teamId)
    return team && team.carClass === classId
  })
  const finished = inClass
    .filter((e) => SCORING_STATUSES.includes(e.status))
    .sort((a, b) => {
      const pa = num(a.position, 9999) || 9999
      const pb = num(b.position, 9999) || 9999
      if (pa !== pb) return pa - pb
      return num(b.laps) - num(a.laps)
    })
  const others = inClass.filter((e) => !SCORING_STATUSES.includes(e.status))

  let autoRank = 0
  const ranked = finished.map((entry) => {
    autoRank += 1
    return { ...entry, classRank: num(entry.classPosition, 0) || autoRank }
  })
  return {
    ranked: [...ranked, ...others.map((entry) => ({ ...entry, classRank: 0 }))],
    winnerLaps: num(ranked[0]?.laps, 0),
  }
}

/** Βαθμοί μιας συμμετοχής σε έναν αγώνα. */
export function entryPoints({ entry, classRank, winnerLaps, event, scoring }) {
  const s = { ...DEFAULT_SCORING, ...scoring }
  if (!SCORING_STATUSES.includes(entry.status)) {
    return { total: -num(entry.penaltyPoints), racePoints: 0, bonus: 0, scored: false }
  }
  const minLaps = winnerLaps * num(s.finishRequiredLapsShare, 0)
  if (winnerLaps > 0 && num(entry.laps) < minLaps) {
    return { total: -num(entry.penaltyPoints), racePoints: 0, bonus: 0, scored: false }
  }
  const multiplier = (s.doublePointsEvents || []).includes(event?.id) ? 2 : 1
  const racePoints = pointsForPosition(s.table, classRank) * multiplier
  const bonus =
    (entry.pole ? num(s.polePoint) : 0) + (entry.fastestLap ? num(s.fastestLapPoint) : 0)
  return {
    total: racePoints + bonus - num(entry.penaltyPoints),
    racePoints,
    bonus,
    multiplier,
    scored: true,
  }
}

function emptyRow(extra) {
  return {
    points: 0,
    rawPoints: 0,
    droppedPoints: 0,
    byEvent: {},
    starts: 0,
    finishes: 0,
    dnfs: 0,
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    positions: [],
    bestFinish: null,
    ...extra,
  }
}

function applyDrops(row, dropRounds) {
  const values = Object.values(row.byEvent).map((v) => num(v))
  row.rawPoints = values.reduce((a, b) => a + b, 0)
  const drops = Math.max(0, Math.min(num(dropRounds), values.length - 1))
  if (!drops) {
    row.points = row.rawPoints
    row.droppedPoints = 0
    return
  }
  const sorted = [...values].sort((a, b) => a - b)
  row.droppedPoints = sorted.slice(0, drops).reduce((a, b) => a + b, 0)
  row.points = row.rawPoints - row.droppedPoints
}

/** Ισοβαθμία: βαθμοί → νίκες → 2ες θέσεις → 3ες … */
function compareRows(a, b) {
  if (b.points !== a.points) return b.points - a.points
  if (b.wins !== a.wins) return b.wins - a.wins
  const maxPos = 30
  for (let pos = 1; pos <= maxPos; pos += 1) {
    const ca = a.positions.filter((p) => p === pos).length
    const cb = b.positions.filter((p) => p === pos).length
    if (ca !== cb) return cb - ca
  }
  return String(a.name || '').localeCompare(String(b.name || ''), 'el')
}

/**
 * Η κύρια συνάρτηση: πλήρεις βαθμολογίες για όλο το πρωτάθλημα.
 * @returns { classes: [{ classId, teams, drivers }], events, resultsByEvent }
 */
export function computeStandings(state) {
  const { championship, teams, drivers, events, results } = state
  const scoring = { ...DEFAULT_SCORING, ...championship.scoring }
  const scoredEvents = events
    .filter((event) => results.some((r) => r.eventId === event.id && r.entries.length))
    .sort((a, b) => a.round - b.round)

  const classes = championship.classes.map((classId) => {
    const teamRows = new Map()
    const driverRows = new Map()

    scoredEvents.forEach((event) => {
      const result = results.find((r) => r.eventId === event.id)
      const { ranked, winnerLaps } = classifyEvent({ result, teams, classId })

      ranked.forEach((entry) => {
        const team = teams.find((t) => t.id === entry.teamId)
        if (!team) return
        const pts = entryPoints({
          entry,
          classRank: entry.classRank,
          winnerLaps,
          event,
          scoring,
        })

        let teamRow = teamRows.get(team.id)
        if (!teamRow) {
          teamRow = emptyRow({ id: team.id, team, name: team.name })
          teamRows.set(team.id, teamRow)
        }
        registerEntry(teamRow, entry, pts, event)

        const entryDrivers = entry.driverIds?.length ? entry.driverIds : team.driverIds
        entryDrivers.forEach((driverId) => {
          const driver = drivers.find((d) => d.id === driverId)
          if (!driver) return
          let driverRow = driverRows.get(driverId)
          if (!driverRow) {
            driverRow = emptyRow({ id: driverId, driver, team, name: driver.name })
            driverRows.set(driverId, driverRow)
          }
          registerEntry(driverRow, entry, pts, event)
        })
      })
    })

    const finish = (map) => {
      const rows = [...map.values()]
      rows.forEach((row) => applyDrops(row, scoring.dropRounds))
      rows.sort(compareRows)
      rows.forEach((row, i) => {
        row.rank = i + 1
        row.gap = rows[0].points - row.points
      })
      return rows
    }

    return { classId, teams: finish(teamRows), drivers: finish(driverRows) }
  })

  return { classes, events: scoredEvents, scoring }
}

function registerEntry(row, entry, pts, event) {
  row.byEvent[event.id] = num(row.byEvent[event.id]) + pts.total
  row.starts += 1
  if (entry.status === 'FINISHED') {
    row.finishes += 1
    if (entry.classRank === 1) row.wins += 1
    if (entry.classRank >= 1 && entry.classRank <= 3) row.podiums += 1
    if (entry.classRank >= 1) {
      row.positions.push(entry.classRank)
      row.bestFinish =
        row.bestFinish === null ? entry.classRank : Math.min(row.bestFinish, entry.classRank)
    }
  } else if (entry.status === 'DNF') {
    row.dnfs += 1
  }
  if (entry.pole) row.poles += 1
  if (entry.fastestLap) row.fastestLaps += 1
}

/** Σύντομη περίληψη ενός αγώνα: νικητές ανά κατηγορία. */
export function eventWinners(state, eventId) {
  const result = state.results.find((r) => r.eventId === eventId)
  if (!result) return []
  return state.championship.classes
    .map((classId) => {
      const { ranked } = classifyEvent({ result, teams: state.teams, classId })
      const winner = ranked.find((e) => e.classRank === 1)
      if (!winner) return null
      const team = state.teams.find((t) => t.id === winner.teamId)
      return { classId, team, entry: winner }
    })
    .filter(Boolean)
}
