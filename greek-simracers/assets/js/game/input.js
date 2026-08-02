/**
 * Χειρισμός: πληκτρολόγιο, οθόνη αφής και gamepad/τιμονιέρα.
 *
 * Η κλάση δίνει ένα ενιαίο αντικείμενο inputs που διαβάζει το engine κάθε
 * frame. Τα πλήκτρα δίνουν 0/1, οπότε το τιμόνι εξομαλύνεται με ράμπα ώστε να
 * μη γίνεται on/off (ένα αναλογικό gamepad παρακάμπτει την εξομάλυνση).
 */

const KEY_MAP = {
  ArrowUp: "throttle",
  KeyW: "throttle",
  ArrowDown: "brake",
  KeyS: "brake",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "handbrake",
};

/** Πόσο γρήγορα φτάνει το τιμόνι στο τέρμα με πλήκτρα (μονάδες/δευτ.). */
const STEER_RAMP = 3.6;
const STEER_RETURN = 6;

export class Input {
  constructor(target = window) {
    this.target = target;
    this.keys = new Set();
    this.touch = { throttle: 0, brake: 0, left: 0, right: 0, handbrake: 0 };
    this.steer = 0;
    this.gamepadIndex = null;
    this.onAction = () => {};

    this._onKeyDown = (e) => {
      const action = KEY_MAP[e.code];
      if (action) {
        // Τα βελάκια/space κάνουν scroll τη σελίδα — δεν το θέλουμε στην πίστα.
        e.preventDefault();
        this.keys.add(action);
      }
      this.onAction(e.code, e);
    };
    this._onKeyUp = (e) => {
      const action = KEY_MAP[e.code];
      if (action) {
        e.preventDefault();
        this.keys.delete(action);
      }
    };
    this._onBlur = () => this.releaseAll();

    target.addEventListener("keydown", this._onKeyDown);
    target.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);
    window.addEventListener("gamepadconnected", (e) => {
      this.gamepadIndex = e.gamepad.index;
    });
    window.addEventListener("gamepaddisconnected", () => {
      this.gamepadIndex = null;
    });
  }

  /** Συνδέει ένα on-screen κουμπί (pointer events = ποντίκι + αφή μαζί). */
  bindButton(el, action) {
    if (!el) return;
    const press = (e) => {
      e.preventDefault();
      this.touch[action] = 1;
      el.classList.add("game__pad-btn--on");
      el.setPointerCapture?.(e.pointerId);
    };
    const release = (e) => {
      e.preventDefault();
      this.touch[action] = 0;
      el.classList.remove("game__pad-btn--on");
    };
    el.addEventListener("pointerdown", press);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("pointerleave", release);
  }

  releaseAll() {
    this.keys.clear();
    for (const k of Object.keys(this.touch)) this.touch[k] = 0;
  }

  /** Διαβάζει gamepad/τιμονιέρα, αν υπάρχει συνδεδεμένο. */
  readGamepad() {
    if (this.gamepadIndex === null || !navigator.getGamepads) return null;
    const pad = navigator.getGamepads()[this.gamepadIndex];
    if (!pad) return null;
    const dead = (v) => (Math.abs(v) < 0.08 ? 0 : v);
    const steer = dead(pad.axes[0] ?? 0);
    // Τα περισσότερα gamepads: RT = buttons[7], LT = buttons[6].
    const throttle = pad.buttons[7]?.value ?? 0;
    const brake = pad.buttons[6]?.value ?? 0;
    const handbrake = Boolean(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed);
    const active = Math.abs(steer) > 0 || throttle > 0.02 || brake > 0.02 || handbrake;
    return active ? { steer, throttle, brake, handbrake } : null;
  }

  /**
   * Τρέχουσα κατάσταση χειριστηρίων.
   * @param {number} dt δευτερόλεπτα, για την εξομάλυνση του τιμονιού
   */
  read(dt) {
    const pad = this.readGamepad();
    if (pad) {
      this.steer = pad.steer;
      return { ...pad, source: "gamepad" };
    }

    const left = this.keys.has("left") || this.touch.left;
    const right = this.keys.has("right") || this.touch.right;
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (dir === 0) {
      // Επιστροφή στο κέντρο.
      const back = STEER_RETURN * dt;
      this.steer = Math.abs(this.steer) <= back ? 0 : this.steer - Math.sign(this.steer) * back;
    } else {
      this.steer = Math.max(-1, Math.min(1, this.steer + dir * STEER_RAMP * dt));
    }

    return {
      steer: this.steer,
      throttle: this.keys.has("throttle") || this.touch.throttle ? 1 : 0,
      brake: this.keys.has("brake") || this.touch.brake ? 1 : 0,
      handbrake: Boolean(this.keys.has("handbrake") || this.touch.handbrake),
      source: "keyboard",
    };
  }

  destroy() {
    this.target.removeEventListener("keydown", this._onKeyDown);
    this.target.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
  }
}
