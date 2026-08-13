/**
 * Μητρώο πραγματικών βιβλιοθηκών Arduino.
 *
 * Κάθε εξάρτημα που βάζεις στον πάγκο «τραβάει» τις βιβλιοθήκες που χρειάζεται
 * στ' αλήθεια για να δουλέψει. Από εδώ βγαίνουν τα `#include` της γεννήτριας
 * κώδικα, οι εντολές εγκατάστασης (`arduino-cli`), τα ονόματα για τον
 * Library Manager και η εκτίμηση flash/RAM.
 *
 * Τα μεγέθη flash/RAM είναι μετρημένα κατά προσέγγιση σε AVR build και
 * χρησιμεύουν για να δεις πότε «δεν χωράει» — όχι ως ακριβής linker έξοδος.
 */

/** Αρχιτεκτονικές πλακετών που υποστηρίζει κάθε βιβλιοθήκη. */
const ALL_ARCH = ['avr', 'rp2040', 'esp32', 'teensy']

/**
 * source: 'manager'  → υπάρχει στον Library Manager του Arduino IDE
 *         'zip'      → κατεβάζεις ZIP από GitHub (Sketch ▸ Include Library ▸ Add .ZIP)
 *         'builtin'  → έρχεται μαζί με το core, δεν εγκαθιστάς τίποτα
 *         'core'     → εγκαθίσταται ως board core στον Boards Manager
 */
const LIBRARIES = [
  /* ---------------------------- HID ---------------------------- */
  {
    id: 'joystick',
    name: 'Arduino Joystick Library',
    author: 'Matthew Heironimus',
    version: '2.1.1',
    source: 'zip',
    manager: null,
    url: 'https://github.com/MHeironimus/ArduinoJoystickLibrary',
    cli: 'arduino-cli lib install --git-url https://github.com/MHeironimus/ArduinoJoystickLibrary.git',
    includes: ['Joystick.h'],
    flashKb: 4.2,
    ramB: 96,
    arch: ['avr'],
    note:
      'Το πρότυπο για button box σε 32U4. Δεν είναι στον Library Manager — κατέβασε ZIP από GitHub. Μέχρι 128 κουμπιά και 8 άξονες.',
  },
  {
    id: 'tinyusb',
    name: 'Adafruit TinyUSB Library',
    author: 'Adafruit',
    version: '3.4.2',
    source: 'manager',
    manager: 'Adafruit TinyUSB Library',
    url: 'https://github.com/adafruit/Adafruit_TinyUSB_Arduino',
    cli: 'arduino-cli lib install "Adafruit TinyUSB Library"',
    includes: ['Adafruit_TinyUSB.h'],
    flashKb: 11,
    ramB: 1400,
    arch: ['rp2040'],
    note:
      'Ο δρόμος για HID σε Pico. Στο IDE διάλεξε Tools ▸ USB Stack ▸ "Adafruit TinyUSB".',
  },
  {
    id: 'teensy-usb',
    name: 'Teensy USB Joystick (core)',
    author: 'PJRC',
    version: 'core',
    source: 'core',
    manager: null,
    url: 'https://www.pjrc.com/teensy/td_joystick.html',
    cli: 'Boards Manager ▸ Teensy (Teensyduino)',
    includes: [],
    flashKb: 3,
    ramB: 120,
    arch: ['teensy'],
    note:
      'Δεν χρειάζεται βιβλιοθήκη: Tools ▸ USB Type ▸ "Serial + Keyboard + Mouse + Joystick" και έχεις έτοιμο το αντικείμενο Joystick.',
  },
  {
    id: 'ble-gamepad',
    name: 'ESP32-BLE-Gamepad',
    author: 'lemmingDev',
    version: '0.5.5',
    source: 'zip',
    manager: null,
    url: 'https://github.com/lemmingDev/ESP32-BLE-Gamepad',
    cli: 'arduino-cli lib install --git-url https://github.com/lemmingDev/ESP32-BLE-Gamepad.git',
    includes: ['BleGamepad.h'],
    flashKb: 640,
    ramB: 24000,
    arch: ['esp32'],
    note:
      'Το ESP32 δεν κάνει USB HID, κάνει όμως Bluetooth gamepad. Θέλει και το NimBLE-Arduino ως εξάρτηση.',
  },

  /* -------------------------- Είσοδοι -------------------------- */
  {
    id: 'bounce2',
    name: 'Bounce2',
    author: 'Thomas Fredericks',
    version: '2.72.0',
    source: 'manager',
    manager: 'Bounce2',
    url: 'https://github.com/thomasfredericks/Bounce2',
    cli: 'arduino-cli lib install Bounce2',
    includes: ['Bounce2.h'],
    flashKb: 1.1,
    ramB: 14,
    arch: ALL_ARCH,
    note: 'Καθαρό debounce ανά κουμπί, με 14 bytes RAM το καθένα.',
  },
  {
    id: 'encoder',
    name: 'Encoder',
    author: 'Paul Stoffregen',
    version: '1.4.4',
    source: 'manager',
    manager: 'Encoder',
    url: 'https://github.com/PaulStoffregen/Encoder',
    cli: 'arduino-cli lib install Encoder',
    includes: ['Encoder.h'],
    flashKb: 1.4,
    ramB: 28,
    arch: ALL_ARCH,
    note:
      'Χρησιμοποιεί interrupts αυτόματα όταν τα pins τα υποστηρίζουν — δεν χάνει βήματα.',
  },
  {
    id: 'rotary-polled',
    name: 'RotaryEncoder',
    author: 'Matthias Hertel',
    version: '1.5.3',
    source: 'manager',
    manager: 'RotaryEncoder',
    url: 'https://github.com/mathertel/RotaryEncoder',
    cli: 'arduino-cli lib install RotaryEncoder',
    includes: ['RotaryEncoder.h'],
    flashKb: 1.2,
    ramB: 20,
    arch: ALL_ARCH,
    note: 'Ελαφριά εναλλακτική με polling — καλή όταν τα pins δεν έχουν interrupt.',
  },
  {
    id: 'keypad',
    name: 'Keypad',
    author: 'Mark Stanley, Alexander Brevig',
    version: '3.1.1',
    source: 'manager',
    manager: 'Keypad',
    url: 'https://github.com/Chris--A/Keypad',
    cli: 'arduino-cli lib install Keypad',
    includes: ['Keypad.h'],
    flashKb: 2.3,
    ramB: 120,
    arch: ALL_ARCH,
    note: 'Σάρωση matrix με έτοιμο debounce και υποστήριξη πολλαπλών ταυτόχρονων πατημάτων.',
  },
  {
    id: 'hx711',
    name: 'HX711 Arduino Library',
    author: 'Bogdan Necula',
    version: '0.7.5',
    source: 'manager',
    manager: 'HX711 Arduino Library',
    url: 'https://github.com/bogde/HX711',
    cli: 'arduino-cli lib install "HX711 Arduino Library"',
    includes: ['HX711.h'],
    flashKb: 2.6,
    ramB: 34,
    arch: ALL_ARCH,
    note:
      'Πρόσεχε: το `read()` μπλοκάρει μέχρι να είναι έτοιμο το δείγμα. Χρησιμοποίησε `is_ready()` για να μην κολλάει το loop.',
  },
  {
    id: 'ads1x15',
    name: 'Adafruit ADS1X15',
    author: 'Adafruit',
    version: '2.5.0',
    source: 'manager',
    manager: 'Adafruit ADS1X15',
    url: 'https://github.com/adafruit/Adafruit_ADS1X15',
    cli: 'arduino-cli lib install "Adafruit ADS1X15"',
    includes: ['Adafruit_ADS1X15.h'],
    flashKb: 5.4,
    ramB: 70,
    arch: ALL_ARCH,
    deps: ['wire', 'busio'],
    note: '16-bit ADC μέσω I2C. Χρησιμοποίησε συνεχή λειτουργία για να μην μπλοκάρει.',
  },
  {
    id: 'mcp23017',
    name: 'Adafruit MCP23017 Arduino Library',
    author: 'Adafruit',
    version: '2.3.2',
    source: 'manager',
    manager: 'Adafruit MCP23017 Arduino Library',
    url: 'https://github.com/adafruit/Adafruit-MCP23017-Arduino-Library',
    cli: 'arduino-cli lib install "Adafruit MCP23017 Arduino Library"',
    includes: ['Adafruit_MCP23X17.h'],
    flashKb: 4.1,
    ramB: 60,
    arch: ALL_ARCH,
    deps: ['wire', 'busio'],
    note: 'Διάβασε και τα 16 pins με ένα `readGPIOAB()` αντί για 16 κλήσεις.',
  },

  /* --------------------------- Έξοδοι -------------------------- */
  {
    id: 'fastled',
    name: 'FastLED',
    author: 'Daniel Garcia, Mark Kriegsman',
    version: '3.9.9',
    source: 'manager',
    manager: 'FastLED',
    url: 'https://github.com/FastLED/FastLED',
    cli: 'arduino-cli lib install FastLED',
    includes: ['FastLED.h'],
    flashKb: 6.8,
    ramB: 3,
    ramPerUnit: 3,
    arch: ALL_ARCH,
    note:
      'Γρήγορη και με έτοιμο `setMaxPowerInVoltsAndMilliamps()` — χρησιμοποίησέ το για να μην ρίξεις την τροφοδοσία. 3 bytes RAM ανά LED.',
  },
  {
    id: 'neopixel',
    name: 'Adafruit NeoPixel',
    author: 'Adafruit',
    version: '1.12.5',
    source: 'manager',
    manager: 'Adafruit NeoPixel',
    url: 'https://github.com/adafruit/Adafruit_NeoPixel',
    cli: 'arduino-cli lib install "Adafruit NeoPixel"',
    includes: ['Adafruit_NeoPixel.h'],
    flashKb: 3.4,
    ramB: 3,
    ramPerUnit: 3,
    arch: ALL_ARCH,
    note: 'Πιο απλή από το FastLED, λίγο πιο αργή. Εναλλακτική αν το FastLED σου δίνει πρόβλημα.',
  },
  {
    id: 'tm1637',
    name: 'TM1637',
    author: 'Avishay Orpaz',
    version: '1.2.0',
    source: 'manager',
    manager: 'TM1637',
    url: 'https://github.com/avishorp/TM1637',
    cli: 'arduino-cli lib install TM1637',
    includes: ['TM1637Display.h'],
    flashKb: 1.8,
    ramB: 12,
    arch: ALL_ARCH,
    note: 'Δύο pins, τέσσερα ψηφία. Το `showNumberDec()` κάνει τη δουλειά για το γρανάζι.',
  },
  {
    id: 'ssd1306',
    name: 'Adafruit SSD1306',
    author: 'Adafruit',
    version: '2.5.13',
    source: 'manager',
    manager: 'Adafruit SSD1306',
    url: 'https://github.com/adafruit/Adafruit_SSD1306',
    cli: 'arduino-cli lib install "Adafruit SSD1306"',
    includes: ['Adafruit_SSD1306.h'],
    flashKb: 8.2,
    ramB: 1024,
    arch: ALL_ARCH,
    deps: ['gfx', 'wire'],
    note:
      'Κρατάει ολόκληρο buffer 1KB στη RAM — σε ATmega328 (2KB) αυτό είναι η μισή σου μνήμη.',
  },
  {
    id: 'gfx',
    name: 'Adafruit GFX Library',
    author: 'Adafruit',
    version: '1.12.1',
    source: 'manager',
    manager: 'Adafruit GFX Library',
    url: 'https://github.com/adafruit/Adafruit-GFX-Library',
    cli: 'arduino-cli lib install "Adafruit GFX Library"',
    includes: ['Adafruit_GFX.h'],
    flashKb: 4.6,
    ramB: 40,
    arch: ALL_ARCH,
    note: 'Κοινή βάση σχεδίασης για SSD1306 και ILI9341.',
  },
  {
    id: 'busio',
    name: 'Adafruit BusIO',
    author: 'Adafruit',
    version: '1.17.1',
    source: 'manager',
    manager: 'Adafruit BusIO',
    url: 'https://github.com/adafruit/Adafruit_BusIO',
    cli: 'arduino-cli lib install "Adafruit BusIO"',
    includes: [],
    flashKb: 2.1,
    ramB: 30,
    arch: ALL_ARCH,
    note: 'Εξάρτηση των Adafruit βιβλιοθηκών· ο Library Manager τη βάζει μόνος του.',
  },
  {
    id: 'ili9341',
    name: 'Adafruit ILI9341',
    author: 'Adafruit',
    version: '1.6.1',
    source: 'manager',
    manager: 'Adafruit ILI9341',
    url: 'https://github.com/adafruit/Adafruit_ILI9341',
    cli: 'arduino-cli lib install "Adafruit ILI9341"',
    includes: ['Adafruit_ILI9341.h'],
    flashKb: 7.4,
    ramB: 90,
    arch: ALL_ARCH,
    deps: ['gfx', 'spi'],
    note:
      'Για ρευστό καντράν προτίμησε TFT_eSPI σε ESP32/RP2040 — είναι αισθητά γρηγορότερη.',
  },
  {
    id: 'nextion',
    name: 'EasyNextionLibrary',
    author: 'Athanasios Seitanis',
    version: '1.0.6',
    source: 'manager',
    manager: 'EasyNextionLibrary',
    url: 'https://github.com/Seithan/EasyNextionLibrary',
    cli: 'arduino-cli lib install EasyNextionLibrary',
    includes: ['EasyNextionLibrary.h'],
    flashKb: 2.4,
    ramB: 60,
    arch: ALL_ARCH,
    note: 'Στέλνεις μόνο τιμές· το σχέδιο ζει μέσα στην οθόνη μέσω του Nextion Editor.',
  },
  {
    id: 'servo',
    name: 'Servo',
    author: 'Arduino',
    version: '1.2.2',
    source: 'builtin',
    manager: 'Servo',
    url: 'https://www.arduino.cc/reference/en/libraries/servo/',
    cli: 'arduino-cli lib install Servo',
    includes: ['Servo.h'],
    flashKb: 2,
    ramB: 40,
    arch: ALL_ARCH,
    note: 'Σε AVR δεσμεύει τον Timer1 — χαλάει το PWM σε D9/D10.',
  },
  {
    id: 'switec',
    name: 'SwitecX25',
    author: 'Guy Carpenter',
    version: '1.0.0',
    source: 'zip',
    manager: null,
    url: 'https://github.com/clearwater/SwitecX25',
    cli: 'arduino-cli lib install --git-url https://github.com/clearwater/SwitecX25.git',
    includes: ['SwitecX25.h'],
    flashKb: 2.2,
    ramB: 26,
    arch: ['avr', 'teensy'],
    note:
      'Οδηγεί τους δείκτες X27.168 με ράμπα επιτάχυνσης, ώστε να μη χάνει βήματα.',
  },

  /* ------------------------ Σύστημα / core ---------------------- */
  {
    id: 'wire',
    name: 'Wire (I2C)',
    author: 'Arduino',
    version: 'core',
    source: 'builtin',
    manager: null,
    url: 'https://www.arduino.cc/reference/en/language/functions/communication/wire/',
    cli: '—',
    includes: ['Wire.h'],
    flashKb: 2.4,
    ramB: 200,
    arch: ALL_ARCH,
    note: 'Ανέβασε τον δίαυλο σε 400kHz με `Wire.setClock(400000)` — η διαφορά στις οθόνες είναι τεράστια.',
  },
  {
    id: 'spi',
    name: 'SPI',
    author: 'Arduino',
    version: 'core',
    source: 'builtin',
    manager: null,
    url: 'https://www.arduino.cc/reference/en/language/functions/communication/spi/',
    cli: '—',
    includes: ['SPI.h'],
    flashKb: 1.2,
    ramB: 20,
    arch: ALL_ARCH,
    note: 'Πολύ γρηγορότερο από I2C για οθόνες, με κόστος τρία επιπλέον pins.',
  },
  {
    id: 'eeprom',
    name: 'EEPROM',
    author: 'Arduino',
    version: 'core',
    source: 'builtin',
    manager: null,
    url: 'https://docs.arduino.cc/learn/built-in-libraries/eeprom',
    cli: '—',
    includes: ['EEPROM.h'],
    flashKb: 0.6,
    ramB: 4,
    arch: ALL_ARCH,
    note: 'Για να θυμάται η πλακέτα τη βαθμονόμηση των πεντάλ μετά από αποσύνδεση.',
  },
]

/** Ποιες βιβλιοθήκες χρειάζεται κάθε ρόλος εξαρτήματος. */
const ROLE_LIBS = {
  button: ['bounce2'],
  matrix: ['keypad'],
  encoder: ['encoder'],
  analog: [],
  loadcell: [],
  hx711: ['hx711'],
  ads1115: ['ads1x15', 'wire'],
  expander: ['mcp23017', 'wire'],
  ledstrip: ['fastled'],
  led: [],
  sevenseg: ['tm1637'],
  gauge: ['switec'],
  servo: ['servo'],
  fan: [],
  haptic: [],
  buzzer: [],
  psu: [],
  buck: [],
  mosfet: [],
  levelshifter: [],
  resistor: [],
  diode: [],
  capacitor: [],
}

/** Βιβλιοθήκη HID ανά αρχιτεκτονική πλακέτας. */
const HID_LIB_BY_ARCH = {
  avr: 'joystick',
  rp2040: 'tinyusb',
  teensy: 'teensy-usb',
  esp32: 'ble-gamepad',
}

export function getLibrary(id) {
  return LIBRARIES.find((l) => l.id === id) || null
}

export function allLibraries() {
  return LIBRARIES
}

/** Η βιβλιοθήκη HID που ταιριάζει σε μια πλακέτα (ή null αν δεν κάνει HID). */
export function hidLibraryFor(board) {
  const id = HID_LIB_BY_ARCH[board.arch]
  return id ? getLibrary(id) : null
}

/**
 * Ανάλυση βιβλιοθηκών για μια κατασκευή.
 *
 * @param {object} board       η πλακέτα
 * @param {object[]} placed    τα τοποθετημένα εξαρτήματα ({ part, values })
 * @param {object} opts        { needsHid, ledCount, usesDisplaySpi, usesSerial, usesEeprom }
 * @returns {{ libs: object[], flashKb: number, ramB: number, incompatible: object[] }}
 */
export function analyzeLibraries(board, placed, opts = {}) {
  const ids = new Set()

  for (const item of placed) {
    for (const libId of ROLE_LIBS[item.part.role] || []) ids.add(libId)
    // Οθόνες: SPI ή I2C ανάλογα με τη ρύθμιση.
    if (item.part.id === 'oled') {
      ids.add('ssd1306')
      ids.add('gfx')
      ids.add(item.values.iface === 'spi' ? 'spi' : 'wire')
    }
    if (item.part.id === 'tft') {
      ids.add('ili9341')
      ids.add('gfx')
      ids.add('spi')
    }
    if (item.part.id === 'nextion') ids.add('nextion')
    // Ο encoder με πολύ μεγάλο pulse δεν χρειάζεται interrupt lib.
    if (item.part.role === 'encoder' && !item.values.useInterrupt) {
      ids.delete('encoder')
      ids.add('rotary-polled')
    }
  }

  if (opts.needsHid) {
    const hid = hidLibraryFor(board)
    if (hid) ids.add(hid.id)
  }
  if (opts.usesEeprom) ids.add('eeprom')

  // Προσθήκη εξαρτήσεων (ένα πέρασμα φτάνει — δεν υπάρχουν βαθιές αλυσίδες).
  for (const id of [...ids]) {
    for (const dep of getLibrary(id)?.deps || []) ids.add(dep)
  }

  const libs = []
  const incompatible = []
  let flashKb = 0
  let ramB = 0

  for (const id of ids) {
    const lib = getLibrary(id)
    if (!lib) continue
    if (!lib.arch.includes(board.arch)) {
      incompatible.push(lib)
      continue
    }
    libs.push(lib)
    flashKb += lib.flashKb
    ramB += lib.ramB
    if (lib.ramPerUnit && opts.ledCount) ramB += lib.ramPerUnit * opts.ledCount
  }

  libs.sort((a, b) => a.name.localeCompare(b.name, 'en'))
  return { libs, flashKb: Math.round(flashKb * 10) / 10, ramB: Math.round(ramB), incompatible }
}

/** Εντολές `arduino-cli` για εγκατάσταση όλων των βιβλιοθηκών μιας κατασκευής. */
export function installScript(libs) {
  const lines = ['# Εγκατάσταση βιβλιοθηκών με arduino-cli']
  for (const lib of libs) {
    if (lib.source === 'builtin' || lib.source === 'core') continue
    lines.push(`# ${lib.name} — ${lib.author}`)
    lines.push(lib.cli)
  }
  return lines.join('\n')
}
