// Player.js — input controller. In Phase 1 the player is always driving, so this
// maps keyboard (and shared mobile) input to a vehicle input state and fires
// discrete actions (camera toggle, lights, horn).

import { CONTROLS } from '../../shared/constants.js'

function matches(code, list) {
  return list.includes(code)
}

export class Player {
  constructor({ onCameraToggle, onLights, onHorn } = {}) {
    // Continuous input shared with MobileControls (same object reference).
    this.input = {
      accelerate: false,
      brake: false,
      left: false,
      right: false,
      handbrake: false,
      run: false,
    }
    this.onCameraToggle = onCameraToggle || (() => {})
    this.onLights = onLights || (() => {})
    this.onHorn = onHorn || (() => {})

    this._onKeyDown = this.handleKey.bind(this, true)
    this._onKeyUp = this.handleKey.bind(this, false)
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
  }

  handleKey(down, e) {
    const code = e.code
    let handled = true
    if (matches(code, CONTROLS.ACCELERATE)) this.input.accelerate = down
    else if (matches(code, CONTROLS.BRAKE)) this.input.brake = down
    else if (matches(code, CONTROLS.LEFT)) this.input.left = down
    else if (matches(code, CONTROLS.RIGHT)) this.input.right = down
    else if (matches(code, CONTROLS.HANDBRAKE)) this.input.handbrake = down
    else if (matches(code, CONTROLS.RUN)) this.input.run = down
    else if (down && matches(code, CONTROLS.CAMERA)) this.onCameraToggle()
    else if (down && matches(code, CONTROLS.LIGHTS)) this.onLights()
    else if (down && matches(code, CONTROLS.HORN)) this.onHorn()
    else handled = false

    if (handled) e.preventDefault()
  }

  getInput() {
    return this.input
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
  }
}
