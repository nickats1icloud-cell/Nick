// MobileControls.js — touch D-pad (left) + action buttons (right). Writes into
// the same input object the Player uses, so driving logic is input-source
// agnostic. Only shown on small screens. Haptics via navigator.vibrate.

export class MobileControls {
  constructor(host, input, { onCamera, onLights, onHorn } = {}) {
    this.host = host
    this.input = input
    this.onCamera = onCamera || (() => {})
    this.onLights = onLights || (() => {})
    this.onHorn = onHorn || (() => {})

    this.enabled = window.innerWidth < 768 || 'ontouchstart' in window
    if (!this.enabled) return

    host.classList.add('active')
    this.build()
  }

  vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms)
  }

  // Create a button that sets input[prop]=true while held.
  hold(label, styleText, prop) {
    const b = document.createElement('div')
    b.className = 'mc-btn'
    b.textContent = label
    b.style.cssText = styleText
    const set = (v) => {
      this.input[prop] = v
      b.classList.toggle('pressed', v)
      if (v) this.vibrate(10)
    }
    b.addEventListener('touchstart', (e) => { e.preventDefault(); set(true) }, { passive: false })
    b.addEventListener('touchend', (e) => { e.preventDefault(); set(false) }, { passive: false })
    b.addEventListener('touchcancel', () => set(false))
    this.host.appendChild(b)
    return b
  }

  // Create a button that fires a callback once per tap.
  tap(label, styleText, cb) {
    const b = document.createElement('div')
    b.className = 'mc-btn mc-round'
    b.textContent = label
    b.style.cssText = styleText
    b.addEventListener('touchstart', (e) => {
      e.preventDefault()
      b.classList.add('pressed')
      this.vibrate(15)
      cb()
    }, { passive: false })
    b.addEventListener('touchend', (e) => { e.preventDefault(); b.classList.remove('pressed') }, { passive: false })
    this.host.appendChild(b)
    return b
  }

  build() {
    // Left D-pad.
    const dpad = 'width:64px;height:64px;'
    this.hold('▲', `left:84px;bottom:118px;${dpad}`, 'accelerate')
    this.hold('▼', `left:84px;bottom:24px;${dpad}`, 'brake')
    this.hold('◀', `left:24px;bottom:71px;${dpad}`, 'left')
    this.hold('▶', `left:144px;bottom:71px;${dpad}`, 'right')

    // Right actions.
    this.hold('Χφ', 'right:24px;bottom:118px;width:64px;height:64px;border-radius:50%;font-size:14px;', 'handbrake')
    this.tap('Κάμ', 'right:104px;bottom:96px;', this.onCamera)
    this.tap('Φώτα', 'right:24px;bottom:36px;', this.onLights)
    this.tap('Κόρνα', 'right:104px;bottom:20px;', this.onHorn)
  }
}
