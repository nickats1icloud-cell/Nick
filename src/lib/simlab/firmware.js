/**
 * Παράγει το «πρόγραμμα» της κατασκευής από την καλωδίωση.
 *
 * Δεν γράφεις κώδικα: ό,τι συνδέσεις παίρνει αυτόματα ρόλο στο firmware
 * (κουμπί → HID button, ποτενσιόμετρο → άξονας, ταινία LED → rev lights).
 * Το ίδιο αντικείμενο τροφοδοτεί την προσομοίωση, τον έλεγχο σχεδίασης και
 * τη γεννήτρια κώδικα, ώστε αυτό που δοκιμάζεις να είναι αυτό που θα ανεβάσεις.
 */

import { getBoard } from './boards.js'
import { boardPinFor, placedParts } from './circuit.js'
import { analyzeLibraries } from './libraries.js'

/**
 * Σειρά ανάθεσης αξόνων HID.
 *
 * Έξι άξονες — όσους έχει το πρότυπο gamepad και όσους μπορούν να
 * αντιστοιχιστούν και στις τέσσερις πλατφόρμες που παράγουμε κώδικα.
 */
export const AXIS_ORDER = ['X', 'Y', 'Z', 'Rx', 'Ry', 'Rz']

/** Εξαρτήματα των οποίων ο χρόνος βρόχου εξαρτάται από τον επεξεργαστή. */
const CPU_BOUND_ROLES = new Set([
  'button', 'encoder', 'matrix', 'led', 'buzzer', 'servo', 'gauge', 'fan', 'haptic', 'analog',
])

/** Ρόλοι που καταναλώνουν τηλεμετρία από το sim. */
const TELEMETRY_ROLES = new Set([
  'ledstrip', 'display', 'sevenseg', 'gauge', 'servo', 'fan', 'haptic', 'buzzer', 'led',
])

const BASE_SKETCH_FLASH_KB = { avr: 3.6, rp2040: 42, esp32: 210, teensy: 24 }
const BASE_SKETCH_RAM_B = { avr: 210, rp2040: 5200, esp32: 14000, teensy: 3600 }
const LOOP_OVERHEAD_US = 26

/** Τα pins ενός κόμβου που καταλήγουν σε pin πλακέτας. */
function resolvePins(build, node, part) {
  const map = {}
  for (const pin of part.pins) {
    const target = boardPinFor(build, node.id, pin.id)
    if (target) map[pin.id] = target
  }
  return map
}

/** Ένα εξάρτημα «μετράει» όταν έχει τουλάχιστον ένα σήμα στην πλακέτα. */
function signalPins(part) {
  return part.pins.filter((p) => !['pwr', 'gnd', 'v12'].includes(p.type))
}

/**
 * @param {object} build η κατασκευή
 * @returns {object} το παραγόμενο firmware
 */
export function deriveFirmware(build) {
  const board = getBoard(build.boardId)
  const placed = placedParts(build)

  const inputs = []
  const outputs = []
  const passives = []
  const supplies = []

  let buttonIndex = 0
  let axisIndex = 0
  const takenAxes = new Set()

  // Πρώτο πέρασμα: άξονες με ρητή επιλογή κρατάνε τη θέση τους.
  for (const { node } of placed) {
    const a = node.values?.axis
    if (a && a !== 'auto') takenAxes.add(a)
  }
  const nextAxis = () => {
    while (axisIndex < AXIS_ORDER.length && takenAxes.has(AXIS_ORDER[axisIndex])) axisIndex += 1
    const a = AXIS_ORDER[axisIndex] || null
    if (a) {
      takenAxes.add(a)
      axisIndex += 1
    }
    return a
  }

  for (const { node, part, values } of placed) {
    const pins = resolvePins(build, node, part)
    const wired = signalPins(part).some((p) => pins[p.id])
    const entry = { nodeId: node.id, label: node.label, part, values, pins, wired }

    switch (part.role) {
      case 'button': {
        entry.kind = 'button'
        entry.buttons = wired ? [buttonIndex++] : []
        inputs.push(entry)
        break
      }
      case 'encoder': {
        entry.kind = 'encoder'
        entry.buttons = []
        if (wired) {
          if (values.mode === 'axis') {
            entry.axis = values.axis && values.axis !== 'auto' ? values.axis : nextAxis()
          } else {
            entry.buttons.push(buttonIndex++, buttonIndex++)
          }
          if (pins.sw) entry.buttons.push(buttonIndex++)
        }
        inputs.push(entry)
        break
      }
      case 'matrix': {
        entry.kind = 'matrix'
        const count = (values.rows || 4) * (values.cols || 4)
        entry.buttons = []
        if (wired) for (let i = 0; i < count; i += 1) entry.buttons.push(buttonIndex++)
        inputs.push(entry)
        break
      }
      case 'expander': {
        entry.kind = 'expander'
        entry.buttons = []
        if (wired) for (let i = 0; i < (values.used || 16); i += 1) entry.buttons.push(buttonIndex++)
        inputs.push(entry)
        break
      }
      case 'analog': {
        entry.kind = 'analog'
        entry.axis = wired
          ? values.axis && values.axis !== 'auto'
            ? values.axis
            : nextAxis()
          : null
        inputs.push(entry)
        break
      }
      case 'hx711': {
        entry.kind = 'hx711'
        entry.axis = wired
          ? values.axis && values.axis !== 'auto'
            ? values.axis
            : nextAxis()
          : null
        // Βρες τη load cell που κρέμεται από τη γέφυρα.
        entry.cell =
          placed.find(
            (o) =>
              o.part.role === 'loadcell' &&
              build.wires.some(
                (w) =>
                  (w.from.node === node.id && w.to.node === o.node.id) ||
                  (w.to.node === node.id && w.from.node === o.node.id)
              )
          ) || null
        inputs.push(entry)
        break
      }
      case 'ads1115': {
        entry.kind = 'ads1115'
        entry.axes = []
        if (wired) for (let i = 0; i < (values.channels || 1); i += 1) entry.axes.push(nextAxis())
        inputs.push(entry)
        break
      }
      case 'loadcell': {
        entry.kind = 'loadcell'
        passives.push(entry)
        break
      }
      case 'psu':
      case 'buck': {
        entry.kind = part.role
        supplies.push(entry)
        break
      }
      case 'mosfet':
      case 'levelshifter':
      case 'resistor':
      case 'diode':
      case 'capacitor': {
        entry.kind = part.role
        passives.push(entry)
        break
      }
      default: {
        entry.kind = part.role
        outputs.push(entry)
      }
    }
  }

  /* ------------------------- Χρόνος βρόχου ------------------------- */
  const cpuFactor = Math.max(0.12, 16 / board.clockMhz)
  const breakdown = []
  let loopUs = LOOP_OVERHEAD_US * cpuFactor

  for (const entry of [...inputs, ...outputs]) {
    if (!entry.wired) continue
    const raw = entry.part.loopUs ? entry.part.loopUs(entry.values, board) : 0
    const us = CPU_BOUND_ROLES.has(entry.part.role) ? raw * cpuFactor : raw
    if (us > 0) breakdown.push({ label: entry.label, nodeId: entry.nodeId, us })
    loopUs += us
  }

  const hidButtonCount = [...inputs].reduce((n, e) => n + (e.buttons?.length || 0), 0)
  const hidAxes = []
  for (const e of inputs) {
    if (e.axis) hidAxes.push({ axis: e.axis, nodeId: e.nodeId, label: e.label })
    for (const a of e.axes || []) if (a) hidAxes.push({ axis: a, nodeId: e.nodeId, label: e.label })
  }
  const needsHid = hidButtonCount > 0 || hidAxes.length > 0

  if (needsHid) {
    const us = 90 * cpuFactor
    breakdown.push({ label: 'Αποστολή HID report', nodeId: null, us })
    loopUs += us
  }

  const telemetryNeeded = outputs.some((o) => o.wired && TELEMETRY_ROLES.has(o.part.role))
  if (telemetryNeeded) {
    const us = 180 * cpuFactor
    breakdown.push({ label: 'Ανάγνωση τηλεμετρίας (serial)', nodeId: null, us })
    loopUs += us
  }

  const loopHz = loopUs > 0 ? 1e6 / loopUs : 0
  const latencyMs = loopUs / 1000 + board.usbPollMs

  /* --------------------------- Μνήμη ------------------------------ */
  const ledCount = outputs
    .filter((o) => o.part.role === 'ledstrip' && o.wired)
    .reduce((n, o) => n + (o.values.ledCount || 0), 0)

  const libInfo = analyzeLibraries(board, placed, {
    needsHid,
    ledCount,
    usesEeprom: inputs.some((i) => i.kind === 'hx711' || i.kind === 'analog'),
  })

  const flashKb = (BASE_SKETCH_FLASH_KB[board.arch] || 6) + libInfo.flashKb
  const ramB =
    (BASE_SKETCH_RAM_B[board.arch] || 400) +
    libInfo.ramB +
    hidButtonCount * 2 +
    hidAxes.length * 6

  return {
    board,
    inputs,
    outputs,
    passives,
    supplies,
    hid: {
      needed: needsHid,
      buttonCount: hidButtonCount,
      axes: hidAxes,
      supported: board.usbHid,
    },
    telemetryNeeded,
    ledCount,
    timing: {
      loopUs: Math.round(loopUs),
      loopHz: Math.round(loopHz),
      latencyMs: Math.round(latencyMs * 100) / 100,
      breakdown: breakdown.sort((a, b) => b.us - a.us),
    },
    memory: {
      flashKb: Math.round(flashKb * 10) / 10,
      ramB: Math.round(ramB),
      flashPct: Math.round((flashKb / board.flashKb) * 100),
      ramPct: Math.round((ramB / (board.ramKb * 1024)) * 100),
      libs: libInfo.libs,
      incompatible: libInfo.incompatible,
    },
  }
}
