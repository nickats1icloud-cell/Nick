/**
 * Λίστα υλικών (BOM) και κόστος.
 *
 * Μαζεύει τα εξαρτήματα του πάγκου, προσθέτει ό,τι πάντα ξεχνάς (καλώδια,
 * κουτί, βίδες) και βγάζει σύνολο, ώστε να ξέρεις τι κοστίζει η κατασκευή
 * πριν την παραγγείλεις.
 */

import { placedParts } from './circuit.js'

/** Αναλώσιμα που δεν μπαίνουν στον πάγκο αλλά τα χρειάζεσαι πάντα. */
const CONSUMABLES = [
  { id: 'wire', name: 'Καλώδια dupont / πολύκλωνο', price: 4, qty: 1, note: 'Ένα σετ φτάνει για δύο-τρεις κατασκευές.' },
  { id: 'heatshrink', name: 'Θερμοσυστελλόμενο & κολλητήρι αναλώσιμα', price: 3, qty: 1, note: '' },
]

const ENCLOSURE = {
  small: { name: 'Κουτί μικρό (έως 8 controls)', price: 12 },
  medium: { name: 'Κουτί μεσαίο (έως 20 controls)', price: 18 },
  large: { name: 'Κουτί μεγάλο / 3D printed', price: 26 },
}

/**
 * @param {object} build
 * @param {object} firmware
 * @returns {{ rows: object[], subtotal: number, total: number, controls: number }}
 */
export function computeBom(build, firmware) {
  const placed = placedParts(build)
  const board = firmware.board

  const rows = [
    {
      id: board.id,
      name: board.name,
      qty: 1,
      unit: board.price,
      total: board.price,
      group: 'Πλακέτα',
      note: board.mcu,
    },
  ]

  // Ομαδοποίηση ίδιων εξαρτημάτων με τις ίδιες βασικές ρυθμίσεις.
  const groups = new Map()
  for (const { part, values } of placed) {
    const key = part.id
    if (!groups.has(key)) groups.set(key, { part, qty: 0, values })
    groups.get(key).qty += 1
  }

  for (const { part, qty, values } of groups.values()) {
    let unit = part.price
    let note = ''
    if (part.id === 'ws2812') {
      const perMeter = 6
      const meters = Math.max(1, Math.ceil((values.ledCount || 16) / 60))
      unit = perMeter * meters
      note = `${values.ledCount} LED (~${meters}m ταινία 60/m)`
    }
    if (part.id === 'loadcell') note = `${values.capacityKg} kg`
    if (part.id === 'psu12') {
      unit = { 2: 9, 5: 14, 10: 22 }[values.amps] || part.price
      note = `12V ${values.amps}A`
    }
    rows.push({
      id: part.id,
      name: part.name,
      qty,
      unit,
      total: Math.round(unit * qty * 100) / 100,
      group: part.category === 'input' ? 'Είσοδοι' : part.category === 'output' ? 'Έξοδοι' : 'Τροφοδοσία & παθητικά',
      note,
    })
  }

  // Ό,τι υπονοείται από τις ρυθμίσεις αλλά δεν είναι στον πάγκο.
  for (const { part, values } of placed) {
    if (part.role === 'matrix' && values.diodes) {
      const qty = (values.rows || 4) * (values.cols || 4)
      rows.push({
        id: 'diode-implied',
        name: 'Δίοδοι 1N4148 (anti-ghosting)',
        qty,
        unit: 0.04,
        total: Math.round(qty * 0.04 * 100) / 100,
        group: 'Τροφοδοσία & παθητικά',
        note: 'Μία ανά κουμπί του matrix',
      })
    }
    if (part.role === 'led' && values.resistor) {
      rows.push({
        id: 'res-implied',
        name: 'Αντίσταση 330Ω',
        qty: 1,
        unit: 0.05,
        total: 0.05,
        group: 'Τροφοδοσία & παθητικά',
        note: 'Σε σειρά με το LED',
      })
    }
  }

  const controls = firmware.hid.buttonCount + firmware.hid.axes.length
  const enclosure =
    controls <= 8 ? ENCLOSURE.small : controls <= 20 ? ENCLOSURE.medium : ENCLOSURE.large

  const extras = [
    { id: 'enclosure', name: enclosure.name, qty: 1, unit: enclosure.price, total: enclosure.price, group: 'Κατασκευή', note: '' },
    ...CONSUMABLES.map((c) => ({ ...c, total: c.price * c.qty, unit: c.price, group: 'Κατασκευή' })),
  ]

  const all = [...rows, ...extras]
  const subtotal = all.reduce((sum, r) => sum + r.total, 0)

  return {
    rows: all,
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(subtotal * 100) / 100,
    controls,
    perControl: controls > 0 ? Math.round((subtotal / controls) * 100) / 100 : 0,
  }
}

/** Εξαγωγή του BOM σε CSV. */
export function bomToCsv(bom) {
  const head = 'Ομάδα,Εξάρτημα,Ποσότητα,Τιμή μονάδας (€),Σύνολο (€),Σημείωση'
  const lines = bom.rows.map((r) =>
    [r.group, r.name, r.qty, r.unit.toFixed(2), r.total.toFixed(2), r.note || '']
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(',')
  )
  lines.push(`"","ΣΥΝΟΛΟ","","","${bom.total.toFixed(2)}",""`)
  return [head, ...lines].join('\n')
}
