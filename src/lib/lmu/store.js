// Ο «server» της εφαρμογής: ένας reducer πάνω από το state του πρωταθλήματος +
// αποθήκευση στο localStorage. Κάθε action είναι καθαρή συνάρτηση state→state,
// ώστε να μπορεί να μπει αύριο πίσω από ένα πραγματικό API χωρίς να αλλάξει το UI.

import { CARS_BY_CLASS } from './constants.js'
import {
  createCarSetup,
  createDriver,
  createEvent,
  createPlan,
  createResult,
  createResultEntry,
  createStint,
  createTeam,
  emptyState,
  normalizeState,
} from './model.js'
import { buildSeedState } from './seed.js'
import { generateStints, suggestCar } from './stints.js'
import { uid } from './utils.js'

const STORAGE_KEY = 'nick.lmu.championship.v1'

/* ------------------------------------------------------------- persistence */

export function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return normalizeState(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    // Γεμάτο localStorage ή ιδιωτική περιήγηση — η εφαρμογή συνεχίζει στη μνήμη.
    return false
  }
}

export function clearStoredState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* αγνόησέ το */
  }
}

/**
 * Αρχικό state.
 *  • τοπική λειτουργία: ό,τι είχε αποθηκευτεί, αλλιώς το πρωτάθλημα επίδειξης
 *  • με backend: κενό — το αληθινό state έρχεται από τη βάση
 */
export function initialState(mode = 'local') {
  if (mode === 'remote') return emptyState()
  return loadState() || buildSeedState()
}

/* ------------------------------------------------------------------ helpers */

function log(state, text) {
  const who = state.drivers.find((d) => d.id === state.session.userId)?.name || 'Επισκέπτης'
  return [...state.log, { at: Date.now(), who, text }].slice(-200)
}

function replace(list, id, patch) {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

function touchPlan(plan, patch) {
  return { ...plan, ...patch, updatedAt: Date.now() }
}

function findPlan(state, planId) {
  return state.plans.find((p) => p.id === planId) || null
}

/** Το πλάνο μιας ομάδας για έναν αγώνα (ή null). */
export function findPlanFor(state, eventId, teamId) {
  return state.plans.find((p) => p.eventId === eventId && p.teamId === teamId) || null
}

/* ------------------------------------------------------------------ reducer */

export function reducer(state, action) {
  switch (action.type) {
    /* --- πρωτάθλημα --- */
    case 'championship/update':
      return {
        ...state,
        championship: { ...state.championship, ...action.patch },
        log: log(state, 'Ενημερώθηκαν τα στοιχεία του πρωταθλήματος.'),
      }

    case 'rules/update':
      return {
        ...state,
        championship: {
          ...state.championship,
          rules: { ...state.championship.rules, ...action.patch },
        },
        log: log(state, 'Ενημερώθηκαν οι κανόνες αγωνιστικού χρόνου.'),
      }

    case 'scoring/update':
      return {
        ...state,
        championship: {
          ...state.championship,
          scoring: { ...state.championship.scoring, ...action.patch },
        },
        log: log(state, 'Ενημερώθηκε το σύστημα βαθμολογίας.'),
      }

    /* --- αγώνες --- */
    case 'event/add': {
      const round = state.events.reduce((mx, e) => Math.max(mx, e.round), 0) + 1
      const event = createEvent({ round, ...action.patch })
      return {
        ...state,
        events: [...state.events, event].sort((a, b) => a.round - b.round),
        log: log(state, `Προστέθηκε αγώνας: ${event.name}.`),
      }
    }

    case 'event/update': {
      const events = replace(state.events, action.id, action.patch).sort((a, b) => a.round - b.round)
      return { ...state, events, log: log(state, 'Ενημερώθηκε αγώνας στο καλεντάρι.') }
    }

    case 'event/remove': {
      const event = state.events.find((e) => e.id === action.id)
      const availability = { ...state.availability }
      delete availability[action.id]
      return {
        ...state,
        events: state.events.filter((e) => e.id !== action.id),
        plans: state.plans.filter((p) => p.eventId !== action.id),
        results: state.results.filter((r) => r.eventId !== action.id),
        availability,
        log: log(state, `Διαγράφηκε αγώνας: ${event?.name || action.id}.`),
      }
    }

    /* --- ομάδες --- */
    case 'team/add': {
      const team = createTeam(action.patch)
      return { ...state, teams: [...state.teams, team], log: log(state, `Νέα ομάδα: ${team.name}.`) }
    }

    case 'team/update': {
      const patch = { ...action.patch }
      const team = state.teams.find((t) => t.id === action.id)
      // Αλλαγή κατηγορίας → το αυτοκίνητο μπορεί να μην υπάρχει πια εκεί.
      if (patch.carClass && team && patch.carClass !== team.carClass) {
        const cars = CARS_BY_CLASS[patch.carClass] || []
        if (!cars.includes(patch.car ?? team.car)) patch.car = cars[0] || ''
      }
      return {
        ...state,
        teams: replace(state.teams, action.id, patch),
        log: log(state, `Ενημερώθηκε η ομάδα ${team?.name || ''}.`),
      }
    }

    case 'team/remove': {
      const team = state.teams.find((t) => t.id === action.id)
      return {
        ...state,
        teams: state.teams.filter((t) => t.id !== action.id),
        drivers: state.drivers.map((d) => (d.teamId === action.id ? { ...d, teamId: null } : d)),
        plans: state.plans.filter((p) => p.teamId !== action.id),
        results: state.results.map((r) => ({
          ...r,
          entries: r.entries.filter((e) => e.teamId !== action.id),
        })),
        log: log(state, `Διαγράφηκε η ομάδα ${team?.name || action.id}.`),
      }
    }

    /* --- οδηγοί & roster --- */
    case 'driver/add': {
      const driver = createDriver(action.patch)
      const teams = driver.teamId
        ? state.teams.map((t) =>
            t.id === driver.teamId ? { ...t, driverIds: [...t.driverIds, driver.id] } : t,
          )
        : state.teams
      return {
        ...state,
        drivers: [...state.drivers, driver],
        teams,
        log: log(state, `Νέος οδηγός: ${driver.name}.`),
      }
    }

    case 'driver/update':
      return {
        ...state,
        drivers: replace(state.drivers, action.id, action.patch),
        log: log(state, 'Ενημερώθηκαν στοιχεία οδηγού.'),
      }

    case 'driver/remove': {
      const driver = state.drivers.find((d) => d.id === action.id)
      return {
        ...state,
        drivers: state.drivers.filter((d) => d.id !== action.id),
        teams: state.teams.map((t) => ({
          ...t,
          driverIds: t.driverIds.filter((id) => id !== action.id),
          principalId: t.principalId === action.id ? null : t.principalId,
        })),
        plans: state.plans.map((p) => ({
          ...p,
          stints: p.stints.map((s) => (s.driverId === action.id ? { ...s, driverId: null } : s)),
        })),
        session:
          state.session.userId === action.id ? { userId: null } : state.session,
        log: log(state, `Διαγράφηκε οδηγός: ${driver?.name || action.id}.`),
      }
    }

    case 'roster/assign': {
      const { teamId, driverId } = action
      return {
        ...state,
        drivers: replace(state.drivers, driverId, { teamId }),
        teams: state.teams.map((t) => {
          if (t.id === teamId) {
            return t.driverIds.includes(driverId)
              ? t
              : { ...t, driverIds: [...t.driverIds, driverId] }
          }
          return t.driverIds.includes(driverId)
            ? {
                ...t,
                driverIds: t.driverIds.filter((id) => id !== driverId),
                principalId: t.principalId === driverId ? null : t.principalId,
              }
            : t
        }),
        log: log(state, 'Μεταφέρθηκε οδηγός σε ομάδα.'),
      }
    }

    case 'roster/unassign':
      return {
        ...state,
        drivers: replace(state.drivers, action.driverId, { teamId: null }),
        teams: state.teams.map((t) =>
          t.id === action.teamId
            ? {
                ...t,
                driverIds: t.driverIds.filter((id) => id !== action.driverId),
                principalId: t.principalId === action.driverId ? null : t.principalId,
              }
            : t,
        ),
        log: log(state, 'Αφαιρέθηκε οδηγός από ομάδα.'),
      }

    case 'roster/principal':
      return {
        ...state,
        teams: replace(state.teams, action.teamId, { principalId: action.driverId }),
        drivers: state.drivers.map((d) => {
          if (d.id === action.driverId) return { ...d, role: d.role === 'ADMIN' ? d.role : 'PRINCIPAL' }
          return d
        }),
        log: log(state, 'Ορίστηκε νέος αρχηγός ομάδας.'),
      }

    /* --- διαθεσιμότητα --- */
    case 'availability/set': {
      const { eventId, driverId, value } = action
      const current = { ...(state.availability[eventId] || {}) }
      if (value === 'UNKNOWN') delete current[driverId]
      else current[driverId] = value
      return {
        ...state,
        availability: { ...state.availability, [eventId]: current },
        log: state.log, // πολύ συχνή ενέργεια — δεν γεμίζουμε το ιστορικό
      }
    }

    /* --- πλάνα stint --- */
    case 'plan/ensure': {
      const { eventId, teamId } = action
      if (findPlanFor(state, eventId, teamId)) return state
      const team = state.teams.find((t) => t.id === teamId)
      const event = state.events.find((e) => e.id === eventId)
      if (!team || !event) return state
      const plan = createPlan({ eventId, teamId, car: createCarSetup(team, event) })
      return { ...state, plans: [...state.plans, plan] }
    }

    case 'plan/update':
      return {
        ...state,
        plans: state.plans.map((p) => (p.id === action.id ? touchPlan(p, action.patch) : p)),
      }

    case 'plan/car':
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === action.id ? touchPlan(p, { car: { ...p.car, ...action.patch } }) : p,
        ),
      }

    case 'plan/car/reset': {
      const plan = findPlan(state, action.id)
      if (!plan) return state
      const team = state.teams.find((t) => t.id === plan.teamId)
      const event = state.events.find((e) => e.id === plan.eventId)
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === action.id ? touchPlan(p, { car: suggestCar(team, event) }) : p,
        ),
      }
    }

    case 'plan/status': {
      const plan = findPlan(state, action.id)
      const team = state.teams.find((t) => t.id === plan?.teamId)
      const labels = {
        DRAFT: 'επέστρεψε σε πρόχειρο',
        SUBMITTED: 'υποβλήθηκε',
        APPROVED: 'εγκρίθηκε',
        CHANGES: 'επιστράφηκε για αλλαγές',
      }
      return {
        ...state,
        plans: state.plans.map((p) => (p.id === action.id ? touchPlan(p, { status: action.status }) : p)),
        log: log(state, `Το πλάνο της ${team?.name || 'ομάδας'} ${labels[action.status] || 'ενημερώθηκε'}.`),
      }
    }

    case 'plan/stint/add': {
      const plan = findPlan(state, action.planId)
      if (!plan) return state
      const last = plan.stints[plan.stints.length - 1]
      const stint = createStint({
        id: uid('st'),
        laps: last?.laps || 10,
        driverId: action.driverId ?? null,
        tyres: 'NEW',
        compound: last?.compound || 'MEDIUM',
        ...action.patch,
      })
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === action.planId ? touchPlan(p, { stints: [...p.stints, stint] }) : p,
        ),
      }
    }

    case 'plan/stint/update':
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === action.planId
            ? touchPlan(p, {
                stints: p.stints.map((s) =>
                  s.id === action.stintId ? { ...s, ...action.patch } : s,
                ),
              })
            : p,
        ),
      }

    case 'plan/stint/remove':
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === action.planId
            ? touchPlan(p, { stints: p.stints.filter((s) => s.id !== action.stintId) })
            : p,
        ),
      }

    case 'plan/stint/move': {
      const plan = findPlan(state, action.planId)
      if (!plan) return state
      const index = plan.stints.findIndex((s) => s.id === action.stintId)
      const target = index + action.direction
      if (index < 0 || target < 0 || target >= plan.stints.length) return state
      const stints = [...plan.stints]
      ;[stints[index], stints[target]] = [stints[target], stints[index]]
      return {
        ...state,
        plans: state.plans.map((p) => (p.id === action.planId ? touchPlan(p, { stints }) : p)),
      }
    }

    case 'plan/autofill': {
      const plan = findPlan(state, action.planId)
      if (!plan) return state
      const team = state.teams.find((t) => t.id === plan.teamId)
      const event = state.events.find((e) => e.id === plan.eventId)
      if (!team || !event) return state
      const car = plan.car || createCarSetup(team, event)
      const stints = generateStints({
        event,
        team,
        drivers: state.drivers,
        rules: state.championship.rules,
        car,
        availability: state.availability,
      })
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === action.planId ? touchPlan(p, { car, stints, status: 'DRAFT' }) : p,
        ),
        log: log(state, `Παράχθηκε αυτόματο πλάνο για την ${team.name} (${event.name}).`),
      }
    }

    case 'plan/clear':
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === action.planId ? touchPlan(p, { stints: [], status: 'DRAFT' }) : p,
        ),
      }

    case 'plan/remove':
      return { ...state, plans: state.plans.filter((p) => p.id !== action.planId) }

    /* --- αποτελέσματα --- */
    case 'result/autofill': {
      const { eventId } = action
      const existing = state.results.find((r) => r.eventId === eventId)
      const entries = state.teams.map((team, index) => {
        const found = existing?.entries.find((e) => e.teamId === team.id)
        return found || createResultEntry({ teamId: team.id, position: index + 1 })
      })
      const result = createResult({ ...(existing || {}), eventId, entries })
      return {
        ...state,
        results: existing
          ? state.results.map((r) => (r.eventId === eventId ? result : r))
          : [...state.results, result],
        log: log(state, 'Δημιουργήθηκε φύλλο αποτελεσμάτων.'),
      }
    }

    case 'result/entry': {
      const { eventId, teamId, patch } = action
      const existing = state.results.find((r) => r.eventId === eventId)
      const base = existing || createResult({ eventId, entries: [] })
      const hasEntry = base.entries.some((e) => e.teamId === teamId)
      const entries = hasEntry
        ? base.entries.map((e) => (e.teamId === teamId ? { ...e, ...patch } : e))
        : [...base.entries, createResultEntry({ teamId, ...patch })]
      const result = { ...base, entries }
      return {
        ...state,
        results: existing
          ? state.results.map((r) => (r.eventId === eventId ? result : r))
          : [...state.results, result],
      }
    }

    case 'result/remove-entry':
      return {
        ...state,
        results: state.results.map((r) =>
          r.eventId === action.eventId
            ? { ...r, entries: r.entries.filter((e) => e.teamId !== action.teamId) }
            : r,
        ),
      }

    case 'result/publish': {
      const event = state.events.find((e) => e.id === action.eventId)
      return {
        ...state,
        events: replace(state.events, action.eventId, { status: 'DONE' }),
        results: state.results.map((r) =>
          r.eventId === action.eventId ? { ...r, publishedAt: Date.now() } : r,
        ),
        log: log(state, `Δημοσιεύτηκαν τα αποτελέσματα: ${event?.name || ''}.`),
      }
    }

    case 'result/clear':
      return {
        ...state,
        results: state.results.filter((r) => r.eventId !== action.eventId),
        log: log(state, 'Καθαρίστηκαν αποτελέσματα αγώνα.'),
      }

    /* --- «σύνδεση» --- */
    case 'session/login':
      return { ...state, session: { userId: action.userId } }

    case 'session/logout':
      return { ...state, session: { userId: null } }

    /* --- δεδομένα --- */
    /**
     * Αντικατάσταση όλου του state — το χρησιμοποιεί το backend όταν φέρνει
     * φρέσκα δεδομένα από τη βάση. Έρχεται ήδη κανονικοποιημένο από το api.js,
     * γι' αυτό μπαίνει ως έχει (κρατά και πεδία που ξέρει μόνο το backend).
     */
    case 'state/replace':
      return action.state

    case 'state/import': {
      const next = normalizeState(action.state)
      return { ...next, log: log(next, 'Έγινε εισαγωγή δεδομένων από αρχείο.') }
    }

    case 'state/seed':
      return buildSeedState()

    case 'state/reset': {
      const next = emptyState()
      return { ...next, log: [{ at: Date.now(), who: '—', text: 'Νέο, κενό πρωτάθλημα.' }] }
    }

    default:
      return state
  }
}
