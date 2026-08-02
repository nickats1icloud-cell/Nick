/**
 * AI οδηγοί.
 *
 * Δεν υπάρχει προϋπολογισμένη racing line: ο οδηγός κοιτάει μπροστά στην
 * κεντρική γραμμή, μετατοπίζεται πλευρικά ανάλογα με την καμπυλότητα (έξω-μέσα-
 * έξω) και ρυθμίζει γκάζι/φρένο με βάση τη μέγιστη ταχύτητα που επιτρέπει το
 * grip στην πιο κλειστή στροφή του ορίζοντά του.
 */

import { SAMPLE_SPACING, nearestSample, lateralOffset } from "./tracks.js";

/** Ονόματα AI αντιπάλων — μέλη-φαντάσματα της κοινότητας. */
export const AI_NAMES = [
  "Ν. Παπαδόπουλος",
  "Γ. Βασιλείου",
  "Κ. Ιωάννου",
  "Μ. Αντωνίου",
  "Δ. Σταθόπουλος",
  "Α. Καραγιάννη",
  "Θ. Μακρής",
];

/** Επίπεδα δυσκολίας: πόσο κοντά στο όριο του grip οδηγεί η AI. */
export const DIFFICULTIES = [
  { id: "rookie", label: "Rookie", pace: 0.78, skill: 0.75 },
  { id: "pro", label: "Pro", pace: 0.9, skill: 0.9 },
  { id: "legend", label: "Legend", pace: 0.99, skill: 1 },
];

export function difficultyById(id) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
}

/** Καταστάσεις AI που δεν χωράνε στο ίδιο το όχημα. */
export function createBrain(difficulty, index) {
  // Μικρή διασπορά ανά οδηγό ώστε το grid να μην είναι κλώνοι.
  const spread = 1 - index * 0.022;
  return {
    pace: difficulty.pace * spread,
    skill: difficulty.skill * spread,
    noisePhase: Math.random() * Math.PI * 2,
    noiseSpeed: 0.5 + Math.random() * 0.5,
    lineBias: (Math.random() - 0.5) * 0.25,
    time: 0,
  };
}

/**
 * Υπολογίζει τα inputs ενός AI οχήματος για το τρέχον frame.
 * @returns {{throttle:number, brake:number, steer:number, handbrake:boolean}}
 */
export function driveAI(car, brain, track, dt, cars) {
  brain.time += dt;
  const found = nearestSample(track, car.x, car.y, car.sampleIndex);
  car.sampleIndex = found.index;

  const speed = car.speed;
  const lookaheadM = 10 + speed * 0.85;
  const step = Math.max(1, Math.round(lookaheadM / SAMPLE_SPACING));
  const targetIdx = (found.index + step) % track.count;
  const target = track.samples[targetIdx];

  // --- Racing line: μετατόπιση προς την εσωτερική πλευρά της στροφής --------
  const curvature = target.curvature;
  let lineOffset =
    -Math.sign(curvature) *
      Math.min(1, Math.abs(curvature) * 90) *
      track.halfWidth *
      0.45 *
      brain.skill +
    brain.lineBias * track.halfWidth * 0.5;

  // Αν έχουμε ήδη βγει προς τα έξω, ο στόχος τραβάει πίσω στο κέντρο — αλλιώς
  // η AI "τρώει" τα όρια της πίστας στις διαδοχικές στροφές.
  const lat = lateralOffset(track, found.index, car.x, car.y);
  if (Math.abs(lat) > track.halfWidth * 0.7) lineOffset = -Math.sign(lat) * track.halfWidth * 0.15;

  const tx = target.x + target.normX * lineOffset;
  const ty = target.y + target.normY * lineOffset;

  // --- Τιμόνι --------------------------------------------------------------
  let desired = Math.atan2(ty - car.y, tx - car.x) - car.angle;
  while (desired > Math.PI) desired -= Math.PI * 2;
  while (desired < -Math.PI) desired += Math.PI * 2;
  // Ελαφρύ counter-steer όταν το πίσω μέρος φεύγει.
  const counter = -car.yawRate * 0.12 * brain.skill;
  const noise = Math.sin(brain.time * brain.noiseSpeed + brain.noisePhase) * 0.05 * (1 - brain.skill);
  const steer = Math.max(-1, Math.min(1, (desired + counter) * 1.9 + noise));

  // --- Ταχύτητα-στόχος από την πιο κλειστή στροφή στον ορίζοντα ------------
  const horizon = Math.max(6, Math.round((18 + speed * 2.4) / SAMPLE_SPACING));
  let targetSpeed = car.spec.maxSpeed;
  for (let k = 2; k < horizon; k++) {
    const s = track.samples[(found.index + k) % track.count];
    const k2 = Math.abs(s.curvature);
    if (k2 < 1e-4) continue;
    // v = sqrt(a / κ) — η ταχύτητα που "χωράει" σε αυτή την ακτίνα. Το grip
    // εξαρτάται από την ταχύτητα (αεροδυναμική), οπότε κάνουμε μία επανάληψη:
    // πρώτη εκτίμηση με το τρέχον grip, δεύτερη με το grip στη στροφή.
    const gripAt = (v) => car.spec.grip * track.grip * (1 + car.spec.downforce * v);
    const first = Math.sqrt(gripAt(speed) / k2);
    const corner = Math.sqrt(gripAt(Math.min(speed, first)) / k2) * brain.pace;
    // Όσο πιο μακριά η στροφή, τόσο πιο χαλαρός ο περιορισμός (πρόλαβε να φρενάρεις).
    const distAhead = k * SAMPLE_SPACING;
    const brakeDist = (speed * speed - corner * corner) / (2 * car.spec.brake);
    if (brakeDist > distAhead - 10) targetSpeed = Math.min(targetSpeed, corner);
  }

  let throttle = 0;
  let brake = 0;
  if (speed < targetSpeed - 1) {
    throttle = Math.min(1, (targetSpeed - speed) / 6);
  } else if (speed > targetSpeed + 1.5) {
    brake = Math.min(1, (speed - targetSpeed) / 8);
  } else {
    throttle = 0.45;
  }

  // --- Αποφυγή του μπροστινού αμαξιού --------------------------------------
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > 400) continue; // >20 m, δεν μας νοιάζει
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    if (ahead <= 0) continue;
    const side = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
    if (Math.abs(side) > 3.5) continue;
    // Λίγο πλάγιασμα για προσπέραση + σήκωμα από το γκάζι.
    throttle *= 0.55;
    brake = Math.max(brake, ahead < 8 ? 0.35 : 0);
    return {
      throttle,
      brake,
      steer: Math.max(-1, Math.min(1, steer + (side > 0 ? -0.35 : 0.35))),
      handbrake: false,
    };
  }

  return { throttle, brake, steer, handbrake: false };
}
