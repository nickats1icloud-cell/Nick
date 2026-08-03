/**
 * Ο αγώνας του GSR Team Manager.
 *
 * Δεν οδηγεί ο παίκτης: και τα δώδεκα αυτοκίνητα τα οδηγεί η AI (ai.js) πάνω
 * στην ίδια φυσική (car.js) και γεωμετρία πίστας (tracks.js). Ο παίκτης
 * επεμβαίνει ως manager — ρυθμός οδήγησης, στιγμή του pit stop και επιλογή
 * ελαστικών — και ο αγώνας κρίνεται από αυτοκίνητο, οδηγό και στρατηγική.
 *
 * Η προσομοίωση τρέχει με σταθερό βήμα μέσα σε accumulator, οπότε ο x2/x4
 * ρυθμός απλώς εκτελεί περισσότερα βήματα ανά frame — ίδιο αποτέλεσμα, απλώς
 * γρηγορότερα.
 */

import { buildTrack, trackById, nearestSample, lateralOffset, gridPose, SAMPLE_SPACING } from "./tracks.js";
import { CARS, createCar, resetCar, stepCar, resolveCollision } from "./car.js";
import { createBrain, driveAI, difficultyById as aiDifficulty } from "./ai.js";
import { Renderer, Minimap } from "./render.js";
import { paceModeById, tyreById, TYRES } from "./manager/data.js";

const FIXED_DT = 1 / 120;
const MAX_STEPS_PER_FRAME = 40; // ασφάλεια στον x4 και μετά από tab switch
const OFFTRACK_GRIP = 0.42;
const WALL_MARGIN = 10;

/** Πόσα μέτρα αντέχει ένα σετ μεσαία ελαστικά με ισορροπημένο ρυθμό. */
const TYRE_LIFE_METERS = 13000;
/** Βασική πιθανότητα βλάβης ανά γύρο για αυτοκίνητο με αξιοπιστία 0. */
const FAILURE_PER_LAP = 0.021;

/** Χρόνος ακινησίας στα pit: το συνεργείο κόβει μέχρι 6 δευτερόλεπτα. */
function pitDuration(pitRating) {
  return 13.5 - (pitRating / 100) * 6;
}

/**
 * Απόδοση ελαστικού ανάλογα με τη ζωή του (1 = καινούργιο).
 * Ομαλή πτώση και μετά "γκρεμός" στο τέλος — εκεί χάνεται ο αγώνας.
 */
function tyrePerformance(compound, life) {
  const drop = 0.16 * (1 - life) ** 1.6;
  const cliff = life < 0.14 ? (0.14 - life) * 2.2 : 0;
  return compound.grip * Math.max(0.52, 1 - drop - cliff);
}

/** Φτιάχνει τα χαρακτηριστικά του αυτοκινήτου μιας ομάδας από τα ratings της. */
function deriveSpec(teamCar, color) {
  const base = CARS[0]; // GT3 ως βάση για όλο το grid
  const aero = (teamCar.aero - 50) / 49;
  const engine = (teamCar.engine - 50) / 49;
  return {
    ...base,
    color,
    accentColor: "#ffffff",
    grip: base.grip * (0.93 + aero * 0.1),
    accel: base.accel * (0.93 + engine * 0.1),
    maxSpeed: base.maxSpeed * (0.95 + engine * 0.07),
    brake: base.brake * (0.96 + aero * 0.05),
  };
}

/** Ο ρυθμός που "τολμά" ένας οδηγός — μπαίνει στο brain.pace της AI. */
function driverPace(driver) {
  const skill = (driver.skill - 50) / 49;
  const morale = ((driver.morale ?? 70) - 60) / 100;
  return 0.94 + skill * 0.05 + morale * 0.012;
}

/**
 * Κατατακτήριες: γρήγορη αναλυτική προσομοίωση (χωρίς εικόνα) που δίνει τη
 * σειρά εκκίνησης. Ο πραγματικός αγώνας τρέχει μετά κανονικά στην πίστα.
 */
export function simulateQualifying(entriesInput, track, rng = Math.random) {
  const reference = track.length / 48; // δευτερόλεπτα, χονδρικά για GT3 ρυθμό
  return entriesInput
    .map((e) => {
      const spec = deriveSpec(e.team.car, e.team.color);
      const performance = (spec.grip / CARS[0].grip) * 0.55 + (spec.accel / CARS[0].accel) * 0.45;
      const pace = driverPace(e.driver) * performance;
      // Όσο λιγότερο σταθερός ο οδηγός, τόσο μεγαλύτερη η διασπορά του γύρου.
      const noise = (1 - (e.driver.consistency ?? 70) / 100) * 0.02 * rng();
      const lapMs = (reference / pace) * (1 + noise) * 1000;
      return { ...e, lapMs };
    })
    .sort((a, b) => a.lapMs - b.lapMs)
    .map((e, i) => ({ ...e, gridPosition: i + 1 }));
}

export class Race {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {HTMLCanvasElement} [opts.minimap]
   * @param {(state:object)=>void} opts.onUpdate καλείται κάθε frame με το HUD state
   * @param {(event:object)=>void} opts.onEvent γεγονότα αγώνα (pit, βλάβη, προσπέραση)
   * @param {(results:Array)=>void} opts.onFinish
   */
  constructor({ canvas, minimap, onUpdate, onEvent, onFinish }) {
    this.canvas = canvas;
    this.minimapCanvas = minimap;
    this.onUpdate = onUpdate || (() => {});
    this.onEvent = onEvent || (() => {});
    this.onFinish = onFinish || (() => {});
    this.renderer = null;
    this.minimap = null;
    this.raf = 0;
    this.speed = 1;
    this.paused = false;
    this.running = false;
    this.entries = [];

    this._onResize = () => this.renderer?.resize();
    window.addEventListener("resize", this._onResize);
  }

  /**
   * Στήνει τον αγώνα.
   * @param {object} opts {teams, raceDef, difficultyId, gridOrder}
   */
  setup({ teams, raceDef, difficultyId }) {
    this.raceDef = raceDef;
    this.track = buildTrack(trackById(raceDef.trackId));
    this.totalLaps = raceDef.laps;
    this.difficulty = aiDifficulty("pro");
    this.rivalPace = difficultyId ? (difficultyId === "legend" ? 1.01 : difficultyId === "rookie" ? 0.965 : 0.99) : 1;

    if (!this.renderer) this.renderer = new Renderer(this.canvas, this.track);
    else this.renderer.setTrack(this.track);
    if (this.minimapCanvas) {
      if (!this.minimap) this.minimap = new Minimap(this.minimapCanvas, this.track);
      else this.minimap.setTrack(this.track);
    }
    this.renderer.resize();

    // Ένα entry ανά οδηγό.
    const raw = [];
    for (const team of teams) {
      for (const driver of team.drivers) {
        raw.push({ id: `${team.id}:${driver.id}`, team, driver });
      }
    }
    this.grid = simulateQualifying(raw, this.track);

    this.entries = this.grid.map((info, index) => this.createEntry(info, index));
    this.carList = this.entries.map((e) => e.car);
    this.time = 0;
    this.phase = "countdown";
    this.lights = 0;
    this.goAt = 3800;
    this.accumulator = 0;
    this.lastFrame = 0;
    this.events = [];
    this.fastestLap = null;
    this.cameraId = (this.entries.find((e) => e.team.isPlayer) || this.entries[0]).id;
    this.results = null;
    this.renderer.skids = [];

    return this.grid;
  }

  createEntry(info, index) {
    const spec = deriveSpec(info.team.car, info.team.color);
    const pose = gridPose(this.track, index);
    const car = createCar(spec, pose, { isAI: true, label: info.driver.short || "" });
    const brain = createBrain(this.difficulty, 0);

    // Ο ρυθμός του οδηγού αντικαθιστά τον γενικό ρυθμό δυσκολίας της AI.
    brain.pace = driverPace(info.driver) * (info.team.isPlayer ? 1 : this.rivalPace);
    brain.skill = 0.7 + (info.driver.skill / 100) * 0.3;
    brain.basePace = brain.pace;

    const found = nearestSample(this.track, car.x, car.y, -1);
    car.sampleIndex = found.index;

    // Στρατηγική εκκίνησης: μαλακά για τους 6 πρώτους, μεσαία για τους υπόλοιπους.
    const compound = index < 6 ? "soft" : "medium";

    return {
      id: info.id,
      driver: info.driver,
      team: info.team,
      isPlayer: Boolean(info.team.isPlayer),
      gridPosition: index + 1,
      car,
      brain,
      spec,
      baseSpec: { ...spec },
      tyre: { compound, life: 1 },
      fuel: 1,
      mode: "balanced",
      pitRequest: null,
      pitStops: 0,
      inPit: false,
      pitTimer: 0,
      mistakeTimer: 0,
      lap: -1,
      progress: (found.index * this.track.length) / this.track.count,
      prevProgress: (found.index * this.track.length) / this.track.count,
      distance: -this.track.length + (found.index * this.track.length) / this.track.count,
      crossedStart: false,
      lapStart: 0,
      bestLap: null,
      lastLap: null,
      dnf: false,
      dnfReason: "",
      finished: false,
      finishTime: null,
      position: index + 1,
    };
  }

  // -------------------------------------------------------------------------
  // Έλεγχος από το UI
  // -------------------------------------------------------------------------

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = 0;
    this.loop();
  }

  setSpeed(multiplier) {
    this.speed = multiplier;
  }

  setPaused(value) {
    this.paused = value;
  }

  setCamera(entryId) {
    this.cameraId = entryId;
  }

  /** Εντολή ρυθμού σε έναν οδηγό της ομάδας. */
  orderPace(entryId, modeId) {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry || entry.dnf || entry.finished) return;
    entry.mode = modeId;
    const mode = paceModeById(modeId);
    entry.brain.pace = entry.brain.basePace * mode.pace;
    this.pushEvent(`${entry.driver.name}: ${mode.name.toLowerCase()}`, "order", entry);
  }

  /** Εντολή pit stop στον επόμενο γύρο. */
  orderPit(entryId, compoundId) {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry || entry.dnf || entry.finished || entry.inPit) return;
    entry.pitRequest = compoundId;
    this.pushEvent(`${entry.driver.name}: pit stop στον επόμενο γύρο (${tyreById(compoundId).name})`, "order", entry);
  }

  cancelPit(entryId) {
    const entry = this.entries.find((e) => e.id === entryId);
    if (entry) entry.pitRequest = null;
  }

  /** Τρέχει τον υπόλοιπο αγώνα χωρίς εικόνα, σε κομμάτια ώστε να μην παγώνει. */
  skipToEnd() {
    if (this.phase === "finished") return;
    this.skipping = true;
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this._onResize);
  }

  // -------------------------------------------------------------------------
  // Βρόχος
  // -------------------------------------------------------------------------

  loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);

    const now = performance.now();
    if (!this.lastFrame) this.lastFrame = now;
    let frameDt = Math.min((now - this.lastFrame) / 1000, 0.2);
    this.lastFrame = now;

    if (this.phase !== "finished" && !this.paused) {
      if (this.skipping) {
        // Μέχρι ~1.5s πραγματικού χρόνου ανά frame — ο αγώνας τελειώνει σε λίγα frames.
        const budget = performance.now() + 24;
        while (this.phase !== "finished" && performance.now() < budget) {
          this.step(FIXED_DT);
        }
      } else {
        this.accumulator += frameDt * this.speed;
        let steps = 0;
        while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
          this.step(FIXED_DT);
          this.accumulator -= FIXED_DT;
          steps++;
        }
        if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
      }
    }

    if (!this.skipping) this.render(frameDt);
    this.onUpdate(this.hudState());
  };

  step(dt) {
    this.time += dt * 1000;

    if (this.phase === "countdown") {
      this.lights = Math.min(5, Math.floor(this.time / 700));
      if (this.time >= this.goAt) {
        this.phase = "racing";
        this.lights = 0;
        for (const entry of this.entries) entry.lapStart = this.time;
        this.pushEvent("Εκκίνηση!", "flag");
      }
      return;
    }

    const racing = this.phase === "racing";

    for (const entry of this.entries) {
      if (entry.dnf) continue;

      if (entry.inPit) {
        this.stepPit(entry, dt);
        continue;
      }

      const { car } = entry;
      let control =
        racing && !entry.finished
          ? driveAI(car, entry.brain, this.track, dt, this.carList)
          : { throttle: 0, brake: entry.finished ? 0.3 : 0, steer: 0, handbrake: false };

      // Λάθος οδηγού: κρατάει λίγο το γκάζι κλειστό.
      if (entry.mistakeTimer > 0) {
        entry.mistakeTimer -= dt;
        control = { ...control, throttle: control.throttle * 0.25, brake: 0.35 };
      }

      const found = nearestSample(this.track, car.x, car.y, car.sampleIndex);
      car.sampleIndex = found.index;
      car.onTrack = found.dist <= this.track.halfWidth;

      stepCar(car, control, dt, car.onTrack ? this.track.grip : OFFTRACK_GRIP);
      this.keepInsideWalls(car, found);

      if (racing && !entry.finished) this.updateProgress(entry, found.index, dt);
    }

    for (let i = 0; i < this.entries.length; i++) {
      for (let j = i + 1; j < this.entries.length; j++) {
        const a = this.entries[i];
        const b = this.entries[j];
        if (a.dnf || b.dnf || a.inPit || b.inPit) continue;
        resolveCollision(a.car, b.car);
      }
    }

    this.updatePositions();

    // Ο αγώνας τελειώνει όταν τερματίσουν όλοι όσοι μπορούν.
    if (racing && this.entries.every((e) => e.finished || e.dnf)) this.finish();
  }

  /** Ακινησία στο pit box και επιστροφή στην πίστα. */
  stepPit(entry, dt) {
    entry.pitTimer -= dt;
    if (entry.pitTimer > 0) return;

    entry.inPit = false;
    entry.tyre = { compound: entry.pendingCompound, life: 1 };
    entry.pitStops += 1;

    // Επιστροφή λίγο μετά τη γραμμή, με ταχύτητα εξόδου από τα pit.
    const exit = this.track.samples[Math.round(70 / SAMPLE_SPACING) % this.track.count];
    resetCar(entry.car, { x: exit.x, y: exit.y, angle: exit.angle });
    entry.car.vx = Math.cos(exit.angle) * 22;
    entry.car.vy = Math.sin(exit.angle) * 22;
    entry.car.sampleIndex = Math.round(70 / SAMPLE_SPACING) % this.track.count;
    entry.prevProgress = 70;
    entry.progress = 70;
    this.applyTyreState(entry);
  }

  keepInsideWalls(car, found) {
    const limit = this.track.halfWidth + WALL_MARGIN;
    if (found.dist <= limit) return;
    const s = this.track.samples[found.index];
    const side = Math.sign(lateralOffset(this.track, found.index, car.x, car.y)) || 1;
    car.x = s.x + s.normX * side * limit;
    car.y = s.y + s.normY * side * limit;
    const outward = car.vx * s.normX * side + car.vy * s.normY * side;
    if (outward > 0) {
      car.vx -= s.normX * side * outward * 1.5;
      car.vy -= s.normY * side * outward * 1.5;
    }
    car.vx *= 0.85;
    car.vy *= 0.85;
  }

  /** Πρόοδος γύρου, φθορά ελαστικών/καυσίμων, πέρασμα από τη γραμμή. */
  updateProgress(entry, sampleIndex, dt) {
    const lapLength = this.track.length;
    const progress = (sampleIndex * lapLength) / this.track.count;
    const prev = entry.prevProgress;

    // Φθορά ανά μέτρο που διανύθηκε — δίκαιη ανάμεσα σε πίστες με άλλο μήκος.
    const metres = entry.car.speed * dt;
    const mode = paceModeById(entry.mode);
    const compound = tyreById(entry.tyre.compound);
    entry.tyre.life = Math.max(
      0,
      entry.tyre.life - (metres / TYRE_LIFE_METERS) * compound.wear * mode.wear,
    );
    entry.fuel = Math.max(0, entry.fuel - (metres / (lapLength * this.totalLaps * 1.06)) * mode.fuel);
    this.applyTyreState(entry);

    if (prev > lapLength * 0.75 && progress < lapLength * 0.25) {
      this.completeLap(entry);
    }

    entry.prevProgress = progress;
    entry.progress = progress;
    entry.distance = entry.lap * lapLength + progress;
  }

  /** Περνά φθορά ελαστικών και βάρος καυσίμου στα χαρακτηριστικά του αμαξιού. */
  applyTyreState(entry) {
    const compound = tyreById(entry.tyre.compound);
    const grip = tyrePerformance(compound, entry.tyre.life);
    // Γεμάτο ρεζερβουάρ = βαρύ αμάξι: λιγότερη επιτάχυνση και λίγο λιγότερο grip.
    const fuelLoad = entry.fuel;
    entry.spec.grip = entry.baseSpec.grip * grip * (1 - fuelLoad * 0.02);
    entry.spec.accel = entry.baseSpec.accel * (1 - fuelLoad * 0.06);
    entry.spec.maxSpeed = entry.baseSpec.maxSpeed * (1 - fuelLoad * 0.015);
  }

  completeLap(entry) {
    const lapMs = this.time - entry.lapStart;
    entry.lapStart = this.time;

    if (!entry.crossedStart) {
      entry.crossedStart = true;
      entry.lap = 0;
      return;
    }

    entry.lap += 1;
    entry.lastLap = lapMs;
    if (entry.bestLap === null || lapMs < entry.bestLap) entry.bestLap = lapMs;
    if (!this.fastestLap || lapMs < this.fastestLap.ms) {
      this.fastestLap = { ms: lapMs, entryId: entry.id, name: entry.driver.name };
      if (entry.lap > 1) this.pushEvent(`Ταχύτερος γύρος: ${entry.driver.name}`, "fastest", entry);
    }

    if (entry.lap >= this.totalLaps) {
      entry.finished = true;
      entry.finishTime = this.time;
      this.pushEvent(`${entry.driver.name} τερμάτισε P${entry.position}`, "finish", entry);
      return;
    }

    this.rollIncidents(entry);

    // Το pit stop γίνεται στο πέρασμα από τη γραμμή.
    if (entry.pitRequest) {
      this.enterPit(entry, entry.pitRequest);
      entry.pitRequest = null;
      return;
    }

    // Οι αντίπαλοι αποφασίζουν μόνοι τους πότε αλλάζουν ελαστικά.
    if (!entry.isPlayer) this.rivalStrategy(entry);
  }

  enterPit(entry, compoundId) {
    entry.inPit = true;
    entry.pendingCompound = compoundId;
    entry.pitTimer = pitDuration(entry.team.car.pit ?? 60);
    // Το αμάξι σταματά στο pit box: παράλληλα με τη γραμμή, έξω από την πίστα.
    const box = this.track.samples[Math.round(24 / SAMPLE_SPACING) % this.track.count];
    const side = this.track.halfWidth + 7;
    resetCar(entry.car, {
      x: box.x - box.normX * side,
      y: box.y - box.normY * side,
      angle: box.angle,
    });
    this.pushEvent(
      `${entry.driver.name}: pit stop, ${tyreById(compoundId).name} (${entry.pitTimer.toFixed(1)}s)`,
      "pit",
      entry,
    );
  }

  /** Απλή στρατηγική AI: αλλάζει όταν τελειώνουν τα λάστιχα και προλαβαίνει. */
  rivalStrategy(entry) {
    const lapsLeft = this.totalLaps - entry.lap;
    const lifePerLap = 1 - entry.tyre.life > 0 ? (1 - entry.tyre.life) / Math.max(1, entry.lap) : 0.1;
    const lapsOfLifeLeft = lifePerLap > 0 ? entry.tyre.life / lifePerLap : 99;

    if (entry.tyre.life < 0.28 && lapsLeft > 1 && lapsOfLifeLeft < lapsLeft) {
      // Διαλέγει ελαστικό που φτάνει μέχρι το τέλος.
      const needed = lapsLeft;
      const compound = needed > 5 ? "hard" : needed > 3 ? "medium" : "soft";
      this.enterPit(entry, compound);
    }
  }

  /** Βλάβες και λάθη οδηγών, μία φορά ανά γύρο. */
  rollIncidents(entry) {
    const mode = paceModeById(entry.mode);
    const reliability = entry.team.car.reliability ?? 70;
    const failure = FAILURE_PER_LAP * (1 - reliability / 100) * mode.risk;
    if (Math.random() < failure) {
      entry.dnf = true;
      entry.dnfReason = "Μηχανική βλάβη";
      this.pushEvent(`Εγκατάλειψη: ${entry.driver.name} — μηχανική βλάβη`, "dnf", entry);
      return;
    }

    const mistake = ((100 - (entry.driver.consistency ?? 70)) / 100) * 0.05 * mode.risk;
    if (Math.random() < mistake) {
      entry.mistakeTimer = 1.4;
      this.pushEvent(`Λάθος: ${entry.driver.name} έχασε χρόνο`, "mistake", entry);
    }
  }

  /** Κατάταξη: τερματισμένοι πρώτοι, μετά κατά απόσταση, εγκαταλείψεις τελευταίες. */
  updatePositions() {
    const order = this.entries.slice().sort((a, b) => {
      if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.distance - a.distance;
    });

    order.forEach((entry, i) => {
      const position = i + 1;
      const gained = entry.position && position < entry.position;
      entry.position = position;
      if (!gained || this.phase !== "racing" || entry.finished || entry.inPit) return;

      const passed = order[i + 1];
      if (!passed || passed.inPit || passed.dnf) return;

      // Δύο αμάξια που παλεύουν αλλάζουν θέση συνέχεια: αναφέρουμε μόνο όταν
      // η προσπέραση "κρατήσει" και μόνο για μάχες που ενδιαφέρουν τον παίκτη
      // (δικός του οδηγός ή κορυφή της κατάταξης).
      const interesting = entry.isPlayer || passed.isPlayer || position <= 3;
      const cooled = this.time - (entry.lastOvertakeMs ?? -Infinity) > 6000;
      const clear = entry.distance - passed.distance > 8; // μέτρα, όχι μύτη-μύτη
      if (!interesting || !cooled || !clear) return;

      entry.lastOvertakeMs = this.time;
      passed.lastOvertakeMs = this.time;
      this.pushEvent(
        `${entry.driver.name} πέρασε τον ${passed.driver.name} για την P${position}`,
        "overtake",
        entry,
      );
    });
    this.order = order;
  }

  finish() {
    this.phase = "finished";
    const order = this.order || this.entries;
    this.results = order.map((entry, i) => ({
      position: i + 1,
      driverId: entry.driver.id,
      teamId: entry.team.id,
      name: entry.driver.name,
      teamName: entry.team.name,
      color: entry.team.color,
      isPlayer: entry.isPlayer,
      dnf: entry.dnf,
      dnfReason: entry.dnfReason,
      bestLap: entry.bestLap,
      pitStops: entry.pitStops,
      laps: Math.max(0, entry.lap),
    }));
    this.skipping = false;
    this.pushEvent("Καρό σημαία!", "flag");
    this.onFinish(this.results);
  }

  pushEvent(text, kind = "info", entry = null) {
    const event = {
      text,
      kind,
      timeMs: this.time,
      entryId: entry?.id ?? null,
      isPlayer: entry?.isPlayer ?? false,
    };
    this.events.unshift(event);
    this.events = this.events.slice(0, 60);
    this.onEvent(event);
  }

  // -------------------------------------------------------------------------
  // Εικόνα
  // -------------------------------------------------------------------------

  render(frameDt) {
    const focus = this.entries.find((e) => e.id === this.cameraId) || this.entries[0];
    const car = focus.car;
    const viewWidth = this.renderer.viewWidth || 900;
    const base = Math.max(78, Math.min(132, viewWidth / 9.5));
    const speedRatio = Math.min(1, car.speed / car.spec.maxSpeed);
    const zoom = viewWidth / (base * (1 + speedRatio * 0.35));
    const lead = Math.min(28, car.speed * 0.45);

    for (const entry of this.entries) {
      if (!entry.dnf && !entry.inPit && entry.car.slip > 5 && entry.car.onTrack) {
        this.renderer.addSkid(entry.car);
      }
    }
    this.renderer.fadeSkids(frameDt);

    this.renderer.draw(
      { x: car.x + Math.cos(car.angle) * lead, y: car.y + Math.sin(car.angle) * lead, zoom },
      {
        cars: this.entries.filter((e) => !e.dnf).map((e) => e.car),
        player: car,
        ghost: null,
        showLine: false,
      },
    );

    this.minimap?.draw(
      this.entries.filter((e) => !e.dnf).map((e) => e.car),
      car,
    );
  }

  /** Το αντικείμενο που διαβάζει το HUD της σελίδας. */
  hudState() {
    const order = this.order || this.entries;
    const leader = order[0];
    const focus = this.entries.find((e) => e.id === this.cameraId) || this.entries[0];

    const timing = order.map((entry) => {
      const gapMs =
        leader && entry !== leader && !entry.dnf
          ? ((leader.distance - entry.distance) / Math.max(12, leader.car.speed)) * 1000
          : 0;
      return {
        id: entry.id,
        position: entry.position,
        name: entry.driver.name,
        short: entry.driver.short,
        teamName: entry.team.name,
        color: entry.team.color,
        isPlayer: entry.isPlayer,
        lap: Math.max(0, entry.lap),
        gapMs,
        lapsDown: leader ? Math.max(0, leader.lap - Math.max(0, entry.lap)) : 0,
        tyre: entry.tyre.compound,
        tyreLife: entry.tyre.life,
        mode: entry.mode,
        inPit: entry.inPit,
        pitStops: entry.pitStops,
        dnf: entry.dnf,
        dnfReason: entry.dnfReason,
        finished: entry.finished,
        bestLap: entry.bestLap,
        lastLap: entry.lastLap,
        isFocus: entry.id === this.cameraId,
      };
    });

    return {
      phase: this.paused ? "paused" : this.phase,
      lights: this.lights,
      speed: this.speed,
      skipping: Boolean(this.skipping),
      lap: Math.min(this.totalLaps, Math.max(1, (leader?.lap ?? 0) + 1)),
      totalLaps: this.totalLaps,
      raceName: this.raceDef?.name ?? "",
      trackName: this.track?.name ?? "",
      focusSpeed: focus.car.speed * 3.6,
      focusName: focus.driver.name,
      fastestLap: this.fastestLap,
      timing,
      players: timing.filter((t) => t.isPlayer),
      events: this.events.slice(0, 12),
    };
  }
}

export { TYRES };
