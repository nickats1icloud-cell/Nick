/**
 * Rendering σε 2D canvas.
 *
 * Η πίστα χτίζεται μία φορά ως Path2D και σχεδιάζεται με διαδοχικά strokes
 * (χαλίκι → κράσπεδα → άσφαλτος) κάτω από το transform της κάμερας, οπότε
 * μένει πάντα ευκρινής χωρίς προ-rendered bitmap. Τα ίχνη από τα λάστιχα
 * ζουν σε δικό τους buffer με σταδιακό ξεθώριασμα.
 */

const COLORS = {
  grass: "#0d1a12",
  grassAlt: "#102016",
  gravel: "#3a3126",
  kerbA: "#d63b3b",
  kerbB: "#f2f2f2",
  asphalt: "#24262c",
  asphaltEdge: "#33363d",
  racingLine: "#3d8bfd",
};

/** Μέγιστος αριθμός αποθηκευμένων ιχνών — πάνω από αυτό πετάμε τα παλιά. */
const MAX_SKIDS = 900;

export function buildTrackPaths(track) {
  const path = new Path2D();
  track.samples.forEach((s, i) => {
    if (i === 0) path.moveTo(s.x, s.y);
    else path.lineTo(s.x, s.y);
  });
  path.closePath();
  return { path };
}

export class Renderer {
  constructor(canvas, track) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.setTrack(track);
    this.skids = [];
    this.dpr = 1;
    this.resize();
  }

  setTrack(track) {
    this.track = track;
    this.paths = buildTrackPaths(track);
    this.skids = [];
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.viewWidth = rect.width;
    this.viewHeight = rect.height;
  }

  /**
   * Καταγράφει ίχνη λάστιχων: ένα τμήμα ανά πίσω τροχό, από την προηγούμενη
   * θέση στην τωρινή — έτσι βγαίνει συνεχής μουτζούρα και όχι σειρά από παύλες.
   */
  addSkid(car) {
    const half = car.spec.width / 2;
    const cos = Math.cos(car.angle);
    const sin = Math.sin(car.angle);
    const back = -car.spec.length * 0.3;
    if (!this._lastSkid || this._lastSkidCar !== car) {
      this._lastSkid = [null, null];
      this._lastSkidCar = car;
    }

    [-1, 1].forEach((side, i) => {
      const point = {
        x: car.x + cos * back - sin * half * side,
        y: car.y + sin * back + cos * half * side,
      };
      const prev = this._lastSkid[i];
      // Κενό >6 m σημαίνει respawn/teleport — δεν ενώνουμε τα δύο σημεία.
      if (prev && Math.hypot(point.x - prev.x, point.y - prev.y) < 6) {
        this.skids.push({ x1: prev.x, y1: prev.y, x2: point.x, y2: point.y, life: 1 });
      }
      this._lastSkid[i] = point;
    });

    if (this.skids.length > MAX_SKIDS) this.skids.splice(0, this.skids.length - MAX_SKIDS);
  }

  /** Καλείται και όταν δεν πατινάρει, ώστε να "κοπεί" η γραμμή του ίχνους. */
  breakSkid() {
    this._lastSkid = [null, null];
  }

  fadeSkids(dt) {
    for (const s of this.skids) s.life -= dt * 0.06;
    if (this.skids.length && this.skids[0].life <= 0) {
      this.skids = this.skids.filter((s) => s.life > 0);
    }
  }

  /**
   * Ζωγραφίζει ένα frame.
   * @param {object} view {x, y, zoom} κέντρο κάμερας σε world coords
   * @param {object} scene {cars, player, ghost, showLine, lights}
   */
  draw(view, scene) {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, w, h);

    const zoom = view.zoom * this.dpr;
    ctx.setTransform(zoom, 0, 0, zoom, w / 2 - view.x * zoom, h / 2 - view.y * zoom);

    this.drawGround(view);
    this.drawTrack(scene.showLine);
    this.drawSkids();
    this.drawStartLine();
    if (scene.ghost) this.drawGhost(scene.ghost);
    for (const car of scene.cars) this.drawCar(car, car === scene.player);
  }

  /** Διακριτικό μοτίβο στο γρασίδι ώστε να φαίνεται η κίνηση. */
  drawGround(view) {
    const { ctx } = this;
    const size = 40;
    const halfW = this.viewWidth / view.zoom / 2 + size;
    const halfH = this.viewHeight / view.zoom / 2 + size;
    const x0 = Math.floor((view.x - halfW) / size) * size;
    const y0 = Math.floor((view.y - halfH) / size) * size;
    ctx.fillStyle = COLORS.grassAlt;
    for (let x = x0; x < view.x + halfW; x += size) {
      for (let y = y0; y < view.y + halfH; y += size) {
        if ((Math.round(x / size) + Math.round(y / size)) % 2 === 0) continue;
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  drawTrack(showLine) {
    const { ctx, track } = this;
    const path = this.paths.path;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Χαλίκι/runoff.
    ctx.strokeStyle = COLORS.gravel;
    ctx.lineWidth = track.width + 14;
    ctx.stroke(path);

    // Κράσπεδα: δύο διακεκομμένα strokes σε αντίθετη φάση δίνουν τα κλασικά
    // κόκκινα/λευκά μπλοκ και στις δύο πλευρές. Χρειάζονται ίσια άκρα — με
    // στρογγυλά caps οι παύλες μεγαλώνουν και η μία σκεπάζει την άλλη.
    ctx.lineCap = "butt";
    ctx.lineWidth = track.width + 5;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = 0;
    ctx.strokeStyle = COLORS.kerbA;
    ctx.stroke(path);
    ctx.lineDashOffset = 5;
    ctx.strokeStyle = COLORS.kerbB;
    ctx.stroke(path);
    ctx.setLineDash([]);
    ctx.lineCap = "round";

    // Άσφαλτος.
    ctx.strokeStyle = COLORS.asphaltEdge;
    ctx.lineWidth = track.width;
    ctx.stroke(path);
    ctx.strokeStyle = COLORS.asphalt;
    ctx.lineWidth = track.width - 1.2;
    ctx.stroke(path);

    if (showLine) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = COLORS.racingLine;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 8]);
      ctx.stroke(path);
      ctx.restore();
    }
  }

  drawSkids() {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.42;
    ctx.lineCap = "round";
    for (const s of this.skids) {
      ctx.globalAlpha = Math.max(0, s.life) * 0.5;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawStartLine() {
    const { ctx, track } = this;
    const s = track.samples[0];
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    const half = track.halfWidth;
    const cell = track.width / 8;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 8; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? "#f2f2f2" : "#1a1a1a";
        ctx.fillRect(-cell + row * cell, -half + col * cell, cell, cell);
      }
    }
    ctx.restore();

    // Λεπτές γραμμές τομέων.
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 0.4;
    for (const idx of track.sectorIndices.slice(1)) {
      const p = track.samples[idx];
      ctx.beginPath();
      ctx.moveTo(p.x + p.normX * track.halfWidth, p.y + p.normY * track.halfWidth);
      ctx.lineTo(p.x - p.normX * track.halfWidth, p.y - p.normY * track.halfWidth);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGhost(ghost) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.32;
    this.drawCarBody(ghost, "#8fa8c8", "#c8d8ee");
    ctx.restore();
  }

  drawCar(car, isPlayer) {
    const { ctx } = this;
    ctx.save();
    // Σκιά για να "κάθεται" πάνω στην άσφαλτο.
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#000";
    ctx.save();
    ctx.translate(car.x + 0.6, car.y + 0.9);
    ctx.rotate(car.angle);
    roundedRect(ctx, -car.spec.length / 2, -car.spec.width / 2, car.spec.length, car.spec.width, 0.5);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    this.drawCarBody(car, car.spec.color, car.spec.accentColor);

    if (isPlayer) {
      // Δείκτης πάνω από το αμάξι του παίκτη.
      ctx.fillStyle = "#7db3ff";
      ctx.beginPath();
      ctx.moveTo(car.x, car.y - car.spec.width * 1.6);
      ctx.lineTo(car.x - 0.9, car.y - car.spec.width * 2.3);
      ctx.lineTo(car.x + 0.9, car.y - car.spec.width * 2.3);
      ctx.closePath();
      ctx.fill();
    } else if (car.label) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "1.6px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(car.label, car.x, car.y - car.spec.width * 1.6);
    }
    ctx.restore();
  }

  drawCarBody(car, color, accent) {
    const { ctx } = this;
    const spec = car.spec || { length: 4.5, width: 1.9 };
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Λάστιχα.
    ctx.fillStyle = "#16181c";
    const wx = spec.length * 0.3;
    const wy = spec.width / 2;
    for (const sx of [-wx, wx]) {
      for (const sy of [-wy, wy]) {
        ctx.fillRect(sx - 0.45, sy - 0.28, 0.9, 0.56);
      }
    }

    // Αμάξωμα.
    ctx.fillStyle = color;
    roundedRect(ctx, -spec.length / 2, -spec.width / 2, spec.length, spec.width, 0.55);
    ctx.fill();

    // Ρίγα στη μέση + παρμπρίζ, για να διαβάζεται η κατεύθυνση.
    ctx.fillStyle = accent;
    ctx.fillRect(-spec.length / 2 + 0.3, -0.18, spec.length - 0.6, 0.36);
    ctx.fillStyle = "rgba(10,14,20,0.85)";
    roundedRect(ctx, spec.length * 0.02, -spec.width / 2 + 0.28, spec.length * 0.24, spec.width - 0.56, 0.2);
    ctx.fill();
    ctx.restore();
  }
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Μικρό minimap με τη χάραξη της πίστας και κουκκίδες για τα αμάξια. */
export class Minimap {
  constructor(canvas, track) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.setTrack(track);
  }

  setTrack(track) {
    this.track = track;
    this.paths = buildTrackPaths(track);
  }

  draw(cars, player) {
    const { ctx, track, canvas } = this;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(rect.width * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const b = track.bounds;
    const pad = track.width;
    const scale = Math.min(w / (b.maxX - b.minX + pad * 2), h / (b.maxY - b.minY + pad * 2));
    const offX = (w - (b.maxX - b.minX) * scale) / 2 - b.minX * scale;
    const offY = (h - (b.maxY - b.minY) * scale) / 2 - b.minY * scale;
    ctx.setTransform(scale, 0, 0, scale, offX, offY);

    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = track.width * 0.9;
    ctx.lineJoin = "round";
    ctx.stroke(this.paths.path);

    for (const car of cars) {
      ctx.fillStyle = car === player ? "#7db3ff" : car.spec.color;
      ctx.beginPath();
      ctx.arc(car.x, car.y, track.width * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
