/**
 * Πίστες του GSR Time Attack — ορισμοί + γεωμετρία.
 *
 * Κάθε πίστα ορίζεται με λίγα control points (μέτρα, world coords). Από αυτά
 * χτίζεται μια κλειστή Catmull-Rom καμπύλη, η οποία ξαναδειγματοληπτείται σε
 * ισαπέχοντα σημεία (`SAMPLE_SPACING`). Όλη η υπόλοιπη λογική του παιχνιδιού
 * (πρόοδος στον γύρο, τομείς, εκτός πίστας, AI racing line) δουλεύει πάνω σε
 * αυτόν τον ομοιόμορφο πίνακα samples, οπότε είναι απλή αριθμητική με index.
 */

/** Απόσταση μεταξύ διαδοχικών samples της κεντρικής γραμμής, σε μέτρα. */
export const SAMPLE_SPACING = 2.5;

/** Πόσοι τομείς (sectors) ανά γύρο — όπως στα πραγματικά sims. */
export const SECTORS = 3;

export const TRACKS = [
  {
    id: "acropolis",
    name: "Ακρόπολις Ring",
    subtitle: "Γρήγορη, ρευστή, ιδανική για πρώτη γνωριμία",
    difficulty: "Εύκολη",
    emoji: "🏛️",
    width: 17,
    raceLaps: 3,
    grip: 1,
    points: [
      [-245, 150],
      [-60, 178],
      [120, 168],
      [248, 108],
      [292, 12],
      [236, -68],
      [120, -78],
      [40, -142],
      [-72, -152],
      [-172, -112],
      [-216, -20],
      [-284, 62],
    ],
  },
  {
    id: "thessaloniki",
    name: "Θεσσαλονίκη Waterfront",
    subtitle: "Αστικό, στενό, με σικέιν στην παραλία",
    difficulty: "Μεσαία",
    emoji: "🌊",
    width: 13,
    raceLaps: 3,
    grip: 0.94,
    points: [
      [-330, 190],
      [-100, 208],
      [130, 200],
      [285, 140],
      [300, 45],
      [205, 18],
      [168, -35],
      [232, -92],
      [190, -170],
      [30, -196],
      [-160, -186],
      [-272, -138],
      [-238, -45],
      [-140, 4],
      [-205, 78],
      [-345, 92],
    ],
  },
  {
    id: "olympia",
    name: "Ολυμπία GP",
    subtitle: "Μεγάλη, με φουρκέτες και esses",
    difficulty: "Δύσκολη",
    emoji: "🔥",
    width: 15,
    raceLaps: 3,
    grip: 1,
    points: [
      [-380, 232],
      [-105, 256],
      [172, 246],
      [362, 192],
      [420, 92],
      [332, 45],
      [232, 70],
      [152, 14],
      [200, -70],
      [332, -108],
      [362, -202],
      [232, -256],
      [30, -254],
      [-138, -232],
      [-200, -146],
      [-122, -85],
      [-186, -15],
      [-332, 15],
      [-398, 108],
    ],
  },
];

export function trackById(id) {
  return TRACKS.find((t) => t.id === id) || TRACKS[0];
}

/** Catmull-Rom interpolation ανάμεσα στα p1..p2, με p0/p3 ως γείτονες. */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/** Πυκνή δειγματοληψία της κλειστής καμπύλης που περνά από όλα τα control points. */
function densePolyline(points, stepsPerSegment) {
  const n = points.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let s = 0; s < stepsPerSegment; s++) {
      const t = s / stepsPerSegment;
      out.push([
        catmullRom(p0[0], p1[0], p2[0], p3[0], t),
        catmullRom(p0[1], p1[1], p2[1], p3[1], t),
      ]);
    }
  }
  return out;
}

/** Ξαναδειγματοληψία κλειστής πολυγραμμής σε ισαπέχοντα σημεία. */
function resample(poly, spacing) {
  const closed = poly.concat([poly[0]]);
  const out = [];
  let carry = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const [x1, y1] = closed[i];
    const [x2, y2] = closed[i + 1];
    const segLen = Math.hypot(x2 - x1, y2 - y1);
    if (segLen === 0) continue;
    let d = carry;
    while (d < segLen) {
      const t = d / segLen;
      out.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
      d += spacing;
    }
    carry = d - segLen;
  }
  return out;
}

/**
 * Χτίζει το πλήρες μοντέλο πίστας από τον ορισμό της.
 * Επιστρέφει samples με θέση, κατεύθυνση, κάθετο διάνυσμα, καμπυλότητα και
 * αθροιστική απόσταση — ό,τι χρειάζεται φυσική, AI και rendering.
 */
export function buildTrack(def) {
  const dense = densePolyline(def.points, 24);
  const samples = resample(dense, SAMPLE_SPACING);
  const n = samples.length;

  for (let i = 0; i < n; i++) {
    const prev = samples[(i - 1 + n) % n];
    const next = samples[(i + 1) % n];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const s = samples[i];
    s.dist = i * SAMPLE_SPACING;
    s.dirX = dx / len;
    s.dirY = dy / len;
    s.angle = Math.atan2(dy, dx);
    // Κάθετο διάνυσμα προς τα "αριστερά" της φοράς κίνησης.
    s.normX = -s.dirY;
    s.normY = s.dirX;
  }

  // Καμπυλότητα: αλλαγή γωνίας ανά μέτρο (προσημασμένη — θετική = αριστερά).
  for (let i = 0; i < n; i++) {
    const prev = samples[(i - 1 + n) % n];
    const next = samples[(i + 1) % n];
    let dAngle = next.angle - prev.angle;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    samples[i].curvature = dAngle / (2 * SAMPLE_SPACING);
  }

  // Εξομάλυνση καμπυλότητας: τα control points δίνουν θόρυβο που κάνει την AI
  // να "τρέμει" στο γκάζι.
  const smoothed = new Array(n);
  const window = 4;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -window; k <= window; k++) sum += samples[(i + k + n) % n].curvature;
    smoothed[i] = sum / (window * 2 + 1);
  }
  for (let i = 0; i < n; i++) samples[i].curvature = smoothed[i];

  const bounds = samples.reduce(
    (b, s) => ({
      minX: Math.min(b.minX, s.x),
      maxX: Math.max(b.maxX, s.x),
      minY: Math.min(b.minY, s.y),
      maxY: Math.max(b.maxY, s.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );

  return {
    def,
    id: def.id,
    name: def.name,
    samples,
    count: n,
    length: n * SAMPLE_SPACING,
    width: def.width,
    halfWidth: def.width / 2,
    grip: def.grip ?? 1,
    raceLaps: def.raceLaps ?? 3,
    bounds,
    // Δείκτες samples όπου αλλάζει τομέας (ο 0 είναι η γραμμή εκκίνησης).
    sectorIndices: Array.from({ length: SECTORS }, (_, i) => Math.round((i * n) / SECTORS)),
  };
}

/**
 * Πλησιέστερο sample στο (x, y). Με `hint` (το προηγούμενο index του οχήματος)
 * ψάχνει μόνο σε ένα παράθυρο γύρω του — O(1) αντί για O(n) κάθε frame.
 */
export function nearestSample(track, x, y, hint = -1) {
  const { samples, count } = track;
  let best = -1;
  let bestDist = Infinity;

  const scan = (from, to) => {
    for (let k = from; k <= to; k++) {
      const i = ((k % count) + count) % count;
      const s = samples[i];
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
  };

  if (hint >= 0) {
    const window = 40; // ±100 m — αρκετά ακόμα και για teleport μετά από reset
    scan(hint - window, hint + window);
    // Αν βρεθήκαμε πολύ μακριά (π.χ. εκτός πίστας σε shortcut), ψάχνουμε παντού.
    if (Math.sqrt(bestDist) < track.halfWidth + 60) return { index: best, dist: Math.sqrt(bestDist) };
    best = -1;
    bestDist = Infinity;
  }

  scan(0, count - 1);
  return { index: best, dist: Math.sqrt(bestDist) };
}

/** Προσημασμένη πλευρική απόκλιση από την κεντρική γραμμή (θετική = αριστερά). */
export function lateralOffset(track, index, x, y) {
  const s = track.samples[index];
  return (x - s.x) * s.normX + (y - s.y) * s.normY;
}

/** Sample σε απόσταση `s` μέτρων από τη γραμμή εκκίνησης (με wrap). */
export function sampleAtDistance(track, s) {
  const i = Math.round(s / SAMPLE_SPACING);
  return track.samples[((i % track.count) + track.count) % track.count];
}

/** Θέση εκκίνησης: πάνω στην κεντρική γραμμή, με πλευρική/διαμήκη μετατόπιση grid. */
export function gridPose(track, slot = 0) {
  // Οι θέσεις μπαίνουν πίσω από τη γραμμή (αρνητική απόσταση) σε ζιγκ-ζαγκ.
  const back = 12 + slot * 9;
  const side = (slot % 2 === 0 ? -1 : 1) * track.halfWidth * 0.42;
  const s = sampleAtDistance(track, track.length - back);
  return {
    x: s.x + s.normX * side,
    y: s.y + s.normY * side,
    angle: s.angle,
  };
}
