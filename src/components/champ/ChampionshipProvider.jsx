// Ο provider που κρατά το state του πρωταθλήματος, το σώζει στο localStorage
// και δίνει στα pages actions + παράγωγα δεδομένα (βαθμολογίες, επόμενος
// αγώνας, δικαιώματα χρήστη).

import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ChampionshipContext } from '../../lib/lmu/context.js'
import { findPlanFor, initialState, reducer, saveState } from '../../lib/lmu/store.js'
import { computeStandings } from '../../lib/lmu/standings.js'
import { can as canDo, manageableTeams, viewer as buildViewer } from '../../lib/lmu/permissions.js'

export default function ChampionshipProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const [storageOk, setStorageOk] = useState(true)
  const first = useRef(true)

  // Αποθήκευση σε κάθε αλλαγή. Το πρώτο render δεν σώζει (μόλις φορτώσαμε).
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setStorageOk(saveState(state))
  }, [state])

  const actions = useMemo(() => makeActions(dispatch), [])

  const value = useMemo(() => {
    const events = [...state.events].sort((a, b) => a.round - b.round)
    const nextEvent =
      events.find((e) => e.status === 'UPCOMING' || e.status === 'LIVE') ||
      events[events.length - 1] ||
      null

    return {
      state,
      dispatch,
      actions,
      storageOk,
      events,
      nextEvent,
      viewer: buildViewer(state),
      standings: computeStandings(state),
      teams: state.teams,
      drivers: state.drivers,
      championship: state.championship,
      myTeams: manageableTeams(state),
      can: (action, scope) => canDo(state, action, scope),
      teamById: (id) => state.teams.find((t) => t.id === id) || null,
      driverById: (id) => state.drivers.find((d) => d.id === id) || null,
      eventById: (id) => state.events.find((e) => e.id === id) || null,
      planFor: (eventId, teamId) => findPlanFor(state, eventId, teamId),
      rosterOf: (teamId) => {
        const team = state.teams.find((t) => t.id === teamId)
        if (!team) return []
        return team.driverIds.map((id) => state.drivers.find((d) => d.id === id)).filter(Boolean)
      },
      availabilityOf: (eventId, driverId) => state.availability?.[eventId]?.[driverId] || 'UNKNOWN',
      resultFor: (eventId) => state.results.find((r) => r.eventId === eventId) || null,
    }
  }, [state, storageOk, actions])

  return <ChampionshipContext.Provider value={value}>{children}</ChampionshipContext.Provider>
}

/** Τα actions είναι σταθερά: μόνο το dispatch τα χρειάζεται. */
function makeActions(dispatch) {
  return {
    updateChampionship: (patch) => dispatch({ type: 'championship/update', patch }),
    updateRules: (patch) => dispatch({ type: 'rules/update', patch }),
    updateScoring: (patch) => dispatch({ type: 'scoring/update', patch }),

    addEvent: (patch) => dispatch({ type: 'event/add', patch }),
    updateEvent: (id, patch) => dispatch({ type: 'event/update', id, patch }),
    removeEvent: (id) => dispatch({ type: 'event/remove', id }),

    addTeam: (patch) => dispatch({ type: 'team/add', patch }),
    updateTeam: (id, patch) => dispatch({ type: 'team/update', id, patch }),
    removeTeam: (id) => dispatch({ type: 'team/remove', id }),

    addDriver: (patch) => dispatch({ type: 'driver/add', patch }),
    updateDriver: (id, patch) => dispatch({ type: 'driver/update', id, patch }),
    removeDriver: (id) => dispatch({ type: 'driver/remove', id }),
    assignDriver: (teamId, driverId) => dispatch({ type: 'roster/assign', teamId, driverId }),
    unassignDriver: (teamId, driverId) => dispatch({ type: 'roster/unassign', teamId, driverId }),
    setPrincipal: (teamId, driverId) => dispatch({ type: 'roster/principal', teamId, driverId }),

    setAvailability: (eventId, driverId, value) =>
      dispatch({ type: 'availability/set', eventId, driverId, value }),

    ensurePlan: (eventId, teamId) => dispatch({ type: 'plan/ensure', eventId, teamId }),
    updatePlan: (id, patch) => dispatch({ type: 'plan/update', id, patch }),
    updateCar: (id, patch) => dispatch({ type: 'plan/car', id, patch }),
    resetCar: (id) => dispatch({ type: 'plan/car/reset', id }),
    setPlanStatus: (id, status) => dispatch({ type: 'plan/status', id, status }),
    addStint: (planId, patch) => dispatch({ type: 'plan/stint/add', planId, patch }),
    updateStint: (planId, stintId, patch) =>
      dispatch({ type: 'plan/stint/update', planId, stintId, patch }),
    removeStint: (planId, stintId) => dispatch({ type: 'plan/stint/remove', planId, stintId }),
    moveStint: (planId, stintId, direction) =>
      dispatch({ type: 'plan/stint/move', planId, stintId, direction }),
    autofillPlan: (planId) => dispatch({ type: 'plan/autofill', planId }),
    clearPlan: (planId) => dispatch({ type: 'plan/clear', planId }),

    autofillResults: (eventId) => dispatch({ type: 'result/autofill', eventId }),
    updateResultEntry: (eventId, teamId, patch) =>
      dispatch({ type: 'result/entry', eventId, teamId, patch }),
    removeResultEntry: (eventId, teamId) =>
      dispatch({ type: 'result/remove-entry', eventId, teamId }),
    publishResults: (eventId) => dispatch({ type: 'result/publish', eventId }),
    clearResults: (eventId) => dispatch({ type: 'result/clear', eventId }),

    login: (userId) => dispatch({ type: 'session/login', userId }),
    logout: () => dispatch({ type: 'session/logout' }),

    importState: (next) => dispatch({ type: 'state/import', state: next }),
    loadDemo: () => dispatch({ type: 'state/seed' }),
    resetAll: () => dispatch({ type: 'state/reset' }),
  }
}
