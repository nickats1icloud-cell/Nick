/**
 * Γεννήτρια κώδικα Arduino.
 *
 * Παράγει σκίτσο (.ino) που αντιστοιχεί ακριβώς σε αυτό που καλωδίωσες και
 * δοκίμασες: ίδια pins, ίδιες βιβλιοθήκες, ίδιες ρυθμίσεις φίλτρων. Ό,τι
 * βλέπεις στην προσομοίωση είναι αυτό που θα ανεβάσεις.
 *
 * Παράγει επίσης το template τηλεμετρίας για το SimHub (Custom Serial Device)
 * ώστε οι έξοδοι να τροφοδοτούνται από πραγματικό παιχνίδι.
 */

import { installScript } from './libraries.js'

/** Μετατροπή id pin πλακέτας σε όνομα που δέχεται το Arduino IDE. */
export function arduinoPin(board, pinId) {
  if (!pinId) return '-1'
  if (board.arch === 'rp2040') return pinId.replace('GP', '')
  if (board.arch === 'esp32') return pinId.replace('GPIO', '')
  if (/^D\d+$/.test(pinId)) return pinId.slice(1)
  return pinId
}

/** Ελληνικά ονόματα → λατινικό αναγνωριστικό για #define. */
const GREEK_MAP = {
  Α: 'A', Β: 'V', Γ: 'G', Δ: 'D', Ε: 'E', Ζ: 'Z', Η: 'I', Θ: 'TH', Ι: 'I', Κ: 'K',
  Λ: 'L', Μ: 'M', Ν: 'N', Ξ: 'X', Ο: 'O', Π: 'P', Ρ: 'R', Σ: 'S', Τ: 'T', Υ: 'Y',
  Φ: 'F', Χ: 'CH', Ψ: 'PS', Ω: 'O',
}

/**
 * Οι τόνοι φεύγουν πρώτοι (αλλιώς το «ί» χάνεται ολόκληρο), μετά γίνεται η
 * αντιστοίχιση σε λατινικά και ό,τι απομείνει εκτός [A-Z0-9] γίνεται «_».
 */
function safeName(label, fallback, index, used) {
  const stripped = (label || fallback)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
  const base =
    [...stripped]
      .map((c) => GREEK_MAP[c] ?? c)
      .join('')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `${fallback}_${index}`

  if (!used) return base
  let name = base
  let n = 2
  while (used.has(name)) name = `${base}_${n++}`
  used.add(name)
  return name
}

/* ------------------------------------------------------------------ */
/* HID ανά αρχιτεκτονική                                               */
/* ------------------------------------------------------------------ */

function hidBlock(board, firmware) {
  const { buttonCount, axes } = firmware.hid
  const axisNames = axes.map((a) => a.axis)
  if (board.arch === 'avr') {
    return {
      include: '#include <Joystick.h>',
      declare: `Joystick_ Joystick(
  JOYSTICK_DEFAULT_REPORT_ID, JOYSTICK_TYPE_GAMEPAD,
  ${buttonCount}, 0,                 // κουμπιά, hat switches
  ${axisNames.includes('X')}, ${axisNames.includes('Y')}, ${axisNames.includes('Z')},
  ${axisNames.includes('Rx')}, ${axisNames.includes('Ry')}, ${axisNames.includes('Rz')},
  false, false, false, false, false);`,
      begin: `  Joystick.begin(false);   // false = στέλνουμε εμείς με sendState()
${axisNames.map((a) => `  Joystick.set${a}AxisRange(0, 1023);`).join('\n')}`,
      setButton: (i, expr) => `  Joystick.setButton(${i}, ${expr});`,
      setAxis: (a, expr) => `  Joystick.set${a}Axis(${expr});`,
      send: '  Joystick.sendState();',
    }
  }
  if (board.arch === 'teensy') {
    return {
      include: '// Tools ▸ USB Type ▸ "Serial + Keyboard + Mouse + Joystick"',
      declare: '',
      begin: '  Joystick.useManualSend(true);',
      setButton: (i, expr) => `  Joystick.button(${i + 1}, ${expr});`,
      setAxis: (a, expr) => `  Joystick.${a.toLowerCase()}(${expr});`,
      send: '  Joystick.send_now();',
    }
  }
  if (board.arch === 'rp2040') {
    return {
      include: '#include <Adafruit_TinyUSB.h>',
      declare: `// Περιγραφέας gamepad: ${buttonCount} κουμπιά, ${axisNames.length} άξονες
uint8_t const desc_hid_report[] = { TUD_HID_REPORT_DESC_GAMEPAD() };
Adafruit_USBD_HID usb_hid(desc_hid_report, sizeof(desc_hid_report), HID_ITF_PROTOCOL_NONE, 2, false);
hid_gamepad_report_t gp;`,
      begin: `  usb_hid.begin();
  while (!TinyUSBDevice.mounted()) delay(1);`,
      setButton: (i, expr) => `  if (${expr}) gp.buttons |= (1UL << ${i}); else gp.buttons &= ~(1UL << ${i});`,
      setAxis: (a, expr) => `  gp.${a.toLowerCase()} = map(${expr}, 0, 1023, -127, 127);`,
      send: '  usb_hid.sendReport(0, &gp, sizeof(gp));',
    }
  }
  return {
    include: '#include <BleGamepad.h>',
    declare: `BleGamepad bleGamepad("Sim Rig", "DIY", 100);`,
    begin: `  BleGamepadConfiguration cfg;
  cfg.setButtonCount(${buttonCount});
  cfg.setAutoReport(false);
  bleGamepad.begin(&cfg);`,
    setButton: (i, expr) => `  if (${expr}) bleGamepad.press(${i + 1}); else bleGamepad.release(${i + 1});`,
    setAxis: (a, expr) => `  bleGamepad.setAxes(${expr});`,
    send: '  bleGamepad.sendReport();',
  }
}

/* ------------------------------------------------------------------ */
/* Το σκίτσο                                                           */
/* ------------------------------------------------------------------ */

export function generateSketch(build, firmware, settings) {
  const board = firmware.board
  const P = (id) => arduinoPin(board, id)
  const hid = firmware.hid.needed ? hidBlock(board, firmware) : null

  const usedNames = new Set()
  const includes = new Set()
  const defines = []
  const globals = []
  const setup = []
  const loopRead = []
  const loopWrite = []

  if (hid?.include) includes.add(hid.include)
  for (const lib of firmware.memory.libs) {
    for (const inc of lib.includes) includes.add(`#include <${inc}>`)
  }

  /* --------------------------- Είσοδοι --------------------------- */
  let btnIndex = 0
  const bounceObjects = []

  firmware.inputs.forEach((entry, i) => {
    if (!entry.wired) return
    const name = safeName(entry.label, 'IN', i, usedNames)
    const v = entry.values

    if (entry.kind === 'button') {
      defines.push(`#define PIN_${name} ${P(entry.pins.sig)}`)
      bounceObjects.push(`Bounce ${name.toLowerCase()} = Bounce();`)
      setup.push(`  ${name.toLowerCase()}.attach(PIN_${name}, ${v.pullup ? 'INPUT_PULLUP' : 'INPUT'});`)
      setup.push(`  ${name.toLowerCase()}.interval(${settings.debounceMs});`)
      loopRead.push(`  ${name.toLowerCase()}.update();`)
      const expr = v.pullup ? `${name.toLowerCase()}.read() == LOW` : `${name.toLowerCase()}.read() == HIGH`
      for (const idx of entry.buttons) {
        loopWrite.push(hid.setButton(idx, expr))
        btnIndex = Math.max(btnIndex, idx)
      }
    }

    if (entry.kind === 'encoder') {
      defines.push(`#define PIN_${name}_A ${P(entry.pins.a)}`)
      defines.push(`#define PIN_${name}_B ${P(entry.pins.b)}`)
      if (v.useInterrupt) {
        globals.push(`Encoder ${name.toLowerCase()}(PIN_${name}_A, PIN_${name}_B);`)
        globals.push(`long ${name.toLowerCase()}_last = 0;`)
        loopRead.push(`  long ${name.toLowerCase()}_now = ${name.toLowerCase()}.read() / 4;`)
      } else {
        globals.push(
          `RotaryEncoder ${name.toLowerCase()}(PIN_${name}_A, PIN_${name}_B, RotaryEncoder::LatchMode::FOUR3);`
        )
        globals.push(`long ${name.toLowerCase()}_last = 0;`)
        loopRead.push(`  ${name.toLowerCase()}.tick();`)
        loopRead.push(`  long ${name.toLowerCase()}_now = ${name.toLowerCase()}.getPosition();`)
      }
      if (v.mode === 'buttons') {
        globals.push(`unsigned long ${name.toLowerCase()}_cw = 0, ${name.toLowerCase()}_ccw = 0;`)
        loopRead.push(`  if (${name.toLowerCase()}_now > ${name.toLowerCase()}_last) ${name.toLowerCase()}_cw = millis() + ${v.pulseMs};`)
        loopRead.push(`  if (${name.toLowerCase()}_now < ${name.toLowerCase()}_last) ${name.toLowerCase()}_ccw = millis() + ${v.pulseMs};`)
        loopRead.push(`  ${name.toLowerCase()}_last = ${name.toLowerCase()}_now;`)
        if (entry.buttons[0] != null) loopWrite.push(hid.setButton(entry.buttons[0], `millis() < ${name.toLowerCase()}_cw`))
        if (entry.buttons[1] != null) loopWrite.push(hid.setButton(entry.buttons[1], `millis() < ${name.toLowerCase()}_ccw`))
      } else if (entry.axis) {
        loopWrite.push(hid.setAxis(entry.axis, `constrain(512 + ${name.toLowerCase()}_now * 8, 0, 1023)`))
      }
      if (entry.pins.sw) {
        defines.push(`#define PIN_${name}_SW ${P(entry.pins.sw)}`)
        setup.push(`  pinMode(PIN_${name}_SW, INPUT_PULLUP);`)
        const last = entry.buttons[entry.buttons.length - 1]
        if (last != null) loopWrite.push(hid.setButton(last, `digitalRead(PIN_${name}_SW) == LOW`))
      }
    }

    if (entry.kind === 'matrix') {
      const rows = v.rows || 4
      const cols = v.cols || 4
      const rowPins = Array.from({ length: rows }, (_, r) => P(entry.pins[`r${r}`])).join(', ')
      const colPins = Array.from({ length: cols }, (_, c) => P(entry.pins[`c${c}`])).join(', ')
      globals.push(`const byte ${name}_ROWS = ${rows};
const byte ${name}_COLS = ${cols};
byte ${name.toLowerCase()}_rowPins[${name}_ROWS] = { ${rowPins} };
byte ${name.toLowerCase()}_colPins[${name}_COLS] = { ${colPins} };
char ${name.toLowerCase()}_keys[${name}_ROWS][${name}_COLS] = {
${Array.from({ length: rows }, (_, r) =>
  `  { ${Array.from({ length: cols }, (_, c) => `'${String.fromCharCode(97 + r * cols + c)}'`).join(', ')} }`
).join(',\n')}
};
Keypad ${name.toLowerCase()} = Keypad(makeKeymap(${name.toLowerCase()}_keys), ${name.toLowerCase()}_rowPins, ${name.toLowerCase()}_colPins, ${name}_ROWS, ${name}_COLS);
bool ${name.toLowerCase()}_state[${rows * cols}] = { false };`)
      loopRead.push(`  ${name.toLowerCase()}.getKeys();
  for (byte k = 0; k < LIST_MAX; k++) {
    if (!${name.toLowerCase()}.key[k].stateChanged) continue;
    int idx = ${name.toLowerCase()}.key[k].kchar - 'a';
    if (idx < 0 || idx >= ${rows * cols}) continue;
    ${name.toLowerCase()}_state[idx] = (${name.toLowerCase()}.key[k].kstate == PRESSED || ${name.toLowerCase()}.key[k].kstate == HOLD);
  }`)
      entry.buttons.forEach((idx, k) => {
        loopWrite.push(hid.setButton(idx, `${name.toLowerCase()}_state[${k}]`))
      })
    }

    if (entry.kind === 'analog') {
      defines.push(`#define PIN_${name} ${P(entry.pins.sig)}`)
      globals.push(`float ${name.toLowerCase()}_f = 0;`)
      const maxCounts = 2 ** board.adcBits - 1
      loopRead.push(`  ${name.toLowerCase()}_f += (analogRead(PIN_${name}) - ${name.toLowerCase()}_f) * ${settings.filterAlpha};`)
      const expr = v.invert
        ? `map((long)${name.toLowerCase()}_f, 0, ${maxCounts}, 1023, 0)`
        : `map((long)${name.toLowerCase()}_f, 0, ${maxCounts}, 0, 1023)`
      if (entry.axis) loopWrite.push(hid.setAxis(entry.axis, `constrain(${expr}, 0, 1023)`))
    }

    if (entry.kind === 'hx711') {
      defines.push(`#define PIN_${name}_DT ${P(entry.pins.dt)}`)
      defines.push(`#define PIN_${name}_SCK ${P(entry.pins.sck)}`)
      globals.push(`HX711 ${name.toLowerCase()};
long ${name.toLowerCase()}_zero = 0;      // βαθμονόμηση: τιμή με ελεύθερο πεντάλ
long ${name.toLowerCase()}_full = 400000; // τιμή με τέρμα πάτημα (βάλε τη δική σου)
float ${name.toLowerCase()}_f = 0;
long ${name.toLowerCase()}_out = 0;`)
      setup.push(`  ${name.toLowerCase()}.begin(PIN_${name}_DT, PIN_${name}_SCK, ${v.gain});
  EEPROM.get(0, ${name.toLowerCase()}_zero);
  EEPROM.get(4, ${name.toLowerCase()}_full);`)
      loopRead.push(`  if (${name.toLowerCase()}.is_ready()) {                 // ΠΟΤΕ read() χωρίς is_ready() — μπλοκάρει τον βρόχο
    long raw = ${name.toLowerCase()}.read();
    ${name.toLowerCase()}_f += (raw - ${name.toLowerCase()}_f) * ${v.emaAlpha};
    float n = (float)(${name.toLowerCase()}_f - ${name.toLowerCase()}_zero) / (${name.toLowerCase()}_full - ${name.toLowerCase()}_zero);
    n = constrain(n, 0.0f, 1.0f);
    n = pow(n, ${v.curve.toFixed(2)}f);                   // καμπύλη πεντάλ
    ${name.toLowerCase()}_out = (long)(n * 1023);
  }`)
      if (entry.axis) loopWrite.push(hid.setAxis(entry.axis, `${name.toLowerCase()}_out`))
    }

    if (entry.kind === 'ads1115') {
      globals.push(`Adafruit_ADS1115 ${name.toLowerCase()};`)
      setup.push(`  ${name.toLowerCase()}.setGain(GAIN_ONE);
  ${name.toLowerCase()}.begin(${v.address});`)
      entry.axes.forEach((axis, ch) => {
        if (!axis) return
        loopRead.push(`  int16_t ${name.toLowerCase()}_ch${ch} = ${name.toLowerCase()}.readADC_SingleEnded(${ch});`)
        loopWrite.push(hid.setAxis(axis, `constrain(map(${name.toLowerCase()}_ch${ch}, 0, 26000, 0, 1023), 0, 1023)`))
      })
    }

    if (entry.kind === 'expander') {
      globals.push(`Adafruit_MCP23X17 ${name.toLowerCase()};`)
      setup.push(`  ${name.toLowerCase()}.begin_I2C(${v.address});
  for (uint8_t i = 0; i < ${v.used}; i++) ${name.toLowerCase()}.pinMode(i, INPUT_PULLUP);`)
      loopRead.push(`  uint16_t ${name.toLowerCase()}_bits = ${name.toLowerCase()}.readGPIOAB();`)
      entry.buttons.forEach((idx, k) => {
        loopWrite.push(hid.setButton(idx, `!(${name.toLowerCase()}_bits & (1 << ${k}))`))
      })
    }
  })

  /* --------------------------- Έξοδοι ---------------------------- */
  firmware.outputs.forEach((entry, i) => {
    if (!entry.wired) return
    const name = safeName(entry.label, 'OUT', i, usedNames)
    const v = entry.values

    if (entry.kind === 'ledstrip') {
      defines.push(`#define PIN_${name} ${P(entry.pins.din)}`)
      defines.push(`#define ${name}_COUNT ${v.ledCount}`)
      globals.push(`CRGB ${name.toLowerCase()}[${name}_COUNT];`)
      setup.push(`  FastLED.addLeds<WS2812B, PIN_${name}, GRB>(${name.toLowerCase()}, ${name}_COUNT);
  FastLED.setBrightness(${Math.round((v.brightness / 100) * 255)});
  FastLED.setMaxPowerInVoltsAndMilliamps(5, ${v.external5v ? 4000 : Math.round(board.maxCurrentMa * 0.7)});`)
      loopWrite.push(`  updateRevLights(${name.toLowerCase()}, ${name}_COUNT);`)
      globals.push(`void updateRevLights(CRGB *leds, int count) {
  float pct = (tel.maxRpm > 0) ? (100.0f * tel.rpm / tel.maxRpm) : 0;
  if (pct >= ${v.shiftPct}) {                       // σημείο αλλαγής: αναβοσβήνει
    bool on = (millis() / ${Math.max(1, Math.round(500 / (v.blinkHz || 10)))}) % 2 == 0;
    fill_solid(leds, count, on ? CRGB(80, 120, 255) : CRGB::Black);
  } else {
    for (int i = 0; i < count; i++) {
      float threshold = ${v.startPct} + (${v.shiftPct} - ${v.startPct}) * i / (float)(count - 1);
      if (pct < threshold) { leds[i] = CRGB::Black; continue; }
      float f = i / (float)(count - 1);
      leds[i] = (f < 0.45f) ? CRGB(0, 255, 60) : (f < 0.78f) ? CRGB(255, 170, 0) : CRGB(255, 20, 20);
    }
  }
  FastLED.show();
}`)
    }

    if (entry.kind === 'led') {
      defines.push(`#define PIN_${name} ${P(entry.pins.a)}`)
      setup.push(`  pinMode(PIN_${name}, OUTPUT);`)
      const cond = {
        shift: '100.0 * tel.rpm / tel.maxRpm > 96',
        abs: 'tel.abs',
        pit: 'tel.pitLimiter',
        fuel: 'tel.fuelPct < 12',
        tc: 'tel.tc',
      }[v.source]
      loopWrite.push(`  digitalWrite(PIN_${name}, (${cond}) ? HIGH : LOW);`)
    }

    if (entry.kind === 'sevenseg') {
      defines.push(`#define PIN_${name}_CLK ${P(entry.pins.clk)}`)
      defines.push(`#define PIN_${name}_DIO ${P(entry.pins.dio)}`)
      globals.push(`TM1637Display ${name.toLowerCase()}(PIN_${name}_CLK, PIN_${name}_DIO);
unsigned long ${name.toLowerCase()}_next = 0;`)
      setup.push(`  ${name.toLowerCase()}.setBrightness(${v.brightness});`)
      const value = { gear: 'tel.gear', speed: 'tel.speedKmh', rpm: 'tel.rpm', lap: 'tel.lapMs / 100' }[v.show]
      loopWrite.push(`  if (millis() >= ${name.toLowerCase()}_next) {   // μην ανανεώνεις κάθε βρόχο
    ${name.toLowerCase()}_next = millis() + ${Math.round(1000 / v.updateHz)};
    ${name.toLowerCase()}.showNumberDec(${value}, false);
  }`)
    }

    if (entry.kind === 'display' && entry.part.id === 'oled') {
      globals.push(`Adafruit_SSD1306 ${name.toLowerCase()}(128, 64, &Wire, -1);
unsigned long ${name.toLowerCase()}_next = 0;`)
      setup.push(`  Wire.begin();
  Wire.setClock(400000);                        // 100kHz → 400kHz: 4× γρηγορότερη οθόνη
  ${name.toLowerCase()}.begin(SSD1306_SWITCHCAPVCC, ${v.address});`)
      loopWrite.push(`  if (millis() >= ${name.toLowerCase()}_next) {
    ${name.toLowerCase()}_next = millis() + ${Math.round(1000 / v.updateHz)};
    ${name.toLowerCase()}.clearDisplay();
    ${name.toLowerCase()}.setTextColor(SSD1306_WHITE);
    ${name.toLowerCase()}.setTextSize(4);
    ${name.toLowerCase()}.setCursor(4, 4);
    ${name.toLowerCase()}.print(tel.gear);
    ${name.toLowerCase()}.setTextSize(1);
    ${name.toLowerCase()}.setCursor(52, 8);
    ${name.toLowerCase()}.print(tel.rpm);
    ${name.toLowerCase()}.setCursor(52, 24);
    ${name.toLowerCase()}.print(tel.speedKmh);
    ${name.toLowerCase()}.print(F(" km/h"));
    ${name.toLowerCase()}.display();
  }`)
    }

    if (entry.kind === 'fan') {
      defines.push(`#define PIN_${name} ${P(entry.pins.pwm)}`)
      setup.push(`  pinMode(PIN_${name}, OUTPUT);`)
      loopWrite.push(`  {
    int duty = map(constrain(tel.speedKmh, 0, ${v.maxKmh}), 0, ${v.maxKmh}, ${Math.round((v.minPct / 100) * 255)}, 255);
    analogWrite(PIN_${name}, tel.speedKmh < 3 ? 0 : duty);
  }`)
    }

    if (entry.kind === 'haptic') {
      defines.push(`#define PIN_${name} ${P(entry.pins.pwm)}`)
      setup.push(`  pinMode(PIN_${name}, OUTPUT);`)
      const cond = { abs: 'tel.abs', slip: 'tel.slip > 20', kerb: 'tel.kerb > 20', shift: '100.0 * tel.rpm / tel.maxRpm > 96' }[v.trigger]
      loopWrite.push(`  analogWrite(PIN_${name}, (${cond}) ? ${Math.round((v.strength / 100) * 255)} : 0);`)
    }

    if (entry.kind === 'buzzer') {
      defines.push(`#define PIN_${name} ${P(entry.pins.sig)}`)
      const cond = { shift: '100.0 * tel.rpm / tel.maxRpm > 96', pit: 'tel.pitLimiter', fuel: 'tel.fuelPct < 12', flag: 'tel.flag != 0' }[v.trigger]
      loopWrite.push(`  if (${cond}) tone(PIN_${name}, ${v.toneHz}); else noTone(PIN_${name});`)
    }

    if (entry.kind === 'servo') {
      defines.push(`#define PIN_${name} ${P(entry.pins.sig)}`)
      globals.push(`Servo ${name.toLowerCase()};`)
      setup.push(`  ${name.toLowerCase()}.attach(PIN_${name});`)
      const src = { boost: 'tel.boost', fuel: 'tel.fuelPct', rpm: '100.0 * tel.rpm / tel.maxRpm', speed: 'tel.speedKmh' }[v.source]
      loopWrite.push(`  ${name.toLowerCase()}.write(constrain((int)(${src}), 0, ${v.rangeDeg}));`)
    }

    if (entry.kind === 'gauge') {
      const pins = ['in1', 'in2', 'in3', 'in4'].map((k) => P(entry.pins[k])).join(', ')
      globals.push(`SwitecX25 ${name.toLowerCase()}(${Math.round(v.sweepDeg * 3)}, ${pins});`)
      setup.push(`  ${name.toLowerCase()}.zero();`)
      const src = { rpm: '100.0 * tel.rpm / tel.maxRpm / 100.0', speed: 'tel.speedKmh / 260.0', fuel: 'tel.fuelPct / 100.0', water: '(tel.waterC - 40) / 80.0' }[v.source]
      loopWrite.push(`  ${name.toLowerCase()}.setPosition(constrain((int)((${src}) * ${Math.round(v.sweepDeg * 3)}), 0, ${Math.round(v.sweepDeg * 3)}));`)
      loopRead.push(`  ${name.toLowerCase()}.update();          // πρέπει να καλείται συχνά για ομαλή κίνηση`)
    }
  })

  /* ------------------------ Τηλεμετρία --------------------------- */
  const telemetryBlock = firmware.telemetryNeeded
    ? `
/* ---- Τηλεμετρία από SimHub (Custom Serial Device) ----
   Μορφή γραμμής:  R7200;G3;S168;T92;B0;A0;C0;K0;P0;F0;L83450;D-0.21
   Το template για το SimHub είναι στην καρτέλα «Κώδικας» της εφαρμογής. */
struct Telemetry {
  int rpm = 0, maxRpm = ${8000}, gear = 0, speedKmh = 0;
  int throttle = 0, brake = 0, slip = 0, kerb = 0, boost = 0;
  bool abs = false, tc = false, pitLimiter = false;
  int flag = 0, fuelPct = 100, waterC = 80;
  long lapMs = 0;
  float delta = 0;
} tel;

char rxBuf[96];
uint8_t rxLen = 0;

void parseTelemetry(char *line) {
  char *tok = strtok(line, ";");
  while (tok) {
    char key = tok[0];
    long val = atol(tok + 1);
    switch (key) {
      case 'R': tel.rpm = val; break;
      case 'M': tel.maxRpm = val; break;
      case 'G': tel.gear = val; break;
      case 'S': tel.speedKmh = val; break;
      case 'T': tel.throttle = val; break;
      case 'B': tel.brake = val; break;
      case 'A': tel.abs = val; break;
      case 'C': tel.tc = val; break;
      case 'K': tel.kerb = val; break;
      case 'P': tel.pitLimiter = val; break;
      case 'F': tel.flag = val; break;
      case 'U': tel.fuelPct = val; break;
      case 'W': tel.waterC = val; break;
      case 'O': tel.boost = val; break;
      case 'L': tel.lapMs = val; break;
      case 'D': tel.delta = val / 100.0f; break;
    }
    tok = strtok(NULL, ";");
  }
}

void readTelemetry() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\\n' || rxLen >= sizeof(rxBuf) - 1) {
      rxBuf[rxLen] = 0;
      if (rxLen > 2) parseTelemetry(rxBuf);
      rxLen = 0;
    } else if (c != '\\r') {
      rxBuf[rxLen++] = c;
    }
  }
}
`
    : ''

  /* --------------------------- Σύνθεση --------------------------- */
  const header = `/*
 * ${build.name}
 * ------------------------------------------------------------
 * Πλακέτα      : ${board.name} (${board.mcu}, ${board.logic}V, ${board.clockMhz}MHz)
 * Είσοδοι      : ${firmware.hid.buttonCount} κουμπιά HID, ${firmware.hid.axes.length} άξονες
 * Βρόχος       : ~${firmware.timing.loopHz} Hz  (καθυστέρηση ~${firmware.timing.latencyMs} ms)
 * Μνήμη        : ~${firmware.memory.flashKb} KB flash, ~${firmware.memory.ramB} B RAM
 *
 * Παράχθηκε από το Εργαστήριο Κατασκευών — η καλωδίωση εδώ είναι ίδια
 * με αυτή που δοκίμασες στην προσομοίωση.
 */
`

  const parts = [
    header,
    [...includes].join('\n'),
    firmware.telemetryNeeded ? telemetryBlock : '',
    defines.length ? `\n/* ---- Pins ---- */\n${defines.join('\n')}` : '',
    bounceObjects.length ? `\n/* ---- Debounce ---- */\n${bounceObjects.join('\n')}` : '',
    globals.length ? `\n/* ---- Καθολικά ---- */\n${globals.join('\n')}` : '',
    hid?.declare ? `\n/* ---- HID ---- */\n${hid.declare}` : '',
    `
void setup() {
${firmware.telemetryNeeded ? '  Serial.begin(115200);\n' : ''}${setup.join('\n')}
${hid ? hid.begin : ''}
}

void loop() {
${firmware.telemetryNeeded ? '  readTelemetry();\n' : ''}${loopRead.join('\n')}

${loopWrite.join('\n')}
${hid ? hid.send : ''}
}
`,
  ]

  return parts.filter(Boolean).join('\n')
}

/**
 * Το «Update messages» template για το SimHub ▸ Custom Serial Devices.
 * Αντιγράφεις και επικολλάς — στέλνει ό,τι περιμένει το parseTelemetry().
 */
export function simhubTemplate() {
  return [
    "'R' + round([DataCorePlugin.GameData.Rpms]) + ';' +",
    "'M' + round([DataCorePlugin.GameData.CarSettings_MaxRPM]) + ';' +",
    "'G' + [DataCorePlugin.GameData.Gear] + ';' +",
    "'S' + round([DataCorePlugin.GameData.SpeedKmh]) + ';' +",
    "'T' + round([DataCorePlugin.GameData.Throttle]) + ';' +",
    "'B' + round([DataCorePlugin.GameData.Brake]) + ';' +",
    "'A' + (isnull([DataCorePlugin.GameData.ABSActive],0) > 0 ? 1 : 0) + ';' +",
    "'C' + (isnull([DataCorePlugin.GameData.TCActive],0) > 0 ? 1 : 0) + ';' +",
    "'P' + ([DataCorePlugin.GameData.PitLimiterOn] ? 1 : 0) + ';' +",
    "'F' + (isnull([DataCorePlugin.GameData.Flag_Yellow],0) > 0 ? 1 : 0) + ';' +",
    "'U' + round([DataCorePlugin.GameData.FuelPercent]) + ';' +",
    "'W' + round([DataCorePlugin.GameData.WaterTemperature]) + ';' +",
    "'O' + round([DataCorePlugin.GameData.TurboPercent]) + ';' +",
    "'L' + round([DataCorePlugin.GameData.CurrentLapTime] * 1000) + ';' +",
    "'D' + round(isnull([DataCorePlugin.GameData.DeltaToSessionBest],0) * 100) + ';' +",
    "chr(10)",
  ].join('\n')
}

/** Σενάριο εγκατάστασης βιβλιοθηκών για τη συγκεκριμένη κατασκευή. */
export function librariesScript(firmware) {
  return installScript(firmware.memory.libs)
}
