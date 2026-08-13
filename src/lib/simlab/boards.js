/**
 * Κατάλογος πλακετών (MCU boards) για το Εργαστήριο.
 *
 * Τα pins είναι τα ΠΡΑΓΜΑΤΙΚΑ pins κάθε πλακέτας, με τα ονόματα που τυπώνονται
 * πάνω της και με τη σειρά που εμφανίζονται στις δύο σειρές ακροδεκτών. Έτσι
 * ό,τι καλωδιώνεις εδώ αντιστοιχεί ένα προς ένα με το τι θα βιδώσεις στον
 * πάγκο, και ο παραγόμενος κώδικας δείχνει τους σωστούς αριθμούς pin.
 *
 * `caps` = τι μπορεί να κάνει το pin· το drc.js τα ελέγχει.
 *   digital · analog · pwm · interrupt · sda · scl · sck · miso · mosi · cs
 *   gnd · pwr5 · pwr3v3 · vin
 *
 * Τα νούμερα κατανάλωσης/μνήμης είναι ρεαλιστικές εκτιμήσεις για προϋπολογισμό,
 * όχι datasheet ακρίβεια.
 */

/**
 * @param {string} id    μοναδικό id (χρησιμοποιείται στα καλώδια)
 * @param {string[]} caps ικανότητες
 * @param {object} opts  { label, note, ino } — `ino` = πώς γράφεται στον κώδικα
 */
function pin(id, caps, opts = {}) {
  return {
    id,
    label: opts.label || id,
    caps,
    note: opts.note || '',
    ino: opts.ino !== undefined ? opts.ino : null,
  }
}

/** Pin χωρίς λειτουργία για εμάς (RESET, AREF, EN…) — φαίνεται αλλά δεν συνδέεται. */
function inert(id, label, note) {
  return pin(id, [], { label, note })
}

const AVR_ADC_BITS = 10
const RP2040_ADC_BITS = 12
const ESP32_ADC_BITS = 12
const TEENSY_ADC_BITS = 12

/* ================================================================== */
/* SparkFun Pro Micro — ATmega32U4                                     */
/* ================================================================== */
const proMicro = {
  id: 'pro-micro',
  arch: 'avr',
  fqbn: 'arduino:avr:micro',
  ideBoard: 'Arduino Micro',
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
    'Η πιο συνηθισμένη επιλογή για button box / πεντάλ: εμφανίζεται μόνη της ως joystick χωρίς drivers. Δεν έχει VIN — η ανεξέλεγκτη τροφοδοσία μπαίνει στο RAW.',
  pins: [
    // Αριστερή σειρά, από πάνω προς τα κάτω όπως τυπώνεται.
    pin('D1', ['digital', 'interrupt'], { label: 'TX0 / D1', ino: '1', note: 'Σειριακή έξοδος' }),
    pin('D0', ['digital', 'interrupt'], { label: 'RXI / D0', ino: '0', note: 'Σειριακή είσοδος' }),
    pin('GND1', ['gnd'], { label: 'GND' }),
    pin('GND2', ['gnd'], { label: 'GND' }),
    pin('D2', ['digital', 'interrupt', 'sda'], { label: 'D2 (SDA)', ino: '2' }),
    pin('D3', ['digital', 'interrupt', 'pwm', 'scl'], { label: 'D3 (SCL) ~', ino: '3' }),
    pin('D4', ['digital', 'analog'], { label: 'D4 / A6', ino: '4' }),
    pin('D5', ['digital', 'pwm'], { label: 'D5 ~', ino: '5' }),
    pin('D6', ['digital', 'analog', 'pwm'], { label: 'D6 / A7 ~', ino: '6' }),
    pin('D7', ['digital', 'interrupt'], { label: 'D7', ino: '7' }),
    pin('D8', ['digital', 'analog'], { label: 'D8 / A8', ino: '8' }),
    pin('D9', ['digital', 'analog', 'pwm'], { label: 'D9 / A9 ~', ino: '9' }),
    // Δεξιά σειρά.
    pin('RAW', ['vin'], { label: 'RAW', note: 'Είσοδος 5-12V στον ρυθμιστή' }),
    pin('VCC', ['pwr5'], { label: 'VCC (5V)' }),
    inert('RST', 'RST', 'Επανεκκίνηση'),
    pin('GND3', ['gnd'], { label: 'GND' }),
    pin('A3', ['digital', 'analog'], { label: 'A3 / D21', ino: 'A3' }),
    pin('A2', ['digital', 'analog'], { label: 'A2 / D20', ino: 'A2' }),
    pin('A1', ['digital', 'analog'], { label: 'A1 / D19', ino: 'A1' }),
    pin('A0', ['digital', 'analog'], { label: 'A0 / D18', ino: 'A0' }),
    pin('D15', ['digital', 'sck'], { label: 'D15 (SCK)', ino: '15' }),
    pin('D16', ['digital', 'mosi'], { label: 'D16 (MOSI)', ino: '16' }),
    pin('D14', ['digital', 'miso'], { label: 'D14 (MISO)', ino: '14' }),
    pin('D10', ['digital', 'analog', 'pwm', 'cs'], { label: 'D10 / A10 ~', ino: '10' }),
  ],
}

/* ================================================================== */
/* Arduino Leonardo — ATmega32U4 σε header τύπου Uno                   */
/* ================================================================== */
const leonardo = {
  id: 'leonardo',
  arch: 'avr',
  fqbn: 'arduino:avr:leonardo',
  ideBoard: 'Arduino Leonardo',
  name: 'Arduino Leonardo',
  mcu: 'ATmega32U4',
  logic: 5,
  clockMhz: 16,
  flashKb: 28,
  ramKb: 2.5,
  adcBits: AVR_ADC_BITS,
  adcRefV: 5,
  usbHid: true,
  usbPollMs: 1,
  maxCurrentMa: 500,
  pinMaxMa: 40,
  price: 18,
  blurb:
    'Ίδιος επεξεργαστής με το Pro Micro, σε header τύπου Uno. Προσοχή: το SPI βγαίνει ΜΟΝΟ από το ICSP header, όχι από τα D11-D13.',
  pins: [
    inert('IOREF', 'IOREF', 'Τάση αναφοράς για shields'),
    inert('RESET', 'RESET', ''),
    pin('3V3', ['pwr3v3'], { label: '3.3V', note: 'Έως ~50mA' }),
    pin('5V', ['pwr5'], { label: '5V' }),
    pin('GND1', ['gnd'], { label: 'GND' }),
    pin('GND2', ['gnd'], { label: 'GND' }),
    pin('VIN', ['vin'], { label: 'VIN', note: 'Είσοδος 7-12V' }),
    pin('A0', ['digital', 'analog'], { label: 'A0', ino: 'A0' }),
    pin('A1', ['digital', 'analog'], { label: 'A1', ino: 'A1' }),
    pin('A2', ['digital', 'analog'], { label: 'A2', ino: 'A2' }),
    pin('A3', ['digital', 'analog'], { label: 'A3', ino: 'A3' }),
    pin('A4', ['digital', 'analog'], { label: 'A4', ino: 'A4' }),
    pin('A5', ['digital', 'analog'], { label: 'A5', ino: 'A5' }),
    pin('D0', ['digital', 'interrupt'], { label: 'D0 (RX)', ino: '0' }),
    pin('D1', ['digital', 'interrupt'], { label: 'D1 (TX)', ino: '1' }),
    pin('D2', ['digital', 'interrupt', 'sda'], { label: 'D2 (SDA)', ino: '2' }),
    pin('D3', ['digital', 'interrupt', 'pwm', 'scl'], { label: 'D3 (SCL) ~', ino: '3' }),
    pin('D4', ['digital', 'analog'], { label: 'D4 / A6', ino: '4' }),
    pin('D5', ['digital', 'pwm'], { label: 'D5 ~', ino: '5' }),
    pin('D6', ['digital', 'analog', 'pwm'], { label: 'D6 / A7 ~', ino: '6' }),
    pin('D7', ['digital', 'interrupt'], { label: 'D7', ino: '7' }),
    pin('D8', ['digital', 'analog'], { label: 'D8 / A8', ino: '8' }),
    pin('D9', ['digital', 'analog', 'pwm'], { label: 'D9 / A9 ~', ino: '9' }),
    pin('D10', ['digital', 'analog', 'pwm'], { label: 'D10 / A10 ~', ino: '10' }),
    pin('D11', ['digital', 'pwm'], { label: 'D11 ~', ino: '11' }),
    pin('D12', ['digital', 'analog'], { label: 'D12 / A11', ino: '12' }),
    pin('D13', ['digital', 'pwm'], { label: 'D13 ~', ino: '13', note: 'Ενσωματωμένο LED' }),
    inert('AREF', 'AREF', ''),
    pin('ICSP_SCK', ['digital', 'sck'], { label: 'ICSP SCK', ino: 'SCK' }),
    pin('ICSP_MOSI', ['digital', 'mosi'], { label: 'ICSP MOSI', ino: 'MOSI' }),
    pin('ICSP_MISO', ['digital', 'miso'], { label: 'ICSP MISO', ino: 'MISO' }),
  ],
}

/* ================================================================== */
/* Arduino Nano — ATmega328P                                           */
/* ================================================================== */
const nano = {
  id: 'nano',
  arch: 'avr',
  fqbn: 'arduino:avr:nano',
  ideBoard: 'Arduino Nano',
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
    pin('D1', ['digital'], { label: 'D1 (TX)', ino: '1' }),
    pin('D0', ['digital'], { label: 'D0 (RX)', ino: '0' }),
    inert('RESET1', 'RESET', ''),
    pin('GND1', ['gnd'], { label: 'GND' }),
    pin('D2', ['digital', 'interrupt'], { label: 'D2', ino: '2' }),
    pin('D3', ['digital', 'interrupt', 'pwm'], { label: 'D3 ~', ino: '3' }),
    pin('D4', ['digital'], { label: 'D4', ino: '4' }),
    pin('D5', ['digital', 'pwm'], { label: 'D5 ~', ino: '5' }),
    pin('D6', ['digital', 'pwm'], { label: 'D6 ~', ino: '6' }),
    pin('D7', ['digital'], { label: 'D7', ino: '7' }),
    pin('D8', ['digital'], { label: 'D8', ino: '8' }),
    pin('D9', ['digital', 'pwm'], { label: 'D9 ~', ino: '9' }),
    pin('D10', ['digital', 'pwm', 'cs'], { label: 'D10 (SS) ~', ino: '10' }),
    pin('D11', ['digital', 'pwm', 'mosi'], { label: 'D11 (MOSI) ~', ino: '11' }),
    pin('D12', ['digital', 'miso'], { label: 'D12 (MISO)', ino: '12' }),
    pin('D13', ['digital', 'sck'], { label: 'D13 (SCK)', ino: '13', note: 'Ενσωματωμένο LED' }),
    pin('VIN', ['vin'], { label: 'VIN', note: 'Είσοδος 7-12V' }),
    pin('GND2', ['gnd'], { label: 'GND' }),
    inert('RESET2', 'RESET', ''),
    pin('5V', ['pwr5'], { label: '5V' }),
    pin('A7', ['analog'], { label: 'A7', ino: 'A7', note: 'Μόνο αναλογική είσοδος' }),
    pin('A6', ['analog'], { label: 'A6', ino: 'A6', note: 'Μόνο αναλογική είσοδος' }),
    pin('A5', ['digital', 'analog', 'scl'], { label: 'A5 (SCL)', ino: 'A5' }),
    pin('A4', ['digital', 'analog', 'sda'], { label: 'A4 (SDA)', ino: 'A4' }),
    pin('A3', ['digital', 'analog'], { label: 'A3', ino: 'A3' }),
    pin('A2', ['digital', 'analog'], { label: 'A2', ino: 'A2' }),
    pin('A1', ['digital', 'analog'], { label: 'A1', ino: 'A1' }),
    pin('A0', ['digital', 'analog'], { label: 'A0', ino: 'A0' }),
    pin('3V3', ['pwr3v3'], { label: '3V3', note: 'Έως ~50mA' }),
    inert('AREF', 'AREF', ''),
  ],
}

/* ================================================================== */
/* Arduino Uno R3 — ATmega328P                                         */
/* ================================================================== */
const uno = {
  id: 'uno',
  arch: 'avr',
  fqbn: 'arduino:avr:uno',
  ideBoard: 'Arduino Uno',
  name: 'Arduino Uno R3',
  mcu: 'ATmega328P',
  logic: 5,
  clockMhz: 16,
  flashKb: 31.5,
  ramKb: 2,
  adcBits: AVR_ADC_BITS,
  adcRefV: 5,
  usbHid: false,
  usbPollMs: 8,
  maxCurrentMa: 450,
  pinMaxMa: 40,
  price: 22,
  blurb:
    'Ό,τι και το Nano σε μεγαλύτερο σώμα με shields, χωρίς τα A6/A7. Επίσης χωρίς native HID.',
  pins: [
    inert('IOREF', 'IOREF', ''),
    inert('RESET', 'RESET', ''),
    pin('3V3', ['pwr3v3'], { label: '3.3V', note: 'Έως 50mA' }),
    pin('5V', ['pwr5'], { label: '5V' }),
    pin('GND1', ['gnd'], { label: 'GND' }),
    pin('GND2', ['gnd'], { label: 'GND' }),
    pin('VIN', ['vin'], { label: 'VIN', note: 'Είσοδος 7-12V' }),
    pin('A0', ['digital', 'analog'], { label: 'A0', ino: 'A0' }),
    pin('A1', ['digital', 'analog'], { label: 'A1', ino: 'A1' }),
    pin('A2', ['digital', 'analog'], { label: 'A2', ino: 'A2' }),
    pin('A3', ['digital', 'analog'], { label: 'A3', ino: 'A3' }),
    pin('A4', ['digital', 'analog', 'sda'], { label: 'A4 (SDA)', ino: 'A4' }),
    pin('A5', ['digital', 'analog', 'scl'], { label: 'A5 (SCL)', ino: 'A5' }),
    pin('D0', ['digital'], { label: 'D0 (RX)', ino: '0' }),
    pin('D1', ['digital'], { label: 'D1 (TX)', ino: '1' }),
    pin('D2', ['digital', 'interrupt'], { label: 'D2', ino: '2' }),
    pin('D3', ['digital', 'interrupt', 'pwm'], { label: 'D3 ~', ino: '3' }),
    pin('D4', ['digital'], { label: 'D4', ino: '4' }),
    pin('D5', ['digital', 'pwm'], { label: 'D5 ~', ino: '5' }),
    pin('D6', ['digital', 'pwm'], { label: 'D6 ~', ino: '6' }),
    pin('D7', ['digital'], { label: 'D7', ino: '7' }),
    pin('D8', ['digital'], { label: 'D8', ino: '8' }),
    pin('D9', ['digital', 'pwm'], { label: 'D9 ~', ino: '9' }),
    pin('D10', ['digital', 'pwm', 'cs'], { label: 'D10 (SS) ~', ino: '10' }),
    pin('D11', ['digital', 'pwm', 'mosi'], { label: 'D11 (MOSI) ~', ino: '11' }),
    pin('D12', ['digital', 'miso'], { label: 'D12 (MISO)', ino: '12' }),
    pin('D13', ['digital', 'sck'], { label: 'D13 (SCK)', ino: '13', note: 'Ενσωματωμένο LED' }),
    pin('GND3', ['gnd'], { label: 'GND' }),
    inert('AREF', 'AREF', ''),
  ],
}

/* ================================================================== */
/* Raspberry Pi Pico — RP2040                                          */
/* ================================================================== */
const pico = {
  id: 'pico',
  arch: 'rp2040',
  fqbn: 'rp2040:rp2040:rpipico',
  ideBoard: 'Raspberry Pi Pico (πακέτο "Raspberry Pi Pico/RP2040" του Earle Philhower)',
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
    'Πολύ γρήγορο και φθηνό, native HID μέσω TinyUSB. Λογική 3.3V — τα 5V εξαρτήματα θέλουν level shifter. Τα GP23/24/25 είναι εσωτερικά και δεν βγαίνουν στο header.',
  pins: [
    // Αριστερή σειρά (pins 1-20)
    pin('GP0', ['digital', 'pwm', 'interrupt'], { label: 'GP0 (TX)', ino: '0' }),
    pin('GP1', ['digital', 'pwm', 'interrupt'], { label: 'GP1 (RX)', ino: '1' }),
    pin('GND1', ['gnd'], { label: 'GND' }),
    pin('GP2', ['digital', 'pwm', 'interrupt'], { label: 'GP2', ino: '2' }),
    pin('GP3', ['digital', 'pwm', 'interrupt'], { label: 'GP3', ino: '3' }),
    pin('GP4', ['digital', 'pwm', 'interrupt', 'sda'], { label: 'GP4 (SDA)', ino: '4' }),
    pin('GP5', ['digital', 'pwm', 'interrupt', 'scl'], { label: 'GP5 (SCL)', ino: '5' }),
    pin('GND2', ['gnd'], { label: 'GND' }),
    pin('GP6', ['digital', 'pwm', 'interrupt'], { label: 'GP6', ino: '6' }),
    pin('GP7', ['digital', 'pwm', 'interrupt'], { label: 'GP7', ino: '7' }),
    pin('GP8', ['digital', 'pwm', 'interrupt'], { label: 'GP8', ino: '8' }),
    pin('GP9', ['digital', 'pwm', 'interrupt'], { label: 'GP9', ino: '9' }),
    pin('GND3', ['gnd'], { label: 'GND' }),
    pin('GP10', ['digital', 'pwm', 'interrupt'], { label: 'GP10', ino: '10' }),
    pin('GP11', ['digital', 'pwm', 'interrupt'], { label: 'GP11', ino: '11' }),
    pin('GP12', ['digital', 'pwm', 'interrupt'], { label: 'GP12', ino: '12' }),
    pin('GP13', ['digital', 'pwm', 'interrupt'], { label: 'GP13', ino: '13' }),
    pin('GND4', ['gnd'], { label: 'GND' }),
    pin('GP14', ['digital', 'pwm', 'interrupt'], { label: 'GP14', ino: '14' }),
    pin('GP15', ['digital', 'pwm', 'interrupt'], { label: 'GP15', ino: '15' }),
    // Δεξιά σειρά (pins 40-21)
    pin('VBUS', ['pwr5'], { label: 'VBUS (5V)', note: 'Απευθείας από το USB' }),
    pin('VSYS', ['vin'], { label: 'VSYS', note: 'Είσοδος 1.8-5.5V' }),
    pin('GND5', ['gnd'], { label: 'GND' }),
    inert('3V3_EN', '3V3_EN', 'Απενεργοποίηση ρυθμιστή'),
    pin('3V3', ['pwr3v3'], { label: '3V3 (OUT)', note: 'Έως ~300mA' }),
    inert('ADC_VREF', 'ADC_VREF', 'Αναφορά ADC'),
    pin('GP28', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'GP28 / A2', ino: '28' }),
    pin('AGND', ['gnd'], { label: 'AGND', note: 'Γείωση αναλογικών' }),
    pin('GP27', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'GP27 / A1', ino: '27' }),
    pin('GP26', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'GP26 / A0', ino: '26' }),
    inert('RUN', 'RUN', 'Επανεκκίνηση'),
    pin('GP22', ['digital', 'pwm', 'interrupt'], { label: 'GP22', ino: '22' }),
    pin('GND6', ['gnd'], { label: 'GND' }),
    pin('GP21', ['digital', 'pwm', 'interrupt'], { label: 'GP21', ino: '21' }),
    pin('GP20', ['digital', 'pwm', 'interrupt'], { label: 'GP20', ino: '20' }),
    pin('GP19', ['digital', 'pwm', 'interrupt', 'mosi'], { label: 'GP19 (MOSI)', ino: '19' }),
    pin('GP18', ['digital', 'pwm', 'interrupt', 'sck'], { label: 'GP18 (SCK)', ino: '18' }),
    pin('GND7', ['gnd'], { label: 'GND' }),
    pin('GP17', ['digital', 'pwm', 'interrupt', 'cs'], { label: 'GP17 (CS)', ino: '17' }),
    pin('GP16', ['digital', 'pwm', 'interrupt', 'miso'], { label: 'GP16 (MISO)', ino: '16' }),
  ],
}

/* ================================================================== */
/* ESP32 DevKit v1 (30 pins)                                           */
/* ================================================================== */
const esp32 = {
  id: 'esp32',
  arch: 'esp32',
  fqbn: 'esp32:esp32:esp32doit-devkit-v1',
  ideBoard: 'DOIT ESP32 DEVKIT V1',
  name: 'ESP32 DevKit v1',
  mcu: 'ESP32-WROOM-32',
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
  blurb:
    'Η επιλογή για ασύρματο τιμόνι ή WiFi τηλεμετρία. Δεν κάνει USB HID — κάνει Bluetooth gamepad ή UDP. Τα IO34-39 είναι μόνο είσοδοι.',
  pins: [
    // Αριστερή σειρά
    inert('EN', 'EN', 'Επανεκκίνηση'),
    pin('GPIO36', ['analog', 'interrupt'], { label: 'VP / IO36', ino: '36', note: 'Μόνο είσοδος' }),
    pin('GPIO39', ['analog', 'interrupt'], { label: 'VN / IO39', ino: '39', note: 'Μόνο είσοδος' }),
    pin('GPIO34', ['analog', 'interrupt'], { label: 'IO34', ino: '34', note: 'Μόνο είσοδος' }),
    pin('GPIO35', ['analog', 'interrupt'], { label: 'IO35', ino: '35', note: 'Μόνο είσοδος' }),
    pin('GPIO32', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'IO32', ino: '32' }),
    pin('GPIO33', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'IO33', ino: '33' }),
    pin('GPIO25', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'IO25 (DAC1)', ino: '25' }),
    pin('GPIO26', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'IO26 (DAC2)', ino: '26' }),
    pin('GPIO27', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'IO27', ino: '27' }),
    pin('GPIO14', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'IO14', ino: '14' }),
    pin('GPIO12', ['digital', 'pwm', 'interrupt', 'analog'], {
      label: 'IO12',
      ino: '12',
      note: 'Strapping pin — μην το τραβάς HIGH στην εκκίνηση',
    }),
    pin('GND1', ['gnd'], { label: 'GND' }),
    pin('GPIO13', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'IO13', ino: '13' }),
    pin('GPIO9', ['digital', 'pwm', 'interrupt'], { label: 'D2 / IO9', ino: '9', note: 'Flash — απόφυγε' }),
    pin('GPIO10', ['digital', 'pwm', 'interrupt'], { label: 'D3 / IO10', ino: '10', note: 'Flash — απόφυγε' }),
    // Δεξιά σειρά
    pin('VIN', ['vin'], { label: 'VIN (5V)', note: 'Είσοδος 5V' }),
    pin('GND2', ['gnd'], { label: 'GND' }),
    pin('GPIO23', ['digital', 'pwm', 'interrupt', 'mosi'], { label: 'IO23 (MOSI)', ino: '23' }),
    pin('GPIO22', ['digital', 'pwm', 'interrupt', 'scl'], { label: 'IO22 (SCL)', ino: '22' }),
    pin('GPIO1', ['digital'], { label: 'TX0 / IO1', ino: '1', note: 'Σειριακή' }),
    pin('GPIO3', ['digital'], { label: 'RX0 / IO3', ino: '3', note: 'Σειριακή' }),
    pin('GPIO21', ['digital', 'pwm', 'interrupt', 'sda'], { label: 'IO21 (SDA)', ino: '21' }),
    pin('GND3', ['gnd'], { label: 'GND' }),
    pin('GPIO19', ['digital', 'pwm', 'interrupt', 'miso'], { label: 'IO19 (MISO)', ino: '19' }),
    pin('GPIO18', ['digital', 'pwm', 'interrupt', 'sck'], { label: 'IO18 (SCK)', ino: '18' }),
    pin('GPIO5', ['digital', 'pwm', 'interrupt', 'cs'], { label: 'IO5 (SS)', ino: '5' }),
    pin('GPIO17', ['digital', 'pwm', 'interrupt'], { label: 'TX2 / IO17', ino: '17' }),
    pin('GPIO16', ['digital', 'pwm', 'interrupt'], { label: 'RX2 / IO16', ino: '16' }),
    pin('GPIO4', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'IO4', ino: '4' }),
    pin('GPIO2', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'IO2', ino: '2', note: 'Ενσωματωμένο LED' }),
    pin('GPIO15', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'IO15', ino: '15' }),
    pin('3V3', ['pwr3v3'], { label: '3V3', note: 'Έως ~500mA' }),
  ],
}

/* ================================================================== */
/* Teensy 4.1 — i.MX RT1062                                            */
/* ================================================================== */
function teensyDigital(n, extra = [], opts = {}) {
  return pin(`D${n}`, ['digital', 'pwm', 'interrupt', ...extra], {
    label: opts.label || `D${n}`,
    ino: String(n),
    note: opts.note || '',
  })
}

const teensy = {
  id: 'teensy41',
  arch: 'teensy',
  fqbn: 'teensy:avr:teensy41',
  ideBoard: 'Teensy 4.1 (Teensyduino) — Tools ▸ USB Type ▸ Serial + Keyboard + Mouse + Joystick',
  name: 'Teensy 4.1',
  mcu: 'i.MX RT1062',
  logic: 3.3,
  clockMhz: 600,
  flashKb: 7936,
  ramKb: 1024,
  adcBits: TEENSY_ADC_BITS,
  adcRefV: 3.3,
  usbHid: true,
  usbPollMs: 1,
  maxCurrentMa: 250,
  pinMaxMa: 10,
  price: 32,
  blurb:
    'Υπερβολικό για button box, ιδανικό για κλειστό βρόχο (direct drive, active pedal): 600MHz και εξαιρετικό USB HID. Λογική 3.3V, ΜΗΝ βάλεις 5V στα pins.',
  pins: [
    // Αριστερή σειρά
    pin('GND1', ['gnd'], { label: 'GND' }),
    teensyDigital(0, [], { label: 'D0 (RX1)' }),
    teensyDigital(1, [], { label: 'D1 (TX1)' }),
    teensyDigital(2),
    teensyDigital(3),
    teensyDigital(4),
    teensyDigital(5),
    teensyDigital(6),
    teensyDigital(7, [], { label: 'D7 (RX2)' }),
    teensyDigital(8, [], { label: 'D8 (TX2)' }),
    teensyDigital(9),
    teensyDigital(10, ['cs'], { label: 'D10 (CS)' }),
    teensyDigital(11, ['mosi'], { label: 'D11 (MOSI)' }),
    teensyDigital(12, ['miso'], { label: 'D12 (MISO)' }),
    pin('3V3a', ['pwr3v3'], { label: '3.3V', note: 'Έως 250mA' }),
    pin('D24', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'D24 / A10', ino: '24' }),
    pin('D25', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'D25 / A11', ino: '25' }),
    pin('D26', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'D26 / A12', ino: '26' }),
    pin('D27', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'D27 / A13', ino: '27' }),
    teensyDigital(28),
    teensyDigital(29),
    teensyDigital(30),
    teensyDigital(31),
    teensyDigital(32),
    // Δεξιά σειρά
    pin('VIN', ['vin'], { label: 'VIN', note: 'Είσοδος 3.6-5.5V' }),
    pin('GND2', ['gnd'], { label: 'GND' }),
    pin('3V3b', ['pwr3v3'], { label: '3.3V' }),
    pin('D23', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'D23 / A9', ino: '23' }),
    pin('D22', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'D22 / A8', ino: '22' }),
    pin('D21', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'D21 / A7', ino: '21' }),
    pin('D20', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'D20 / A6', ino: '20' }),
    pin('D19', ['digital', 'pwm', 'interrupt', 'analog', 'scl'], { label: 'D19 / A5 (SCL)', ino: '19' }),
    pin('D18', ['digital', 'pwm', 'interrupt', 'analog', 'sda'], { label: 'D18 / A4 (SDA)', ino: '18' }),
    pin('D17', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'D17 / A3', ino: '17' }),
    pin('D16', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'D16 / A2', ino: '16' }),
    pin('D15', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'D15 / A1', ino: '15' }),
    pin('D14', ['digital', 'pwm', 'interrupt', 'analog'], { label: 'D14 / A0', ino: '14' }),
    teensyDigital(13, ['sck'], { label: 'D13 (SCK, LED)' }),
    teensyDigital(41, [], { label: 'D41 / A17' }),
    teensyDigital(40, [], { label: 'D40 / A16' }),
    teensyDigital(39, [], { label: 'D39 / A15' }),
    teensyDigital(38, [], { label: 'D38 / A14' }),
    teensyDigital(37),
    teensyDigital(36),
    teensyDigital(35),
    teensyDigital(34),
    teensyDigital(33),
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

/**
 * Το όνομα που δέχεται ο μεταγλωττιστής για ένα pin (π.χ. 'D6' → '6', 'A2' → 'A2').
 * Ζει εδώ ώστε να μη μαντεύει η γεννήτρια κώδικα από το id.
 */
export function inoPin(board, pinId) {
  const p = getBoardPin(board, pinId)
  return p && p.ino ? p.ino : null
}
