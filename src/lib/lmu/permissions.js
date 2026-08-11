// Ρόλοι και δικαιώματα.
//
// ΣΗΜΑΝΤΙΚΟ, χωρίς αστερίσκους: η εφαρμογή τρέχει 100% στον browser, χωρίς
// server. Η «σύνδεση» είναι επιλογή ταυτότητας από τη λίστα του πρωταθλήματος
// και τα δικαιώματα εφαρμόζονται στο UI, όχι σε βάση δεδομένων. Οργανώνει τη
// δουλειά μιας ομάδας που συνεργάζεται — δεν προστατεύει από κάποιον που
// θέλει να παρακάμψει τους ρόλους. Για πραγματικό έλεγχο πρόσβασης χρειάζεται
// backend (π.χ. Supabase με RLS, όπως το greek-simracers/).

import { ROLES } from './constants.js'

/** Ο συνδεδεμένος «χρήστης» (ένας οδηγός/διοργανωτής από τη λίστα). */
export function currentUser(state) {
  const id = state?.session?.userId
  if (!id) return null
  return state.drivers.find((d) => d.id === id) || null
}

/** Οι ομάδες στις οποίες ο χρήστης είναι αρχηγός. */
export function principalTeams(state, user = currentUser(state)) {
  if (!user) return []
  return state.teams.filter((t) => t.principalId === user.id)
}

/** Η ομάδα του χρήστη ως οδηγού (ή η πρώτη που είναι αρχηγός). */
export function homeTeam(state, user = currentUser(state)) {
  if (!user) return null
  const led = principalTeams(state, user)[0]
  if (led) return led
  return state.teams.find((t) => t.id === user.teamId || t.driverIds.includes(user.id)) || null
}

function isPrincipalOf(state, user, teamId) {
  if (!user || !teamId) return false
  const team = state.teams.find((t) => t.id === teamId)
  return Boolean(team && team.principalId === user.id)
}

/**
 * Ο κεντρικός έλεγχος δικαιωμάτων.
 * @param action π.χ. 'plan.edit'
 * @param scope  { teamId, driverId }
 */
export function can(state, action, scope = {}) {
  const user = currentUser(state)
  if (!user) return false
  const isAdmin = user.role === ROLES.ADMIN.id
  if (isAdmin) return true

  const ownTeam = isPrincipalOf(state, user, scope.teamId)
  switch (action) {
    case 'team.edit':
    case 'roster.edit':
    case 'plan.edit':
    case 'plan.submit':
    case 'driver.create':
      return ownTeam
    case 'availability.edit': {
      if (scope.driverId && scope.driverId === user.id) return true
      const driver = state.drivers.find((d) => d.id === scope.driverId)
      return Boolean(driver && isPrincipalOf(state, user, driver.teamId))
    }
    case 'plan.view':
      return ownTeam || state.teams.some((t) => t.id === scope.teamId && t.driverIds.includes(user.id))
    // Μόνο ο διοργανωτής:
    case 'championship.edit':
    case 'events.edit':
    case 'teams.create':
    case 'teams.delete':
    case 'results.edit':
    case 'plan.approve':
    case 'roles.edit':
    case 'data.reset':
      return false
    default:
      return false
  }
}

/** Σύνοψη για το UI — τι βλέπει και τι μπορεί να πατήσει ο χρήστης. */
export function viewer(state) {
  const user = currentUser(state)
  const led = principalTeams(state, user)
  return {
    user,
    isGuest: !user,
    isAdmin: user?.role === ROLES.ADMIN.id,
    isPrincipal: led.length > 0,
    isDriver: Boolean(user) && led.length === 0,
    ledTeams: led,
    team: homeTeam(state, user),
    roleLabel: user ? ROLES[user.role]?.label || 'Οδηγός' : 'Επισκέπτης',
  }
}

/** Οι ομάδες που μπορεί να διαχειριστεί ο χρήστης (για τα dropdown). */
export function manageableTeams(state) {
  const v = viewer(state)
  if (v.isAdmin) return state.teams
  return v.ledTeams
}
