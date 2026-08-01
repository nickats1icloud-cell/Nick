/**
 * Ο πυρήνας του παιχνιδιού: βρόχος, χρονομέτρηση γύρων, τομείς, κατάταξη.
 *
 * Η φυσική τρέχει με σταθερό βήμα (FIXED_DT) μέσα σε accumulator, ώστε ο ίδιος
 * γύρος να βγάζει τον ίδιο χρόνο σε 60Hz και σε 144Hz οθόνη. Το rendering και
 * το HUD ενημερώνονται μία φορά ανά frame.
 */

import { buildTrack, trackById, nearestSample, lateralOffset, gridPose, SECTORS } from "./tracks.js";
import { CARS, carById, createCar, resetCar, stepCar, gearAndRpm, kmh, resolveCollision } from "./car.js";
import { AI_NAMES, createBrain, driveAI, difficultyById } from "./ai.js";
import { Renderer, Minimap } from "./render.js";
import { GhostRecorder } from "./ghost.js";
import { Input } from "./input.js";

const FIXED_DT = 1 / 120;
const MAX_STEPS = 6; // ασφάλεια: μετά από tab switch δεν "τρέχουμε" 10 δευτ. φυσικής

/** Grip εκτός ασφάλτου — αρκετά χαμηλό ώστε το κόψιμο στροφής να μη συμφέρει. */
const OFFTRACK_GRIP = 0.42;
/** Πόσο πέρα από την άσφαλτο υπάρχει τοίχος (μέτρα από την κεντρική γραμμή). */
const WALL_MARGIN = 10;
/** Χρόνος εκτός πίστας που ακυρώνει τον γύρο (δευτερόλεπτα). */
const INVALIDATE_AFTER = 0.7;

export const MODES = {
  timeattack: { id: "timeattack", label: "Time Attack", aiCount: 0, ghost: true },
  race: { id: "race", label: "Αγώνας", aiCount: 5, ghost: false },
};

const COUNTDOWN_LIGHT_MS = 700;
const COUNTDOWN_LIGHTS = 5;

export class Game {
  constructor({ canvas, minimap, onHud, onEvent }) {
    this.canvas = canvas;
    this.onHud = onHud || (() => {});
    this.onEvent = onEvent || (() => {});
    this.input = new Input(window);
    this.renderer = null;
    this.minimapCanvas = minimap;
    this.minimap = null;
    this.raf = 0;
    this.running = false;
    this.showLine = false;
    this.entries = [];
    // Όσο η σελίδα δείχνει το μενού, τα πλήκτρα του παιχνιδιού αγνοούνται.
    this.locked = true;

    this._onResize = () => this.renderer?.resize();
    window.addEventListener("resize", this._onResize);

    // Πλήκτρα εκτός οδήγησης (pause, reset, βοηθητική γραμμή).
    this.input.onAction = (code, event) => {
      if (this.locked || event?.repeat) return;
      if (code === "Escape") this.togglePause();
      if (code === "KeyR") this.respawn();
      if (code === "KeyE") {
        this.showLine = !this.showLine;
        this.onEvent({ type: "assist-line", on: this.showLine });
      }
    };

    this._onVisibility = () => {
      if (document.hidden && this.phase === "racing") this.setPaused(true);
    };
    document.addEventListener("visibilitychange", this._onVisibility);
  }

  /** Ξεκινά (ή ξαναξεκινά) μια συνεδρία με τις δοσμένες ρυθμίσεις. */
  start(config) {
    this.config = { ...this.config, ...config };
    this.track = buildTrack(trackById(this.config.trackId));
    this.mode = MODES[this.config.mode] || MODES.timeattack;
    this.difficulty = difficultyById(this.config.difficulty);
    this.totalLaps = this.mode.id === "race" ? this.track.raceLaps : Infinity;

    if (!this.renderer) this.renderer = new Renderer(this.canvas, this.track);
    else this.renderer.setTrack(this.track);
    if (this.minimapCanvas) {
      if (!this.minimap) this.minimap = new Minimap(this.minimapCanvas, this.track);
      else this.minimap.setTrack(this.track);
    }
    this.renderer.resize();

    this.buildGrid();
    this.resetSession();
    this.loop();
  }

  /** Στήνει τον παίκτη και (σε αγώνα) τους AI αντιπάλους στο grid. */
  buildGrid() {
    const playerSpec = carById(this.config.carId);
    const aiCount = this.mode.aiCount;
    // Ο παίκτης ξεκινά τελευταίος στον αγώνα — υπάρχει λόγος να προσπεράσει.
    const playerSlot = aiCount;
    this.entries = [];

    const player = createCar(playerSpec, gridPose(this.track, playerSlot), {
      label: this.config.driverName || "Εσύ",
    });
    this.player = player;
    this.entries.push({ car: player, name: this.config.driverName || "Εσύ", isPlayer: true });

    for (let i = 0; i < aiCount; i++) {
      // Οι AI παίρνουν κυκλικά τα διαθέσιμα αμάξια, για ποικιλία στο grid.
      const spec = CARS[i % CARS.length];
      const name = AI_NAMES[i % AI_NAMES.length];
      // Στην πίστα φαίνεται μόνο το επώνυμο — χωράει και διαβάζεται.
      const car = createCar(spec, gridPose(this.track, i), { isAI: true, label: name.split(" ").pop() });
      this.entries.push({ car, name, isPlayer: false, brain: createBrain(this.difficulty, i) });
    }

    this.carList = this.entries.map((e) => e.car);
    for (const entry of this.entries) this.resetEntryState(entry);
  }

  resetEntryState(entry) {
    const { car } = entry;
    const found = nearestSample(this.track, car.x, car.y, -1);
    car.sampleIndex = found.index;
    // Ξεκινάμε πίσω από τη γραμμή: μέχρι το πρώτο πέρασμα ο γύρος είναι -1,
    // ώστε η συνολική απόσταση (lap * μήκος + πρόοδος) να βγαίνει αρνητική και
    // η κατάταξη να μη νομίζει ότι το grid έχει σχεδόν ολοκληρώσει γύρο.
    entry.lap = -1;
    entry.progress = found.index * (this.track.length / this.track.count);
    entry.prevProgress = entry.progress;
    entry.distance = 0;
    entry.lapStart = 0;
    entry.lapValid = true;
    entry.offTrackTime = 0;
    entry.sectorsHit = new Array(SECTORS).fill(false);
    entry.sectorSplits = [];
    entry.bestLap = null;
    entry.lastLap = null;
    entry.finished = false;
    entry.finishTime = null;
    entry.started = false;
    // Το grid είναι πίσω από τη γραμμή· το πρώτο πέρασμα ξεκινά τον 1ο γύρο
    // αντί να τον μετρήσει ως ολοκληρωμένο.
    entry.crossedStart = false;
  }

  resetSession() {
    this.time = 0; // ms προσομοίωσης από την αρχή της συνεδρίας
    this.phase = "countdown";
    this.countdown = 0;
    this.lights = 0;
    this.goAt = COUNTDOWN_LIGHTS * COUNTDOWN_LIGHT_MS + 400 + Math.random() * 900;
    this.recorder = new GhostRecorder();
    this.ghost = this.config.keepGhost ? this.ghost : null;
    this.bestLap = this.config.keepGhost ? this.bestLap : null;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.running = true;
    this.paused = false;
    this.results = null;
    if (this.renderer) this.renderer.skids = [];
  }

  /** Πλήρες restart της ίδιας συνεδρίας (κρατά ghost/καλύτερο γύρο). */
  restart({ keepGhost = true } = {}) {
    this.config.keepGhost = keepGhost;
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const slot = entry.isPlayer ? this.mode.aiCount : this.entries.indexOf(entry) - 1;
      resetCar(entry.car, gridPose(this.track, Math.max(0, slot)));
      this.resetEntryState(entry);
    }
    this.resetSession();
  }

  /** Επαναφορά του παίκτη στην πίστα μετά από τούμπα/έξοδο (πλήκτρο R). */
  respawn() {
    if (this.phase !== "racing") return;
    const car = this.player;
    const found = nearestSample(this.track, car.x, car.y, car.sampleIndex);
    const s = this.track.samples[found.index];
    resetCar(car, { x: s.x, y: s.y, angle: s.angle });
    const entry = this.entries.find((e) => e.isPlayer);
    entry.lapValid = false;
    this.onEvent({ type: "respawn" });
  }

  setPaused(value) {
    if (this.phase === "finished") return;
    this.paused = value;
    this.input.releaseAll();
    this.onEvent({ type: "pause", paused: value });
  }

  togglePause() {
    this.setPaused(!this.paused);
  }

  loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);

    const now = performance.now();
    if (!this.lastFrame) this.lastFrame = now;
    let frameDt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    frameDt = Math.min(frameDt, 0.25);

    const inputs = this.input.read(frameDt);

    if (!this.paused && this.phase !== "finished") {
      this.accumulator += frameDt;
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
        this.step(FIXED_DT, inputs);
        this.accumulator -= FIXED_DT;
        steps++;
      }
      if (steps === MAX_STEPS) this.accumulator = 0;
    }

    this.render(frameDt);
    this.onHud(this.hudState(inputs));
  };

  /** Ένα βήμα προσομοίωσης. */
  step(dt, inputs) {
    this.time += dt * 1000;

    if (this.phase === "countdown") {
      this.lights = Math.min(COUNTDOWN_LIGHTS, Math.floor(this.time / COUNTDOWN_LIGHT_MS));
      if (this.time >= this.goAt) {
        this.phase = "racing";
        this.lights = 0;
        for (const entry of this.entries) {
          entry.lapStart = this.time;
          entry.started = true;
        }
        this.onEvent({ type: "go" });
      }
    }

    const racing = this.phase === "racing";

    for (const entry of this.entries) {
      const { car } = entry;
      let control;
      if (entry.isPlayer) {
        control = racing
          ? {
              throttle: inputs.throttle,
              brake: inputs.brake,
              steer: inputs.steer,
              handbrake: inputs.handbrake,
            }
          : { throttle: 0, brake: 0, steer: 0, handbrake: false };
      } else {
        control = racing
          ? driveAI(car, entry.brain, this.track, dt, this.carList)
          : { throttle: 0, brake: 0, steer: 0, handbrake: false };
      }
      if (entry.finished) control = { throttle: 0, brake: 0.35, steer: control.steer, handbrake: false };

      const found = nearestSample(this.track, car.x, car.y, car.sampleIndex);
      car.sampleIndex = found.index;
      car.onTrack = found.dist <= this.track.halfWidth;
      const surface = car.onTrack ? this.track.grip : OFFTRACK_GRIP;

      stepCar(car, control, dt, surface);
      this.keepInsideWalls(car, found);
      if (racing) this.updateProgress(entry, found.index, dt);
    }

    // Συγκρούσεις: όλα τα ζεύγη, λίγα αμάξια οπότε O(n²) είναι εντάξει.
    for (let i = 0; i < this.entries.length; i++) {
      for (let j = i + 1; j < this.entries.length; j++) {
        resolveCollision(this.entries[i].car, this.entries[j].car);
      }
    }

    if (racing && this.mode.ghost) {
      const entry = this.entries[0];
      this.recorder.record(this.time - entry.lapStart, entry.progress, this.player);
    }
  }

  /** Κρατά τα αμάξια μέσα στα όρια — μαλακός "τοίχος" γύρω από την πίστα. */
  keepInsideWalls(car, found) {
    const limit = this.track.halfWidth + WALL_MARGIN;
    if (found.dist <= limit) return;
    const s = this.track.samples[found.index];
    const lat = lateralOffset(this.track, found.index, car.x, car.y);
    const side = Math.sign(lat) || 1;
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

  /** Πρόοδος στον γύρο, τομείς, πέρασμα από τη γραμμή τερματισμού. */
  updateProgress(entry, sampleIndex, dt) {
    const track = this.track;
    const lapLength = track.length;
    const progress = (sampleIndex * lapLength) / track.count;
    const prev = entry.prevProgress;

    // Πέρασμα γραμμής: η πρόοδος "γυρίζει" από το τέλος στην αρχή του γύρου.
    if (prev > lapLength * 0.75 && progress < lapLength * 0.25) {
      this.completeLap(entry);
    } else if (prev < lapLength * 0.25 && progress > lapLength * 0.75) {
      // Ανάποδα πέρασμα — δεν μετράει γύρο και ακυρώνει τον τρέχοντα.
      entry.lap = Math.max(0, entry.lap - 1);
      entry.lapValid = false;
    }

    entry.prevProgress = progress;
    entry.progress = progress;
    entry.distance = entry.lap * lapLength + progress;

    // Τομείς.
    for (let i = 1; i < SECTORS; i++) {
      const border = (i * lapLength) / SECTORS;
      if (!entry.sectorsHit[i] && progress >= border && progress < border + lapLength * 0.2) {
        entry.sectorsHit[i] = true;
        entry.sectorSplits[i - 1] = this.time - entry.lapStart;
        if (entry.isPlayer) {
          this.onEvent({ type: "sector", index: i, split: entry.sectorSplits[i - 1] });
        }
      }
    }

    // Εκτός πίστας για πολλή ώρα → άκυρος γύρος (όπως στα πραγματικά sims).
    if (!entry.car.onTrack) {
      entry.offTrackTime += dt;
      if (entry.offTrackTime > INVALIDATE_AFTER && entry.lapValid) {
        entry.lapValid = false;
        if (entry.isPlayer) this.onEvent({ type: "invalid" });
      }
    } else {
      entry.offTrackTime = Math.max(0, entry.offTrackTime - dt * 0.5);
    }
  }

  completeLap(entry) {
    // Ο γύρος μετράει μόνο αν έχουν περαστεί όλοι οι τομείς με τη σειρά.
    const allSectors = entry.sectorsHit.every((hit, i) => i === 0 || hit);
    const lapMs = this.time - entry.lapStart;
    entry.lapStart = this.time;
    entry.sectorsHit = new Array(SECTORS).fill(false);
    const splits = entry.sectorSplits;
    entry.sectorSplits = [];
    entry.offTrackTime = 0;

    if (!entry.started) return;
    if (!entry.crossedStart) {
      // Πρώτο πέρασμα από το grid: εδώ ξεκινά ο 1ος γύρος.
      entry.crossedStart = true;
      entry.lap = 0;
      entry.lapValid = true;
      if (entry.isPlayer) this.recorder.reset();
      return;
    }
    entry.lap += 1;

    const valid = allSectors && entry.lapValid && lapMs > 5000;
    entry.lapValid = true;
    entry.lastLap = valid ? lapMs : null;

    let isBest = false;
    if (valid && (entry.bestLap === null || lapMs < entry.bestLap)) {
      entry.bestLap = lapMs;
      isBest = true;
    }

    if (entry.isPlayer) {
      if (isBest) {
        this.bestLap = lapMs;
        const ghost = this.recorder.take();
        if (ghost && this.mode.ghost) this.ghost = ghost;
      }
      this.recorder.reset();
      this.onEvent({
        type: "lap",
        lap: entry.lap,
        lapMs,
        valid,
        isBest,
        splits,
      });
    }

    if (entry.lap >= this.totalLaps && !entry.finished) {
      entry.finished = true;
      entry.finishTime = this.time;
      if (entry.isPlayer) this.finishRace();
    }
  }

  /** Τερματισμός: κλείδωμα κατάταξης και ενημέρωση της σελίδας. */
  finishRace() {
    this.phase = "finished";
    const standings = this.standings();
    this.results = {
      mode: this.mode.id,
      position: standings.findIndex((e) => e.isPlayer) + 1,
      total: standings.length,
      bestLap: this.entries[0].bestLap,
      trackId: this.track.id,
      carId: this.player.spec.id,
      rows: standings.map((entry, i) => ({
        position: i + 1,
        name: entry.name,
        isPlayer: entry.isPlayer,
        bestLap: entry.bestLap,
        laps: Math.max(0, entry.lap),
      })),
    };
    this.input.releaseAll();
    this.onEvent({ type: "finish", results: this.results });
  }

  /** Κατάταξη: πρώτα όσοι τερμάτισαν (κατά χρόνο), μετά κατά απόσταση. */
  standings() {
    return this.entries.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.distance - a.distance;
    });
  }

  render(frameDt) {
    const car = this.player;
    const zoom = this.cameraZoom(car);
    // Λίγο look-ahead προς την κατεύθυνση κίνησης, χωρίς να "τρέχει" η κάμερα.
    const lead = Math.min(28, car.speed * 0.45);
    const view = {
      x: car.x + Math.cos(car.angle) * lead,
      y: car.y + Math.sin(car.angle) * lead,
      zoom,
    };

    if (car.slip > 5 && car.onTrack) this.renderer.addSkid(car);
    else this.renderer.breakSkid();
    this.renderer.fadeSkids(frameDt);

    if (this.ghost && this.mode.ghost && this.phase === "racing") {
      this.ghost.seek(this.time - this.entries[0].lapStart);
    }

    this.renderer.draw(view, {
      cars: this.carList,
      player: car,
      ghost: this.ghost && this.mode.ghost && this.phase === "racing" && !this.ghost.done ? this.ghost : null,
      showLine: this.showLine,
    });

    this.minimap?.draw(this.carList, car);
  }

  cameraZoom(car) {
    const viewWidth = this.renderer.viewWidth || 900;
    // Πόσα μέτρα πλάτους θέλουμε να φαίνονται: λιγότερα σε μικρές οθόνες.
    const base = Math.max(78, Math.min(132, viewWidth / 9.5));
    const speedRatio = Math.min(1, car.speed / car.spec.maxSpeed);
    return viewWidth / (base * (1 + speedRatio * 0.35));
  }

  /** Το αντικείμενο που διαβάζει το HUD της σελίδας. */
  hudState(inputs) {
    const entry = this.entries[0];
    const car = this.player;
    const { gear, rpm } = gearAndRpm(car);
    const lapMs = this.phase === "racing" || this.phase === "finished" ? this.time - entry.lapStart : 0;

    let delta = null;
    if (this.ghost && this.mode.ghost && this.phase === "racing") {
      const ghostTime = this.ghost.timeAtProgress(entry.progress);
      if (ghostTime !== null) delta = lapMs - ghostTime;
    }

    const standings = this.mode.id === "race" ? this.standings() : null;

    return {
      phase: this.paused ? "paused" : this.phase,
      lights: this.lights,
      speed: kmh(car),
      gear,
      rpm,
      steer: inputs.steer,
      throttle: inputs.throttle,
      brake: inputs.brake,
      source: inputs.source,
      lap: Math.min(Math.max(1, entry.lap + 1), this.totalLaps),
      totalLaps: this.totalLaps,
      lapMs,
      bestLap: entry.bestLap,
      lastLap: entry.lastLap,
      delta,
      valid: entry.lapValid,
      offTrack: !car.onTrack,
      position: standings ? standings.findIndex((e) => e.isPlayer) + 1 : null,
      fieldSize: standings ? standings.length : null,
      mode: this.mode.id,
      showLine: this.showLine,
    };
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    window.removeEventListener("resize", this._onResize);
    document.removeEventListener("visibilitychange", this._onVisibility);
  }
}
