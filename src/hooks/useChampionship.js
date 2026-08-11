// Τα hooks που διαβάζουν το context του πρωταθλήματος. Ο provider ζωγραφίζεται
// από το components/champ/ChampionshipProvider.jsx.

import { useContext, useEffect, useMemo } from 'react'
import { ChampionshipContext } from '../lib/lmu/context.js'
import { computePlan } from '../lib/lmu/stints.js'
import { validatePlan } from '../lib/lmu/rules.js'

export function useChampionship() {
  const ctx = useContext(ChampionshipContext)
  if (!ctx) {
    throw new Error('Το useChampionship πρέπει να χρησιμοποιηθεί μέσα σε <ChampionshipProvider>.')
  }
  return ctx
}

/**
 * Όλα όσα χρειάζεται ο planner για μία ομάδα σε έναν αγώνα: το πλάνο (το
 * φτιάχνει αν λείπει), οι υπολογισμοί και ο έλεγχος κανόνων.
 */
export function usePlan(eventId, teamId) {
  const ctx = useChampionship()
  const { state, actions } = ctx
  const plan = eventId && teamId ? ctx.planFor(eventId, teamId) : null

  useEffect(() => {
    if (eventId && teamId && !plan) actions.ensurePlan(eventId, teamId)
  }, [eventId, teamId, plan, actions])

  const team = teamId ? ctx.teamById(teamId) : null
  const event = eventId ? ctx.eventById(eventId) : null

  return useMemo(() => {
    if (!plan || !team || !event) {
      return { plan: null, computed: null, validation: null, team, event }
    }
    const computed = computePlan({
      plan,
      team,
      event,
      drivers: state.drivers,
      rules: state.championship.rules,
    })
    const validation = validatePlan({
      computed,
      plan,
      team,
      event,
      drivers: state.drivers,
      availability: state.availability,
      rules: state.championship.rules,
    })
    return { plan, computed, validation, team, event }
  }, [plan, team, event, state.drivers, state.availability, state.championship.rules])
}
