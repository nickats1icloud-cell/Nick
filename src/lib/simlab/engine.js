/**
 * Η μηχανή προσομοίωσης — εδώ γίνεται το «real test».
 *
 * Δεν ζωγραφίζει απλώς κινούμενα σχέδια: μοντελοποιεί τα πράγματα που
 * χαλάνε στην πράξη —
 *   • αναπήδηση επαφών και ψεύτικα πατήματα όταν λείπει το debounce
 *   • κβαντισμό και θόρυβο του ADC, με φίλτρα που τα διορθώνουν
 *   • χαμένα βήματα encoder όταν ο βρόχος είναι αργός
 *   • πτώση τάσης (brownout) και reset όταν τραβάς πάνω από το USB
 *   • πραγματική κατανάλωση της ταινίας LED από τα χρώματα που ανάβουν
 *
 * Ο βρόχος του firmware τρέχει στη συχνότητα που υπολόγισε το firmware.js,
 * όχι στη συχνότητα της οθόνης — γι' αυτό μια αργή οθόνη «σκοτώνει» τα κουμπιά.
 */

import { formatLapTime } from './telemetry.js'

const MAX_ITERATIONS_PER_FRAME = 240
const SCOPE_SAMPLES = 260
const SERIAL_LINES = 60
const BROWNOUT_RESET_MS = 900
/** Ρεύμα ανά κανάλι LED στο μέγιστο (πράσινο+κόκκινο+μπλε = 60mA). */
const MA_PER_CHANNEL = 20

export function createEngine() {
  return {
    time: 0,
    running: false,
    nodes: {},
    hid: { buttons: [], axes: {}, connected: false },
    serial: [],
    scope: { samples: [], channels: [] },
    stats: {
      loopHz: 0,
      iterations: 0,
      currentMa: 0,
      peakMa: 0,
      brownout: false,
      resets: 0,
      missedSteps: 0,
      ghostPresses: 0,
      hidReports: 0,
    },
    _resetUntil: 0,
    _bootAt: 0,
    _serialAcc: 0,
  }
}

/* ------------------------------------------------------------------ */
/* Βοηθητικά                                                           */
/* ------------------------------------------------------------------ */

function gaussian() {
  // Box-Muller — θόρυβος πιο ρεαλιστικός από το uniform random.
  const u = Math.random() || 1e-9
  const v = Math.random() || 1e-9
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Παράγει «τρένο» αναπηδήσεων για μια μετάβαση επαφής. */
function makeBounce(durationMs, targetHigh) {
  if (durationMs <= 0) return []
  const edges = []
  let t = 0
  let level = !targetHigh
  while (t < durationMs) {
    t += 0.15 + Math.random() * (durationMs / 4)
    level = !level
    edges.push({ t, level })
  }
  edges.push({ t: durationMs, level: targetHigh })
  return edges
}

function bounceLevel(state, elapsedMs) {
  if (!state.bounce || state.bounce.length === 0) return state.target
  if (elapsedMs >= state.bounce[state.bounce.length - 1].t) return state.target
  let level = !state.target
  for (const e of state.bounce) {
    if (elapsedMs >= e.t) level = e.level
    else break
  }
  return level
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

/* ------------------------------------------------------------------ */
/* Αρχικοποίηση κατάστασης κόμβου                                      */
/* ------------------------------------------------------------------ */

function initNode(entry) {
  const base = { kind: entry.kind, label: entry.label }
  switch (entry.kind) {
    case 'button':
      return { ...base, target: false, raw: false, debounced: false, bounce: [], edgeAt: -1e9, presses: 0, ghosts: 0, latched: false }
    case 'encoder':
      return { ...base, angle: 0, lastQuad: 0, counts: 0, missed: 0, cwUntil: 0, ccwUntil: 0, swTarget: false, swDebounced: false, axis: 0.5 }
    case 'matrix':
      return { ...base, pressed: new Set(), ghosts: 0 }
    case 'expander':
      return { ...base, pressed: new Set() }
    case 'analog':
      return { ...base, position: 0.5, counts: 0, filtered: 0, axis: 0 }
    case 'hx711':
      return { ...base, forceKg: 0, counts: 0, filtered: 0, axis: 0, avgBuf: [], nextSampleAt: 0 }
    case 'ads1115':
      return { ...base, positions: [0.5, 0.5, 0.5, 0.5], axes: [0, 0, 0, 0] }
    case 'ledstrip':
      return { ...base, pixels: [], currentMa: 0, blinkPhase: 0 }
    case 'led':
      return { ...base, on: false, duty: 0 }
    case 'sevenseg':
      return { ...base, text: '----', nextUpdate: 0 }
    case 'display':
      return { ...base, lines: [], nextUpdate: 0, frames: 0 }
    case 'gauge':
      return { ...base, angle: 0, targetAngle: 0, lagging: false }
    case 'servo':
      return { ...base, angle: 0, targetAngle: 0 }
    case 'fan':
      return { ...base, duty: 0, rpm: 0 }
    case 'haptic':
      return { ...base, duty: 0, phase: 0 }
    case 'buzzer':
      return { ...base, on: false }
    default:
      return base
  }
}

/* ------------------------------------------------------------------ */
/* Έξοδοι: υπολογισμός από την τηλεμετρία                              */
/* ------------------------------------------------------------------ */

const FLAG_COLORS = {
  yellow: [255, 190, 0],
  blue: [0, 110, 255],
  white: [200, 200, 200],
  red: [255, 0, 0],
  none: [0, 0, 0],
}

function revPixels(values, tel, phaseOn) {
  const count = values.ledCount || 16
  const start = values.startPct || 70
  const shift = values.shiftPct || 96
  const bright = (values.brightness || 40) / 100
  const pct = tel.rpmPct
  const pixels = new Array(count)

  const shiftNow = pct >= shift
  for (let i = 0; i < count; i += 1) {
    const threshold = start + ((shift - start) * i) / Math.max(1, count - 1)
    let rgb = [0, 0, 0]
    if (shiftNow) {
      rgb = phaseOn ? [80, 120, 255] : [0, 0, 0]
    } else if (pct >= threshold) {
      const frac = i / Math.max(1, count - 1)
      if (frac < 0.45) rgb = [0, 255, 60]
      else if (frac < 0.78) rgb = [255, 170, 0]
      else rgb = [255, 20, 20]
    }
    pixels[i] = [
      Math.round(rgb[0] * bright),
      Math.round(rgb[1] * bright),
      Math.round(rgb[2] * bright),
    ]
  }
  return pixels
}

function flagPixels(values, tel) {
  const count = values.ledCount || 16
  const bright = (values.brightness || 40) / 100
  const base = FLAG_COLORS[tel.flag] || FLAG_COLORS.none
  return new Array(count).fill(null).map(() => [
    Math.round(base[0] * bright),
    Math.round(base[1] * bright),
    Math.round(base[2] * bright),
  ])
}

function displayLines(values, tel) {
  switch (values.layout) {
    case 'delta':
      return [
        { big: (tel.delta >= 0 ? '+' : '') + tel.delta.toFixed(2), tone: tel.delta <= 0 ? 'good' : 'bad' },
        { label: 'ΓΥΡΟΣ', value: formatLapTime(tel.lapTime) },
        { label: 'ΚΑΛΥΤΕΡΟΣ', value: formatLapTime(tel.bestLap) },
        { label: 'SECTOR', value: `S${tel.sector}` },
      ]
    case 'temps':
      return [
        { big: `${Math.round(tel.waterC)}°`, tone: tel.waterC > 105 ? 'bad' : 'good' },
        { label: 'ΛΑΔΙ', value: `${tel.oilBar.toFixed(1)} bar` },
        { label: 'ΚΑΥΣΙΜΟ', value: `${tel.fuelL.toFixed(1)} L` },
        { label: 'BOOST', value: `${tel.boostBar.toFixed(2)} bar` },
      ]
    case 'tyres':
      return [
        { big: `${tel.speedKmh}`, tone: 'good' },
        { label: 'ΟΛΙΣΘΗΣΗ', value: `${Math.round(tel.slip * 100)}%` },
        { label: 'ABS', value: tel.abs ? 'ΕΝΕΡΓΟ' : '—' },
        { label: 'ΚΡΑΣΠΕΔΟ', value: `${Math.round(tel.kerb * 100)}%` },
      ]
    case 'cluster':
      return [
        { big: String(tel.gear), tone: tel.rpmPct > 96 ? 'bad' : 'good' },
        { label: 'RPM', value: String(tel.rpm) },
        { label: 'ΤΑΧΥΤΗΤΑ', value: `${tel.speedKmh} km/h` },
        { label: 'ΓΥΡΟΣ', value: formatLapTime(tel.lapTime) },
      ]
    default:
      return [
        { big: String(tel.gear), tone: tel.rpmPct > 96 ? 'bad' : 'good' },
        { label: 'RPM', value: String(tel.rpm) },
        { label: 'ΤΑΧΥΤΗΤΑ', value: `${tel.speedKmh} km/h` },
        { label: 'ΚΑΥΣΙΜΟ', value: `${tel.fuelPct.toFixed(0)}%` },
      ]
  }
}

function sevenSegText(values, tel) {
  switch (values.show) {
    case 'speed':
      return String(tel.speedKmh).padStart(4, ' ')
    case 'rpm':
      return String(tel.rpm).padStart(4, ' ')
    case 'lap':
      return formatLapTime(tel.lapTime).slice(0, 4)
    default:
      return `  ${tel.gear} `
  }
}

function gaugeValue(values, tel) {
  switch (values.source) {
    case 'speed':
      return clamp(tel.speedKmh / 260, 0, 1)
    case 'fuel':
      return clamp(tel.fuelPct / 100, 0, 1)
    case 'water':
      return clamp((tel.waterC - 40) / 80, 0, 1)
    default:
      return clamp(tel.rpmPct / 100, 0, 1)
  }
}

function ledOn(values, tel) {
  switch (values.source) {
    case 'abs':
      return tel.abs
    case 'pit':
      return tel.pitLimiter
    case 'fuel':
      return tel.fuelPct < 12
    case 'tc':
      return tel.tc
    default:
      return tel.rpmPct > 96
  }
}

function hapticLevel(values, tel) {
  const strength = (values.strength || 70) / 100
  switch (values.trigger) {
    case 'slip':
      return clamp(tel.slip, 0, 1) * strength
    case 'kerb':
      return tel.kerb * strength
    case 'shift':
      return tel.rpmPct > 96 ? strength : 0
    default:
      return tel.abs ? strength : 0
  }
}

function buzzerOn(values, tel) {
  switch (values.trigger) {
    case 'pit':
      return tel.pitLimiter
    case 'fuel':
      return tel.fuelPct < 12
    case 'flag':
      return tel.flag !== 'none'
    default:
      return tel.rpmPct > 96
  }
}

/* ------------------------------------------------------------------ */
/* Το βήμα                                                             */
/* ------------------------------------------------------------------ */

/**
 * @param {object} engine     κατάσταση μηχανής (μεταβάλλεται)
 * @param {object} ctx        { firmware, telemetry, controls, settings, dt }
 */
export function stepEngine(engine, ctx) {
  const { firmware, telemetry: tel, controls, settings, dt } = ctx
  const board = firmware.board
  const dtMs = dt * 1000
  engine.time += dtMs

  /* --------- Brownout & reset --------- */
  const brownout = engine.stats.currentMa > board.maxCurrentMa
  if (brownout && engine.time > engine._resetUntil) {
    engine._resetUntil = engine.time + BROWNOUT_RESET_MS
    engine.stats.resets += 1
    pushSerial(engine, '!! Πτώση τάσης — επανεκκίνηση πλακέτας')
  }
  const inReset = engine.time < engine._resetUntil
  engine.stats.brownout = brownout || inReset
  engine.hid.connected = firmware.hid.needed && board.usbHid && !inReset

  /* --------- Πόσες επαναλήψεις firmware χωράνε σε αυτό το frame; --------- */
  const loopHz = Math.max(1, firmware.timing.loopHz)
  engine.stats.loopHz = loopHz
  const wanted = Math.round(loopHz * dt)
  const iterations = inReset ? 0 : Math.min(MAX_ITERATIONS_PER_FRAME, Math.max(1, wanted))
  const stepMs = wanted > 0 ? dtMs / Math.max(1, wanted) : dtMs
  const sampleMs = 1000 / loopHz
  engine.stats.iterations = iterations

  const buttons = []
  const axes = {}
  let totalMa = 25

  /* ============================ ΕΙΣΟΔΟΙ ============================ */
  for (const entry of firmware.inputs) {
    const st = engine.nodes[entry.nodeId] || (engine.nodes[entry.nodeId] = initNode(entry))
    const ctrl = controls[entry.nodeId] || {}
    const v = entry.values

    if (entry.kind === 'button') {
      const want = !!ctrl.pressed
      if (want !== st.target) {
        st.target = want
        st.bounce = makeBounce(v.bounceMs || 0, want)
        st.edgeAt = engine.time
      }
      // Δειγματοληψία στη συχνότητα του βρόχου, με debounce firmware.
      for (let i = 0; i < iterations; i += 1) {
        const tNow = engine.time - dtMs + i * stepMs
        const raw = bounceLevel(st, tNow - st.edgeAt)
        st.raw = raw
        if (raw !== st.debounced) {
          if (st._pendingSince == null || st._pendingLevel !== raw) {
            st._pendingSince = tNow
            st._pendingLevel = raw
          } else if (tNow - st._pendingSince >= (settings.debounceMs || 0)) {
            const wasGhost =
              raw === true && st.debounced === false && tNow - st.edgeAt < (v.bounceMs || 0) && st.target === false
            st.debounced = raw
            st._pendingSince = null
            if (raw) {
              st.presses += 1
              if (wasGhost) {
                st.ghosts += 1
                engine.stats.ghostPresses += 1
              }
              if (v.latch) st.latched = !st.latched
            }
          }
        } else {
          st._pendingSince = null
        }
      }
      const active = v.latch ? st.latched : st.debounced
      for (const idx of entry.buttons) buttons[idx] = active
      if (entry.wired) totalMa += entry.part.currentMa || 0
    }

    if (entry.kind === 'encoder') {
      // Ο χρήστης «γυρίζει»: ctrl.spin σε κλικ/δευτερόλεπτο.
      const spin = ctrl.spin || 0
      const detents = v.detents || 20
      const prevAngle = st.angle
      st.angle += spin * dt
      const transitionsPerDetent = 4
      const rawTransitions = Math.abs(st.angle - prevAngle) * transitionsPerDetent
      const transitionRate = Math.abs(spin) * transitionsPerDetent

      if (v.useInterrupt) {
        st.counts += Math.round((st.angle - prevAngle) * transitionsPerDetent)
      } else {
        // Με polling: αν δύο μεταβάσεις πέσουν στο ίδιο δείγμα, χάνεται μία.
        const perSample = transitionRate * (sampleMs / 1000)
        const captured = perSample > 1 ? rawTransitions / perSample : rawTransitions
        const missed = Math.max(0, rawTransitions - captured)
        st.missed += missed
        engine.stats.missedSteps += missed
        st.counts += Math.sign(st.angle - prevAngle) * captured
      }

      const detentDelta = st.counts / transitionsPerDetent
      if (v.mode === 'axis') {
        st.axis = clamp(0.5 + detentDelta / (detents * 4), 0, 1)
        if (entry.axis) axes[entry.axis] = { value: st.axis, label: entry.label, raw: st.counts }
      } else {
        if (spin > 0.01) st.cwUntil = engine.time + (v.pulseMs || 50)
        if (spin < -0.01) st.ccwUntil = engine.time + (v.pulseMs || 50)
        if (entry.buttons[0] != null) buttons[entry.buttons[0]] = engine.time < st.cwUntil
        if (entry.buttons[1] != null) buttons[entry.buttons[1]] = engine.time < st.ccwUntil
      }
      if (entry.pins.sw && entry.buttons.length > 2) {
        st.swDebounced = !!ctrl.pressed
        buttons[entry.buttons[entry.buttons.length - 1]] = st.swDebounced
      }
    }

    if (entry.kind === 'matrix' || entry.kind === 'expander') {
      const set = new Set(ctrl.keys || [])
      st.pressed = set
      entry.buttons.forEach((idx, i) => {
        buttons[idx] = set.has(i)
      })
      // Ghosting: 3 πατημένα σε ορθογώνιο χωρίς διόδους δίνουν 4ο.
      if (entry.kind === 'matrix' && v.diodes === false && set.size >= 3) {
        const cols = v.cols || 4
        const list = [...set]
        for (const a of list) {
          for (const b of list) {
            for (const c of list) {
              if (a === b || b === c || a === c) continue
              const ghost = Math.floor(a / cols) * cols + (c % cols)
              if (Math.floor(a / cols) === Math.floor(b / cols) && b % cols === c % cols && !set.has(ghost)) {
                const idx = entry.buttons[ghost]
                if (idx != null) buttons[idx] = true
              }
            }
          }
        }
      }
      totalMa += entry.part.currentMa || 0
    }

    if (entry.kind === 'analog') {
      st.position = ctrl.value != null ? ctrl.value : st.position
      const pos = v.taper === 'log' ? st.position ** 2.2 : st.position
      const volts = pos * board.adcRefV
      const noisy = volts + (gaussian() * (v.noiseMv || 0)) / 1000
      const maxCounts = 2 ** board.adcBits - 1
      st.counts = clamp(Math.round((noisy / board.adcRefV) * maxCounts), 0, maxCounts)
      const alpha = settings.filterAlpha ?? 1
      st.filtered = st.filtered === 0 ? st.counts : st.filtered + (st.counts - st.filtered) * alpha
      let norm = st.filtered / maxCounts
      if (v.invert) norm = 1 - norm
      norm = applyDeadzone(norm, settings.deadzonePct || 0)
      st.axis = norm
      if (entry.axis) {
        axes[entry.axis] = { value: norm, label: entry.label, raw: Math.round(st.counts) }
      }
      totalMa += entry.part.currentMa || 0
    }

    if (entry.kind === 'hx711') {
      const cellValues = entry.cell?.values || { maxForceKg: 45, sensitivityMvV: 2, capacityKg: 100 }
      st.forceKg = (ctrl.value != null ? ctrl.value : 0) * (cellValues.maxForceKg || 45)
      // mV/V → mV στην έξοδο της γέφυρας με 5V διέγερση
      const mv = (st.forceKg / (cellValues.capacityKg || 100)) * (cellValues.sensitivityMvV || 2) * 5
      const lsbUv = 0.0149 * (128 / (v.gain || 128)) // ~±0.5mV πλήρης κλίμακα στα 128×
      const rawCounts = (mv * 1000) / lsbUv
      const noise = gaussian() * 900 // τυπικός θόρυβος HX711 σε counts
      const sampleIntervalMs = 1000 / (v.rateHz || 80)

      if (engine.time >= st.nextSampleAt) {
        st.nextSampleAt = engine.time + sampleIntervalMs
        st.counts = rawCounts + noise
        if (v.filter === 'avg4') {
          st.avgBuf.push(st.counts)
          if (st.avgBuf.length > 4) st.avgBuf.shift()
          st.filtered = st.avgBuf.reduce((a, b) => a + b, 0) / st.avgBuf.length
        } else if (v.filter === 'ema') {
          st.filtered = st.filtered + (st.counts - st.filtered) * (v.emaAlpha || 0.3)
        } else {
          st.filtered = st.counts
        }
      }

      const fullScale = ((cellValues.maxForceKg || 45) / (cellValues.capacityKg || 100)) *
        (cellValues.sensitivityMvV || 2) * 5 * 1000 / lsbUv
      let norm = clamp(st.filtered / Math.max(1, fullScale), 0, 1)
      norm = norm ** (v.curve || 1)
      norm = applyDeadzone(norm, settings.deadzonePct || 0)
      st.axis = norm
      if (entry.axis) {
        axes[entry.axis] = {
          value: norm,
          label: entry.label,
          raw: Math.round(st.filtered),
          extra: `${st.forceKg.toFixed(1)} kg`,
        }
      }
      totalMa += entry.part.currentMa || 0
    }

    if (entry.kind === 'ads1115') {
      entry.axes.forEach((axis, i) => {
        const val = ctrl[`ch${i}`] != null ? ctrl[`ch${i}`] : st.positions[i]
        st.positions[i] = val
        const noisy = clamp(val + gaussian() * 0.0004, 0, 1)
        st.axes[i] = noisy
        if (axis) axes[axis] = { value: noisy, label: `${entry.label} CH${i}`, raw: Math.round(noisy * 32767) }
      })
      totalMa += entry.part.currentMa || 0
    }
  }

  /* ============================ ΕΞΟΔΟΙ ============================= */
  const live = !inReset
  for (const entry of firmware.outputs) {
    const st = engine.nodes[entry.nodeId] || (engine.nodes[entry.nodeId] = initNode(entry))
    const v = entry.values
    if (!entry.wired) continue

    switch (entry.kind) {
      case 'ledstrip': {
        st.blinkPhase += dt * (v.blinkHz || 10)
        const phaseOn = Math.floor(st.blinkPhase) % 2 === 0
        let pixels
        if (v.mode === 'flags') pixels = flagPixels(v, tel)
        else pixels = revPixels(v, tel, phaseOn)
        if (v.mode === 'revflags' && tel.flag !== 'none') {
          const base = FLAG_COLORS[tel.flag]
          const bright = (v.brightness || 40) / 100
          const edge = Math.max(1, Math.round(pixels.length * 0.15))
          for (let i = 0; i < edge; i += 1) {
            const c = [
              Math.round(base[0] * bright),
              Math.round(base[1] * bright),
              Math.round(base[2] * bright),
            ]
            pixels[i] = c
            pixels[pixels.length - 1 - i] = c
          }
        }
        if (!live) pixels = pixels.map(() => [0, 0, 0])
        st.pixels = pixels
        // Πραγματικό ρεύμα από τα χρώματα που ανάβουν αυτή τη στιγμή.
        let ma = 1
        for (const [r, g, b] of pixels) {
          ma += ((r + g + b) / 255) * MA_PER_CHANNEL
        }
        st.currentMa = ma
        if (!v.external5v) totalMa += ma
        break
      }
      case 'led': {
        st.on = live && ledOn(v, tel)
        totalMa += st.on ? entry.part.currentMa : 0
        break
      }
      case 'sevenseg': {
        const period = 1000 / (v.updateHz || 10)
        if (engine.time >= st.nextUpdate) {
          st.nextUpdate = engine.time + period
          st.text = live ? sevenSegText(v, tel) : '    '
        }
        totalMa += entry.part.currentMa
        break
      }
      case 'display': {
        const period = 1000 / (v.updateHz || 15)
        if (engine.time >= st.nextUpdate) {
          st.nextUpdate = engine.time + period
          st.lines = live ? displayLines(v, tel) : []
          st.frames += 1
        }
        totalMa += entry.part.currentMa
        break
      }
      case 'gauge': {
        const sweep = v.sweepDeg || 270
        st.targetAngle = gaugeValue(v, tel) * sweep
        const maxDelta = ((v.maxStepsPerSec || 600) / 3) * dt // 3 βήματα ανά μοίρα
        const delta = st.targetAngle - st.angle
        st.lagging = Math.abs(delta) > maxDelta * 1.2
        st.angle += clamp(delta, -maxDelta, maxDelta)
        totalMa += entry.part.currentMa
        break
      }
      case 'servo': {
        const range = v.rangeDeg || 180
        const source = { boost: clamp(tel.boostBar / 1.2, 0, 1), fuel: tel.fuelPct / 100, rpm: tel.rpmPct / 100, speed: clamp(tel.speedKmh / 260, 0, 1) }
        st.targetAngle = (source[v.source] ?? 0) * range
        const maxDelta = (v.speedDegS || 300) * dt
        const delta = st.targetAngle - st.angle
        st.angle += clamp(delta, -maxDelta, maxDelta)
        totalMa += Math.abs(delta) > 0.5 ? entry.part.currentMa : entry.part.currentMa * 0.2
        break
      }
      case 'fan': {
        const pct = clamp(tel.speedKmh / (v.maxKmh || 220), 0, 1)
        const min = (v.minPct || 0) / 100
        st.duty = live ? (pct > 0.02 ? min + pct * (1 - min) : 0) : 0
        st.rpm = Math.round(st.duty * 1800)
        break
      }
      case 'haptic': {
        st.duty = live ? hapticLevel(v, tel) : 0
        st.phase += dt * 30
        break
      }
      case 'buzzer': {
        st.on = live && buzzerOn(v, tel)
        totalMa += st.on ? entry.part.currentMa : 0
        break
      }
      default:
        break
    }
  }

  engine.stats.currentMa = Math.round(totalMa)
  engine.stats.peakMa = Math.max(engine.stats.peakMa, engine.stats.currentMa)

  /* --------- HID --------- */
  engine.hid.buttons = buttons.map((b) => !!b)
  engine.hid.axes = axes
  if (engine.hid.connected) engine.stats.hidReports += iterations

  /* --------- Σειριακή --------- */
  engine._serialAcc += dtMs
  if (engine._serialAcc > 700 && firmware.telemetryNeeded && live) {
    engine._serialAcc = 0
    pushSerial(
      engine,
      `rpm=${tel.rpm} gear=${tel.gear} spd=${tel.speedKmh} thr=${(tel.throttle * 100).toFixed(0)} brk=${(tel.brake * 100).toFixed(0)} abs=${tel.abs ? 1 : 0} flag=${tel.flag}`
    )
  }

  /* --------- Παλμογράφος --------- */
  pushScope(engine, firmware, tel)

  return engine
}

function applyDeadzone(value, pct) {
  const dz = pct / 100
  if (dz <= 0) return value
  if (value < dz) return 0
  if (value > 1 - dz) return 1
  return (value - dz) / (1 - 2 * dz)
}

export function pushSerial(engine, line) {
  engine.serial.push({ t: engine.time, line })
  if (engine.serial.length > SERIAL_LINES) engine.serial.shift()
}

function pushScope(engine, firmware, tel) {
  const sample = { t: engine.time / 1000, values: {} }
  const channels = []

  for (const entry of firmware.inputs) {
    const st = engine.nodes[entry.nodeId]
    if (!st) continue
    if (entry.kind === 'analog' || entry.kind === 'hx711') {
      const maxCounts = entry.kind === 'hx711' ? Math.max(1, Math.abs(st.counts) || 1) : 2 ** firmware.board.adcBits - 1
      sample.values[`${entry.label} ωμό`] = clamp(st.counts / maxCounts, 0, 1)
      sample.values[`${entry.label} άξονας`] = st.axis
      channels.push(`${entry.label} ωμό`, `${entry.label} άξονας`)
    }
    if (entry.kind === 'button') {
      sample.values[`${entry.label} ωμό`] = st.raw ? 1 : 0
      sample.values[`${entry.label} debounced`] = st.debounced ? 1 : 0
      channels.push(`${entry.label} ωμό`, `${entry.label} debounced`)
    }
  }
  sample.values['RPM %'] = tel.rpmPct / 100
  sample.values['Φρένο'] = tel.brake
  channels.push('RPM %', 'Φρένο')

  engine.scope.channels = [...new Set(channels)]
  engine.scope.samples.push(sample)
  if (engine.scope.samples.length > SCOPE_SAMPLES) engine.scope.samples.shift()
}

export function resetEngine(engine) {
  engine.nodes = {}
  engine.serial = []
  engine.scope = { samples: [], channels: [] }
  engine.stats = {
    loopHz: 0, iterations: 0, currentMa: 0, peakMa: 0, brownout: false,
    resets: 0, missedSteps: 0, ghostPresses: 0, hidReports: 0,
  }
  engine._resetUntil = 0
  engine.time = 0
  return engine
}
