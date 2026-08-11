// Η μηχανή κανόνων του πλάνου. Παίρνει το υπολογισμένο πλάνο (computePlan) και
// βγάζει λίστα ελέγχων. Κάθε έλεγχος έχει `level`:
//   'error' → το πλάνο δεν είναι νόμιμο / δεν βγαίνει ο αγώνας
//   'warn'  → βγαίνει, αλλά είναι ρίσκο
//   'ok'    → πέρασε
//
// Οι κανόνες είναι εμπνευσμένοι από τους κανονισμούς αντοχής (μέγιστη
// συνεχόμενη οδήγηση, ελάχιστη ξεκούραση, πλαφόν χρόνου ανά οδηγό, ελάχιστος
// χρόνος για Am οδηγό) αλλά ρυθμίζονται όλοι από τον διοργανωτή.

import { AM_CATEGORIES, DEFAULT_RULES } from './constants.js'
import { formatClock, formatMinutes, num } from './utils.js'

const LEVEL_WEIGHT = { error: 0, warn: 1, ok: 2 }

function check(level, code, title, detail) {
  return { level, code, title, detail }
}

/**
 * @param computed αποτέλεσμα του computePlan
 * @returns { checks, errors, warnings, passed, ok, score }
 */
export function validatePlan({
  computed,
  plan,
  team,
  event,
  drivers = [],
  availability = {},
  rules = DEFAULT_RULES,
}) {
  const checks = []
  const r = { ...DEFAULT_RULES, ...rules }
  const { stints, perDriver, blocks, totals, targetSec, deltaSec } = computed
  const driverById = new Map(drivers.map((d) => [d.id, d]))
  const availabilityMap = availability?.[event?.id] || {}
  const roster = new Set(team?.driverIds || [])
  const name = (id) => driverById.get(id)?.name || 'Άγνωστος οδηγός'

  if (!stints.length) {
    return {
      checks: [check('error', 'EMPTY', 'Το πλάνο είναι κενό', 'Πρόσθεσε stint ή πάτα «Αυτόματο πλάνο».')],
      errors: 1,
      warnings: 0,
      passed: 0,
      ok: false,
      score: 0,
    }
  }

  /* --- 1. Καλύπτει τη διάρκεια του αγώνα; --- */
  const oneStintSec = totals.totalSec / stints.length
  if (deltaSec < -30) {
    checks.push(
      check(
        'error',
        'COVERAGE_SHORT',
        'Το πλάνο δεν καλύπτει τον αγώνα',
        `Λείπουν ${formatMinutes(Math.abs(deltaSec) / 60)} από τη διάρκεια (${formatMinutes(
          targetSec / 60,
        )}). Πρόσθεσε γύρους ή ένα stint.`,
      ),
    )
  } else if (deltaSec > oneStintSec) {
    checks.push(
      check(
        'warn',
        'COVERAGE_LONG',
        'Το πλάνο είναι πολύ μακρύ',
        `Ξεπερνά τη διάρκεια κατά ${formatMinutes(
          deltaSec / 60,
        )} — δηλαδή περίπου ένα stint παραπάνω απ' όσο χρειάζεται.`,
      ),
    )
  } else {
    checks.push(
      check(
        'ok',
        'COVERAGE',
        'Καλύπτει τη διάρκεια',
        `Σύνολο ${formatMinutes(totals.totalSec / 60)} για αγώνα ${formatMinutes(
          targetSec / 60,
        )} (${totals.laps} γύροι, ${totals.stops} στάσεις).`,
      ),
    )
  }

  /* --- 2. Πλήθος οδηγών --- */
  const unassigned = stints.filter((s) => !s.driverId)
  if (unassigned.length) {
    checks.push(
      check(
        'error',
        'UNASSIGNED',
        `${unassigned.length} stint χωρίς οδηγό`,
        `Χωρίς οδηγό: ${unassigned.map((s) => `#${s.index + 1}`).join(', ')}.`,
      ),
    )
  }
  if (totals.driverCount < num(r.minDriversPerCar, 2)) {
    checks.push(
      check(
        'error',
        'MIN_DRIVERS',
        'Λίγοι οδηγοί στο αυτοκίνητο',
        `Ο κανονισμός θέλει τουλάχιστον ${r.minDriversPerCar} οδηγούς, το πλάνο έχει ${totals.driverCount}.`,
      ),
    )
  } else if (totals.driverCount > num(r.maxDriversPerCar, 4)) {
    checks.push(
      check(
        'error',
        'MAX_DRIVERS',
        'Πολλοί οδηγοί στο αυτοκίνητο',
        `Επιτρέπονται έως ${r.maxDriversPerCar}, το πλάνο έχει ${totals.driverCount}.`,
      ),
    )
  } else {
    checks.push(
      check(
        'ok',
        'DRIVERS',
        `${totals.driverCount} οδηγοί`,
        `Μέσα στα όρια (${r.minDriversPerCar}–${r.maxDriversPerCar}).`,
      ),
    )
  }

  /* --- 3. Καύσιμα --- */
  const short = stints.filter((s) => s.fuelShort)
  if (short.length) {
    checks.push(
      check(
        'error',
        'FUEL',
        'Δεν βγαίνουν τα καύσιμα',
        `Το stint ${short
          .map((s) => `#${s.index + 1}`)
          .join(', ')} ζητά περισσότερα λίτρα απ' όσα χωράει το ρεζερβουάρ (${
          computed.car.tankL
        } L). Λιγότεροι γύροι ή περισσότερες στάσεις.`,
      ),
    )
  } else {
    checks.push(
      check('ok', 'FUEL', 'Τα καύσιμα βγαίνουν', `Συνολικά ${totals.fuelL} L σε ${totals.stops} στάσεις.`),
    )
  }

  /* --- 4. Ελαστικά --- */
  const overrun = stints.filter((s) => s.tyreOverrun)
  if (overrun.length) {
    checks.push(
      check(
        'warn',
        'TYRE_LIFE',
        'Τα ελαστικά τραβάνε πάνω από τη ζωή τους',
        `Στα stint ${overrun
          .map((s) => `#${s.index + 1}`)
          .join(', ')} το σετ περνά τους ${computed.car.tyreLifeLaps} γύρους. Περίμενε πτώση ρυθμού.`,
      ),
    )
  }
  if (totals.tyreSets > num(r.tyreSetsPerEvent, 8)) {
    checks.push(
      check(
        'error',
        'TYRE_SETS',
        'Ξεπερνάς τα διαθέσιμα σετ ελαστικών',
        `Το πλάνο χρησιμοποιεί ${totals.tyreSets} σετ, το όριο του αγώνα είναι ${r.tyreSetsPerEvent}.`,
      ),
    )
  } else {
    checks.push(
      check(
        'ok',
        'TYRE_SETS',
        `${totals.tyreSets} σετ ελαστικών`,
        `Όριο αγώνα: ${r.tyreSetsPerEvent} σετ.`,
      ),
    )
  }

  /* --- 5. Μέγιστη συνεχόμενη οδήγηση --- */
  const maxBlockSec = num(r.maxStintMinutes, 80) * 60
  const tooLong = blocks.filter((b) => b.driverId && b.durationSec > maxBlockSec + 1)
  if (tooLong.length) {
    tooLong.forEach((b) => {
      checks.push(
        check(
          'error',
          'MAX_STINT',
          `${name(b.driverId)}: υπερβολικά μεγάλο σερί`,
          `Οδηγεί ${formatMinutes(b.durationSec / 60)} συνεχόμενα (από ${formatClock(
            b.startSec,
          )}) — το όριο είναι ${formatMinutes(r.maxStintMinutes)}.`,
        ),
      )
    })
  } else {
    checks.push(
      check(
        'ok',
        'MAX_STINT',
        'Κανένα σερί πάνω από το όριο',
        `Μέγιστο συνεχόμενο: ${formatMinutes(
          Math.max(0, ...blocks.map((b) => b.durationSec)) / 60,
        )} (όριο ${formatMinutes(r.maxStintMinutes)}).`,
      ),
    )
  }

  /* --- 6. Ξεκούραση --- */
  const minRestSec = num(r.minRestMinutes, 45) * 60
  const notRested = perDriver.filter((d) => d.minRestSec !== null && d.minRestSec < minRestSec - 1)
  if (notRested.length) {
    notRested.forEach((d) => {
      checks.push(
        check(
          'error',
          'REST',
          `${name(d.driverId)}: λίγη ξεκούραση`,
          `Ξαναμπαίνει μετά από ${formatMinutes(d.minRestSec / 60)} — ο κανονισμός θέλει ${formatMinutes(
            r.minRestMinutes,
          )}. Βάλε άλλον οδηγό ενδιάμεσα.`,
        ),
      )
    })
  } else if (perDriver.some((d) => d.minRestSec !== null)) {
    checks.push(check('ok', 'REST', 'Η ξεκούραση τηρείται', `Όριο: ${formatMinutes(r.minRestMinutes)}.`))
  }

  /* --- 7. Πλαφόν και ελάχιστος χρόνος ανά οδηγό --- */
  const maxShareSec = num(r.maxDriveShare, 0.65) * targetSec
  const minDriveSec = num(r.minDriveMinutes, 0) * 60
  perDriver.forEach((d) => {
    if (d.driveSec > maxShareSec + 1) {
      checks.push(
        check(
          'error',
          'SHARE',
          `${name(d.driverId)}: πάνω από το πλαφόν`,
          `Οδηγεί ${formatMinutes(d.driveSec / 60)} (${Math.round(
            d.share * 100,
          )}% του αγώνα) — το πλαφόν είναι ${Math.round(num(r.maxDriveShare) * 100)}%, δηλαδή ${formatMinutes(
            maxShareSec / 60,
          )}.`,
        ),
      )
    }
    if (minDriveSec > 0 && d.driveSec < minDriveSec - 1) {
      checks.push(
        check(
          'warn',
          'MIN_DRIVE',
          `${name(d.driverId)}: κάτω από τον ελάχιστο χρόνο`,
          `Οδηγεί ${formatMinutes(d.driveSec / 60)}, ο κανονισμός θέλει ${formatMinutes(
            r.minDriveMinutes,
          )} για κάθε δηλωμένο οδηγό.`,
        ),
      )
    }
  })
  if (perDriver.length && perDriver.every((d) => d.driveSec <= maxShareSec + 1)) {
    checks.push(
      check(
        'ok',
        'SHARE',
        'Η μοιρασιά είναι νόμιμη',
        `Ο πιο φορτωμένος οδηγός: ${Math.round((perDriver[0]?.share || 0) * 100)}% (πλαφόν ${Math.round(
          num(r.maxDriveShare) * 100,
        )}%).`,
      ),
    )
  }

  /* --- 8. Ελάχιστος χρόνος για Silver/Bronze --- */
  const minAmSec = num(r.minAmDriveMinutes, 0) * 60
  if (minAmSec > 0) {
    const amSec = perDriver
      .filter((d) => AM_CATEGORIES.includes(driverById.get(d.driverId)?.category))
      .reduce((acc, d) => acc + d.driveSec, 0)
    if (amSec < minAmSec - 1) {
      checks.push(
        check(
          'error',
          'AM_TIME',
          'Λίγος χρόνος για Silver/Bronze',
          `Οι Am οδηγοί οδηγούν ${formatMinutes(amSec / 60)}, ο κανονισμός θέλει ${formatMinutes(
            r.minAmDriveMinutes,
          )}.`,
        ),
      )
    } else {
      checks.push(
        check(
          'ok',
          'AM_TIME',
          'Ο χρόνος Am τηρείται',
          `${formatMinutes(amSec / 60)} από ${formatMinutes(r.minAmDriveMinutes)}.`,
        ),
      )
    }
  }

  /* --- 9. Roster & διαθεσιμότητα --- */
  const outsiders = perDriver.filter((d) => d.driverId && !roster.has(d.driverId))
  if (outsiders.length) {
    checks.push(
      check(
        'error',
        'ROSTER',
        'Οδηγός εκτός ομάδας',
        `${outsiders.map((d) => name(d.driverId)).join(', ')} δεν είναι στο roster της ομάδας.`,
      ),
    )
  }
  const unavailable = perDriver.filter((d) => availabilityMap[d.driverId] === 'NO')
  const uncertain = perDriver.filter(
    (d) => !availabilityMap[d.driverId] || availabilityMap[d.driverId] === 'MAYBE',
  )
  if (unavailable.length) {
    checks.push(
      check(
        'error',
        'AVAILABILITY',
        'Οδηγός δήλωσε ότι δεν είναι διαθέσιμος',
        `${unavailable.map((d) => name(d.driverId)).join(', ')} — έχει δηλώσει «Μη διαθέσιμος» γι' αυτόν τον αγώνα.`,
      ),
    )
  }
  if (uncertain.length) {
    checks.push(
      check(
        'warn',
        'AVAILABILITY_SOFT',
        'Αβέβαιη διαθεσιμότητα',
        `${uncertain
          .map((d) => name(d.driverId))
          .join(', ')} δεν έχει επιβεβαιώσει. Ζήτα δήλωση πριν υποβάλεις το πλάνο.`,
      ),
    )
  }

  /* --- 10. Deadline --- */
  const lockHours = num(r.planLockHoursBefore, 0)
  if (lockHours > 0 && event?.dateISO) {
    const hoursLeft = (new Date(event.dateISO).getTime() - Date.now()) / 3600000
    if (Number.isFinite(hoursLeft) && hoursLeft > 0 && hoursLeft < lockHours && plan?.status === 'DRAFT') {
      checks.push(
        check(
          'warn',
          'DEADLINE',
          'Πλησιάζει το deadline υποβολής',
          `Μένουν ${Math.round(hoursLeft)} ώρες για τον αγώνα και το πλάνο είναι ακόμα πρόχειρο (κλείδωμα ${lockHours}ω πριν).`,
        ),
      )
    }
  }

  checks.sort((a, b) => LEVEL_WEIGHT[a.level] - LEVEL_WEIGHT[b.level])
  const errors = checks.filter((c) => c.level === 'error').length
  const warnings = checks.filter((c) => c.level === 'warn').length
  const passed = checks.filter((c) => c.level === 'ok').length
  const total = errors + warnings + passed

  return {
    checks,
    errors,
    warnings,
    passed,
    ok: errors === 0,
    // 0-100: τα errors κοστίζουν διπλά από τα warnings.
    score: total ? Math.max(0, Math.round(((passed + warnings * 0.5) / total) * 100)) : 0,
  }
}

/** Μπορεί η ομάδα να υποβάλει το πλάνο; (χωρίς errors) */
export function canSubmit(validation) {
  return Boolean(validation?.ok)
}
