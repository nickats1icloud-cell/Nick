/**
 * Έτοιμες κατασκευές.
 *
 * Καθεμιά είναι πλήρως καλωδιωμένη και δοκιμασμένη στην προσομοίωση: πάτα
 * «Φόρτωση», άναψε την τροφοδοσία και δες την να δουλεύει. Ξεκίνα από την
 * πιο κοντινή στο πρότζεκτ σου και άλλαξέ τη.
 */

import { BOARD_NODE, DEFAULT_SETTINGS } from './circuit.js'
import { defaultParams } from './parts.js'

/* ---------------------- Μικρός builder ---------------------- */

function maker(boardId, name, description) {
  const build = {
    version: 1,
    name,
    boardId,
    boardPos: { x: 40, y: 60 },
    nodes: [],
    wires: [],
    settings: { ...DEFAULT_SETTINGS },
  }
  let n = 0
  let w = 0

  const add = (partId, x, y, values = {}, label) => {
    n += 1
    const id = `p${n}`
    build.nodes.push({
      id,
      partId,
      label: label || undefined,
      x,
      y,
      values: { ...defaultParams(partId), ...values },
    })
    return id
  }
  const link = (fromNode, fromPin, toNode, toPin) => {
    w += 1
    build.wires.push({
      id: `w${w}`,
      from: { node: fromNode, pin: fromPin },
      to: { node: toNode, pin: toPin },
    })
  }
  const toBoard = (node, pin, boardPin) => link(node, pin, BOARD_NODE, boardPin)

  return { build, add, link, toBoard, description }
}

function finish(m) {
  // Τα labels που έμειναν κενά παίρνουν το όνομα του εξαρτήματος στην UI.
  for (const node of m.build.nodes) if (!node.label) delete node.label
  return m.build
}

/* ------------------------- Οι κατασκευές ------------------------- */

function buttonBox() {
  const m = maker('pro-micro', 'Button box 11 εντολών', '')
  const cols = [
    ['D4', 'Κουμπί 1'], ['D5', 'Κουμπί 2'], ['D6', 'Κουμπί 3'],
    ['D7', 'Κουμπί 4'], ['D8', 'Κουμπί 5'], ['D9', 'Κουμπί 6'],
  ]
  cols.forEach(([pin, label], i) => {
    const id = m.add('button', 400 + (i % 2) * 250, 60 + Math.floor(i / 2) * 120, {}, label)
    m.toBoard(id, 'sig', pin)
    m.toBoard(id, 'gnd', i % 2 === 0 ? 'GND1' : 'GND2')
  })
  const e1 = m.add('encoder', 400, 460, { useInterrupt: true }, 'Encoder TC')
  m.toBoard(e1, 'a', 'D2')
  m.toBoard(e1, 'b', 'D3')
  m.toBoard(e1, 'gnd', 'GND1')
  const e2 = m.add('encoder', 650, 460, { useInterrupt: true }, 'Encoder ABS')
  m.toBoard(e2, 'a', 'D0')
  m.toBoard(e2, 'b', 'D1')
  m.toBoard(e2, 'gnd', 'GND2')
  const t = m.add('toggle', 400, 620, {}, 'Ignition')
  m.toBoard(t, 'sig', 'D10')
  m.toBoard(t, 'gnd', 'GND3')
  return finish(m)
}

function brakePedal() {
  const m = maker('pro-micro', 'Πεντάλ φρένου με load cell', '')
  const cell = m.add('loadcell', 400, 80, { capacityKg: 100, maxForceKg: 45 }, 'Load cell 100kg')
  const amp = m.add('hx711', 700, 80, { rateHz: 80, filter: 'ema', emaAlpha: 0.35, curve: 1.3 }, 'HX711')
  m.link(cell, 'ex', amp, 'bridge')
  m.link(cell, 'sig', amp, 'bridge')
  m.toBoard(amp, 'vcc', 'VCC')
  m.toBoard(amp, 'gnd', 'GND1')
  m.toBoard(amp, 'dt', 'D4')
  m.toBoard(amp, 'sck', 'D5')

  const shaker = m.add('shaker', 400, 340, { trigger: 'abs', placement: 'brake' }, 'Δόνηση ABS')
  const mos = m.add('mosfet', 700, 340, {}, 'MOSFET')
  const psu = m.add('psu12', 980, 340, { amps: 2 }, 'Τροφοδοτικό 12V')
  m.link(shaker, 'pwm', mos, 'gate')
  m.toBoard(mos, 'gate', 'D9')
  m.link(mos, 'drain', shaker, 'v12')
  m.link(mos, 'source', psu, 'gnd')
  m.link(psu, 'v12', shaker, 'v12')
  m.link(psu, 'gnd', shaker, 'gnd')
  m.toBoard(psu, 'gnd', 'GND2')
  return finish(m)
}

function revLights() {
  const m = maker('pro-micro', 'Rev lights 16 LED', '')
  const strip = m.add('ws2812', 420, 80, { ledCount: 16, brightness: 45, external5v: true }, 'Ταινία rev')
  const buck = m.add('buck', 740, 80, { amps: 3 }, 'Buck 12→5V')
  const psu = m.add('psu12', 1000, 80, { amps: 5 }, 'Τροφοδοτικό 12V')
  const cap = m.add('capacitor', 740, 280, { uf: 1000 }, 'Πυκνωτής')
  m.toBoard(strip, 'din', 'D6')
  m.toBoard(strip, 'gnd', 'GND1')
  m.link(strip, 'vcc', buck, 'out5')
  m.link(buck, 'v12', psu, 'v12')
  m.link(buck, 'gnd', psu, 'gnd')
  m.toBoard(psu, 'gnd', 'GND2')
  m.link(cap, 'a', buck, 'out5')
  m.link(cap, 'b', psu, 'gnd')

  const buzz = m.add('buzzer', 420, 400, { trigger: 'shift' }, 'Βομβητής shift')
  m.toBoard(buzz, 'sig', 'D5')
  m.toBoard(buzz, 'gnd', 'GND3')
  return finish(m)
}

function shifter() {
  const m = maker('pro-micro', 'Sequential shifter (Hall)', '')
  const up = m.add('hall-digital', 420, 80, {}, 'Ανέβασμα')
  const down = m.add('hall-digital', 420, 280, {}, 'Κατέβασμα')
  m.toBoard(up, 'vcc', 'VCC')
  m.toBoard(up, 'gnd', 'GND1')
  m.toBoard(up, 'sig', 'D2')
  m.toBoard(down, 'vcc', 'VCC')
  m.toBoard(down, 'gnd', 'GND2')
  m.toBoard(down, 'sig', 'D3')
  const led = m.add('led', 420, 480, { source: 'shift', color: 'red' }, 'Λυχνία shift')
  m.toBoard(led, 'a', 'D5')
  m.toBoard(led, 'k', 'GND3')
  return finish(m)
}

function windSim() {
  const m = maker('pro-micro', 'Wind simulator (2 ανεμιστήρες)', '')
  const psu = m.add('psu12', 1000, 100, { amps: 10 }, 'Τροφοδοτικό 12V 10A')
  const pins = ['D9', 'D10']
  pins.forEach((pin, i) => {
    const fan = m.add('fan', 420, 80 + i * 260, { sizeMm: 120, minPct: 20, maxKmh: 220 }, `Ανεμιστήρας ${i + 1}`)
    const mos = m.add('mosfet', 720, 80 + i * 260, {}, `MOSFET ${i + 1}`)
    m.link(fan, 'pwm', mos, 'gate')
    m.toBoard(mos, 'gate', pin)
    m.link(mos, 'drain', fan, 'v12')
    m.link(mos, 'source', psu, 'gnd')
    m.link(psu, 'v12', fan, 'v12')
    m.link(psu, 'gnd', fan, 'gnd')
  })
  m.toBoard(psu, 'gnd', 'GND1')
  return finish(m)
}

function fullDash() {
  const m = maker('pico', 'Πλήρες καντράν (Pico)', '')
  const oled = m.add('oled', 420, 70, { iface: 'i2c', layout: 'delta', updateHz: 15, partial: true }, 'OLED delta')
  m.toBoard(oled, 'vcc', '3V3')
  m.toBoard(oled, 'gnd', 'GND1')
  m.toBoard(oled, 'sda', 'GP4')
  m.toBoard(oled, 'scl', 'GP5')

  const seg = m.add('tm1637', 420, 300, { show: 'gear', updateHz: 10 }, 'Γρανάζι')
  m.toBoard(seg, 'vcc', 'VBUS')
  m.toBoard(seg, 'gnd', 'GND2')
  m.toBoard(seg, 'clk', 'GP6')
  m.toBoard(seg, 'dio', 'GP7')

  const strip = m.add('ws2812', 760, 70, { ledCount: 12, brightness: 35 }, 'Rev lights')
  const shifter5 = m.add('levelshifter', 1060, 70, { channels: 2 }, 'Level shifter')
  m.link(strip, 'din', shifter5, 'b')
  m.toBoard(shifter5, 'a', 'GP8')
  m.toBoard(shifter5, 'lv', '3V3')
  m.toBoard(shifter5, 'gnd', 'GND3')
  m.toBoard(strip, 'gnd', 'GND4')
  m.toBoard(strip, 'vcc', 'VBUS')
  return finish(m)
}

function handbrake() {
  const m = maker('pro-micro', 'Χειρόφρενο load cell', '')
  const cell = m.add('loadcell', 420, 80, { capacityKg: 200, maxForceKg: 60 }, 'Load cell 200kg')
  const amp = m.add('hx711', 720, 80, { rateHz: 80, filter: 'avg4', curve: 0.9 }, 'HX711')
  m.link(cell, 'ex', amp, 'bridge')
  m.link(cell, 'sig', amp, 'bridge')
  m.toBoard(amp, 'vcc', 'VCC')
  m.toBoard(amp, 'gnd', 'GND1')
  m.toBoard(amp, 'dt', 'D2')
  m.toBoard(amp, 'sck', 'D3')
  const btn = m.add('button', 420, 340, {}, 'Κουμπί μηδενισμού')
  m.toBoard(btn, 'sig', 'D4')
  m.toBoard(btn, 'gnd', 'GND2')
  return finish(m)
}

function bigPanel() {
  const m = maker('leonardo', 'Πάνελ 16 κουμπιών (matrix)', '')
  const kp = m.add('keypad', 420, 70, { rows: 4, cols: 4, diodes: true }, 'Matrix 4×4')
  const rows = ['D4', 'D5', 'D6', 'D7']
  const cols = ['D8', 'D9', 'D10', 'D11']
  rows.forEach((pin, i) => m.toBoard(kp, `r${i}`, pin))
  cols.forEach((pin, i) => m.toBoard(kp, `c${i}`, pin))

  const pot = m.add('pot', 760, 70, { taper: 'lin', noiseMv: 10 }, 'Brake bias')
  m.toBoard(pot, 'vcc', '5V')
  m.toBoard(pot, 'gnd', 'GND1')
  m.toBoard(pot, 'sig', 'A0')

  const seg = m.add('tm1637', 760, 330, { show: 'gear' }, 'Ένδειξη')
  m.toBoard(seg, 'vcc', '5V')
  m.toBoard(seg, 'gnd', 'GND2')
  m.toBoard(seg, 'clk', 'D12')
  m.toBoard(seg, 'dio', 'D13')
  return finish(m)
}

export const PRESETS = [
  {
    id: 'button-box',
    name: 'Button box 11 εντολών',
    level: 'Αρχάριο',
    hours: 4,
    summary: '6 κουμπιά, 2 encoders με interrupt και έναν διακόπτη σε Pro Micro. Το κλασικό πρώτο πρότζεκτ.',
    make: buttonBox,
  },
  {
    id: 'brake-pedal',
    name: 'Πεντάλ φρένου load cell',
    level: 'Μεσαίο',
    hours: 8,
    summary: 'Load cell 100kg με HX711 στα 80 SPS, καμπύλη πεντάλ και δόνηση όταν ενεργοποιείται το ABS.',
    make: brakePedal,
  },
  {
    id: 'rev-lights',
    name: 'Rev lights 16 LED',
    level: 'Αρχάριο',
    hours: 3,
    summary: 'Ταινία WS2812 με ξεχωριστή τροφοδοσία 5V από buck, πυκνωτή στην είσοδο και βομβητή στο shift.',
    make: revLights,
  },
  {
    id: 'shifter',
    name: 'Sequential shifter (Hall)',
    level: 'Αρχάριο',
    hours: 6,
    summary: 'Δύο αισθητήρες Hall αντί για micro switches: μηδενική αναπήδηση, καμία φθορά.',
    make: shifter,
  },
  {
    id: 'wind',
    name: 'Wind simulator',
    level: 'Μεσαίο',
    hours: 5,
    summary: 'Δύο ανεμιστήρες 120mm σε MOSFET, με ταχύτητα ανάλογη της ταχύτητας του αυτοκινήτου.',
    make: windSim,
  },
  {
    id: 'dash',
    name: 'Πλήρες καντράν (Pico)',
    level: 'Μεσαίο',
    hours: 10,
    summary: 'OLED με delta, 7-segment για το γρανάζι και rev lights — με level shifter, όπως πρέπει σε 3.3V.',
    make: fullDash,
  },
  {
    id: 'handbrake',
    name: 'Χειρόφρενο load cell',
    level: 'Μεσαίο',
    hours: 6,
    summary: 'Load cell 200kg με μέσο όρο 4 δειγμάτων και ελαφρώς επιθετική καμπύλη για γρήγορο κλείδωμα.',
    make: handbrake,
  },
  {
    id: 'panel',
    name: 'Πάνελ 16 κουμπιών',
    level: 'Μεσαίο',
    hours: 7,
    summary: 'Matrix 4×4 με διόδους, ποτενσιόμετρο για brake bias και ένδειξη 7-segment σε Leonardo.',
    make: bigPanel,
  },
]

export function loadPreset(id) {
  const preset = PRESETS.find((p) => p.id === id)
  return preset ? preset.make() : null
}
