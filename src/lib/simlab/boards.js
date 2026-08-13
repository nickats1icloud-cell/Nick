/**
 * Κατάλογος πλακετών (MCU boards) για το Εργαστήριο.
 *
 * Κάθε πλακέτα περιγράφει τα pins της με «ικανότητες» (caps) ώστε ο έλεγχος
 * σχεδίασης (drc.js) να μπορεί να πει αν ένα εξάρτημα επιτρέπεται σε ένα pin.
 * Τα νούμερα (ρεύμα, μνήμη, κόστος) είναι ρεαλιστικά αλλά στρογγυλεμένα —
 * φτιαγμένα για χρήσιμη εκτίμηση, όχι για datasheet ακρίβεια.
 */

/** Ικανότητες pin: digital, analog, pwm, interrupt, sda, scl, sck, miso, mosi. */
function pin(id, caps, opts = {}) {
  return { id, label: opts.label || id, caps, note: opts.note || '' }
}

/** Pins τροφοδοσίας — κοινά σε όλες τις πλακέτες. */
function powerPins(logic, hasVin = true) {
  const out = [pin('GND', ['gnd']), pin('GND2', ['gnd'], { label: 'GND' })]
  if (logic === 5) {
    out.push(pin('5V', ['pwr5']))
    out.push(pin('3V3', ['pwr3v3'], { note: 'Χαμηλό ρεύμα (~50mA)' }))
  } else {
    out.push(pin('3V3', ['pwr3v3']))
    out.push(pin('5V', ['pwr5'], { note: 'Περνάει από USB, όχι από τον ρυθμιστή' }))
  }
  if (hasVin) out.push(pin('VIN', ['vin']))
  return out
}

const AVR_ADC_BITS = 10
const RP2040_ADC_BITS = 12
const ESP32_ADC_BITS = 12
const TEENSY_ADC_BITS = 12

/** Arduino Pro Micro / Leonardo — ATmega32U4, native USB HID. */
const proMicro = {
  id: 'pro-micro',
  arch: 'avr',
  name: 'Arduino Pro Micro',
  mcu: 'ATmega32U4',
  logic: 5,
  clockMhz: 16,
  flashKb: 28,
  ramKb: 2.5,
  adcBits: AVR_ADC_BITS,
  adcRefV: 5,
  usbHid: true,
  usbPollMs: 1,
  maxCurrentMa: 480,
  pinMaxMa: 40,
  price: 8,
  blurb:
    'Η πιο συνηθισμένη επιλογή για button box / πεντάλ: εμφανίζεται μόνη της ως joystick χωρίς drivers.',
  pins: [
    ...powerPins(5),
    pin('D0', ['digital', 'interrupt'], { note: 'RX — αποφυγή αν θες Serial' }),
    pin('D1', ['digital', 'interrupt'], { note: 'TX — αποφυγή αν θες Serial' }),
    pin('D2', ['digital', 'interrupt', 'sda']),
    pin('D3', ['digital', 'interrupt', 'pwm', 'scl']),
    pin('D4', ['digital', 'analog'], { label: 'D4/A6' }),
    pin('D5', ['digital', 'pwm']),
    pin('D6', ['digital', 'analog', 'pwm'], { label: 'D6/A7' }),
    pin('D7', ['digital', 'interrupt']),
    pin('D8', ['digital', 'analog'], { label: 'D8/A8' }),
    pin('D9', ['digital', 'analog', 'pwm'], { label: 'D9/A9' }),
    pin('D10', ['digital', 'analog', 'pwm'], { label: 'D10/A10' }),
    pin('D14', ['digital', 'miso']),
    pin('D15', ['digital', 'sck']),
    pin('D16', ['digital', 'mosi']),
    pin('A0', ['digital', 'analog']),
    pin('A1', ['digital', 'analog']),
    pin('A2', ['digital', 'analog']),
    pin('A3', ['digital', 'analog']),
  ],
}

const leonardo = {
  ...proMicro,
  id: 'leonardo',
  name: 'Arduino Leonardo',
  price: 18,
  maxCurrentMa: 500,
  blurb: 'Ίδιος επεξεργαστής με το Pro Micro αλλά με περισσότερα pins και βαρέλι τροφοδοσίας.',
  pins: [
    ...powerPins(5),
    pin('D0', ['digital', 'interrupt'], { note: 'RX' }),
    pin('D1', ['digital', 'interrupt'], { note: 'TX' }),
    pin('D2', ['digital', 'interrupt', 'sda']),
    pin('D3', ['digital', 'interrupt', 'pwm', 'scl']),
    pin('D4', ['digital', 'analog'], { label: 'D4/A6' }),
    pin('D5', ['digital', 'pwm']),
    pin('D6', ['digital', 'analog', 'pwm'], { label: 'D6/A7' }),
    pin('D7', ['digital', 'interrupt']),
    pin('D8', ['digital', 'analog'], { label: 'D8/A8' }),
    pin('D9', ['digital', 'analog', 'pwm'], { label: 'D9/A9' }),
    pin('D10', ['digital', 'analog', 'pwm'], { label: 'D10/A10' }),
    pin('D11', ['digital', 'pwm']),
    pin('D12', ['digital', 'analog'], { label: 'D12/A11' }),
    pin('D13', ['digital', 'pwm'], { note: 'Ενσωματωμένο LED' }),
    pin('A0', ['digital', 'analog']),
    pin('A1', ['digital', 'analog']),
    pin('A2', ['digital', 'analog']),
    pin('A3', ['digital', 'analog']),
    pin('A4', ['digital', 'analog']),
    pin('A5', ['digital', 'analog']),
    pin('SCK', ['digital', 'sck']),
    pin('MISO', ['digital', 'miso']),
    pin('MOSI', ['digital', 'mosi']),
  ],
}

const nano = {
  id: 'nano',
  arch: 'avr',
  name: 'Arduino Nano',
  mcu: 'ATmega328P',
  logic: 5,
  clockMhz: 16,
  flashKb: 30,
  ramKb: 2,
  adcBits: AVR_ADC_BITS,
  adcRefV: 5,
  usbHid: false,
  usbPollMs: 8,
  maxCurrentMa: 450,
  pinMaxMa: 40,
  price: 5,
  blurb:
    'Φθηνό αλλά ΔΕΝ κάνει native USB HID: χρειάζεται SimHub serial ή reflash του 16U2 για να γίνει joystick.',
  pins: [
    ...powerPins(5),
    pin('D2', ['digital', 'interrupt']),
    pin('D3', ['digital', 'interrupt', 'pwm']),
    pin('D4', ['digital']),
    pin('D5', ['digital', 'pwm']),
    pin('D6', ['digital', 'pwm']),
    pin('D7', ['digital']),
    pin('D8', ['digital']),
    pin('D9', ['digital', 'pwm']),
    pin('D10', ['digital', 'pwm', 'cs']),
    pin('D11', ['digital', 'pwm', 'mosi']),
    pin('D12', ['digital', 'miso']),
    pin('D13', ['digital', 'sck'], { note: 'Ενσωματωμένο LED' }),
    pin('A0', ['digital', 'analog']),
    pin('A1', ['digital', 'analog']),
    pin('A2', ['digital', 'analog']),
    pin('A3', ['digital', 'analog']),
    pin('A4', ['digital', 'analog', 'sda']),
    pin('A5', ['digital', 'analog', 'scl']),
    pin('A6', ['analog'], { note: 'Μόνο analog είσοδος' }),
    pin('A7', ['analog'], { note: 'Μόνο analog είσοδος' }),
  ],
}

const uno = {
  ...nano,
  id: 'uno',
  name: 'Arduino Uno R3',
  price: 22,
  ramKb: 2,
  blurb: 'Ό,τι και το Nano σε μεγαλύτερο σώμα με shields. Επίσης χωρίς native HID.',
  pins: nano.pins.filter((p) => p.id !== 'A6' && p.id !== 'A7'),
}

const pico = {
  id: 'pico',
  arch: 'rp2040',
  name: 'Raspberry Pi Pico',
  mcu: 'RP2040',
  logic: 3.3,
  clockMhz: 133,
  flashKb: 2048,
  ramKb: 264,
  adcBits: RP2040_ADC_BITS,
  adcRefV: 3.3,
  usbHid: true,
  usbPollMs: 1,
  maxCurrentMa: 300,
  pinMaxMa: 12,
  price: 5,
  blurb:
    'Πολύ γρήγορο και φθηνό, native HID μέσω TinyUSB. Προσοχή: λογική 3.3V — τα 5V εξαρτήματα θέλουν level shifter.',
  pins: [
    ...powerPins(3.3),
    ...Array.from({ length: 23 }, (_, i) => {
      const caps = ['digital', 'pwm', 'interrupt']
      if (i === 4) caps.push('sda')
      if (i === 5) caps.push('scl')
      if (i === 16) caps.push('miso')
      if (i === 18) caps.push('sck')
      if (i === 19) caps.push('mosi')
      return pin(`GP${i}`, caps)
    }),
    pin('GP26', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'GP26/A0' }),
    pin('GP27', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'GP27/A1' }),
    pin('GP28', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'GP28/A2' }),
  ],
}

const esp32 = {
  id: 'esp32',
  arch: 'esp32',
  name: 'ESP32 DevKit v1',
  mcu: 'ESP32-WROOM',
  logic: 3.3,
  clockMhz: 240,
  flashKb: 4096,
  ramKb: 320,
  adcBits: ESP32_ADC_BITS,
  adcRefV: 3.3,
  usbHid: false,
  usbPollMs: 8,
  maxCurrentMa: 400,
  pinMaxMa: 12,
  price: 9,
  wireless: true,
  price12v: 0,
  blurb:
    'Η επιλογή για ασύρματο τιμόνι ή WiFi τηλεμετρία. Δεν κάνει USB HID — κάνει όμως Bluetooth HID ή UDP.',
  pins: [
    ...powerPins(3.3),
    ...[13, 12, 14, 27, 26, 25, 33, 32].map((n) =>
      pin(`GPIO${n}`, ['digital', 'pwm', 'interrupt', 'analog'], { label: `IO${n}` })
    ),
    ...[35, 34, 39, 36].map((n) =>
      pin(`GPIO${n}`, ['analog', 'interrupt'], { label: `IO${n}`, note: 'Μόνο είσοδος' })
    ),
    pin('GPIO21', ['digital', 'pwm', 'interrupt', 'sda'], { label: 'IO21' }),
    pin('GPIO22', ['digital', 'pwm', 'interrupt', 'scl'], { label: 'IO22' }),
    pin('GPIO23', ['digital', 'pwm', 'interrupt', 'mosi'], { label: 'IO23' }),
    pin('GPIO19', ['digital', 'pwm', 'interrupt', 'miso'], { label: 'IO19' }),
    pin('GPIO18', ['digital', 'pwm', 'interrupt', 'sck'], { label: 'IO18' }),
    pin('GPIO5', ['digital', 'pwm', 'interrupt', 'cs'], { label: 'IO5' }),
    pin('GPIO4', ['digital', 'pwm', 'interrupt'], { label: 'IO4' }),
    pin('GPIO16', ['digital', 'pwm', 'interrupt'], { label: 'IO16' }),
    pin('GPIO17', ['digital', 'pwm', 'interrupt'], { label: 'IO17' }),
  ],
}

const teensy = {
  id: 'teensy41',
  arch: 'teensy',
  name: 'Teensy 4.1',
  mcu: 'i.MX RT1062',
  logic: 3.3,
  clockMhz: 600,
  flashKb: 8192,
  ramKb: 1024,
  adcBits: TEENSY_ADC_BITS,
  adcRefV: 3.3,
  usbHid: true,
  usbPollMs: 1,
  maxCurrentMa: 250,
  pinMaxMa: 10,
  price: 32,
  blurb:
    'Υπερβολικό για button box, ιδανικό για κλειστό βρόχο (direct drive, active pedal): 600MHz και εξαιρετικό USB HID.',
  pins: [
    ...powerPins(3.3),
    ...Array.from({ length: 14 }, (_, i) => {
      const caps = ['digital', 'pwm', 'interrupt']
      if (i === 11) caps.push('mosi')
      if (i === 12) caps.push('miso')
      if (i === 13) caps.push('sck')
      return pin(`D${i}`, caps)
    }),
    pin('D18', ['digital', 'pwm', 'interrupt', 'analog', 'sda'], { label: 'D18/A4' }),
    pin('D19', ['digital', 'pwm', 'interrupt', 'analog', 'scl'], { label: 'D19/A5' }),
    ...Array.from({ length: 10 }, (_, i) =>
      pin(`A${i}`, ['digital', 'analog', 'pwm', 'interrupt'])
    ),
  ],
}

export const BOARDS = [proMicro, leonardo, nano, uno, pico, esp32, teensy]

export function getBoard(id) {
  return BOARDS.find((b) => b.id === id) || proMicro
}

export function getBoardPin(board, pinId) {
  return board.pins.find((p) => p.id === pinId) || null
}

/** Πόσα pins της πλακέτας υποστηρίζουν μια ικανότητα (π.χ. πόσα analog έχει). */
export function countCap(board, cap) {
  return board.pins.filter((p) => p.caps.includes(cap)).length
}
