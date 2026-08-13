/**
 * Έλεγχος σχεδίασης (Design Rule Check).
 *
 * Τα ίδια λάθη που θα σε κάψουν στον πάγκο, πριν παραγγείλεις εξαρτήματα:
 * pin που δεν κάνει analog, ταινία LED που ζητάει 2A από USB, encoder χωρίς
 * interrupt, οθόνη που ρίχνει τον βρόχο στα 30Hz.
 *
 * Κάθε εύρημα έχει σοβαρότητα, εξήγηση και συγκεκριμένη διόρθωση.
 */

import { getBoardPin } from './boards.js'
import { BOARD_NODE, computeNets, pinKey, placedParts, sameRef, wiresAt, otherEnd } from './circuit.js'
import { PIN_TYPES } from './parts.js'

export const SEVERITY = { error: 3, warn: 2, info: 1 }

/** Ελάχιστος ρυθμός βρόχου για να μη «χάνει» πατήματα ένα button box. */
const LOOP_HZ_GOOD = 250
const LOOP_HZ_BAD = 100
/** Ρεύμα ανά LED στο λευκό, στα 100% φωτεινότητα. */
const WS2812_MA_PER_LED = 60
/** Το ρεύμα που θεωρούμε ότι τραβάει ρεαλιστικά ένα rev light strip (κόκκινο). */
const WS2812_MA_TYPICAL_FACTOR = 0.42

function finding(severity, title, detail, fix, nodeId = null, id = null) {
  return { id: id || `${severity}:${title}`, severity, title, detail, fix, nodeId }
}

/** Το δίκτυο στο οποίο ανήκει ένα pin. */
function netOf(nets, ref) {
  return nets.find((net) => net.some((r) => sameRef(r, ref))) || null
}

function netHasBoardCap(nets, ref, cap, board) {
  const net = netOf(nets, ref)
  if (!net) return false
  return net.some((r) => {
    if (r.node !== BOARD_NODE) return false
    const bp = getBoardPin(board, r.pin)
    return bp && bp.caps.includes(cap)
  })
}

/** Βρίσκει αν το δίκτυο περνάει από εξάρτημα με συγκεκριμένο ρόλο. */
function netHasRole(nets, ref, role, placed) {
  const net = netOf(nets, ref)
  if (!net) return false
  return net.some((r) => placed.find((p) => p.node.id === r.node && p.part.role === role))
}

/**
 * @param {object} build     η κατασκευή
 * @param {object} firmware  η έξοδος του deriveFirmware
 * @returns {{ findings: object[], errors: number, warnings: number, power: object }}
 */
export function runDrc(build, firmware) {
  const board = firmware.board
  const placed = placedParts(build)
  const nets = computeNets(build)
  const out = []

  /* ---------------- 1. Συμβατότητα pin ανά pin ---------------- */
  const boardPinUse = new Map() // boardPinId -> [{nodeId,label,pinLabel,type}]

  for (const { node, part } of placed) {
    for (const pin of part.pins) {
      const ref = { node: node.id, pin: pin.id }
      const links = wiresAt(build, ref).map((w) => otherEnd(w, ref))
      const boardLinks = links.filter((r) => r.node === BOARD_NODE)

      for (const link of boardLinks) {
        const bp = getBoardPin(board, link.pin)
        if (!bp) continue
        const needs = PIN_TYPES[pin.type]?.needs

        if (needs === 'gnd' && !bp.caps.includes('gnd')) {
          out.push(
            finding('error', `${node.label}: GND σε λάθος pin`,
              `Το «${pin.label}» πρέπει να πάει σε GND, όχι στο ${bp.label}.`,
              'Μετακίνησε το καλώδιο σε ένα από τα GND της πλακέτας.', node.id,
              `gnd:${node.id}:${pin.id}`)
          )
        }
        if (needs === 'pwr' && !bp.caps.includes('pwr5') && !bp.caps.includes('pwr3v3')) {
          out.push(
            finding('error', `${node.label}: τροφοδοσία σε λάθος pin`,
              `Το «${pin.label}» ζητάει τάση τροφοδοσίας, αλλά είναι στο ${bp.label}.`,
              'Σύνδεσέ το στο 5V ή στο 3V3.', node.id, `pwr:${node.id}:${pin.id}`)
          )
        }
        if (needs === 'analog' && !bp.caps.includes('analog')) {
          out.push(
            finding('error', `${node.label}: αναλογικό σήμα σε ψηφιακό pin`,
              `Το ${bp.label} δεν έχει ADC — θα διαβάζεις μόνο 0 ή 1 αντί για τη θέση.`,
              `Χρησιμοποίησε ένα από τα ${board.pins.filter((p) => p.caps.includes('analog')).slice(0, 4).map((p) => p.label).join(', ')}.`,
              node.id, `an:${node.id}:${pin.id}`)
          )
        }
        if (needs === 'digital' && !bp.caps.includes('digital')) {
          out.push(
            finding('error', `${node.label}: το ${bp.label} είναι μόνο είσοδος`,
              `Το ${bp.label} δεν μπορεί να οδηγήσει σήμα ή να λειτουργήσει ως ψηφιακό.`,
              'Διάλεξε ένα κανονικό ψηφιακό pin.', node.id, `dig:${node.id}:${pin.id}`)
          )
        }
        if (needs === 'pwm' && !bp.caps.includes('pwm')) {
          out.push(
            finding('warn', `${node.label}: χωρίς PWM στο ${bp.label}`,
              'Θα μπορείς μόνο να το ανάβεις και να το σβήνεις, χωρίς ενδιάμεση ένταση.',
              `Μετακίνησέ το σε PWM pin (${board.pins.filter((p) => p.caps.includes('pwm')).slice(0, 4).map((p) => p.label).join(', ')}).`,
              node.id, `pwm:${node.id}:${pin.id}`)
          )
        }
        for (const bus of ['sda', 'scl', 'sck', 'mosi', 'miso']) {
          if (needs === bus && !bp.caps.includes(bus)) {
            out.push(
              finding('error', `${node.label}: ${bus.toUpperCase()} σε λάθος pin`,
                `Ο δίαυλος είναι σταθερός στο υλικό: το ${bus.toUpperCase()} δεν δουλεύει από το ${bp.label}.`,
                `Σύνδεσέ το στο ${board.pins.find((p) => p.caps.includes(bus))?.label || '—'}.`,
                node.id, `${bus}:${node.id}:${pin.id}`)
            )
          }
        }

        // Καταγραφή χρήσης για ανίχνευση σύγκρουσης.
        const isRail = ['gnd', 'pwr', 'v12'].includes(pin.type)
        if (!isRail) {
          if (!boardPinUse.has(link.pin)) boardPinUse.set(link.pin, [])
          boardPinUse.get(link.pin).push({ nodeId: node.id, label: node.label, pinLabel: pin.label })
        }
      }

      // Ασύνδετα υποχρεωτικά pins.
      if (links.length === 0 && !['exc'].includes(pin.type)) {
        const severity = pin.type === 'gnd' || pin.type === 'pwr' ? 'warn' : 'info'
        out.push(
          finding(severity, `${node.label}: ασύνδετο «${pin.label}»`,
            'Το pin δεν πάει πουθενά, οπότε το εξάρτημα δεν λειτουργεί πλήρως.',
            'Τράβα ένα καλώδιο από αυτό το pin.', node.id, `nc:${node.id}:${pin.id}`)
        )
      }
    }
  }

  for (const [boardPinId, users] of boardPinUse) {
    if (users.length > 1) {
      const bp = getBoardPin(board, boardPinId)
      out.push(
        finding('error', `Σύγκρουση στο ${bp?.label || boardPinId}`,
          `Δύο σήματα στο ίδιο pin: ${users.map((u) => `${u.label} (${u.pinLabel})`).join(' και ')}.`,
          'Δώσε σε καθένα ξεχωριστό pin.', users[0].nodeId, `conflict:${boardPinId}`)
      )
    }
  }

  /* ---------------- 2. HID ---------------- */
  if (firmware.hid.needed && !board.usbHid) {
    out.push(
      finding('error', `Το ${board.name} δεν κάνει USB HID`,
        'Ο επεξεργαστής δεν έχει native USB, οπότε τα Windows δεν θα δουν χειριστήριο.',
        board.arch === 'esp32'
          ? 'Χρησιμοποίησε Bluetooth gamepad (ESP32-BLE-Gamepad) ή άλλαξε σε Pro Micro / Pico.'
          : 'Άλλαξε σε Pro Micro, Leonardo, Pico ή Teensy — ή στείλε τα κουμπιά στο SimHub μέσω serial.',
        null, 'hid:unsupported')
    )
  }
  if (firmware.hid.buttonCount > 32) {
    out.push(
      finding('warn', `${firmware.hid.buttonCount} κουμπιά HID`,
        'Πάνω από 32 κουμπιά: πολλά παιχνίδια και το Windows joy.cpl δείχνουν μόνο τα πρώτα 32.',
        'Μοίρασέ τα σε δύο χειριστήρια ή δήλωσε ρητά περισσότερα στο Joystick constructor.',
        null, 'hid:manybuttons')
    )
  }
  if (firmware.hid.axes.length > 8) {
    out.push(
      finding('error', `${firmware.hid.axes.length} άξονες`,
        'Το πρότυπο HID gamepad δίνει το πολύ 8 άξονες.',
        'Μείωσε τους αναλογικούς αισθητήρες ή χώρισέ τους σε δεύτερη πλακέτα.',
        null, 'hid:manyaxes')
    )
  }

  /* ---------------- 3. Ρεύμα ---------------- */
  const power = computePower(build, firmware, nets, placed)

  if (power.boardRailMa > board.maxCurrentMa) {
    out.push(
      finding('error', `Υπέρβαση ρεύματος: ${Math.round(power.boardRailMa)}mA`,
        `Η πλακέτα αντέχει ~${board.maxCurrentMa}mA από το USB. Στην πράξη θα πέφτει η τάση και θα κάνει reset στη μέση του γύρου.`,
        'Βάλε buck converter 12V→5V ή ξεχωριστή τροφοδοσία 5V για τα LED, με κοινό GND.',
        null, 'power:over')
    )
  } else if (power.boardRailMa > board.maxCurrentMa * 0.75) {
    out.push(
      finding('warn', `Οριακό ρεύμα: ${Math.round(power.boardRailMa)}mA`,
        `Κοντά στο όριο των ${board.maxCurrentMa}mA — μια αιχμή αρκεί για brownout.`,
        'Χαμήλωσε τη φωτεινότητα των LED ή δώσε τους ξεχωριστά 5V.',
        null, 'power:tight')
    )
  }
  if (power.v12Ma > 0 && !power.hasSupply) {
    out.push(
      finding('error', 'Λείπει τροφοδοτικό 12V',
        `Υπάρχουν φορτία που ζητούν ${Math.round(power.v12Ma)}mA στα 12V, χωρίς πηγή.`,
        'Πρόσθεσε «Τροφοδοτικό 12V» και ένωσε το GND του με το GND της πλακέτας.',
        null, 'power:no12v')
    )
  }
  if (power.ext5Ma > 0 && !power.hasBuck && !power.hasSupply) {
    out.push(
      finding('warn', 'Δηλωμένη εξωτερική τροφοδοσία 5V χωρίς πηγή',
        `${Math.round(power.ext5Ma)}mA περιμένουν ρεύμα από πηγή που δεν υπάρχει στον πάγκο.`,
        'Πρόσθεσε buck converter 12V→5V (και τροφοδοτικό), ή ξεδιάλεξε τη «Ξεχωριστή τροφοδοσία 5V».',
        null, 'power:no5v')
    )
  }
  if (power.supplyAmps > 0 && power.externalMa > power.supplyAmps * 1000) {
    out.push(
      finding('warn', 'Μικρό τροφοδοτικό',
        `Τα φορτία ζητούν ~${(power.externalMa / 1000).toFixed(1)}A αλλά το τροφοδοτικό δίνει ${power.supplyAmps}A.`,
        'Ανέβα σε μεγαλύτερο τροφοδοτικό ή μείωσε τα φορτία.',
        null, 'power:smallpsu')
    )
  }

  /* ---------------- 4. Οδήγηση φορτίων ---------------- */
  for (const item of placed) {
    const { node, part } = item
    if (!part.needsMosfet) continue
    const gate = part.pins.find((p) => p.type === 'pwm')
    if (!gate) continue
    const direct = wiresAt(build, { node: node.id, pin: gate.id }).some(
      (w) => otherEnd(w, { node: node.id, pin: gate.id }).node === BOARD_NODE
    )
    const viaMosfet = netHasRole(nets, { node: node.id, pin: gate.id }, 'mosfet', placed)
    if (direct && !viaMosfet) {
      out.push(
        finding('error', `${node.label}: απευθείας στο pin`,
          `Το φορτίο τραβάει πολύ περισσότερο από τα ${board.pinMaxMa}mA που αντέχει ένα pin — θα κάψεις την έξοδο.`,
          'Παρεμβάλλε MOSFET λογικού επιπέδου (π.χ. IRLZ44N) με δίοδο flyback.',
          node.id, `drive:${node.id}`)
      )
    }
  }

  /* ---------------- 5. Λογική στάθμη ---------------- */
  for (const o of firmware.outputs) {
    if (o.part.role !== 'ledstrip' || !o.wired) continue
    if (board.logic >= 5) continue
    const shifted = netHasRole(nets, { node: o.nodeId, pin: 'din' }, 'levelshifter', placed)
    if (!shifted) {
      out.push(
        finding('warn', 'WS2812 με λογική 3.3V',
          'Οι WS2812B θέλουν ~3.5V στο DIN. Από 3.3V πλακέτα δουλεύουν άστατα — «μια στις τρεις εκκινήσεις».',
          'Βάλε level shifter 3.3→5V, ή τροφοδότησε την ταινία με 4.5V, ή θυσίασε το πρώτο LED ως buffer.',
          o.nodeId, `logic:${o.nodeId}`)
      )
    }
  }

  /* ---------------- 6. I2C ---------------- */
  const i2cAddresses = new Map()
  for (const { node, values, part } of placed) {
    if (!values.address) continue
    const key = String(values.address)
    if (!i2cAddresses.has(key)) i2cAddresses.set(key, [])
    i2cAddresses.get(key).push({ node, part })
  }
  for (const [addr, users] of i2cAddresses) {
    if (users.length > 1) {
      out.push(
        finding('error', `Διπλή διεύθυνση I2C ${addr}`,
          `${users.map((u) => u.node.label).join(' και ')} έχουν την ίδια διεύθυνση — ο δίαυλος μπερδεύεται.`,
          'Άλλαξε τη διεύθυνση σε ένα από τα δύο (jumper ADDR ή αντίστοιχη ρύθμιση).',
          users[0].node.id, `i2c:${addr}`)
      )
    }
  }

  /* ---------------- 7. Encoders ---------------- */
  for (const input of firmware.inputs) {
    if (input.kind !== 'encoder' || !input.wired) continue
    if (input.values.useInterrupt) {
      const bad = ['a', 'b'].filter((k) => {
        const target = input.pins[k]
        if (!target) return false
        return !getBoardPin(board, target)?.caps.includes('interrupt')
      })
      if (bad.length) {
        out.push(
          finding('error', `${input.label}: interrupt σε pin χωρίς interrupt`,
            `Ζήτησες διάβασμα με interrupt αλλά τα ${bad.map((k) => input.pins[k]).join(', ')} δεν το υποστηρίζουν.`,
            `Μετακίνησέ τα σε ${board.pins.filter((p) => p.caps.includes('interrupt')).slice(0, 4).map((p) => p.label).join(', ')}.`,
            input.nodeId, `enc:int:${input.nodeId}`)
        )
      }
    } else {
      const maxPulseHz = ((input.values.detents || 20) * 4 * 3) // ~3 στροφές/s γρήγορο γύρισμα
      if (firmware.timing.loopHz > 0 && firmware.timing.loopHz < maxPulseHz * 2) {
        out.push(
          finding('warn', `${input.label}: κίνδυνος για χαμένα βήματα`,
            `Ο βρόχος τρέχει στα ${firmware.timing.loopHz}Hz· ένα γρήγορο γύρισμα παράγει ~${Math.round(maxPulseHz)} μεταβάσεις/s.`,
            'Ενεργοποίησε το διάβασμα με interrupt ή ελάφρυνε τον βρόχο (λιγότερη ανανέωση οθόνης).',
            input.nodeId, `enc:slow:${input.nodeId}`)
        )
      }
    }
  }

  /* ---------------- 8. Ταχύτητα βρόχου ---------------- */
  if (firmware.timing.loopHz > 0 && firmware.timing.loopHz < LOOP_HZ_BAD) {
    const worst = firmware.timing.breakdown[0]
    out.push(
      finding('error', `Πολύ αργός βρόχος: ${firmware.timing.loopHz}Hz`,
        `Καθυστέρηση εισόδου ~${firmware.timing.latencyMs}ms. Θα χάνεις γρήγορα πατήματα και το πεντάλ θα «κολλάει».${worst ? ` Ο μεγαλύτερος καταναλωτής είναι «${worst.label}» με ${Math.round(worst.us)}µs.` : ''}`,
        'Μείωσε τη συχνότητα ανανέωσης της οθόνης, βάλε SPI αντί για I2C, ή δώσε την οθόνη σε δεύτερη πλακέτα.',
        worst?.nodeId || null, 'loop:bad')
    )
  } else if (firmware.timing.loopHz > 0 && firmware.timing.loopHz < LOOP_HZ_GOOD) {
    out.push(
      finding('warn', `Βρόχος στα ${firmware.timing.loopHz}Hz`,
        `Καθυστέρηση ~${firmware.timing.latencyMs}ms. Για κουμπιά είναι ανεκτό, για πεντάλ φρένου όχι.`,
        'Στόχευσε πάνω από 250Hz: λιγότερη ανανέωση οθόνης ή γρηγορότερη πλακέτα.',
        null, 'loop:warn')
    )
  }

  /* ---------------- 9. Μνήμη ---------------- */
  if (firmware.memory.ramPct > 90) {
    out.push(
      finding('error', `RAM στο ${firmware.memory.ramPct}%`,
        `${firmware.memory.ramB} bytes από τα ${Math.round(board.ramKb * 1024)}. Σε αυτό το σημείο η στοίβα χτυπάει στο heap και η πλακέτα κρασάρει τυχαία.`,
        'Λιγότερα LED, οθόνη χωρίς full framebuffer, ή πλακέτα με περισσότερη RAM (Pico, Teensy).',
        null, 'mem:ram')
    )
  } else if (firmware.memory.ramPct > 75) {
    out.push(
      finding('warn', `RAM στο ${firmware.memory.ramPct}%`,
        'Πάνω από 75% — μένει λίγος χώρος για τη στοίβα.',
        'Κράτησέ το κάτω από 75% για ασφάλεια.', null, 'mem:ramwarn')
    )
  }
  if (firmware.memory.flashPct > 95) {
    out.push(
      finding('error', `Flash στο ${firmware.memory.flashPct}%`,
        `${firmware.memory.flashKb}KB από τα ${board.flashKb}KB διαθέσιμα.`,
        'Πέταξε βιβλιοθήκες που δεν χρησιμοποιείς ή ανέβα σε μεγαλύτερη πλακέτα.',
        null, 'mem:flash')
    )
  }
  for (const lib of firmware.memory.incompatible) {
    out.push(
      finding('error', `Η βιβλιοθήκη ${lib.name} δεν τρέχει σε ${board.name}`,
        `Υποστηρίζει: ${lib.arch.join(', ')}.`,
        'Άλλαξε πλακέτα ή βρες εναλλακτική βιβλιοθήκη για αυτή την αρχιτεκτονική.',
        null, `lib:${lib.id}`)
    )
  }

  /* ---------------- 10. Καλές πρακτικές ---------------- */
  for (const { node, part, values } of placed) {
    if (part.role === 'button' && values.pullup === false) {
      const hasExternal = netHasRole(nets, { node: node.id, pin: 'sig' }, 'resistor', placed)
      if (!hasExternal) {
        out.push(
          finding('warn', `${node.label}: χωρίς pull-up`,
            'Το pin «αιωρείται» και διαβάζει τυχαίες τιμές από τον θόρυβο του χώρου.',
            'Ενεργοποίησε το εσωτερικό pull-up ή βάλε αντίσταση 10kΩ προς VCC.',
            node.id, `pull:${node.id}`)
        )
      }
    }
    if (part.role === 'matrix' && values.diodes === false) {
      out.push(
        finding('warn', `${node.label}: χωρίς διόδους`,
          'Τρία ταυτόχρονα πατήματα θα δημιουργήσουν ένα τέταρτο, ανύπαρκτο (ghosting).',
          'Βάλε μία δίοδο 1N4148 σε σειρά με κάθε κουμπί.',
          node.id, `ghost:${node.id}`)
      )
    }
    if (part.role === 'led' && values.resistor === false) {
      out.push(
        finding('warn', `${node.label}: LED χωρίς αντίσταση`,
          `Τραβάει πάνω από τα ${board.pinMaxMa}mA του pin και καίγεται σιγά σιγά.`,
          'Βάλε 220-330Ω σε σειρά.', node.id, `res:${node.id}`)
      )
    }
    if (part.role === 'servo') {
      const fromBoard = netHasBoardCap(nets, { node: node.id, pin: 'vcc' }, 'pwr5', board)
      if (fromBoard) {
        out.push(
          finding('warn', `${node.label}: τροφοδοσία από την πλακέτα`,
            'Η αιχμή εκκίνησης του σέρβο φτάνει ~900mA και ρίχνει την τάση — η πλακέτα κάνει reset.',
            'Δώσε του ξεχωριστά 5V από buck converter, με κοινό GND.',
            node.id, `servo:${node.id}`)
        )
      }
    }
    if (part.role === 'hx711' && values.rateHz === 10) {
      out.push(
        finding('info', `${node.label}: 10 δείγματα/s`,
          'Στα 10 SPS το πεντάλ φρένου αντιδρά με ~100ms καθυστέρηση και μοιάζει «λαστιχένιο».',
          'Κόψε την πίστα RATE στο module και βάλε το σε 80 SPS.',
          node.id, `hx:${node.id}`)
      )
    }
    if (part.role === 'ledstrip' && values.ledCount > 20 && !values.external5v) {
      out.push(
        finding('info', `${node.label}: ${values.ledCount} LED από την πλακέτα`,
          `Στο τέρμα φωτεινότητας θέλουν ~${Math.round((values.ledCount * WS2812_MA_PER_LED * values.brightness) / 100)}mA.`,
          'Ενεργοποίησε τη «Ξεχωριστή τροφοδοσία 5V» και βάλε buck converter.',
          node.id, `strip:${node.id}`)
      )
    }
  }

  // Κοινό GND ανάμεσα σε τροφοδοτικό και πλακέτα.
  const psu = placed.find((x) => x.part.role === 'psu')
  if (psu) {
    const gndNet = netOf(nets, { node: psu.node.id, pin: 'gnd' })
    const shared = gndNet?.some((r) => r.node === BOARD_NODE)
    const sharedVia = gndNet?.some((r) => {
      const other = placed.find((p) => p.node.id === r.node)
      return other && wiresAt(build, r).some((w) => otherEnd(w, r).node === BOARD_NODE)
    })
    if (!shared && !sharedVia) {
      out.push(
        finding('error', 'Ασύνδετο GND τροφοδοτικού',
          'Χωρίς κοινή γείωση, τα σήματα PWM δεν έχουν σημείο αναφοράς και τίποτα δεν δουλεύει σωστά.',
          'Ένωσε το GND του τροφοδοτικού με ένα GND της πλακέτας.',
          psu.node.id, 'gnd:common')
      )
    }
  }

  // Load cell χωρίς ενισχυτή.
  for (const { node, part } of placed) {
    if (part.role !== 'loadcell') continue
    const hasAmp = ['ex', 'sig'].some((pinId) =>
      netHasRole(nets, { node: node.id, pin: pinId }, 'hx711', placed)
    )
    if (!hasAmp) {
      out.push(
        finding('error', `${node.label}: χωρίς ενισχυτή`,
          'Η load cell δίνει μερικά μιλιβόλτ — το ADC του Arduino δεν τα βλέπει καν.',
          'Πρόσθεσε HX711 και σύνδεσε τη γέφυρα πάνω του.',
          node.id, `cell:${node.id}`)
      )
    }
  }

  const findings = out.sort((a, b) => SEVERITY[b.severity] - SEVERITY[a.severity])
  return {
    findings,
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warn').length,
    infos: findings.filter((f) => f.severity === 'info').length,
    power,
  }
}

/**
 * Ισοζύγιο ρεύματος: τι κρέμεται από την πλακέτα και τι από εξωτερική πηγή.
 */
export function computePower(build, firmware, nets, placed) {
  let boardRailMa = 25 // η ίδια η πλακέτα
  let v12Ma = 0
  let ext5Ma = 0
  let supplyAmps = 0
  let hasSupply = false
  let hasBuck = false
  const items = []

  for (const { node, part, values } of placed) {
    if (part.role === 'psu') {
      hasSupply = true
      supplyAmps += values.amps || 0
      continue
    }
    if (part.role === 'buck') {
      hasBuck = true
      continue
    }

    let ma = part.currentMa || 0
    if (part.id === 'ws2812') {
      const count = values.ledCount || 0
      ma =
        count * WS2812_MA_PER_LED * ((values.brightness || 40) / 100) * WS2812_MA_TYPICAL_FACTOR
    }
    if (part.externalCurrentMa) ma = part.externalCurrentMa
    if (ma <= 0) continue

    // Σε ποια γραμμή κρέμεται; Φορτία 12V και ό,τι περνάει από buck δεν
    // βαραίνουν την πλακέτα.
    const on12v = part.pins.some((p) => p.type === 'v12')
    const vccPin = part.pins.find((p) => p.type === 'pwr')
    const onExt5 =
      values.external5v === true ||
      (vccPin && netHasRole(nets, { node: node.id, pin: vccPin.id }, 'buck', placed))

    if (on12v) {
      v12Ma += ma
      items.push({ label: node.label, ma, rail: '12V' })
    } else if (onExt5) {
      ext5Ma += ma
      items.push({ label: node.label, ma, rail: '5V εξωτ.' })
    } else {
      boardRailMa += ma
      items.push({ label: node.label, ma, rail: 'πλακέτα' })
    }
  }

  return {
    boardRailMa,
    v12Ma,
    ext5Ma,
    externalMa: v12Ma + ext5Ma,
    supplyAmps,
    hasSupply,
    hasBuck,
    items: items.sort((a, b) => b.ma - a.ma),
    budgetMa: firmware.board.maxCurrentMa,
    usedPct: Math.round((boardRailMa / firmware.board.maxCurrentMa) * 100),
  }
}

export { pinKey }
