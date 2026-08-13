/**
 * Εικονικό αυτοκίνητο και πίστα — η «πηγή αλήθειας» για το real test.
 *
 * Παίζει τον ρόλο που έχει το SimHub όταν διαβάζει το παιχνίδι: παράγει
 * στροφές, ταχύτητα, γρανάζι, ABS, ολίσθηση, καύσιμο, χρόνους γύρου και
 * σημαίες, τα οποία καταναλώνουν οι έξοδοι της κατασκευής σου.
 *
 * Δεν είναι μοντέλο φυσικής ακριβείας — είναι ρυθμισμένο ώστε τα σήματα
 * (rev lights, ABS δόνηση, delta) να συμπεριφέρονται σαν αληθινά.
 */

const REDLINE = 7600
const IDLE_RPM = 950
const GEAR_RATIOS = [3.25, 1.95, 1.4, 1.09, 0.87, 0.72]
const FINAL_DRIVE = 4.4
const TYRE_CIRC_M = 1.95
const MAX_ACCEL_MS2 = 5.6
const MAX_BRAKE_MS2 = 12.5
const DRAG_K = 0.00017
const FUEL_TANK_L = 45
const FUEL_PER_REV = 0.0000021

/** Πίστες: μια λίστα «σημείων φρεναρίσματος» με ταχύτητα απόσβεσης. */
export const TRACKS = [
  {
    id: 'club',
    name: 'Τεχνική πίστα (club)',
    lengthM: 2400,
    corners: [
      { at: 320, apexKmh: 85, kerb: true },
      { at: 640, apexKmh: 120, kerb: false },
      { at: 980, apexKmh: 60, kerb: true },
      { at: 1320, apexKmh: 145, kerb: false },
      { at: 1560, apexKmh: 70, kerb: true },
      { at: 1900, apexKmh: 100, kerb: false },
      { at: 2250, apexKmh: 55, kerb: true },
    ],
  },
  {
    id: 'fast',
    name: 'Γρήγορη πίστα (Monza style)',
    lengthM: 5700,
    corners: [
      { at: 800, apexKmh: 70, kerb: true },
      { at: 1700, apexKmh: 210, kerb: false },
      { at: 2600, apexKmh: 90, kerb: true },
      { at: 3400, apexKmh: 190, kerb: false },
      { at: 4200, apexKmh: 130, kerb: true },
      { at: 5100, apexKmh: 105, kerb: false },
    ],
  },
  {
    id: 'oval',
    name: 'Οβάλ (σταθερό σήμα)',
    lengthM: 1800,
    corners: [
      { at: 500, apexKmh: 170, kerb: false },
      { at: 1400, apexKmh: 170, kerb: false },
    ],
  },
]

export function getTrack(id) {
  return TRACKS.find((t) => t.id === id) || TRACKS[0]
}

export function createTelemetry(trackId = 'club') {
  return {
    trackId,
    mode: 'lap',
    t: 0,
    distanceM: 0,
    speedKmh: 0,
    rpm: IDLE_RPM,
    maxRpm: REDLINE,
    gear: 1,
    throttle: 0,
    brake: 0,
    clutch: 0,
    steer: 0,
    boostBar: 0,
    waterC: 82,
    oilBar: 3.2,
    fuelL: FUEL_TANK_L,
    fuelPct: 100,
    abs: false,
    tc: false,
    slip: 0,
    kerb: 0,
    pitLimiter: false,
    flag: 'none',
    lap: 1,
    lapTime: 0,
    lastLap: 0,
    bestLap: 0,
    delta: 0,
    sector: 1,
    _bestTrace: null,
    _trace: [],
    _flagTimer: 8 + Math.random() * 25,
  }
}

const TOP_KMH = 255

/**
 * Ταχύτητα-στόχος για μια θέση στην πίστα (m).
 *
 * Η ζώνη φρεναρίσματος κάθε στροφής βγαίνει από την πτώση ταχύτητας που
 * απαιτεί — όχι σταθερή — ώστε οι μεγάλες ευθείες να μένουν ευθείες.
 */
function targetSpeed(track, distanceM) {
  let target = TOP_KMH
  for (const corner of track.corners) {
    // Ζώνη πέδησης: v² = 2·a·s με a ≈ 1.2g.
    const vTop = TOP_KMH / 3.6
    const vApex = corner.apexKmh / 3.6
    const zoneM = Math.max(50, (vTop * vTop - vApex * vApex) / (2 * MAX_BRAKE_MS2))

    // Απόσταση μέχρι τη στροφή (κυκλικά).
    let d = corner.at - distanceM
    if (d < -50) d += track.lengthM
    if (d > -50 && d < zoneM) {
      const ratio = Math.max(0, Math.min(1, d / zoneM))
      const allowed = corner.apexKmh + (TOP_KMH - corner.apexKmh) * ratio ** 1.6
      target = Math.min(target, allowed)
    }
  }
  return target
}

function kerbAt(track, distanceM) {
  for (const corner of track.corners) {
    if (!corner.kerb) continue
    const d = Math.abs(corner.at - distanceM)
    if (d < 35) return 1 - d / 35
  }
  return 0
}

function pickGear(speedKmh, currentGear) {
  const rpmFor = (g) => ((speedKmh / 3.6) / TYRE_CIRC_M) * 60 * GEAR_RATIOS[g] * FINAL_DRIVE
  let gear = currentGear
  if (rpmFor(gear) > REDLINE * 0.94 && gear < GEAR_RATIOS.length - 1) gear += 1
  if (rpmFor(gear) < 3200 && gear > 0) gear -= 1
  return Math.max(0, Math.min(GEAR_RATIOS.length - 1, gear))
}

function rpmFromSpeed(speedKmh, gear) {
  const wheelHz = (speedKmh / 3.6) / TYRE_CIRC_M
  const rpm = wheelHz * 60 * GEAR_RATIOS[gear] * FINAL_DRIVE
  return Math.max(IDLE_RPM, Math.min(REDLINE * 1.02, rpm))
}

/**
 * Ένα βήμα προσομοίωσης.
 *
 * @param {object} s   κατάσταση (μεταβάλλεται επί τόπου)
 * @param {number} dt  δευτερόλεπτα
 * @param {object} manual  { throttle, brake, gear, pitLimiter, flag } στη χειροκίνητη λειτουργία
 */
export function stepTelemetry(s, dt, manual = null) {
  const track = getTrack(s.trackId)
  s.t += dt

  if (s.mode === 'manual' && manual) {
    s.throttle = manual.throttle ?? 0
    s.brake = manual.brake ?? 0
    s.gear = manual.gear ?? s.gear
    s.pitLimiter = !!manual.pitLimiter
    s.flag = manual.flag || 'none'
    const targetRpm = IDLE_RPM + (REDLINE - IDLE_RPM) * s.throttle
    s.rpm += (targetRpm - s.rpm) * Math.min(1, dt * 6)
    s.speedKmh = Math.max(
      0,
      ((s.rpm / (GEAR_RATIOS[s.gear] * FINAL_DRIVE)) / 60) * TYRE_CIRC_M * 3.6
    )
    s.slip = s.throttle > 0.85 && s.gear < 2 ? (s.throttle - 0.85) * 6 : 0
    s.abs = s.brake > 0.8
    s.tc = s.slip > 0.25
  } else {
    /* -------- Αυτόματος οδηγός -------- */
    const target = targetSpeed(track, s.distanceM)
    const err = target - s.speedKmh

    if (err > 2) {
      s.throttle = Math.min(1, s.throttle + dt * 4)
      s.brake = Math.max(0, s.brake - dt * 8)
    } else if (err < -3) {
      s.brake = Math.min(1, s.brake + dt * 5)
      s.throttle = Math.max(0, s.throttle - dt * 10)
    } else {
      s.throttle = Math.max(0.15, s.throttle - dt * 2)
      s.brake = Math.max(0, s.brake - dt * 6)
    }
    if (s.pitLimiter) s.throttle = Math.min(s.throttle, s.speedKmh < 78 ? 0.35 : 0)

    const dragKmh = DRAG_K * s.speedKmh * s.speedKmh
    const accel = s.throttle * MAX_ACCEL_MS2 * (1 - s.gear * 0.11) - s.brake * MAX_BRAKE_MS2
    s.speedKmh = Math.max(0, s.speedKmh + (accel * 3.6 - dragKmh) * dt)

    s.gear = pickGear(s.speedKmh, s.gear)
    s.rpm += (rpmFromSpeed(s.speedKmh, s.gear) - s.rpm) * Math.min(1, dt * 12)

    // ABS / ολίσθηση
    s.abs = s.brake > 0.65 && s.speedKmh > 25
    s.slip = s.throttle > 0.9 && s.gear <= 1 ? (s.throttle - 0.9) * 8 : 0
    s.tc = s.slip > 0.2

    s.distanceM += (s.speedKmh / 3.6) * dt
    s.lapTime += dt

    if (s.distanceM >= track.lengthM) {
      s.distanceM -= track.lengthM
      s.lastLap = s.lapTime
      if (!s.bestLap || s.lapTime < s.bestLap) {
        s.bestLap = s.lapTime
        s._bestTrace = s._trace
      }
      s._trace = []
      s.lapTime = 0
      s.lap += 1
    }

    // Καταγραφή για delta (ένα δείγμα ανά 20 μέτρα).
    const bucket = Math.floor(s.distanceM / 20)
    if (s._trace.length <= bucket) s._trace[bucket] = s.lapTime
    if (s._bestTrace && s._bestTrace[bucket] != null) {
      s.delta = s.lapTime - s._bestTrace[bucket]
    }
    s.sector = Math.min(3, Math.floor((s.distanceM / track.lengthM) * 3) + 1)
  }

  /* -------- Κοινά -------- */
  s.kerb = kerbAt(track, s.distanceM) * (s.speedKmh > 40 ? 1 : 0)
  s.boostBar = Math.max(0, Math.min(1.2, s.throttle * (s.rpm / REDLINE) * 1.35 - 0.12))
  s.waterC += ((78 + (s.rpm / REDLINE) * 22 - s.waterC) * dt) / 12
  s.oilBar = 1.1 + (s.rpm / REDLINE) * 3.4
  s.fuelL = Math.max(0, s.fuelL - s.rpm * s.throttle * FUEL_PER_REV * dt * 60)
  s.fuelPct = (s.fuelL / FUEL_TANK_L) * 100

  // Σημαίες: εμφανίζονται περιοδικά για να δοκιμάζεις τα LED.
  s._flagTimer -= dt
  if (s._flagTimer <= 0) {
    const flags = ['none', 'none', 'yellow', 'blue', 'white']
    s.flag = flags[Math.floor(Math.random() * flags.length)]
    s._flagTimer = 6 + Math.random() * 20
  }

  return s
}

/** Στιγμιότυπο χωρίς τα εσωτερικά πεδία — αυτό «βλέπει» το firmware. */
export function telemetrySnapshot(s) {
  return {
    rpm: Math.round(s.rpm),
    maxRpm: s.maxRpm,
    rpmPct: (s.rpm / s.maxRpm) * 100,
    gear: s.gear + 1,
    speedKmh: Math.round(s.speedKmh),
    throttle: s.throttle,
    brake: s.brake,
    boostBar: s.boostBar,
    waterC: s.waterC,
    oilBar: s.oilBar,
    fuelL: s.fuelL,
    fuelPct: s.fuelPct,
    abs: s.abs,
    tc: s.tc,
    slip: s.slip,
    kerb: s.kerb,
    pitLimiter: s.pitLimiter,
    flag: s.flag,
    lap: s.lap,
    lapTime: s.lapTime,
    lastLap: s.lastLap,
    bestLap: s.bestLap,
    delta: s.delta,
    sector: s.sector,
  }
}

export function formatLapTime(seconds) {
  if (!seconds) return '--:--.---'
  const m = Math.floor(seconds / 60)
  const rest = seconds - m * 60
  return `${m}:${rest.toFixed(3).padStart(6, '0')}`
}
