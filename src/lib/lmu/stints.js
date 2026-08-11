// Τα μαθηματικά του stint plan: χρονογραμμή, καύσιμα, ελαστικά, στάσεις —
// και η αυτόματη παραγωγή πλάνου για έναν αγώνα αντοχής.
//
// Το μοντέλο των στάσεων είναι απλοποιημένο αλλά ρεαλιστικό:
//   στάση = pit loss πίστας + service, όπου
//   service = max(ρεφιουλάρισμα, αλλαγή οδηγού) + (αλλαγή ελαστικών ? χρόνος : 0)
// δηλαδή ο οδηγός αλλάζει όσο μπαίνει βενζίνη, τα ελαστικά όχι.

import { CLASS_DEFAULTS, DEFAULT_RULES, trackInfo } from './constants.js'
import { createCarSetup, createStint } from './model.js'
import { num, round, uid } from './utils.js'

/** Τεχνικά στοιχεία αυτοκινήτου: πλάνο → προεπιλογές κατηγορίας/πίστας. */
export function resolveCar(plan, team, event) {
  const fallback = createCarSetup(team, event)
  if (!plan?.car) return fallback
  return {
    tankL: num(plan.car.tankL, fallback.tankL),
    fuelPerLapL: num(plan.car.fuelPerLapL, fallback.fuelPerLapL),
    lapTimeSec: num(plan.car.lapTimeSec, fallback.lapTimeSec),
    tyreLifeLaps: num(plan.car.tyreLifeLaps, fallback.tyreLifeLaps),
  }
}

/** Πόσους γύρους αντέχει ένα γεμάτο ρεζερβουάρ. */
export function lapsPerTank(car) {
  const perLap = Math.max(0.01, num(car.fuelPerLapL))
  return Math.max(1, Math.floor(num(car.tankL) / perLap))
}

/**
 * Υπολογίζει ολόκληρο το πλάνο. Επιστρέφει καθαρό, «παράγωγο» αντικείμενο —
 * το state δεν αλλάζει ποτέ εδώ.
 */
export function computePlan({ plan, team, event, drivers = [], rules = DEFAULT_RULES }) {
  const car = resolveCar(plan, team, event)
  const track = trackInfo(event?.trackId)
  const pitLossSec = num(track?.pitLossSec, 30)
  const driverById = new Map(drivers.map((d) => [d.id, d]))
  const targetSec = Math.max(0, num(event?.durationMinutes) * 60)

  let clock = 0
  let fuelInTank = 0
  let tyreSets = 0
  let lapsOnSet = 0
  let previousDriverId = null

  const stints = (plan?.stints || []).map((raw, index) => {
    const driver = raw.driverId ? driverById.get(raw.driverId) || null : null
    const lapTimeSec =
      num(raw.lapTimeSec) > 0
        ? num(raw.lapTimeSec)
        : Math.max(10, num(car.lapTimeSec) + num(driver?.paceDeltaSec))
    const laps = Math.max(1, Math.round(num(raw.laps, 1)))
    const drivingSec = laps * lapTimeSec

    // --- καύσιμα ---
    const needL = laps * num(car.fuelPerLapL)
    const requested = num(raw.fuelAddedL)
    const targetFuel =
      requested > 0 ? Math.min(car.tankL, fuelInTank + requested) : Math.min(car.tankL, needL)
    const refuelL = Math.max(0, targetFuel - fuelInTank)
    const fuelStart = Math.max(fuelInTank, targetFuel)
    const fuelEnd = fuelStart - needL

    // --- ελαστικά ---
    const changedTyres = index === 0 ? true : raw.tyres === 'NEW' || raw.tyres === 'USED'
    if (changedTyres) {
      if (raw.tyres !== 'USED' || index === 0) tyreSets += 1
      lapsOnSet = 0
    }
    lapsOnSet += laps

    // --- στάση πριν από αυτό το stint (το 1ο ξεκινά από τη σχάρα) ---
    const driverChanged = index > 0 && raw.driverId && raw.driverId !== previousDriverId
    let pitSec = 0
    if (index > 0) {
      const refuelSec = refuelL / Math.max(0.1, num(rules.refuelRateLps, 2.6))
      const service =
        Math.max(refuelSec, driverChanged ? num(rules.driverChangeSec, 35) : 0) +
        (changedTyres ? num(rules.tyreChangeSec, 25) : 0)
      pitSec = pitLossSec + service
    }

    const startSec = clock + pitSec
    const endSec = startSec + drivingSec
    clock = endSec
    fuelInTank = Math.max(0, fuelEnd)
    previousDriverId = raw.driverId || previousDriverId

    return {
      ...raw,
      index,
      driver,
      driverName: driver?.name || null,
      lapTimeSec,
      laps,
      drivingSec,
      pitSec,
      startSec,
      endSec,
      driverChanged,
      changedTyres,
      refuelL: round(refuelL, 1),
      fuelNeedL: round(needL, 1),
      fuelStartL: round(fuelStart, 1),
      fuelEndL: round(fuelEnd, 1),
      fuelShort: fuelEnd < -0.001,
      tyreSetNo: tyreSets,
      lapsOnSet,
      tyreOverrun: lapsOnSet > num(car.tyreLifeLaps),
      distanceKm: round(laps * num(track?.lengthKm, 0), 1),
    }
  })

  // --- συνεχόμενα μπλοκ οδήγησης (η στάση δεν διακόπτει τον χρόνο οδήγησης) ---
  const blocks = []
  stints.forEach((stint) => {
    const last = blocks[blocks.length - 1]
    if (last && last.driverId && last.driverId === stint.driverId) {
      last.endSec = stint.endSec
      last.stintIds.push(stint.id)
      last.laps += stint.laps
    } else {
      blocks.push({
        driverId: stint.driverId,
        startSec: stint.startSec,
        endSec: stint.endSec,
        laps: stint.laps,
        stintIds: [stint.id],
      })
    }
  })
  blocks.forEach((b) => {
    b.durationSec = b.endSec - b.startSec
  })

  // --- σύνολα ανά οδηγό ---
  const perDriver = []
  const seen = new Map()
  stints.forEach((stint) => {
    if (!stint.driverId) return
    let row = seen.get(stint.driverId)
    if (!row) {
      row = {
        driverId: stint.driverId,
        driver: stint.driver,
        driveSec: 0,
        laps: 0,
        stints: 0,
        longestBlockSec: 0,
        minRestSec: Infinity,
      }
      seen.set(stint.driverId, row)
      perDriver.push(row)
    }
    row.driveSec += stint.drivingSec
    row.laps += stint.laps
    row.stints += 1
  })
  perDriver.forEach((row) => {
    const own = blocks.filter((b) => b.driverId === row.driverId)
    row.blocks = own.length
    row.longestBlockSec = own.reduce((mx, b) => Math.max(mx, b.durationSec), 0)
    for (let i = 1; i < own.length; i += 1) {
      row.minRestSec = Math.min(row.minRestSec, own[i].startSec - own[i - 1].endSec)
    }
    if (!Number.isFinite(row.minRestSec)) row.minRestSec = null
    row.share = clock > 0 ? row.driveSec / clock : 0
  })
  perDriver.sort((a, b) => b.driveSec - a.driveSec)

  const drivingSec = stints.reduce((acc, s) => acc + s.drivingSec, 0)
  const pitSec = stints.reduce((acc, s) => acc + s.pitSec, 0)

  return {
    car,
    track,
    stints,
    blocks,
    perDriver,
    targetSec,
    totals: {
      drivingSec,
      pitSec,
      totalSec: clock,
      stops: Math.max(0, stints.length - 1),
      laps: stints.reduce((acc, s) => acc + s.laps, 0),
      distanceKm: round(stints.reduce((acc, s) => acc + s.distanceKm, 0), 1),
      fuelL: round(stints.reduce((acc, s) => acc + s.fuelNeedL, 0), 1),
      tyreSets,
      driverCount: perDriver.length,
    },
    coverage: targetSec > 0 ? clock / targetSec : 0,
    deltaSec: clock - targetSec,
  }
}

/**
 * Παράγει αυτόματα πλάνο stint. Στρατηγική:
 *  1. μήκος stint = ό,τι μικρότερο βγάζει το ρεζερβουάρ ή ο κανόνας μέγιστης
 *     συνεχόμενης οδήγησης,
 *  2. προσθέτουμε stint μέχρι να καλυφθεί η διάρκεια του αγώνα,
 *  3. σε κάθε stint μπαίνει ο διαθέσιμος οδηγός με τον λιγότερο χρόνο, που δεν
 *     οδήγησε μόλις πριν, που έχει ξεκουραστεί αρκετά και δεν ξεπερνά το
 *     πλαφόν ποσοστού. Αν κανείς δεν πληροί τα κριτήρια, χαλαρώνουμε τα
 *     κριτήρια με τη σειρά αντί να μείνει το stint κενό.
 */
export function generateStints({
  event,
  team,
  drivers = [],
  rules = DEFAULT_RULES,
  car,
  availability = {},
}) {
  const setup = car || createCarSetup(team, event)
  const track = trackInfo(event?.trackId)
  const pitLossSec = num(track?.pitLossSec, 30)
  const targetSec = Math.max(60, num(event?.durationMinutes) * 60)
  const lapTimeSec = Math.max(10, num(setup.lapTimeSec, 100))

  const fuelLaps = lapsPerTank(setup)
  const ruleLaps = Math.max(1, Math.floor((num(rules.maxStintMinutes, 80) * 60) / lapTimeSec))
  const stintLaps = Math.max(1, Math.min(fuelLaps, ruleLaps))
  const stintSec = stintLaps * lapTimeSec

  // Χονδρική εκτίμηση στάσης, για να βγει σωστό πλήθος stint.
  const pitEstimate =
    pitLossSec +
    Math.max(
      (stintLaps * num(setup.fuelPerLapL)) / Math.max(0.1, num(rules.refuelRateLps, 2.6)),
      num(rules.driverChangeSec, 35),
    ) +
    num(rules.tyreChangeSec, 25)

  const pool = eligibleDrivers({ team, drivers, availability, eventId: event?.id })
  const tracker = pool.map((d) => ({ driver: d, driveSec: 0, lastEndSec: -Infinity }))

  const stints = []
  let clock = 0
  let guard = 0
  while (clock < targetSec && guard < 400) {
    guard += 1
    const isFirst = stints.length === 0
    const pitSec = isFirst ? 0 : pitEstimate
    const remaining = targetSec - (clock + pitSec)
    // Το τελευταίο stint κόβεται στους γύρους που χρειάζονται.
    const cappedLaps =
      remaining <= stintSec
        ? Math.max(1, Math.min(stintLaps, Math.ceil(remaining / lapTimeSec)))
        : stintLaps
    const startSec = clock + pitSec
    const drivingSec = cappedLaps * lapTimeSec

    const pick = pickDriver({
      tracker,
      startSec,
      drivingSec,
      previousDriverId: stints[stints.length - 1]?.driverId || null,
      rules,
      targetSec,
    })
    if (pick) {
      pick.driveSec += drivingSec
      pick.lastEndSec = startSec + drivingSec
    }

    // Διπλό stint στα ελαστικά όσο αντέχουν, όπως γίνεται στην αντοχή.
    const tyreLaps = Math.max(1, num(setup.tyreLifeLaps, cappedLaps))
    const lapsOnCurrentSet = stints[stints.length - 1]?.lapsOnSet || 0
    const keepTyres = !isFirst && lapsOnCurrentSet + cappedLaps <= tyreLaps

    stints.push({
      ...createStint({
        id: uid('st'),
        driverId: pick?.driver.id || null,
        laps: cappedLaps,
        lapTimeSec: 0,
        fuelAddedL: 0, // 0 = «βάλε όσο χρειάζεται»
        tyres: keepTyres ? 'KEEP' : 'NEW',
        compound: 'MEDIUM',
      }),
      lapsOnSet: keepTyres ? lapsOnCurrentSet + cappedLaps : cappedLaps,
    })
    clock = startSec + drivingSec
  }

  // Το `lapsOnSet` ήταν βοηθητικό για τη λογική των ελαστικών — δεν το κρατάμε.
  const clean = stints.map((stint) => {
    const copy = { ...stint }
    delete copy.lapsOnSet
    return copy
  })

  // Ο βρόχος από πάνω δουλεύει με *εκτίμηση* της στάσης. Εδώ ελέγχουμε το πλάνο
  // με τα πραγματικά μαθηματικά (computePlan) και συμπληρώνουμε γύρους μέχρι να
  // καλυφθεί ο αγώνας — αλλιώς μπορεί να βγει μισό λεπτό κοντός.
  return topUpCoverage({ stints: clean, setup, team, event, drivers, rules, stintLaps, tracker })
}

/**
 * Προσθέτει γύρους (ή ένα ακόμη stint) όσο το πλάνο δεν φτάνει τη διάρκεια του
 * αγώνα. Πάντα τελειώνει λίγο *μετά* το τέλος — έτσι γίνεται και στην
 * πραγματικότητα, ο αγώνας κλείνει με τον γύρο που περνά τη γραμμή.
 */
function topUpCoverage({ stints, setup, team, event, drivers, rules, stintLaps, tracker }) {
  let current = stints
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const computed = computePlan({
      plan: { car: setup, stints: current },
      team,
      event,
      drivers,
      rules,
    })
    if (computed.deltaSec >= 0) return current

    const missingSec = -computed.deltaSec
    const last = current[current.length - 1]
    if (!last) return current
    const lapTimeSec = computed.stints[computed.stints.length - 1]?.lapTimeSec || 60
    const extraLaps = Math.max(1, Math.ceil(missingSec / lapTimeSec))

    if (last.laps + extraLaps <= stintLaps) {
      current = current.map((s) => (s.id === last.id ? { ...s, laps: s.laps + extraLaps } : s))
    } else if (last.laps < stintLaps) {
      current = current.map((s) => (s.id === last.id ? { ...s, laps: stintLaps } : s))
    } else {
      // Το τελευταίο stint είναι γεμάτο — χρειάζεται ένα ακόμη.
      const pick = pickDriver({
        tracker,
        startSec: computed.totals.totalSec,
        drivingSec: extraLaps * lapTimeSec,
        previousDriverId: last.driverId,
        rules,
        targetSec: computed.targetSec,
      })
      if (pick) {
        pick.driveSec += extraLaps * lapTimeSec
        pick.lastEndSec = computed.totals.totalSec + extraLaps * lapTimeSec
      }
      current = [
        ...current,
        createStint({
          id: uid('st'),
          driverId: pick?.driver.id || last.driverId,
          laps: Math.min(stintLaps, extraLaps),
          lapTimeSec: 0,
          fuelAddedL: 0,
          tyres: 'NEW',
          compound: last.compound,
        }),
      ]
    }
  }
  return current
}

/** Οι οδηγοί της ομάδας που μπορούν να μπουν στο πλάνο, με σειρά προτίμησης. */
export function eligibleDrivers({ team, drivers, availability = {}, eventId }) {
  const map = availability?.[eventId] || {}
  const roster = (team?.driverIds || [])
    .map((id) => drivers.find((d) => d.id === id))
    .filter(Boolean)
  const rank = { YES: 0, UNKNOWN: 1, MAYBE: 2, NO: 3 }
  return roster
    .filter((d) => map[d.id] !== 'NO')
    .sort((a, b) => (rank[map[a.id] || 'UNKNOWN'] ?? 1) - (rank[map[b.id] || 'UNKNOWN'] ?? 1))
}

function pickDriver({ tracker, startSec, drivingSec, previousDriverId, rules, targetSec }) {
  if (!tracker.length) return null
  const maxShareSec = num(rules.maxDriveShare, 0.65) * targetSec
  const minRestSec = num(rules.minRestMinutes, 45) * 60

  const sorted = [...tracker].sort((a, b) => a.driveSec - b.driveSec)
  const tests = [
    // 1. ιδανικά: άλλος οδηγός, ξεκούραστος, μέσα στο πλαφόν
    (t) =>
      t.driver.id !== previousDriverId &&
      startSec - t.lastEndSec >= minRestSec &&
      t.driveSec + drivingSec <= maxShareSec,
    // 2. χαλαρώνουμε την ξεκούραση
    (t) => t.driver.id !== previousDriverId && t.driveSec + drivingSec <= maxShareSec,
    // 3. χαλαρώνουμε το πλαφόν
    (t) => t.driver.id !== previousDriverId,
    // 4. τελευταία λύση: όποιος έχει οδηγήσει λιγότερο
    () => true,
  ]
  for (const test of tests) {
    const found = sorted.find(test)
    if (found) return found
  }
  return sorted[0]
}

/** Προτεινόμενα τεχνικά στοιχεία όταν αλλάζει κατηγορία/πίστα. */
export function suggestCar(team, event) {
  const defaults = CLASS_DEFAULTS[team?.carClass] || CLASS_DEFAULTS.LMP2
  const track = trackInfo(event?.trackId)
  return {
    tankL: defaults.tankL,
    fuelPerLapL: round(defaults.fuelPerKm * num(track?.lengthKm, 5), 2),
    lapTimeSec: num(track?.refLap?.[team?.carClass], 100),
    tyreLifeLaps: Math.max(4, Math.round(defaults.tyreLifeKm / num(track?.lengthKm, 5))),
  }
}
