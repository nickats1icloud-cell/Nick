// Ο provider που κρατά το state του πρωταθλήματος και το συγχρονίζει.
//
// Δύο λειτουργίες, ίδιο UI:
//
//  • **τοπική** (χωρίς ρυθμισμένο Supabase): το state ζει στο localStorage,
//    όπως πριν. Χρήσιμο για δοκιμές και για να δουλεύει το demo offline.
//
//  • **backend** (ρυθμισμένο Supabase): το state έρχεται από τη βάση, κάθε
//    action εφαρμόζεται πρώτα τοπικά (για να μη «κολλάει» το UI) και μετά
//    γράφεται. Αν η βάση το απορρίψει — π.χ. επειδή το RLS δεν σου δίνει
//    δικαίωμα — δείχνουμε το μήνυμα και ξαναφορτώνουμε την αλήθεια από τον
//    server. Το realtime φέρνει τις αλλαγές των άλλων χωρίς refresh.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ChampionshipContext } from '../../lib/lmu/context.js'
import { findPlanFor, initialState, reducer, saveState } from '../../lib/lmu/store.js'
import { computeStandings } from '../../lib/lmu/standings.js'
import { can as canDo, manageableTeams, viewer as buildViewer } from '../../lib/lmu/permissions.js'
import { BACKEND_MODE } from '../../lib/lmu/config.js'
import { fetchState, pushAction, resolveChampionshipId } from '../../lib/lmu/api.js'
import { getSession, onAuthChange } from '../../lib/lmu/auth.js'
import { getClient } from '../../lib/lmu/supabase.js'

const REMOTE = BACKEND_MODE === 'remote'
/** Πόσο περιμένουμε να «καθίσουν» τα realtime events πριν ξαναδιαβάσουμε. */
const REALTIME_DEBOUNCE_MS = 500

export default function ChampionshipProvider({ children }) {
  const [state, rawDispatch] = useReducer(reducer, REMOTE, initialState)
  const [storageOk, setStorageOk] = useState(true)
  const [session, setSession] = useState(null)
  const [championshipId, setChampionshipId] = useState(null)
  const [sync, setSync] = useState({
    mode: BACKEND_MODE,
    loading: REMOTE,
    saving: false,
    error: null,
    ready: !REMOTE,
  })

  const stateRef = useRef(state)
  stateRef.current = state
  const queue = useRef(Promise.resolve())
  const lastWrite = useRef(0)
  const firstSave = useRef(true)

  /* ------------------------------------------------ τοπική αποθήκευση ----- */
  useEffect(() => {
    if (REMOTE) return
    if (firstSave.current) {
      firstSave.current = false
      return
    }
    setStorageOk(saveState(state))
  }, [state])

  /* -------------------------------------------------------- φόρτωση ------- */
  const reload = useCallback(
    async (id = championshipId, user = session?.user?.id || null) => {
      if (!REMOTE || !id) return
      try {
        const next = await fetchState(id, user)
        if (next) rawDispatch({ type: 'state/replace', state: next })
        setSync((s) => ({ ...s, loading: false, ready: true, error: null }))
      } catch (error) {
        setSync((s) => ({ ...s, loading: false, ready: true, error: error.message }))
      }
    },
    [championshipId, session],
  )

  // Σύνδεση: αρχική συνεδρία + παρακολούθηση αλλαγών.
  useEffect(() => {
    if (!REMOTE) return
    let cleanup = () => {}
    let alive = true
    getSession().then((current) => {
      if (alive) setSession(current)
    })
    onAuthChange((next) => {
      if (alive) setSession(next)
    }).then((fn) => {
      cleanup = fn
    })
    return () => {
      alive = false
      cleanup()
    }
  }, [])

  // Ποιο πρωτάθλημα φορτώνουμε.
  useEffect(() => {
    if (!REMOTE) return
    let alive = true
    resolveChampionshipId()
      .then((id) => {
        if (!alive) return
        setChampionshipId(id)
        if (!id) setSync((s) => ({ ...s, loading: false, ready: true }))
      })
      .catch((error) => {
        if (alive) setSync((s) => ({ ...s, loading: false, ready: true, error: error.message }))
      })
    return () => {
      alive = false
    }
    // Ξαναψάχνουμε μετά από login: αλλάζει τι πρωταθλήματα βλέπεις.
  }, [session])

  // Το πρώτο (και κάθε μετέπειτα) φόρτωμα δεδομένων.
  useEffect(() => {
    if (!REMOTE || !championshipId) return
    reload(championshipId, session?.user?.id || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [championshipId, session])

  /* -------------------------------------------------------- realtime ------ */
  useEffect(() => {
    if (!REMOTE || !championshipId) return
    let channel = null
    let timer = null
    let alive = true

    getClient().then((supabase) => {
      if (!supabase || !alive) return
      channel = supabase
        .channel(`lmu-${championshipId}`)
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          // Οι δικές μας γραφές γυρνάνε κι αυτές ως events — τις αγνοούμε για
          // λίγο, αλλιώς θα ξαναδιαβάζαμε σε κάθε πάτημα κουμπιού.
          if (Date.now() - lastWrite.current < 1200) return
          clearTimeout(timer)
          timer = setTimeout(() => reload(), REALTIME_DEBOUNCE_MS)
        })
        .subscribe()
    })

    return () => {
      alive = false
      clearTimeout(timer)
      if (channel) getClient().then((supabase) => supabase?.removeChannel(channel))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [championshipId])

  /* --------------------------------------------------------- dispatch ----- */
  const dispatch = useCallback(
    (action) => {
      if (!REMOTE) {
        rawDispatch(action)
        return
      }
      // Ο reducer είναι καθαρός, οπότε υπολογίζουμε το επόμενο state εδώ και το
      // στέλνουμε στη βάση — χωρίς να περιμένουμε το re-render.
      const prev = stateRef.current
      const next = reducer(prev, action)
      if (next === prev) return
      stateRef.current = next
      rawDispatch(action)

      if (!championshipId) return
      lastWrite.current = Date.now()
      setSync((s) => ({ ...s, saving: true }))
      queue.current = queue.current
        .then(() => pushAction({ action, prev, next, championshipId }))
        .then(() => {
          lastWrite.current = Date.now()
          setSync((s) => ({ ...s, saving: false, error: null }))
        })
        .catch(async (error) => {
          setSync((s) => ({ ...s, saving: false, error: error.message }))
          await reload()
        })
    },
    [championshipId, reload],
  )

  const actions = useMemo(() => makeActions(dispatch), [dispatch])

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

      // --- backend ---
      backend: {
        ...sync,
        isRemote: REMOTE,
        session,
        championshipId,
        reload,
        setChampionshipId,
        dismissError: () => setSync((s) => ({ ...s, error: null })),
      },
    }
  }, [state, storageOk, actions, dispatch, sync, session, championshipId, reload])

  return <ChampionshipContext.Provider value={value}>{children}</ChampionshipContext.Provider>
}

/** Τα actions είναι σταθερά ανά dispatch. */
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
