/**
 * Φυσική οχήματος — arcade drift μοντέλο, όχι προσομοίωση.
 *
 * Κάθε βήμα: (1) προβάλλουμε την ταχύτητα στο σύστημα του αμαξιού, (2)
 * εφαρμόζουμε κινητήρα/φρένα/αντίσταση στη διαμήκη συνιστώσα, (3) στρίβουμε το
 * αμάξι με βάση τη γωνία τιμονιού, (4) ξαναπροβάλλουμε και "τρώμε" την πλευρική
 * συνιστώσα με περιορισμένη τριβή. Το βήμα (4) είναι όλο το drift: όταν η
 * απαιτούμενη πλευρική επιτάχυνση ξεπερνά το grip, το αμάξι γλιστράει.
 *
 * Οι σταθερές είναι ρυθμισμένες "στο αίσθημα", όχι σε πραγματικά δεδομένα.
 */

/** Διαθέσιμα αμάξια. Τιμές σε SI (m, s, m/s²). */
export const CARS = [
  {
    id: "gt3",
    name: "GSR GT3",
    blurb: "Ισορροπημένο, συγχωρητικό — η καλύτερη πρώτη επιλογή.",
    color: "#2f6fd0",
    accentColor: "#8fc0ff",
    length: 4.6,
    width: 1.95,
    wheelbase: 2.65,
    accel: 11.5,
    brake: 22,
    maxSpeed: 76, // ~274 km/h
    grip: 15.5,
    downforce: 0.012, // επιπλέον grip ανά m/s ταχύτητας (αεροδυναμική)
    steerMax: 0.62,
    steerRate: 7,
    steerFalloff: 0.028,
    drag: 0.00028,
    roll: 0.012,
  },
  {
    id: "formula",
    name: "GSR Formula",
    blurb: "Τεράστιο grip και φρένα, αλλά τιμωρεί τα λάθη.",
    color: "#d63b3b",
    accentColor: "#ffb3b3",
    length: 5.1,
    width: 1.85,
    wheelbase: 3.1,
    accel: 15,
    brake: 28,
    maxSpeed: 85, // ~306 km/h
    grip: 18,
    downforce: 0.018,
    steerMax: 0.5,
    steerRate: 9,
    steerFalloff: 0.024,
    drag: 0.00024,
    roll: 0.01,
  },
  {
    id: "drift",
    name: "GSR Drift AE",
    blurb: "Λίγο grip, πολύ γωνία. Για όσους κυνηγούν στιλ.",
    color: "#e8a33d",
    accentColor: "#ffe0b0",
    length: 4.3,
    width: 1.8,
    wheelbase: 2.5,
    accel: 10,
    brake: 18,
    maxSpeed: 66, // ~238 km/h
    grip: 11.5,
    downforce: 0.005,
    steerMax: 0.78,
    steerRate: 8,
    steerFalloff: 0.02,
    drag: 0.00045,
    roll: 0.018,
  },
];

export function carById(id) {
  return CARS.find((c) => c.id === id) || CARS[0];
}

/** Εικονικό κιβώτιο 6 σχέσεων — μόνο για το HUD (ταχύτητα/στροφές). */
const GEAR_TOPS = [0.16, 0.3, 0.45, 0.62, 0.8, 1];

export function createCar(spec, pose, opts = {}) {
  return {
    spec,
    x: pose.x,
    y: pose.y,
    angle: pose.angle,
    vx: 0,
    vy: 0,
    steer: 0,
    yawRate: 0,
    slip: 0, // πλευρική ολίσθηση σε m/s (για skid marks / ήχο)
    speed: 0,
    onTrack: true,
    isAI: Boolean(opts.isAI),
    label: opts.label || "",
    // Κατάσταση αγώνα (τη γεμίζει το engine).
    lap: 0,
    progress: 0,
    sampleIndex: -1,
    finished: false,
  };
}

export function resetCar(car, pose) {
  car.x = pose.x;
  car.y = pose.y;
  car.angle = pose.angle;
  car.vx = 0;
  car.vy = 0;
  car.steer = 0;
  car.yawRate = 0;
  car.slip = 0;
  car.speed = 0;
}

/**
 * Ένα βήμα φυσικής.
 * @param {object} car
 * @param {{throttle:number, brake:number, steer:number, handbrake:boolean}} input
 * @param {number} dt δευτερόλεπτα (σταθερό βήμα από το engine)
 * @param {number} surfaceGrip 1 = άσφαλτος, <1 = χώμα/γρασίδι
 */
export function stepCar(car, input, dt, surfaceGrip) {
  const spec = car.spec;
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);

  let vLong = car.vx * cos + car.vy * sin;
  let vLat = -car.vx * sin + car.vy * cos;

  // --- Κινητήρας / φρένα -------------------------------------------------
  // Η ώθηση σβήνει καθώς πλησιάζουμε την τελική ταχύτητα.
  const powerFade = Math.max(0, 1 - Math.max(0, vLong) / spec.maxSpeed);
  vLong += input.throttle * spec.accel * powerFade * surfaceGrip * dt;

  if (input.brake > 0) {
    if (vLong > 0.2) {
      vLong = Math.max(0, vLong - spec.brake * input.brake * surfaceGrip * dt);
    } else {
      // Στο σταμάτημα το φρένο γίνεται όπισθεν (χρήσιμο μετά από τούμπα).
      vLong = Math.max(-8, vLong - spec.accel * 0.45 * input.brake * dt);
    }
  }

  // Αεροδυναμική + κύλιση.
  vLong -= (spec.drag * vLong * Math.abs(vLong) + spec.roll * vLong * (2 - surfaceGrip)) * dt;

  // --- Τιμόνι ------------------------------------------------------------
  // Η μέγιστη γωνία μικραίνει με την ταχύτητα, αλλιώς το αμάξι είναι ανοδήγητο.
  const steerLimit = spec.steerMax / (1 + Math.abs(vLong) * spec.steerFalloff);
  const targetSteer = input.steer * steerLimit;
  car.steer += (targetSteer - car.steer) * Math.min(1, spec.steerRate * dt);

  // Επιστροφή στο world frame πριν τη στροφή, ώστε η περιστροφή του αμαξιού να
  // δημιουργήσει από μόνη της πλευρική ταχύτητα (= η αίσθηση της ολίσθησης).
  car.vx = vLong * cos - vLat * sin;
  car.vy = vLong * sin + vLat * cos;

  const speed = Math.hypot(car.vx, car.vy);
  if (Math.abs(vLong) > 0.4) {
    car.yawRate = (vLong * Math.tan(car.steer)) / spec.wheelbase;
    car.angle += car.yawRate * dt;
  } else {
    car.yawRate = 0;
  }

  // --- Πλευρική τριβή (traction limit) -----------------------------------
  const cos2 = Math.cos(car.angle);
  const sin2 = Math.sin(car.angle);
  vLong = car.vx * cos2 + car.vy * sin2;
  vLat = -car.vx * sin2 + car.vy * cos2;

  let grip = (spec.grip + spec.downforce * speed * spec.grip) * surfaceGrip;
  if (input.handbrake) grip *= 0.32; // χειρόφρενο = σπάει το πίσω μέρος
  const maxDeltaLat = grip * dt;
  const correction = Math.min(Math.abs(vLat), maxDeltaLat) * Math.sign(vLat);
  vLat -= correction;

  // Όση τριβή "ξοδεύεται" πλευρικά, τόση λείπει από το γκάζι (traction circle).
  const slipRatio = Math.min(1, Math.abs(vLat) / 12);
  vLong *= 1 - slipRatio * 0.35 * dt;

  car.vx = vLong * cos2 - vLat * sin2;
  car.vy = vLong * sin2 + vLat * cos2;

  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = Math.hypot(car.vx, car.vy);
  car.slip = Math.abs(vLat);
  car.vLong = vLong;
}

/** Ταχύτητα σε km/h. */
export function kmh(car) {
  return car.speed * 3.6;
}

/** Εικονική σχέση + στροφές για το HUD, από την ταχύτητα. */
export function gearAndRpm(car) {
  const ratio = Math.min(1, Math.max(0, car.speed / car.spec.maxSpeed));
  let gear = GEAR_TOPS.length;
  for (let i = 0; i < GEAR_TOPS.length; i++) {
    if (ratio <= GEAR_TOPS[i]) {
      gear = i + 1;
      break;
    }
  }
  const low = gear === 1 ? 0 : GEAR_TOPS[gear - 2];
  const top = GEAR_TOPS[gear - 1];
  const within = top > low ? (ratio - low) / (top - low) : 1;
  const rpm = 0.28 + Math.min(1, Math.max(0, within)) * 0.72;
  return { gear, rpm };
}

/**
 * Απλή σύγκρουση δύο αμαξιών ως κύκλοι: τα σπρώχνει μακριά και ανταλλάσσει
 * μέρος της ταχύτητας. Αρκετό για side-by-side μάχες χωρίς rigid body.
 */
export function resolveCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const minDist = (a.spec.length + b.spec.length) * 0.42;
  if (dist >= minDist) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = (minDist - dist) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;

  // Ανταλλαγή της συνιστώσας ταχύτητας κατά μήκος του άξονα επαφής.
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel > 0) return true;
  const impulse = rel * 0.6;
  a.vx += impulse * nx;
  a.vy += impulse * ny;
  b.vx -= impulse * nx;
  b.vy -= impulse * ny;
  return true;
}
