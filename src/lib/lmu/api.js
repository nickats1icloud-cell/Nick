// Το data access layer του backend: διαβάζει ολόκληρο το πρωτάθλημα από τη βάση
// στο ίδιο σχήμα που περιμένει το UI, και μεταφράζει τα actions του reducer σε
// γραφές.
//
// Γιατί «ολόκληρο»: ένα πρωτάθλημα είναι μικρό (δεκάδες ομάδες/οδηγοί, λίγοι
// αγώνες). Ένα fetch φέρνει τα πάντα, οπότε οι υπολογισμοί (stint, κανόνες,
// βαθμολογίες) μένουν ακριβώς όπως ήταν — καθαρές συναρτήσεις πάνω σε ένα
// state. Έτσι μπήκε backend χωρίς να ξαναγραφτεί το UI.
//
// Οι γραφές είναι «upsert της γραμμής που άλλαξε»: παίρνουμε το αποτέλεσμα του
// reducer (που είναι η αλήθεια του UI) και το στέλνουμε στη βάση. Ό,τι δεν
// επιτρέπεται, το κόβει το RLS και το μήνυμα γυρνά στον χρήστη.

import { CHAMPIONSHIP_ID } from './config.js'
import { DEFAULT_RULES, DEFAULT_SCORING } from './constants.js'
import { createResultEntry, emptyState, normalizeState } from './model.js'
import { assertOk, getClient } from './supabase.js'
import { fromLocalInput, isUuid, num, toLocalInput, uid } from './utils.js'

/* ------------------------------------------------------------- μεταφράσεις --
   Η βάση είναι snake_case, το UI camelCase. Μία θέση για κάθε κατεύθυνση. */

function eventFromRow(row) {
  return {
    id: row.id,
    round: row.round,
    name: row.name,
    trackId: row.track_id,
    dateISO: toLocalInput(row.starts_at),
    durationMinutes: row.duration_minutes,
    formationLapMinutes: 0,
    status: row.status,
    notes: row.notes || '',
  }
}

function eventToRow(event, championshipId) {
  return {
    id: event.id,
    championship_id: championshipId,
    round: num(event.round, 1),
    name: event.name,
    track_id: event.trackId || '',
    starts_at: fromLocalInput(event.dateISO),
    duration_minutes: Math.max(1, num(event.durationMinutes, 360)),
    status: event.status || 'UPCOMING',
    notes: event.notes || '',
  }
}

function teamFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name || '',
    carClass: row.car_class,
    car: row.car || '',
    number: row.number || '',
    color: row.color || '#7c5cff',
    principalId: row.principal_id || null,
    driverIds: [], // συμπληρώνεται από τους οδηγούς
    notes: row.notes || '',
  }
}

function teamToRow(team, championshipId) {
  return {
    id: team.id,
    championship_id: championshipId,
    name: team.name,
    short_name: team.shortName || '',
    car_class: team.carClass,
    car: team.car || '',
    number: String(team.number ?? ''),
    color: team.color || '#7c5cff',
    principal_id: team.principalId || null,
    notes: team.notes || '',
  }
}

function driverFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname || '',
    country: row.country || '',
    category: row.category,
    steamId: row.steam_id || '',
    discord: row.discord || '',
    email: row.email || '',
    role: row.role,
    teamId: row.team_id || null,
    userId: row.user_id || null,
    paceDeltaSec: num(row.pace_delta_sec),
    notes: row.notes || '',
  }
}

function driverToRow(driver, championshipId) {
  return {
    id: driver.id,
    championship_id: championshipId,
    name: driver.name,
    nickname: driver.nickname || '',
    country: driver.country || '',
    category: driver.category || 'SILVER',
    steam_id: driver.steamId || '',
    discord: driver.discord || '',
    email: driver.email ? String(driver.email).trim().toLowerCase() : null,
    role: driver.role || 'DRIVER',
    team_id: driver.teamId || null,
    pace_delta_sec: num(driver.paceDeltaSec),
    notes: driver.notes || '',
  }
}

function planToRow(plan) {
  return {
    id: plan.id,
    event_id: plan.eventId,
    team_id: plan.teamId,
    status: plan.status || 'DRAFT',
    strategy_note: plan.strategyNote || '',
    car: plan.car || {},
  }
}

function stintToRow(stint, planId, position) {
  return {
    id: stint.id,
    plan_id: planId,
    position,
    driver_id: stint.driverId || null,
    laps: Math.max(1, num(stint.laps, 1)),
    lap_time_sec: num(stint.lapTimeSec),
    fuel_added_l: num(stint.fuelAddedL),
    tyres: stint.tyres || 'NEW',
    compound: stint.compound || 'MEDIUM',
    note: stint.note || '',
  }
}

function entryToRow(entry, resultId) {
  return {
    result_id: resultId,
    team_id: entry.teamId,
    position: num(entry.position),
    class_position: num(entry.classPosition),
    laps: num(entry.laps),
    total_time_sec: num(entry.totalTimeSec),
    best_lap_sec: num(entry.bestLapSec),
    status: entry.status || 'FINISHED',
    pole: Boolean(entry.pole),
    fastest_lap: Boolean(entry.fastestLap),
    penalty_points: num(entry.penaltyPoints),
    driver_ids: (entry.driverIds || []).filter(isUuid),
    note: entry.note || '',
  }
}

/* ------------------------------------------------------------------ ανάγνωση */

/** Τα πρωταθλήματα που μπορεί να δει ο χρήστης (για επιλογή αν είναι πολλά). */
export async function listChampionships() {
  const supabase = await getClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('championships')
    .select('id, name, season, organizer, created_at')
    .order('created_at', { ascending: false })
  assertOk(error, 'Δεν μπόρεσα να διαβάσω τα πρωταθλήματα')
  return data || []
}

/** Ποιο πρωτάθλημα φορτώνουμε: το ρυθμισμένο, αλλιώς το πρώτο διαθέσιμο. */
export async function resolveChampionshipId() {
  if (CHAMPIONSHIP_ID) return CHAMPIONSHIP_ID
  const list = await listChampionships()
  return list[0]?.id || null
}

/**
 * Φέρνει όλο το πρωτάθλημα σε σχήμα state. Τα πλάνα stint τα επιστρέφει το RLS
 * μόνο για την ομάδα σου (και όλα, αν είσαι διοργανωτής) — δεν χρειάζεται
 * φιλτράρισμα εδώ.
 */
export async function fetchState(championshipId, userId = null) {
  const supabase = await getClient()
  if (!supabase || !championshipId) return null

  const champRes = await supabase
    .from('championships')
    .select('*')
    .eq('id', championshipId)
    .maybeSingle()
  assertOk(champRes.error, 'Δεν μπόρεσα να διαβάσω το πρωτάθλημα')
  if (!champRes.data) return null

  // Οι επισκέπτες δεν βλέπουν τον πίνακα drivers (κρύβει emails) — γι' αυτούς
  // υπάρχει το δημόσιο view με μόνο τα ασφαλή πεδία.
  const driverSource = userId ? 'drivers' : 'v_public_drivers'

  const [teamsRes, driversRes, eventsRes] = await Promise.all([
    supabase.from('teams').select('*').eq('championship_id', championshipId),
    supabase.from(driverSource).select('*').eq('championship_id', championshipId),
    supabase.from('events').select('*').eq('championship_id', championshipId).order('round'),
  ])
  assertOk(teamsRes.error, 'Δεν μπόρεσα να διαβάσω τις ομάδες')
  assertOk(driversRes.error, 'Δεν μπόρεσα να διαβάσω τους οδηγούς')
  assertOk(eventsRes.error, 'Δεν μπόρεσα να διαβάσω το καλεντάρι')

  const eventIds = (eventsRes.data || []).map((e) => e.id)

  const [availRes, plansRes, resultsRes, logRes] = await Promise.all([
    eventIds.length
      ? supabase.from('availability').select('*').in('event_id', eventIds)
      : { data: [], error: null },
    eventIds.length
      ? supabase.from('plans').select('*, stints(*)').in('event_id', eventIds)
      : { data: [], error: null },
    eventIds.length
      ? supabase.from('results').select('*, result_entries(*)').in('event_id', eventIds)
      : { data: [], error: null },
    userId
      ? supabase
          .from('activity_log')
          .select('at, who, message')
          .eq('championship_id', championshipId)
          .order('at', { ascending: false })
          .limit(60)
      : { data: [], error: null },
  ])
  // Η διαθεσιμότητα και το ιστορικό είναι μόνο για μέλη: αν ο χρήστης δεν είναι
  // μέλος, το RLS γυρνά κενό — δεν είναι σφάλμα, οπότε δεν κόβουμε τη ροή.
  assertOk(plansRes.error, 'Δεν μπόρεσα να διαβάσω τα πλάνα')
  assertOk(resultsRes.error, 'Δεν μπόρεσα να διαβάσω τα αποτελέσματα')

  const drivers = (driversRes.data || []).map(driverFromRow)
  const teams = (teamsRes.data || []).map(teamFromRow)
  // Η σχέση ομάδα→οδηγοί ζει σε μία στήλη (drivers.team_id) — τη λίστα την
  // ξαναφτιάχνουμε εδώ, ώστε να μην υπάρχουν δύο πηγές αλήθειας.
  teams.forEach((team) => {
    team.driverIds = drivers.filter((d) => d.teamId === team.id).map((d) => d.id)
    if (team.principalId && !team.driverIds.includes(team.principalId)) {
      team.driverIds.push(team.principalId)
    }
  })

  const availability = {}
  ;(availRes.data || []).forEach((row) => {
    availability[row.event_id] = availability[row.event_id] || {}
    availability[row.event_id][row.driver_id] = row.value
  })

  const plans = (plansRes.data || []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    teamId: row.team_id,
    status: row.status,
    strategyNote: row.strategy_note || '',
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    car: row.car && Object.keys(row.car).length ? row.car : null,
    stints: [...(row.stints || [])]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        id: s.id,
        driverId: s.driver_id || null,
        laps: s.laps,
        lapTimeSec: num(s.lap_time_sec),
        fuelAddedL: num(s.fuel_added_l),
        tyres: s.tyres,
        compound: s.compound,
        note: s.note || '',
      })),
  }))

  const results = (resultsRes.data || []).map((row) => ({
    eventId: row.event_id,
    publishedAt: row.published_at ? new Date(row.published_at).getTime() : null,
    entries: (row.result_entries || []).map((entry) =>
      createResultEntry({
        teamId: entry.team_id,
        position: entry.position,
        classPosition: entry.class_position,
        laps: entry.laps,
        totalTimeSec: num(entry.total_time_sec),
        bestLapSec: num(entry.best_lap_sec),
        status: entry.status,
        pole: entry.pole,
        fastestLap: entry.fastest_lap,
        penaltyPoints: num(entry.penalty_points),
        driverIds: entry.driver_ids || [],
        note: entry.note || '',
      }),
    ),
  }))

  const champ = champRes.data
  const myDriver = userId ? drivers.find((d) => d.userId === userId) : null

  const state = normalizeState({
    championship: {
      id: champ.id,
      name: champ.name,
      season: champ.season || '',
      organizer: champ.organizer || '',
      description: champ.description || '',
      classes: champ.classes || [],
      rules: { ...DEFAULT_RULES, ...(champ.rules || {}) },
      scoring: { ...DEFAULT_SCORING, ...(champ.scoring || {}) },
    },
    events: (eventsRes.data || []).map(eventFromRow),
    teams,
    drivers,
    availability,
    plans,
    results,
    session: { userId: myDriver?.id || null },
    log: (logRes.data || [])
      .map((row) => ({ at: new Date(row.at).getTime(), who: row.who, text: row.message }))
      .reverse(),
  })

  // Το normalizeState πετάει πεδία που δεν ξέρει — τα δικά του backend πεδία
  // (email, userId) τα ξαναβάζουμε γιατί τα θέλει το UI του roster/σύνδεσης.
  state.drivers = state.drivers.map((d) => {
    const source = drivers.find((row) => row.id === d.id)
    return source ? { ...d, email: source.email || '', userId: source.userId || null } : d
  })
  state.teams = state.teams.map((t) => {
    const source = teams.find((row) => row.id === t.id)
    return source ? { ...t, driverIds: source.driverIds } : t
  })
  return state
}

/* -------------------------------------------------------------------- γραφές */

/** Αντικαθιστά τα stints ενός πλάνου με ό,τι λέει το UI (και σβήνει τα υπόλοιπα). */
async function syncStints(supabase, plan) {
  const rows = plan.stints.map((stint, index) => stintToRow(stint, plan.id, index))
  const keep = rows.map((r) => r.id)

  if (rows.length) {
    const { error } = await supabase.from('stints').upsert(rows, { onConflict: 'id' })
    assertOk(error, 'Δεν μπόρεσα να αποθηκεύσω τα stint')
  }

  let del = supabase.from('stints').delete().eq('plan_id', plan.id)
  if (keep.length) del = del.not('id', 'in', `(${keep.join(',')})`)
  const { error } = await del
  assertOk(error, 'Δεν μπόρεσα να καθαρίσω τα παλιά stint')
}

async function syncPlan(supabase, plan) {
  const { error } = await supabase.from('plans').upsert(planToRow(plan), { onConflict: 'id' })
  assertOk(error, 'Δεν μπόρεσα να αποθηκεύσω το πλάνο')
  await syncStints(supabase, plan)
}

/** Το id του φύλλου αποτελεσμάτων ενός αγώνα (το φτιάχνει αν λείπει). */
async function ensureResultId(supabase, eventId) {
  const found = await supabase.from('results').select('id').eq('event_id', eventId).maybeSingle()
  assertOk(found.error, 'Δεν μπόρεσα να διαβάσω το φύλλο αποτελεσμάτων')
  if (found.data?.id) return found.data.id
  const created = await supabase
    .from('results')
    .insert({ id: uid(), event_id: eventId })
    .select('id')
    .single()
  assertOk(created.error, 'Δεν μπόρεσα να φτιάξω φύλλο αποτελεσμάτων')
  return created.data.id
}

async function syncResult(supabase, result) {
  const resultId = await ensureResultId(supabase, result.eventId)
  if (result.publishedAt) {
    const { error } = await supabase
      .from('results')
      .update({ published_at: new Date(result.publishedAt).toISOString() })
      .eq('id', resultId)
    assertOk(error, 'Δεν μπόρεσα να δημοσιεύσω τα αποτελέσματα')
  }
  if (!result.entries.length) return
  const { error } = await supabase
    .from('result_entries')
    .upsert(result.entries.map((entry) => entryToRow(entry, resultId)), {
      onConflict: 'result_id,team_id',
    })
  assertOk(error, 'Δεν μπόρεσα να αποθηκεύσω τα αποτελέσματα')
}

async function pushNewLogEntries(supabase, championshipId, prev, next) {
  const added = next.log.length - prev.log.length
  if (added <= 0) return
  const rows = next.log.slice(-added).map((entry) => ({
    championship_id: championshipId,
    at: new Date(entry.at).toISOString(),
    who: entry.who,
    message: entry.text,
  }))
  // Το ιστορικό είναι «nice to have»: αν αποτύχει, δεν χαλάει την ενέργεια.
  await supabase.from('activity_log').insert(rows)
}

/**
 * Στέλνει στη βάση ό,τι άλλαξε ένα action. Τρέχει *μετά* τον reducer, οπότε
 * διαβάζει το τελικό state — δεν ξαναϋπολογίζει τίποτα.
 */
export async function pushAction({ action, prev, next, championshipId }) {
  const supabase = await getClient()
  if (!supabase || !championshipId) return

  const teamOf = (id) => next.teams.find((t) => t.id === id)
  const driverOf = (id) => next.drivers.find((d) => d.id === id)
  const planOf = (id) => next.plans.find((p) => p.id === id)
  const eventOf = (id) => next.events.find((e) => e.id === id)

  switch (action.type) {
    case 'championship/update':
    case 'rules/update':
    case 'scoring/update': {
      const c = next.championship
      const { error } = await supabase
        .from('championships')
        .update({
          name: c.name,
          season: c.season,
          organizer: c.organizer,
          description: c.description,
          classes: c.classes,
          rules: c.rules,
          scoring: c.scoring,
        })
        .eq('id', championshipId)
      assertOk(error, 'Δεν μπόρεσα να αποθηκεύσω το πρωτάθλημα')
      break
    }

    case 'event/add':
    case 'event/update': {
      // Το event/add μπορεί να αλλάξει και τη σειρά (round) των υπολοίπων.
      const rows = next.events.map((e) => eventToRow(e, championshipId))
      const { error } = await supabase.from('events').upsert(rows, { onConflict: 'id' })
      assertOk(error, 'Δεν μπόρεσα να αποθηκεύσω τον αγώνα')
      break
    }

    case 'event/remove': {
      const { error } = await supabase.from('events').delete().eq('id', action.id)
      assertOk(error, 'Δεν μπόρεσα να διαγράψω τον αγώνα')
      break
    }

    case 'team/add':
    case 'team/update': {
      const team = teamOf(action.id) || next.teams[next.teams.length - 1]
      const { error } = await supabase
        .from('teams')
        .upsert(teamToRow(team, championshipId), { onConflict: 'id' })
      assertOk(error, 'Δεν μπόρεσα να αποθηκεύσω την ομάδα')
      break
    }

    case 'team/remove': {
      const { error } = await supabase.from('teams').delete().eq('id', action.id)
      assertOk(error, 'Δεν μπόρεσα να διαγράψω την ομάδα')
      break
    }

    case 'driver/add': {
      const driver = next.drivers[next.drivers.length - 1]
      const { error } = await supabase
        .from('drivers')
        .insert(driverToRow(driver, championshipId))
      assertOk(error, 'Δεν μπόρεσα να προσθέσω τον οδηγό')
      break
    }

    case 'driver/update': {
      const driver = driverOf(action.id)
      if (!driver) break
      const { error } = await supabase
        .from('drivers')
        .update(driverToRow(driver, championshipId))
        .eq('id', driver.id)
      assertOk(error, 'Δεν μπόρεσα να αποθηκεύσω τον οδηγό')
      break
    }

    case 'driver/remove': {
      const { error } = await supabase.from('drivers').delete().eq('id', action.id)
      assertOk(error, 'Δεν μπόρεσα να διαγράψω τον οδηγό')
      break
    }

    case 'roster/assign':
    case 'roster/unassign': {
      const driver = driverOf(action.driverId)
      const { error } = await supabase
        .from('drivers')
        .update({ team_id: driver?.teamId || null })
        .eq('id', action.driverId)
      assertOk(error, 'Δεν μπόρεσα να αλλάξω ομάδα στον οδηγό')
      // Αν ήταν αρχηγός, ο reducer τον έβγαλε — πέρνα το και στη βάση.
      const team = teamOf(action.teamId)
      if (team) {
        await supabase.from('teams').update({ principal_id: team.principalId }).eq('id', team.id)
      }
      break
    }

    case 'roster/principal': {
      const team = teamOf(action.teamId)
      const { error } = await supabase
        .from('teams')
        .update({ principal_id: team?.principalId || null })
        .eq('id', action.teamId)
      assertOk(error, 'Δεν μπόρεσα να ορίσω αρχηγό')
      const driver = driverOf(action.driverId)
      if (driver) {
        await supabase.from('drivers').update({ role: driver.role }).eq('id', driver.id)
      }
      break
    }

    case 'availability/set': {
      if (action.value === 'UNKNOWN') {
        const { error } = await supabase
          .from('availability')
          .delete()
          .eq('event_id', action.eventId)
          .eq('driver_id', action.driverId)
        assertOk(error, 'Δεν μπόρεσα να καθαρίσω τη δήλωση')
      } else {
        const { error } = await supabase.from('availability').upsert(
          {
            event_id: action.eventId,
            driver_id: action.driverId,
            value: action.value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'event_id,driver_id' },
        )
        assertOk(error, 'Δεν μπόρεσα να αποθηκεύσω τη δήλωση')
      }
      break
    }

    case 'plan/ensure': {
      const plan = next.plans.find(
        (p) => p.eventId === action.eventId && p.teamId === action.teamId,
      )
      if (plan) await syncPlan(supabase, plan)
      break
    }

    case 'plan/update':
    case 'plan/car':
    case 'plan/car/reset':
    case 'plan/status': {
      const plan = planOf(action.id)
      if (!plan) break
      const { error } = await supabase
        .from('plans')
        .update({
          status: plan.status,
          strategy_note: plan.strategyNote,
          car: plan.car || {},
        })
        .eq('id', plan.id)
      assertOk(error, 'Δεν μπόρεσα να αποθηκεύσω το πλάνο')
      break
    }

    case 'plan/stint/add':
    case 'plan/stint/update':
    case 'plan/stint/remove':
    case 'plan/stint/move':
    case 'plan/autofill':
    case 'plan/clear': {
      const plan = planOf(action.planId)
      if (plan) await syncPlan(supabase, plan)
      break
    }

    case 'plan/remove': {
      const { error } = await supabase.from('plans').delete().eq('id', action.planId)
      assertOk(error, 'Δεν μπόρεσα να διαγράψω το πλάνο')
      break
    }

    case 'result/autofill':
    case 'result/entry': {
      const result = next.results.find((r) => r.eventId === action.eventId)
      if (result) await syncResult(supabase, result)
      break
    }

    case 'result/remove-entry': {
      const resultId = await ensureResultId(supabase, action.eventId)
      const { error } = await supabase
        .from('result_entries')
        .delete()
        .eq('result_id', resultId)
        .eq('team_id', action.teamId)
      assertOk(error, 'Δεν μπόρεσα να διαγράψω τη συμμετοχή')
      break
    }

    case 'result/publish': {
      const event = eventOf(action.eventId)
      const result = next.results.find((r) => r.eventId === action.eventId)
      if (result) await syncResult(supabase, result)
      if (event) {
        const { error } = await supabase
          .from('events')
          .update({ status: event.status })
          .eq('id', event.id)
        assertOk(error, 'Δεν μπόρεσα να ενημερώσω τον αγώνα')
      }
      break
    }

    case 'result/clear': {
      const { error } = await supabase.from('results').delete().eq('event_id', action.eventId)
      assertOk(error, 'Δεν μπόρεσα να διαγράψω τα αποτελέσματα')
      break
    }

    // Καθαρά τοπικά — δεν αγγίζουν τη βάση.
    case 'session/login':
    case 'session/logout':
    case 'state/replace':
      return

    default:
      return
  }

  await pushNewLogEntries(supabase, championshipId, prev, next)
}

/** Νέο, κενό πρωτάθλημα στο cloud. Ο δημιουργός γίνεται διοργανωτής. */
export async function createChampionship({
  name,
  season = '',
  organizer = '',
  displayName = '',
  rules = DEFAULT_RULES,
  scoring = DEFAULT_SCORING,
  classes = ['HYPERCAR', 'LMP2', 'LMGT3'],
}) {
  const supabase = await getClient()
  if (!supabase) throw new Error('Δεν υπάρχει ρυθμισμένο backend.')
  const { data, error } = await supabase.rpc('lmu_create_championship', {
    p_name: name,
    p_season: season,
    p_organizer: organizer,
    p_display_name: displayName,
    p_rules: rules,
    p_scoring: scoring,
    p_classes: classes,
  })
  assertOk(error, 'Δεν μπόρεσα να δημιουργήσω πρωτάθλημα')
  return data
}

/* ------------------------------------------------- ανέβασμα τοπικού state --- */

/**
 * Ανεβάζει ένα ολόκληρο τοπικό πρωτάθλημα στο cloud: φτιάχνει νέο πρωτάθλημα
 * (ο χρήστης γίνεται διοργανωτής) και αντιγράφει τα πάντα. Τα ids που δεν είναι
 * UUID (π.χ. του demo seed) αντικαθίστανται, κρατώντας τις σχέσεις.
 */
export async function uploadState(state, { displayName = '' } = {}) {
  const supabase = await getClient()
  if (!supabase) throw new Error('Δεν υπάρχει ρυθμισμένο backend.')

  const map = new Map()
  const remap = (id) => {
    if (!id) return null
    if (isUuid(id)) return id
    if (!map.has(id)) map.set(id, uid())
    return map.get(id)
  }

  const created = await supabase.rpc('lmu_create_championship', {
    p_name: state.championship.name,
    p_season: state.championship.season,
    p_organizer: state.championship.organizer,
    p_display_name: displayName,
    p_rules: state.championship.rules,
    p_scoring: state.championship.scoring,
    p_classes: state.championship.classes,
  })
  assertOk(created.error, 'Δεν μπόρεσα να δημιουργήσω πρωτάθλημα')
  const championshipId = created.data
  if (!championshipId) throw new Error('Η βάση δεν επέστρεψε id πρωταθλήματος.')

  await supabase
    .from('championships')
    .update({ description: state.championship.description })
    .eq('id', championshipId)

  // Ομάδες πρώτα χωρίς αρχηγό (ο αρχηγός είναι οδηγός που δεν υπάρχει ακόμα).
  if (state.teams.length) {
    const rows = state.teams.map((team) => ({
      ...teamToRow({ ...team, id: remap(team.id) }, championshipId),
      principal_id: null,
    }))
    const { error } = await supabase.from('teams').insert(rows)
    assertOk(error, 'Δεν μπόρεσα να ανεβάσω τις ομάδες')
  }

  if (state.drivers.length) {
    const rows = state.drivers.map((driver) =>
      driverToRow(
        { ...driver, id: remap(driver.id), teamId: remap(driver.teamId) },
        championshipId,
      ),
    )
    // Ο δικός μας ADMIN οδηγός φτιάχτηκε από την RPC — μην τον διπλασιάσουμε.
    const { error } = await supabase
      .from('drivers')
      .insert(rows.map((row) => ({ ...row, role: row.role === 'ADMIN' ? 'DRIVER' : row.role })))
    assertOk(error, 'Δεν μπόρεσα να ανεβάσω τους οδηγούς')
  }

  for (const team of state.teams) {
    if (!team.principalId) continue
    await supabase
      .from('teams')
      .update({ principal_id: remap(team.principalId) })
      .eq('id', remap(team.id))
  }

  if (state.events.length) {
    const rows = state.events.map((event) =>
      eventToRow({ ...event, id: remap(event.id) }, championshipId),
    )
    const { error } = await supabase.from('events').insert(rows)
    assertOk(error, 'Δεν μπόρεσα να ανεβάσω το καλεντάρι')
  }

  const availabilityRows = []
  Object.entries(state.availability || {}).forEach(([eventId, map2]) => {
    Object.entries(map2 || {}).forEach(([driverId, value]) => {
      if (!['YES', 'MAYBE', 'NO'].includes(value)) return
      availabilityRows.push({
        event_id: remap(eventId),
        driver_id: remap(driverId),
        value,
      })
    })
  })
  if (availabilityRows.length) {
    const { error } = await supabase.from('availability').insert(availabilityRows)
    assertOk(error, 'Δεν μπόρεσα να ανεβάσω τις διαθεσιμότητες')
  }

  for (const plan of state.plans) {
    const planId = remap(plan.id)
    const row = planToRow({
      ...plan,
      id: planId,
      eventId: remap(plan.eventId),
      teamId: remap(plan.teamId),
      status: 'DRAFT', // ο trigger θέλει νέο πλάνο ως πρόχειρο
    })
    const { error } = await supabase.from('plans').insert(row)
    assertOk(error, 'Δεν μπόρεσα να ανεβάσω τα πλάνα')
    if (plan.stints.length) {
      const stintRows = plan.stints.map((stint, index) =>
        stintToRow({ ...stint, id: remap(stint.id), driverId: remap(stint.driverId) }, planId, index),
      )
      const stintRes = await supabase.from('stints').insert(stintRows)
      assertOk(stintRes.error, 'Δεν μπόρεσα να ανεβάσω τα stint')
    }
    if (plan.status !== 'DRAFT') {
      await supabase.from('plans').update({ status: plan.status }).eq('id', planId)
    }
  }

  for (const result of state.results) {
    const resultRow = await supabase
      .from('results')
      .insert({
        id: uid(),
        event_id: remap(result.eventId),
        published_at: result.publishedAt ? new Date(result.publishedAt).toISOString() : null,
      })
      .select('id')
      .single()
    assertOk(resultRow.error, 'Δεν μπόρεσα να ανεβάσω τα αποτελέσματα')
    if (!result.entries.length) continue
    const entryRows = result.entries.map((entry) =>
      entryToRow(
        {
          ...entry,
          teamId: remap(entry.teamId),
          driverIds: (entry.driverIds || []).map(remap),
        },
        resultRow.data.id,
      ),
    )
    const entriesRes = await supabase.from('result_entries').insert(entryRows)
    assertOk(entriesRes.error, 'Δεν μπόρεσα να ανεβάσω τις συμμετοχές')
  }

  return championshipId
}

/** Κενό state με σημαία «φορτώνει», για το πρώτο render σε remote mode. */
export function loadingState() {
  return emptyState()
}
