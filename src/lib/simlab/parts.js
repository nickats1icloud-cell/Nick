/**
 * Βιβλιοθήκη εξαρτημάτων του Εργαστηρίου.
 *
 * Κάθε εξάρτημα δηλώνει: pins (τι καλωδιώνεται πού), ρόλο (τι κάνει στο
 * firmware), παραμέτρους (τι ρυθμίζεις), κόστος βρόχου σε μικροδευτερόλεπτα
 * (πόσο «τρώει» από το loop) και κατανάλωση.
 *
 * Οι τιμές (€) και τα ρεύματα είναι ρεαλιστικές εκτιμήσεις αγοράς 2025 για
 * χρήση σε προϋπολογισμό — όχι προσφορά προμηθευτή.
 */

/** Τύποι pin εξαρτημάτων. Το drc.js τους αντιστοιχεί σε ικανότητες pin πλακέτας. */
export const PIN_TYPES = {
  gnd: { label: 'GND', needs: 'gnd', color: '#6b7280' },
  pwr: { label: 'VCC', needs: 'pwr', color: '#ef4444' },
  v12: { label: '12V', needs: 'v12', color: '#b91c1c' },
  din: { label: 'ψηφιακό → MCU', needs: 'digital', color: '#38bdf8' },
  dout: { label: 'MCU → ψηφιακό', needs: 'digital', color: '#34d399' },
  aout: { label: 'αναλογικό → MCU', needs: 'analog', color: '#fbbf24' },
  pwm: { label: 'PWM → εξάρτημα', needs: 'pwm', color: '#f472b6' },
  sda: { label: 'I2C SDA', needs: 'sda', color: '#a78bfa' },
  scl: { label: 'I2C SCL', needs: 'scl', color: '#a78bfa' },
  sck: { label: 'SPI SCK', needs: 'sck', color: '#c084fc' },
  mosi: { label: 'SPI MOSI', needs: 'mosi', color: '#c084fc' },
  miso: { label: 'SPI MISO', needs: 'miso', color: '#c084fc' },
  cs: { label: 'SPI CS', needs: 'digital', color: '#c084fc' },
  exc: { label: 'Γέφυρα load cell', needs: 'bridge', color: '#fb923c' },
}

function p(id, type, label, side = 'right') {
  return { id, type, label: label || PIN_TYPES[type].label, side }
}

/** Τυπικά pins τροφοδοσίας εξαρτήματος. */
const VCC_GND = [p('vcc', 'pwr', 'VCC', 'left'), p('gnd', 'gnd', 'GND', 'left')]

/* ------------------------------------------------------------------ */
/* Κόστος βρόχου (µs) ανά λειτουργία — από μετρήσεις σε AVR/ARM        */
/* ------------------------------------------------------------------ */
export const LOOP_COST = {
  digitalRead: 4,
  analogReadAvr: 112,
  analogReadFast: 6,
  hx711Read: 620,
  ads1115Read: 1150,
  ws2812PerLed: 30,
  ws2812Latch: 300,
  oledI2cFull: 23000,
  oledI2cPartial: 4200,
  oledSpiFull: 3100,
  tftSpiPartial: 5600,
  nextionWrite: 900,
  tm1637Write: 1500,
  hidReport: 90,
  serialLine: 120,
  servoWrite: 12,
  stepperStep: 40,
  pwmWrite: 3,
}

/* ------------------------------------------------------------------ */
/* Ο κατάλογος                                                         */
/* ------------------------------------------------------------------ */

const PARTS = [
  /* ---------------- ΕΙΣΟΔΟΙ: διακόπτες ---------------- */
  {
    id: 'button',
    name: 'Στιγμιαίο κουμπί',
    nameEn: 'Momentary push button',
    category: 'input',
    role: 'button',
    icon: 'button',
    price: 0.4,
    currentMa: 0,
    pins: [p('sig', 'din', 'SIG'), p('gnd', 'gnd', 'GND', 'left')],
    params: [
      { key: 'bounceMs', label: 'Αναπήδηση επαφής', type: 'number', min: 0, max: 20, step: 0.5, def: 4, unit: 'ms' },
      { key: 'pullup', label: 'Εσωτερικό pull-up', type: 'bool', def: true },
      { key: 'latch', label: 'Λειτουργία toggle στο firmware', type: 'bool', def: false },
    ],
    hidButtons: 1,
    loopUs: () => LOOP_COST.digitalRead,
    tip: 'Καλωδίωσε το ένα πόδι στο pin και το άλλο στο GND, με INPUT_PULLUP. Χωρίς debounce θα δεις φαντάσματα.',
  },
  {
    id: 'toggle',
    name: 'Διακόπτης toggle (ON/OFF)',
    nameEn: 'SPST toggle switch',
    category: 'input',
    role: 'button',
    icon: 'toggle',
    price: 1.2,
    currentMa: 0,
    pins: [p('sig', 'din', 'SIG'), p('gnd', 'gnd', 'GND', 'left')],
    params: [
      { key: 'bounceMs', label: 'Αναπήδηση επαφής', type: 'number', min: 0, max: 20, step: 0.5, def: 6, unit: 'ms' },
      { key: 'latch', label: 'Κρατάει θέση', type: 'bool', def: true },
      { key: 'pullup', label: 'Εσωτερικό pull-up', type: 'bool', def: true },
    ],
    hidButtons: 1,
    loopUs: () => LOOP_COST.digitalRead,
    tip: 'Τα sims συνήθως θέλουν στιγμιαίο σήμα· βάλε "pulse on change" αν το κουμπί κολλάει πατημένο.',
  },
  {
    id: 'microswitch',
    name: 'Micro switch (λεβιές)',
    nameEn: 'Micro limit switch',
    category: 'input',
    role: 'button',
    icon: 'lever',
    price: 0.6,
    currentMa: 0,
    pins: [p('sig', 'din', 'SIG'), p('gnd', 'gnd', 'GND', 'left')],
    params: [
      { key: 'bounceMs', label: 'Αναπήδηση επαφής', type: 'number', min: 0, max: 20, step: 0.5, def: 8, unit: 'ms' },
      { key: 'pullup', label: 'Εσωτερικό pull-up', type: 'bool', def: true },
    ],
    hidButtons: 1,
    loopUs: () => LOOP_COST.digitalRead,
    tip: 'Το κλασικό για sequential shifter. Αναπηδά αρκετά (5-10ms) — θέλει σίγουρα debounce.',
  },
  {
    id: 'encoder',
    name: 'Rotary encoder (χωρίς κλικ)',
    nameEn: 'Rotary encoder EC11',
    category: 'input',
    role: 'encoder',
    icon: 'knob',
    price: 1.5,
    currentMa: 0,
    pins: [p('a', 'din', 'CLK / A'), p('b', 'din', 'DT / B'), p('gnd', 'gnd', 'GND', 'left')],
    params: [
      { key: 'detents', label: 'Κλικ ανά στροφή', type: 'number', min: 12, max: 40, step: 1, def: 20 },
      { key: 'useInterrupt', label: 'Διάβασμα με interrupt', type: 'bool', def: false },
      { key: 'mode', label: 'Έξοδος', type: 'select', def: 'buttons', options: [
        { value: 'buttons', label: '2 κουμπιά (CW / CCW)' },
        { value: 'axis', label: 'Άξονας (ενσωματωμένος)' },
      ] },
      { key: 'pulseMs', label: 'Διάρκεια παλμού', type: 'number', min: 20, max: 200, step: 10, def: 50, unit: 'ms' },
    ],
    hidButtons: 2,
    loopUs: (v) => (v.useInterrupt ? 2 : LOOP_COST.digitalRead * 2),
    tip: 'Χωρίς interrupt χάνεις βήματα όταν γυρίζεις γρήγορα — το εργαστήριο σου δείχνει πόσα.',
  },
  {
    id: 'encoder-push',
    name: 'Rotary encoder με κουμπί',
    nameEn: 'Rotary encoder w/ push',
    category: 'input',
    role: 'encoder',
    icon: 'knob',
    price: 2,
    currentMa: 0,
    pins: [
      p('a', 'din', 'CLK / A'),
      p('b', 'din', 'DT / B'),
      p('sw', 'din', 'SW'),
      p('gnd', 'gnd', 'GND', 'left'),
    ],
    params: [
      { key: 'detents', label: 'Κλικ ανά στροφή', type: 'number', min: 12, max: 40, step: 1, def: 20 },
      { key: 'useInterrupt', label: 'Διάβασμα με interrupt', type: 'bool', def: false },
      { key: 'mode', label: 'Έξοδος', type: 'select', def: 'buttons', options: [
        { value: 'buttons', label: '2 κουμπιά (CW / CCW)' },
        { value: 'axis', label: 'Άξονας' },
      ] },
      { key: 'pulseMs', label: 'Διάρκεια παλμού', type: 'number', min: 20, max: 200, step: 10, def: 50, unit: 'ms' },
    ],
    hidButtons: 3,
    loopUs: (v) => (v.useInterrupt ? 2 : LOOP_COST.digitalRead * 2) + LOOP_COST.digitalRead,
    tip: 'Το πιο πυκνό control ανά τρύπα στο πάνελ: 3 εντολές από ένα εξάρτημα.',
  },
  {
    id: 'keypad',
    name: 'Πίνακας κουμπιών (matrix)',
    nameEn: 'Button matrix',
    category: 'input',
    role: 'matrix',
    icon: 'grid',
    price: 4,
    currentMa: 0,
    pins: [
      p('r0', 'dout', 'ROW 0'),
      p('r1', 'dout', 'ROW 1'),
      p('r2', 'dout', 'ROW 2'),
      p('r3', 'dout', 'ROW 3'),
      p('c0', 'din', 'COL 0'),
      p('c1', 'din', 'COL 1'),
      p('c2', 'din', 'COL 2'),
      p('c3', 'din', 'COL 3'),
    ],
    params: [
      { key: 'rows', label: 'Γραμμές', type: 'number', min: 2, max: 4, step: 1, def: 4 },
      { key: 'cols', label: 'Στήλες', type: 'number', min: 2, max: 4, step: 1, def: 4 },
      { key: 'diodes', label: 'Δίοδοι anti-ghosting', type: 'bool', def: true },
      { key: 'bounceMs', label: 'Αναπήδηση', type: 'number', min: 0, max: 20, step: 0.5, def: 4, unit: 'ms' },
    ],
    hidButtons: 16,
    loopUs: (v) => (v.rows || 4) * ((v.cols || 4) * LOOP_COST.digitalRead + 12),
    tip: '16 κουμπιά με 8 pins. Χωρίς διόδους 1N4148, τρία ταυτόχρονα πατήματα δίνουν φάντασμα τέταρτου.',
  },
  {
    id: 'hall-digital',
    name: 'Αισθητήρας Hall ψηφιακός (A3144)',
    nameEn: 'Hall effect switch',
    category: 'input',
    role: 'button',
    icon: 'magnet',
    price: 0.8,
    currentMa: 6,
    pins: [...VCC_GND, p('sig', 'din', 'OUT')],
    params: [
      { key: 'bounceMs', label: 'Αναπήδηση', type: 'number', min: 0, max: 5, step: 0.5, def: 0, unit: 'ms' },
      { key: 'pullup', label: 'Pull-up (open drain)', type: 'bool', def: true },
    ],
    hidButtons: 1,
    loopUs: () => LOOP_COST.digitalRead,
    tip: 'Μηδενική φθορά και μηδενική αναπήδηση — ιδανικό για shifter που θα δουλέψει χρόνια.',
  },
  {
    id: 'hall-linear',
    name: 'Αισθητήρας Hall αναλογικός (49E)',
    nameEn: 'Linear hall sensor',
    category: 'input',
    role: 'analog',
    icon: 'magnet',
    price: 1.1,
    currentMa: 7,
    pins: [...VCC_GND, p('sig', 'aout', 'OUT')],
    params: [
      { key: 'noiseMv', label: 'Θόρυβος', type: 'number', min: 0, max: 40, step: 1, def: 6, unit: 'mV' },
      { key: 'travelMm', label: 'Διαδρομή μαγνήτη', type: 'number', min: 2, max: 30, step: 1, def: 10, unit: 'mm' },
      { key: 'axis', label: 'Άξονας HID', type: 'select', def: 'auto', options: [
        { value: 'auto', label: 'Αυτόματα' }, { value: 'X', label: 'X' }, { value: 'Y', label: 'Y' },
        { value: 'Z', label: 'Z' }, { value: 'Rx', label: 'Rx' }, { value: 'Ry', label: 'Ry' }, { value: 'Rz', label: 'Rz' },
      ] },
      { key: 'invert', label: 'Αντιστροφή', type: 'bool', def: false },
    ],
    hidAxes: 1,
    loopUs: (v, board) => (board.clockMhz > 100 ? LOOP_COST.analogReadFast : LOOP_COST.analogReadAvr),
    tip: 'Χωρίς μηχανική επαφή: δεν φθείρεται σαν το ποτενσιόμετρο. Θέλει όμως σταθερή απόσταση μαγνήτη.',
  },
  {
    id: 'pot',
    name: 'Ποτενσιόμετρο 10kΩ',
    nameEn: 'Rotary potentiometer',
    category: 'input',
    role: 'analog',
    icon: 'dial',
    price: 1,
    currentMa: 0.5,
    pins: [...VCC_GND, p('sig', 'aout', 'WIPER')],
    params: [
      { key: 'taper', label: 'Καμπύλη', type: 'select', def: 'lin', options: [
        { value: 'lin', label: 'Γραμμική (B)' }, { value: 'log', label: 'Λογαριθμική (A)' },
      ] },
      { key: 'noiseMv', label: 'Θόρυβος / φθορά', type: 'number', min: 0, max: 60, step: 1, def: 12, unit: 'mV' },
      { key: 'axis', label: 'Άξονας HID', type: 'select', def: 'auto', options: [
        { value: 'auto', label: 'Αυτόματα' }, { value: 'X', label: 'X' }, { value: 'Y', label: 'Y' },
        { value: 'Z', label: 'Z' }, { value: 'Rx', label: 'Rx' }, { value: 'Ry', label: 'Ry' }, { value: 'Rz', label: 'Rz' },
      ] },
      { key: 'invert', label: 'Αντιστροφή', type: 'bool', def: false },
    ],
    hidAxes: 1,
    loopUs: (v, board) => (board.clockMhz > 100 ? LOOP_COST.analogReadFast : LOOP_COST.analogReadAvr),
    tip: 'Φτηνό και άμεσο, αλλά μετά από μερικές χιλιάδες πατήματα σκονίζει και «πηδάει».',
  },
  {
    id: 'loadcell',
    name: 'Load cell (κυψέλη φορτίου)',
    nameEn: 'Strain gauge load cell',
    category: 'input',
    role: 'loadcell',
    icon: 'scale',
    price: 9,
    currentMa: 1.5,
    pins: [
      p('ex', 'exc', 'E+ / E−', 'left'),
      p('sig', 'exc', 'A+ / A−'),
    ],
    params: [
      { key: 'capacityKg', label: 'Ονομαστικό φορτίο', type: 'select', def: 100, options: [
        { value: 50, label: '50 kg' }, { value: 100, label: '100 kg' }, { value: 200, label: '200 kg' },
      ] },
      { key: 'sensitivityMvV', label: 'Ευαισθησία', type: 'number', min: 0.5, max: 3, step: 0.1, def: 2, unit: 'mV/V' },
      { key: 'maxForceKg', label: 'Φορτίο στο τέρμα πεντάλ', type: 'number', min: 10, max: 150, step: 5, def: 45, unit: 'kg' },
    ],
    needsAmp: true,
    loopUs: () => 0,
    tip: 'Δεν συνδέεται απευθείας στο Arduino: δίνει μιλιβόλτ. Θέλει ενισχυτή HX711 ή INA125.',
  },
  {
    id: 'hx711',
    name: 'Ενισχυτής HX711',
    nameEn: 'HX711 24-bit ADC',
    category: 'input',
    role: 'hx711',
    icon: 'chip',
    price: 2,
    currentMa: 1.5,
    pins: [
      ...VCC_GND,
      p('bridge', 'exc', 'Γέφυρα → load cell', 'left'),
      p('dt', 'din', 'DT / DOUT'),
      p('sck', 'dout', 'SCK'),
    ],
    params: [
      { key: 'rateHz', label: 'Ρυθμός δειγματοληψίας', type: 'select', def: 80, options: [
        { value: 10, label: '10 SPS (εργοστασιακό)' }, { value: 80, label: '80 SPS (κόψε το RATE pin)' },
      ] },
      { key: 'gain', label: 'Κέρδος', type: 'select', def: 128, options: [
        { value: 64, label: '64×' }, { value: 128, label: '128×' },
      ] },
      { key: 'filter', label: 'Φίλτρο', type: 'select', def: 'ema', options: [
        { value: 'none', label: 'Χωρίς' }, { value: 'ema', label: 'Εκθετικό (EMA)' }, { value: 'avg4', label: 'Μέσος όρος 4' },
      ] },
      { key: 'emaAlpha', label: 'Βάρος EMA', type: 'number', min: 0.05, max: 1, step: 0.05, def: 0.3 },
      { key: 'curve', label: 'Καμπύλη πεντάλ', type: 'number', min: 0.5, max: 2.5, step: 0.1, def: 1 },
      { key: 'axis', label: 'Άξονας HID', type: 'select', def: 'auto', options: [
        { value: 'auto', label: 'Αυτόματα' }, { value: 'X', label: 'X' }, { value: 'Y', label: 'Y' },
        { value: 'Z', label: 'Z' }, { value: 'Rx', label: 'Rx' }, { value: 'Ry', label: 'Ry' }, { value: 'Rz', label: 'Rz' },
      ] },
    ],
    hidAxes: 1,
    loopUs: () => LOOP_COST.hx711Read,
    tip: 'Στα 10 SPS το πεντάλ φαίνεται «λαστιχένιο». Κόψε την πίστα RATE για 80 SPS — αλλάζει εντελώς.',
  },
  {
    id: 'ads1115',
    name: 'ADC 16-bit ADS1115',
    nameEn: 'ADS1115 I2C ADC',
    category: 'input',
    role: 'ads1115',
    icon: 'chip',
    price: 3.5,
    currentMa: 0.2,
    pins: [...VCC_GND, p('sda', 'sda', 'SDA'), p('scl', 'scl', 'SCL')],
    params: [
      { key: 'channels', label: 'Ενεργά κανάλια', type: 'number', min: 1, max: 4, step: 1, def: 4 },
      { key: 'address', label: 'Διεύθυνση I2C', type: 'select', def: '0x48', options: [
        { value: '0x48', label: '0x48 (ADDR→GND)' }, { value: '0x49', label: '0x49 (ADDR→VCC)' },
        { value: '0x4A', label: '0x4A (ADDR→SDA)' }, { value: '0x4B', label: '0x4B (ADDR→SCL)' },
      ] },
      { key: 'sps', label: 'Ρυθμός', type: 'select', def: 860, options: [
        { value: 128, label: '128 SPS' }, { value: 475, label: '475 SPS' }, { value: 860, label: '860 SPS' },
      ] },
    ],
    loopUs: (v) => LOOP_COST.ads1115Read * (v.channels || 1),
    tip: '16 bit αντί για 10 — αλλά κάθε κανάλι κοστίζει ~1ms στο loop. Για πεντάλ, προτίμησε HX711.',
  },
  {
    id: 'mcp23017',
    name: 'Επέκταση I/O MCP23017',
    nameEn: 'MCP23017 I2C expander',
    category: 'input',
    role: 'expander',
    icon: 'chip',
    price: 2.5,
    currentMa: 1,
    pins: [...VCC_GND, p('sda', 'sda', 'SDA'), p('scl', 'scl', 'SCL'), p('int', 'din', 'INT')],
    params: [
      { key: 'used', label: 'Χρησιμοποιούμενα pins', type: 'number', min: 1, max: 16, step: 1, def: 16 },
      { key: 'address', label: 'Διεύθυνση I2C', type: 'select', def: '0x20', options: [
        { value: '0x20', label: '0x20' }, { value: '0x21', label: '0x21' },
        { value: '0x22', label: '0x22' }, { value: '0x23', label: '0x23' },
      ] },
    ],
    hidButtons: 16,
    loopUs: () => 380,
    tip: '+16 κουμπιά με μόνο 2 pins. Βάλε 8 τσιπ στον ίδιο δίαυλο για 128 εισόδους.',
  },

  /* ---------------- ΕΞΟΔΟΙ: φώτα & οθόνες ---------------- */
  {
    id: 'ws2812',
    name: 'Ταινία LED WS2812B',
    nameEn: 'WS2812B addressable strip',
    category: 'output',
    role: 'ledstrip',
    icon: 'strip',
    price: 6,
    currentMa: 1,
    pins: [...VCC_GND, p('din', 'dout', 'DIN')],
    params: [
      { key: 'ledCount', label: 'Αριθμός LED', type: 'number', min: 4, max: 144, step: 1, def: 16 },
      { key: 'mode', label: 'Λειτουργία', type: 'select', def: 'rev', options: [
        { value: 'rev', label: 'Rev lights (στροφόμετρο)' },
        { value: 'flags', label: 'Σημαίες αγώνα' },
        { value: 'revflags', label: 'Rev lights + σημαίες στα άκρα' },
      ] },
      { key: 'brightness', label: 'Φωτεινότητα', type: 'number', min: 5, max: 100, step: 5, def: 40, unit: '%' },
      { key: 'startPct', label: 'Έναρξη ανάβματος', type: 'number', min: 40, max: 95, step: 1, def: 70, unit: '% RPM' },
      { key: 'shiftPct', label: 'Σημείο αλλαγής', type: 'number', min: 80, max: 100, step: 1, def: 96, unit: '% RPM' },
      { key: 'blinkHz', label: 'Αναβόσβημα στο shift', type: 'number', min: 0, max: 20, step: 1, def: 10, unit: 'Hz' },
      { key: 'external5v', label: 'Ξεχωριστή τροφοδοσία 5V', type: 'bool', def: false },
    ],
    loopUs: (v) => (v.ledCount || 16) * LOOP_COST.ws2812PerLed + LOOP_COST.ws2812Latch,
    /** Πραγματικό ρεύμα: υπολογίζεται από τα χρώματα που ανάβουν τη στιγμή εκείνη. */
    dynamicCurrent: true,
    tip: 'Κάθε LED τραβάει έως 60mA στο λευκό. 30 LED στο τέρμα = 1.8A — πάνω από ό,τι δίνει το USB.',
  },
  {
    id: 'led',
    name: 'LED ένδειξης 5mm',
    nameEn: 'Indicator LED',
    category: 'output',
    role: 'led',
    icon: 'bulb',
    price: 0.15,
    currentMa: 15,
    pins: [p('a', 'dout', 'Άνοδος (+)'), p('k', 'gnd', 'Κάθοδος (−)', 'left')],
    params: [
      { key: 'color', label: 'Χρώμα', type: 'select', def: 'red', options: [
        { value: 'red', label: 'Κόκκινο' }, { value: 'green', label: 'Πράσινο' },
        { value: 'blue', label: 'Μπλε' }, { value: 'amber', label: 'Πορτοκαλί' },
      ] },
      { key: 'source', label: 'Πηγή', type: 'select', def: 'shift', options: [
        { value: 'shift', label: 'Λυχνία αλλαγής' }, { value: 'abs', label: 'ABS ενεργό' },
        { value: 'pit', label: 'Pit limiter' }, { value: 'fuel', label: 'Χαμηλό καύσιμο' },
        { value: 'tc', label: 'Έλεγχος πρόσφυσης' },
      ] },
      { key: 'resistor', label: 'Αντίσταση σειράς', type: 'bool', def: true },
    ],
    loopUs: () => LOOP_COST.pwmWrite,
    tip: 'Χωρίς αντίσταση σειράς (220-330Ω) καις το LED και ζορίζεις το pin.',
  },
  {
    id: 'tm1637',
    name: 'Οθόνη 7 τμημάτων TM1637',
    nameEn: '4-digit 7-segment display',
    category: 'output',
    role: 'sevenseg',
    icon: 'digits',
    price: 2.5,
    currentMa: 30,
    pins: [...VCC_GND, p('clk', 'dout', 'CLK'), p('dio', 'dout', 'DIO')],
    params: [
      { key: 'show', label: 'Τι δείχνει', type: 'select', def: 'gear', options: [
        { value: 'gear', label: 'Ταχύτητα (γρανάζι)' }, { value: 'speed', label: 'Ταχύτητα km/h' },
        { value: 'rpm', label: 'Στροφές' }, { value: 'lap', label: 'Χρόνος γύρου' },
      ] },
      { key: 'updateHz', label: 'Ανανέωση', type: 'number', min: 2, max: 30, step: 1, def: 10, unit: 'Hz' },
      { key: 'brightness', label: 'Φωτεινότητα', type: 'number', min: 1, max: 7, step: 1, def: 5 },
    ],
    loopUs: (v) => Math.round((LOOP_COST.tm1637Write * (v.updateHz || 10)) / 200),
    tip: 'Το πιο ευανάγνωστο γρανάζι με 2.5€. Μην το ανανεώνεις πάνω από 15Hz, δεν το βλέπει το μάτι.',
  },
  {
    id: 'oled',
    name: 'Οθόνη OLED 128×64 (SSD1306)',
    nameEn: 'SSD1306 OLED',
    category: 'output',
    role: 'display',
    icon: 'screen',
    price: 4,
    currentMa: 22,
    pins: [...VCC_GND, p('sda', 'sda', 'SDA'), p('scl', 'scl', 'SCL')],
    params: [
      { key: 'iface', label: 'Δίαυλος', type: 'select', def: 'i2c', options: [
        { value: 'i2c', label: 'I2C (2 pins, αργό)' }, { value: 'spi', label: 'SPI (5 pins, 7× γρηγορότερο)' },
      ] },
      { key: 'layout', label: 'Διάταξη', type: 'select', def: 'gear-rpm', options: [
        { value: 'gear-rpm', label: 'Γρανάζι + στροφές' }, { value: 'delta', label: 'Delta + χρόνος γύρου' },
        { value: 'temps', label: 'Θερμοκρασίες & καύσιμο' },
      ] },
      { key: 'updateHz', label: 'Ανανέωση', type: 'number', min: 2, max: 60, step: 1, def: 15, unit: 'Hz' },
      { key: 'partial', label: 'Μερική ανανέωση', type: 'bool', def: true },
      { key: 'address', label: 'Διεύθυνση I2C', type: 'select', def: '0x3C', options: [
        { value: '0x3C', label: '0x3C' }, { value: '0x3D', label: '0x3D' },
      ] },
    ],
    loopUs: (v) => {
      const frame =
        v.iface === 'spi'
          ? LOOP_COST.oledSpiFull
          : v.partial
            ? LOOP_COST.oledI2cPartial
            : LOOP_COST.oledI2cFull
      return Math.round((frame * (v.updateHz || 15)) / 1000)
    },
    tip: 'Πλήρες frame μέσω I2C στα 400kHz θέλει ~23ms. Αν το κάνεις κάθε loop, το button box σου κολλάει.',
  },
  {
    id: 'tft',
    name: 'Οθόνη TFT 2.8" (ILI9341)',
    nameEn: 'ILI9341 SPI TFT',
    category: 'output',
    role: 'display',
    icon: 'screen',
    price: 12,
    currentMa: 90,
    pins: [
      ...VCC_GND,
      p('sck', 'sck', 'SCK'),
      p('mosi', 'mosi', 'MOSI'),
      p('cs', 'cs', 'CS'),
      p('dc', 'dout', 'DC'),
      p('rst', 'dout', 'RST'),
    ],
    params: [
      { key: 'layout', label: 'Διάταξη', type: 'select', def: 'cluster', options: [
        { value: 'cluster', label: 'Πλήρες καντράν' }, { value: 'delta', label: 'Delta & sectors' },
        { value: 'tyres', label: 'Ελαστικά & φρένα' },
      ] },
      { key: 'updateHz', label: 'Ανανέωση', type: 'number', min: 5, max: 60, step: 1, def: 20, unit: 'Hz' },
      { key: 'spiMhz', label: 'Ταχύτητα SPI', type: 'select', def: 40, options: [
        { value: 8, label: '8 MHz' }, { value: 24, label: '24 MHz' }, { value: 40, label: '40 MHz' },
      ] },
    ],
    loopUs: (v) =>
      Math.round((LOOP_COST.tftSpiPartial * (40 / (v.spiMhz || 40)) * (v.updateHz || 20)) / 1000),
    tip: 'Ζωγραφίζει ωραία, αλλά ζητάει γρήγορο SPI. Σε ATmega328 θα παλέψεις — βάλε RP2040 ή Teensy.',
  },
  {
    id: 'nextion',
    name: 'Οθόνη Nextion HMI 3.5"',
    nameEn: 'Nextion HMI display',
    category: 'output',
    role: 'display',
    icon: 'screen',
    price: 38,
    currentMa: 145,
    pins: [...VCC_GND, p('rx', 'dout', 'RX'), p('tx', 'din', 'TX')],
    params: [
      { key: 'baud', label: 'Ταχύτητα σειριακής', type: 'select', def: 115200, options: [
        { value: 9600, label: '9600' }, { value: 115200, label: '115200' }, { value: 921600, label: '921600' },
      ] },
      { key: 'fields', label: 'Πεδία που ανανεώνονται', type: 'number', min: 1, max: 20, step: 1, def: 8 },
      { key: 'updateHz', label: 'Ανανέωση', type: 'number', min: 2, max: 30, step: 1, def: 12, unit: 'Hz' },
    ],
    loopUs: (v) =>
      Math.round((LOOP_COST.nextionWrite * (v.fields || 8) * (v.updateHz || 12)) / 1000),
    tip: 'Η οθόνη έχει δικό της επεξεργαστή: το Arduino στέλνει μόνο τιμές. Ο πιο εύκολος δρόμος για ωραίο dash.',
  },

  /* ---------------- ΕΞΟΔΟΙ: κίνηση & αφή ---------------- */
  {
    id: 'x27-gauge',
    name: 'Βηματικός δείκτης οργάνου X27.168',
    nameEn: 'X27.168 stepper gauge',
    category: 'output',
    role: 'gauge',
    icon: 'gauge',
    price: 7,
    currentMa: 20,
    pins: [
      ...VCC_GND,
      p('in1', 'dout', 'IN1'),
      p('in2', 'dout', 'IN2'),
      p('in3', 'dout', 'IN3'),
      p('in4', 'dout', 'IN4'),
    ],
    params: [
      { key: 'source', label: 'Τι δείχνει', type: 'select', def: 'rpm', options: [
        { value: 'rpm', label: 'Στροφόμετρο' }, { value: 'speed', label: 'Ταχύμετρο' },
        { value: 'fuel', label: 'Καύσιμο' }, { value: 'water', label: 'Θερμοκρασία νερού' },
      ] },
      { key: 'sweepDeg', label: 'Γωνία σάρωσης', type: 'number', min: 90, max: 315, step: 5, def: 270, unit: '°' },
      { key: 'maxStepsPerSec', label: 'Μέγιστα βήματα/s', type: 'number', min: 200, max: 1500, step: 50, def: 600 },
    ],
    loopUs: () => LOOP_COST.stepperStep,
    tip: 'Το ίδιο μοτεράκι που έχουν τα εργοστασιακά καντράν. Πάνω από ~700 βήματα/s χάνει συγχρονισμό.',
  },
  {
    id: 'servo',
    name: 'Σερβοκινητήρας SG90 / MG996R',
    nameEn: 'Hobby servo',
    category: 'output',
    role: 'servo',
    icon: 'servo',
    price: 4,
    currentMa: 180,
    currentMaPeak: 900,
    pins: [...VCC_GND, p('sig', 'pwm', 'SIG')],
    params: [
      { key: 'source', label: 'Οδηγείται από', type: 'select', def: 'boost', options: [
        { value: 'boost', label: 'Πίεση υπερπλήρωσης' }, { value: 'fuel', label: 'Καύσιμο' },
        { value: 'rpm', label: 'Στροφές' }, { value: 'speed', label: 'Ταχύτητα' },
      ] },
      { key: 'rangeDeg', label: 'Εύρος κίνησης', type: 'number', min: 30, max: 270, step: 5, def: 180, unit: '°' },
      { key: 'speedDegS', label: 'Ταχύτητα', type: 'number', min: 60, max: 600, step: 20, def: 300, unit: '°/s' },
    ],
    loopUs: () => LOOP_COST.servoWrite,
    tip: 'Ποτέ από το 5V του Arduino: η αιχμή ρεύματος στο ξεκίνημα ρίχνει την τάση και κάνει reset την πλακέτα.',
  },
  {
    id: 'fan',
    name: 'Ανεμιστήρας 12V (wind sim)',
    nameEn: '12V fan + MOSFET',
    category: 'output',
    role: 'fan',
    icon: 'fan',
    price: 14,
    currentMa: 0,
    externalCurrentMa: 900,
    pins: [
      p('v12', 'v12', '12V +', 'left'),
      p('gnd', 'gnd', 'GND', 'left'),
      p('pwm', 'pwm', 'Πύλη MOSFET'),
    ],
    params: [
      { key: 'sizeMm', label: 'Διάμετρος', type: 'select', def: 120, options: [
        { value: 92, label: '92 mm' }, { value: 120, label: '120 mm' }, { value: 140, label: '140 mm' },
      ] },
      { key: 'minPct', label: 'Ελάχιστο στροφών', type: 'number', min: 0, max: 60, step: 5, def: 20, unit: '%' },
      { key: 'maxKmh', label: 'Ταχύτητα για 100%', type: 'number', min: 80, max: 350, step: 10, def: 220, unit: 'km/h' },
      { key: 'pwmHz', label: 'Συχνότητα PWM', type: 'select', def: 25000, options: [
        { value: 490, label: '490 Hz (ακούγεται)' }, { value: 25000, label: '25 kHz (αθόρυβο)' },
      ] },
    ],
    needsMosfet: true,
    loopUs: () => LOOP_COST.pwmWrite,
    tip: 'Στα 490Hz ο ανεμιστήρας σφυρίζει. Στα 25kHz είναι αθόρυβος — αλλά θέλει timer ρύθμιση.',
  },
  {
    id: 'shaker',
    name: 'Μοτέρ δόνησης (haptic)',
    nameEn: 'Vibration motor',
    category: 'output',
    role: 'haptic',
    icon: 'waves',
    price: 3,
    currentMa: 90,
    pins: [
      p('v12', 'v12', 'Τροφοδοσία', 'left'),
      p('gnd', 'gnd', 'GND', 'left'),
      p('pwm', 'pwm', 'Πύλη MOSFET'),
    ],
    params: [
      { key: 'trigger', label: 'Ενεργοποιείται από', type: 'select', def: 'abs', options: [
        { value: 'abs', label: 'ABS / μπλοκάρισμα τροχού' },
        { value: 'slip', label: 'Ολίσθηση (σπινιάρισμα)' },
        { value: 'kerb', label: 'Κράσπεδα' },
        { value: 'shift', label: 'Σημείο αλλαγής' },
      ] },
      { key: 'strength', label: 'Ένταση', type: 'number', min: 10, max: 100, step: 5, def: 70, unit: '%' },
      { key: 'placement', label: 'Θέση', type: 'select', def: 'brake', options: [
        { value: 'brake', label: 'Πεντάλ φρένου' }, { value: 'throttle', label: 'Πεντάλ γκαζιού' },
        { value: 'wheel', label: 'Τιμόνι' }, { value: 'seat', label: 'Κάθισμα' },
      ] },
    ],
    needsMosfet: true,
    loopUs: () => LOOP_COST.pwmWrite,
    tip: 'Δόνηση στο φρένο όταν μπλοκάρει ο τροχός: το πιο χρήσιμο βοήθημα για threshold braking.',
  },
  {
    id: 'buzzer',
    name: 'Βομβητής',
    nameEn: 'Piezo buzzer',
    category: 'output',
    role: 'buzzer',
    icon: 'speaker',
    price: 0.8,
    currentMa: 25,
    pins: [p('sig', 'pwm', 'SIG'), p('gnd', 'gnd', 'GND', 'left')],
    params: [
      { key: 'trigger', label: 'Ηχεί σε', type: 'select', def: 'shift', options: [
        { value: 'shift', label: 'Σημείο αλλαγής' }, { value: 'pit', label: 'Όριο pit' },
        { value: 'fuel', label: 'Χαμηλό καύσιμο' }, { value: 'flag', label: 'Σημαία' },
      ] },
      { key: 'toneHz', label: 'Συχνότητα', type: 'number', min: 200, max: 4000, step: 100, def: 2000, unit: 'Hz' },
    ],
    loopUs: () => LOOP_COST.pwmWrite,
    tip: 'Ηχητικό shift light: δουλεύει και με τα μάτια στην πίστα.',
  },

  /* ---------------- ΤΡΟΦΟΔΟΣΙΑ & ΠΑΘΗΤΙΚΑ ---------------- */
  {
    id: 'psu12',
    name: 'Τροφοδοτικό 12V',
    nameEn: '12V PSU',
    category: 'power',
    role: 'psu',
    icon: 'plug',
    price: 12,
    pins: [p('v12', 'v12', '12V +'), p('gnd', 'gnd', 'GND')],
    params: [
      { key: 'amps', label: 'Ρεύμα', type: 'select', def: 5, options: [
        { value: 2, label: '2 A' }, { value: 5, label: '5 A' }, { value: 10, label: '10 A' },
      ] },
    ],
    supplies: 'v12',
    loopUs: () => 0,
    tip: 'Απαραίτητο για ανεμιστήρες, shakers και μοτέρ. Ένωσε τα GND του με το Arduino, αλλιώς τίποτα δεν δουλεύει.',
  },
  {
    id: 'buck',
    name: 'Μετατροπέας 12V → 5V (buck)',
    nameEn: 'Buck converter',
    category: 'power',
    role: 'buck',
    icon: 'converter',
    price: 3,
    pins: [
      p('v12', 'v12', 'IN 12V', 'left'),
      p('gnd', 'gnd', 'GND', 'left'),
      p('out5', 'pwr', 'OUT 5V'),
    ],
    params: [
      { key: 'amps', label: 'Ρεύμα εξόδου', type: 'select', def: 3, options: [
        { value: 1, label: '1 A' }, { value: 3, label: '3 A' }, { value: 5, label: '5 A' },
      ] },
    ],
    supplies: 'pwr5',
    loopUs: () => 0,
    tip: 'Ο σωστός τρόπος να ταΐσεις 30+ LED χωρίς να καείς το USB της πλακέτας.',
  },
  {
    id: 'mosfet',
    name: 'MOSFET λογικού επιπέδου (IRLZ44N)',
    nameEn: 'Logic-level MOSFET',
    category: 'power',
    role: 'mosfet',
    icon: 'transistor',
    price: 1,
    pins: [
      p('gate', 'pwm', 'Gate ← MCU', 'left'),
      p('drain', 'v12', 'Drain → φορτίο'),
      p('source', 'gnd', 'Source → GND', 'left'),
    ],
    params: [
      { key: 'gateResistor', label: 'Αντίσταση gate 100Ω', type: 'bool', def: true },
      { key: 'flyback', label: 'Δίοδος flyback', type: 'bool', def: true },
    ],
    loopUs: () => 0,
    tip: 'Πρόσεχε το "logic level": ένα κοινό IRF540 δεν ανοίγει πλήρως με 5V στο gate και ζεσταίνεται.',
  },
  {
    id: 'levelshifter',
    name: 'Μετατροπέας στάθμης 3.3V ↔ 5V',
    nameEn: 'Level shifter',
    category: 'power',
    role: 'levelshifter',
    icon: 'shift',
    price: 1.5,
    pins: [
      p('lv', 'pwr', 'LV 3.3V', 'left'),
      p('gnd', 'gnd', 'GND', 'left'),
      p('a', 'dout', 'LV1 ← MCU'),
      p('b', 'dout', 'HV1 → φορτίο'),
    ],
    params: [{ key: 'channels', label: 'Κανάλια', type: 'select', def: 4, options: [
      { value: 2, label: '2' }, { value: 4, label: '4' }, { value: 8, label: '8' },
    ] }],
    loopUs: () => 0,
    tip: 'Οι WS2812 θέλουν ~3.5V στο DIN. Από Pico/ESP32 (3.3V) συχνά δουλεύουν «μια στις τρεις» χωρίς αυτό.',
  },
  {
    id: 'resistor',
    name: 'Αντίσταση pull-up 10kΩ',
    nameEn: 'Pull-up resistor',
    category: 'passive',
    role: 'resistor',
    icon: 'resistor',
    price: 0.05,
    pins: [p('a', 'dout', 'Προς pin', 'left'), p('b', 'pwr', 'Προς VCC')],
    params: [{ key: 'ohms', label: 'Τιμή', type: 'select', def: 10000, options: [
      { value: 1000, label: '1 kΩ' }, { value: 4700, label: '4.7 kΩ' }, { value: 10000, label: '10 kΩ' },
    ] }],
    loopUs: () => 0,
    tip: 'Εξωτερικό pull-up χρειάζεσαι μόνο σε μακριά καλώδια ή σε I2C. Αλλιώς φτάνει το INPUT_PULLUP.',
  },
  {
    id: 'diode',
    name: 'Δίοδος 1N4148 (anti-ghosting)',
    nameEn: '1N4148 diode',
    category: 'passive',
    role: 'diode',
    icon: 'diode',
    price: 0.04,
    pins: [p('a', 'dout', 'Άνοδος', 'left'), p('k', 'din', 'Κάθοδος')],
    params: [{ key: 'qty', label: 'Ποσότητα', type: 'number', min: 1, max: 64, step: 1, def: 16 }],
    loopUs: () => 0,
    tip: 'Μία ανά κουμπί σε matrix. Χωρίς αυτές, τρία ταυτόχρονα πατήματα δημιουργούν ένα τέταρτο ανύπαρκτο.',
  },
  {
    id: 'capacitor',
    name: 'Πυκνωτής αποσύζευξης 1000µF',
    nameEn: 'Decoupling capacitor',
    category: 'passive',
    role: 'capacitor',
    icon: 'capacitor',
    price: 0.6,
    pins: [p('a', 'pwr', '+', 'left'), p('b', 'gnd', '−', 'left')],
    params: [{ key: 'uf', label: 'Χωρητικότητα', type: 'select', def: 1000, options: [
      { value: 100, label: '100 µF' }, { value: 470, label: '470 µF' }, { value: 1000, label: '1000 µF' },
    ] }],
    loopUs: () => 0,
    tip: 'Στην αρχή της ταινίας LED: απορροφά την αιχμή ρεύματος στο άναμμα και σώζει το πρώτο LED.',
  },
]

/** Κατηγορίες με ελληνικές ετικέτες, με τη σειρά που εμφανίζονται στην παλέτα. */
export const CATEGORIES = [
  { id: 'input', label: 'Είσοδοι', hint: 'Ό,τι διαβάζει το Arduino' },
  { id: 'output', label: 'Έξοδοι', hint: 'Ό,τι οδηγεί το Arduino' },
  { id: 'power', label: 'Τροφοδοσία', hint: 'Ρεύμα και οδήγηση φορτίων' },
  { id: 'passive', label: 'Παθητικά', hint: 'Μικρά αλλά κρίσιμα' },
]

export function getPart(id) {
  return PARTS.find((x) => x.id === id) || null
}

export function partsByCategory(category) {
  return PARTS.filter((x) => x.category === category)
}

export function allParts() {
  return PARTS
}

/** Προεπιλεγμένες τιμές παραμέτρων ενός εξαρτήματος. */
export function defaultParams(partId) {
  const part = getPart(partId)
  if (!part) return {}
  const out = {}
  for (const prm of part.params || []) out[prm.key] = prm.def
  return out
}

/** Αναζήτηση στην παλέτα (ελληνικά ή αγγλικά). */
export function searchParts(query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return PARTS
  return PARTS.filter((x) =>
    [x.name, x.nameEn, x.id, x.category, x.tip].join(' ').toLowerCase().includes(q)
  )
}
