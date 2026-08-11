// Το σχήμα των δεδομένων του πρωταθλήματος + factories και «καθάρισμα»
// (normalize) όταν φορτώνουμε παλιά/χαλασμένα δεδομένα από το localStorage ή
// από ένα εισαγόμενο αρχείο JSON.

import {
  CARS_BY_CLASS,
  CLASS_DEFAULTS,
  CLASS_IDS,
  DEFAULT_RULES,
  DEFAULT_SCORING,
  TRACKS,
  trackInfo,
} from './constants.js'
import { num, uid } from './utils.js'

/** Η τρέχουσα έκδοση του σχήματος — ανεβαίνει όταν αλλάζει η δομή. */
export const SCHEMA_VERSION = 1

export function createChampionship(patch = {}) {
  return {
    id: uid('champ'),
    name: 'Ελληνικό Πρωτάθλημα Αντοχής LMU',
    season: String(new Date().getFullYear()),
    organizer: '',
    description: '',
    classes: ['HYPERCAR', 'LMP2', 'LMGT3'],
    rules: { ...DEFAULT_RULES },
    scoring: { ...DEFAULT_SCORING },
    ...patch,
  }
}

export function createEvent(patch = {}) {
  const trackId = patch.trackId || TRACKS[0].id
  const track = trackInfo(trackId)
  return {
    id: uid('ev'),
    round: 1,
    name: track ? `${track.lengthKm >= 10 ? '24 Ώρες' : '6 Ώρες'} — ${track.name}` : 'Νέος αγώνας',
    trackId,
    dateISO: '',
    durationMinutes: 360,
    formationLapMinutes: 0,
    status: 'UPCOMING', // UPCOMING | LIVE | DONE
    notes: '',
    ...patch,
  }
}

export function createTeam(patch = {}) {
  const carClass = patch.carClass && CLASS_IDS.includes(patch.carClass) ? patch.carClass : 'LMP2'
  return {
    id: uid('team'),
    name: 'Νέα ομάδα',
    shortName: '',
    carClass,
    car: CARS_BY_CLASS[carClass]?.[0] || '',
    number: '',
    color: '#7c5cff',
    principalId: null,
    driverIds: [],
    notes: '',
    ...patch,
  }
}

export function createDriver(patch = {}) {
  return {
    id: uid('drv'),
    name: 'Νέος οδηγός',
    nickname: '',
    country: 'Ελλάδα',
    category: 'SILVER',
    steamId: '',
    discord: '',
    role: 'DRIVER', // ADMIN | PRINCIPAL | DRIVER
    teamId: null,
    paceDeltaSec: 0, // πόσο πιο αργός/γρήγορος από τον χρόνο αναφοράς
    notes: '',
    ...patch,
  }
}

export function createStint(patch = {}) {
  return {
    id: uid('st'),
    driverId: null,
    laps: 10,
    lapTimeSec: 0, // 0 = υπολογίζεται από το πλάνο/πίστα
    fuelAddedL: 0, // 0 = γεμάτο ρεζερβουάρ όσο χωράει
    tyres: 'NEW', // NEW | KEEP | USED
    compound: 'MEDIUM',
    note: '',
    ...patch,
  }
}

/**
 * Τα τεχνικά στοιχεία του αυτοκινήτου για συγκεκριμένο event: βγαίνουν από τις
 * προεπιλογές της κατηγορίας και της πίστας, και η ομάδα τα διορθώνει.
 */
export function createCarSetup(team, event) {
  const track = trackInfo(event?.trackId)
  const defaults = CLASS_DEFAULTS[team?.carClass] || CLASS_DEFAULTS.LMP2
  const lengthKm = track?.lengthKm || 5
  return {
    tankL: defaults.tankL,
    fuelPerLapL: Math.round(defaults.fuelPerKm * lengthKm * 100) / 100,
    lapTimeSec: track?.refLap?.[team?.carClass] || 100,
    tyreLifeLaps: Math.max(4, Math.round(defaults.tyreLifeKm / lengthKm)),
  }
}

export function createPlan(patch = {}) {
  return {
    id: uid('plan'),
    eventId: null,
    teamId: null,
    status: 'DRAFT',
    updatedAt: Date.now(),
    strategyNote: '',
    car: null, // createCarSetup(...) — μπαίνει από τον store
    stints: [],
    ...patch,
  }
}

export function createResultEntry(patch = {}) {
  return {
    teamId: null,
    position: 0, // θέση στη γενική
    classPosition: 0, // 0 = υπολογίζεται από τη γενική μέσα στην κατηγορία
    laps: 0,
    totalTimeSec: 0,
    bestLapSec: 0,
    status: 'FINISHED',
    pole: false,
    fastestLap: false,
    penaltyPoints: 0,
    driverIds: [],
    note: '',
    ...patch,
  }
}

export function createResult(patch = {}) {
  return { eventId: null, entries: [], publishedAt: null, ...patch }
}

export function emptyState() {
  return {
    version: SCHEMA_VERSION,
    championship: createChampionship(),
    events: [],
    teams: [],
    drivers: [],
    availability: {}, // { [eventId]: { [driverId]: 'YES' | 'MAYBE' | 'NO' } }
    plans: [],
    results: [], // [{ eventId, entries: [...] }]
    session: { userId: null }, // ποιος είναι συνδεδεμένος τοπικά
    log: [], // [{ at, who, text }]
  }
}

/* ---------------------------------------------------------------- normalize */

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeStint(raw) {
  const base = createStint()
  return {
    ...base,
    ...raw,
    id: raw?.id || base.id,
    laps: Math.max(1, Math.round(num(raw?.laps, base.laps))),
    lapTimeSec: Math.max(0, num(raw?.lapTimeSec, 0)),
    fuelAddedL: Math.max(0, num(raw?.fuelAddedL, 0)),
    driverId: raw?.driverId || null,
  }
}

function normalizePlan(raw) {
  const base = createPlan()
  return {
    ...base,
    ...raw,
    id: raw?.id || base.id,
    stints: asArray(raw?.stints).map(normalizeStint),
    car: raw?.car
      ? {
          tankL: Math.max(1, num(raw.car.tankL, 70)),
          fuelPerLapL: Math.max(0.1, num(raw.car.fuelPerLapL, 3)),
          lapTimeSec: Math.max(10, num(raw.car.lapTimeSec, 100)),
          tyreLifeLaps: Math.max(1, Math.round(num(raw.car.tyreLifeLaps, 30))),
        }
      : null,
  }
}

/**
 * Δέχεται ό,τι βρήκαμε αποθηκευμένο και επιστρέφει έγκυρο state. Ποτέ δεν
 * πετάει — αν κάτι είναι χαλασμένο, πέφτει στις προεπιλογές.
 */
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return emptyState()
  const base = emptyState()
  const championship = {
    ...base.championship,
    ...(raw.championship || {}),
    rules: { ...DEFAULT_RULES, ...(raw.championship?.rules || {}) },
    scoring: { ...DEFAULT_SCORING, ...(raw.championship?.scoring || {}) },
    classes: asArray(raw.championship?.classes).filter((c) => CLASS_IDS.includes(c)),
  }
  if (!championship.classes.length) championship.classes = base.championship.classes

  const teams = asArray(raw.teams).map((t) => ({
    ...createTeam(),
    ...t,
    driverIds: asArray(t?.driverIds),
  }))
  const drivers = asArray(raw.drivers).map((d) => ({ ...createDriver(), ...d }))

  // Κρατάμε τη σχέση ομάδα ↔ οδηγός συνεπή και από τις δύο μεριές.
  const teamById = new Map(teams.map((t) => [t.id, t]))
  drivers.forEach((driver) => {
    if (driver.teamId && !teamById.has(driver.teamId)) driver.teamId = null
  })
  teams.forEach((team) => {
    team.driverIds = team.driverIds.filter((id) => drivers.some((d) => d.id === id))
    drivers.forEach((driver) => {
      if (driver.teamId === team.id && !team.driverIds.includes(driver.id)) {
        team.driverIds.push(driver.id)
      }
    })
    if (team.principalId && !team.driverIds.includes(team.principalId)) {
      const principal = drivers.find((d) => d.id === team.principalId)
      if (principal) team.driverIds.push(principal.id)
      else team.principalId = null
    }
  })

  const events = asArray(raw.events)
    .map((e, i) => ({
      ...createEvent(),
      ...e,
      round: Math.max(1, Math.round(num(e?.round, i + 1))),
      durationMinutes: Math.max(10, Math.round(num(e?.durationMinutes, 360))),
    }))
    .sort((a, b) => a.round - b.round)

  const availability = {}
  Object.entries(raw.availability || {}).forEach(([eventId, map]) => {
    if (!map || typeof map !== 'object') return
    availability[eventId] = { ...map }
  })

  const results = asArray(raw.results).map((r) => ({
    ...createResult(),
    ...r,
    entries: asArray(r?.entries).map((entry) => ({ ...createResultEntry(), ...entry })),
  }))

  const sessionUser = raw.session?.userId
  return {
    version: SCHEMA_VERSION,
    championship,
    events,
    teams,
    drivers,
    availability,
    plans: asArray(raw.plans).map(normalizePlan),
    results,
    session: { userId: drivers.some((d) => d.id === sessionUser) ? sessionUser : null },
    log: asArray(raw.log).slice(-200),
  }
}
