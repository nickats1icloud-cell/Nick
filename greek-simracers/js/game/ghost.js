/**
 * Ghost του καλύτερου γύρου.
 *
 * Κατά τη διάρκεια κάθε γύρου καταγράφουμε δείγματα (χρόνος, θέση, γωνία,
 * πρόοδος). Όταν ο γύρος είναι ταχύτερος από τον προηγούμενο καλύτερο, η
 * καταγραφή γίνεται το νέο ghost: αναπαράγεται με παρεμβολή στον χρόνο και
 * δίνει επίσης το ζωντανό delta (πόσο μπροστά/πίσω είμαστε στο ίδιο σημείο).
 */

/** Πόσο συχνά καταγράφουμε δείγμα, σε ms. */
const SAMPLE_MS = 45;

export class GhostRecorder {
  constructor() {
    this.samples = [];
    this.nextAt = 0;
  }

  reset() {
    this.samples = [];
    this.nextAt = 0;
  }

  /** @param {number} lapMs χρόνος μέσα στον γύρο, @param {number} progress μέτρα από τη γραμμή */
  record(lapMs, progress, car) {
    if (lapMs < this.nextAt) return;
    this.nextAt = lapMs + SAMPLE_MS;
    this.samples.push({ t: lapMs, s: progress, x: car.x, y: car.y, a: car.angle });
  }

  take() {
    return this.samples.length > 2 ? new Ghost(this.samples.slice()) : null;
  }
}

export class Ghost {
  constructor(samples) {
    this.samples = samples;
    this.spec = { length: 4.6, width: 1.9 };
    this.x = samples[0].x;
    this.y = samples[0].y;
    this.angle = samples[0].a;
    this._cursor = 0;
  }

  /** Τοποθετεί το ghost στη χρονική στιγμή `lapMs` του γύρου του. */
  seek(lapMs) {
    const s = this.samples;
    // Ο δείκτης κινείται μόνο μπροστά όσο τρέχει ο γύρος — O(1) ανά frame.
    if (lapMs < s[this._cursor].t) this._cursor = 0;
    while (this._cursor < s.length - 2 && s[this._cursor + 1].t <= lapMs) this._cursor++;

    const a = s[this._cursor];
    const b = s[Math.min(s.length - 1, this._cursor + 1)];
    const span = b.t - a.t;
    const t = span > 0 ? Math.min(1, (lapMs - a.t) / span) : 0;
    this.x = a.x + (b.x - a.x) * t;
    this.y = a.y + (b.y - a.y) * t;
    // Παρεμβολή γωνίας από τον κοντύτερο δρόμο, αλλιώς σπινάρει στο ±π.
    let d = b.a - a.a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.angle = a.a + d * t;
    this.done = lapMs > s[s.length - 1].t;
  }

  /**
   * Χρόνος που είχε κάνει το ghost στην ίδια πρόοδο γύρου.
   * @returns {number|null} ms, ή null αν δεν έχει φτάσει ακόμα εκεί
   */
  timeAtProgress(progress) {
    const s = this.samples;
    if (progress <= s[0].s) return s[0].t;
    if (progress >= s[s.length - 1].s) return null;
    let lo = 0;
    let hi = s.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid].s <= progress) lo = mid;
      else hi = mid;
    }
    const span = s[hi].s - s[lo].s;
    const t = span > 0 ? (progress - s[lo].s) / span : 0;
    return s[lo].t + (s[hi].t - s[lo].t) * t;
  }
}
