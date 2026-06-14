// HUD.js — HTML/CSS overlay (Greek UI). Analog speedometer + RPM arc (SVG),
// gear, time, odometer, per-wheel tire temps, engine temp and fuel gauges.

const NS = 'http://www.w3.org/2000/svg'

function el(tag, attrs = {}, parent) {
  const node = document.createElement(tag)
  for (const k in attrs) {
    if (k === 'class') node.className = attrs[k]
    else if (k === 'text') node.textContent = attrs[k]
    else node.setAttribute(k, attrs[k])
  }
  if (parent) parent.appendChild(node)
  return node
}

function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag)
  for (const k in attrs) node.setAttribute(k, attrs[k])
  if (parent) parent.appendChild(node)
  return node
}

export class HUD {
  constructor(root, maxSpeedKmh = 240) {
    this.root = root
    this.maxSpeed = maxSpeedKmh
    this.build()
  }

  build() {
    this.root.innerHTML = ''

    // Top-center chips.
    const top = el('div', { class: 'hud-top' }, this.root)
    this.speedChip = el('div', { class: 'hud-chip' }, top)
    this.gearChip = el('div', { class: 'hud-chip' }, top)
    this.timeChip = el('div', { class: 'hud-chip' }, top)
    this.kmChip = el('div', { class: 'hud-chip' }, top)

    // Gauge cluster.
    const cluster = el('div', { class: 'hud-cluster' }, this.root)

    // Side panel (engine/fuel/tires).
    const panel = el('div', { class: 'gauge-wrap' }, cluster)
    this.engineBar = this.makeBar(panel, 'Κινητήρας °C')
    this.fuelBar = this.makeBar(panel, 'Καύσιμο')
    el('div', { text: 'Λάστιχα °C', class: 'tire-title' }, panel).style.cssText =
      'font-size:10px;opacity:0.7;margin-top:6px'
    const grid = el('div', { class: 'tire-grid' }, panel)
    this.tireCells = []
    for (let i = 0; i < 4; i++) {
      const cell = el('div', { class: 'tire-cell' }, grid)
      const val = el('b', { text: '20' }, cell)
      el('span', { text: ['ΕΑ', 'ΔΑ', 'ΕΠ', 'ΔΠ'][i] }, cell)
      this.tireCells.push(val)
    }

    // Analog speedometer (SVG).
    const gWrap = el('div', { class: 'gauge-wrap' }, cluster)
    const size = 180
    const s = svg('svg', { width: size, height: size, viewBox: '0 0 200 200' }, gWrap)
    const cx = 100
    const cy = 100
    const r = 84

    // RPM arc background + fill.
    svg('path', {
      d: this.arcPath(cx, cy, r, -135, 135),
      fill: 'none',
      stroke: 'rgba(255,255,255,0.12)',
      'stroke-width': 10,
      'stroke-linecap': 'round',
    }, s)
    this.rpmArc = svg('path', {
      d: this.arcPath(cx, cy, r, -135, 135),
      fill: 'none',
      stroke: '#5fd0ff',
      'stroke-width': 10,
      'stroke-linecap': 'round',
    }, s)
    this.rpmArcLen = this.rpmArc.getTotalLength ? 0 : 0

    // Speed ticks.
    for (let i = 0; i <= 8; i++) {
      const ang = (-135 + (270 * i) / 8) * (Math.PI / 180)
      const x1 = cx + Math.cos(ang) * (r - 18)
      const y1 = cy + Math.sin(ang) * (r - 18)
      const x2 = cx + Math.cos(ang) * (r - 26)
      const y2 = cy + Math.sin(ang) * (r - 26)
      svg('line', { x1, y1, x2, y2, stroke: 'rgba(255,255,255,0.4)', 'stroke-width': 2 }, s)
    }

    // Needle.
    this.needle = svg('line', {
      x1: cx,
      y1: cy,
      x2: cx,
      y2: cy - (r - 30),
      stroke: '#ff5555',
      'stroke-width': 3,
      'stroke-linecap': 'round',
    }, s)
    svg('circle', { cx, cy, r: 6, fill: '#1a2238', stroke: '#5fd0ff', 'stroke-width': 2 }, s)

    // Center digital readout.
    this.speedText = svg('text', {
      x: cx,
      y: cy + 36,
      'text-anchor': 'middle',
      fill: '#e8f0ff',
      'font-size': 22,
      'font-weight': 'bold',
    }, s)
    this.speedText.textContent = '0'
    this.unitText = svg('text', {
      x: cx,
      y: cy + 52,
      'text-anchor': 'middle',
      fill: 'rgba(232,240,255,0.6)',
      'font-size': 9,
    }, s)
    this.unitText.textContent = 'km/h'

    this.cx = cx
    this.cy = cy
    this.r = r

    // Bottom-left money + wanted (placeholders for later phases, shown for layout).
    const bl = el('div', { class: 'hud-bottom-left' }, this.root)
    el('div', { class: 'hud-money', html: '' }, bl).innerHTML = 'Cash: <b>VX$5,000</b>'
    el('div', { class: 'hud-stars', text: '★☆☆☆☆ Wanted' }, bl)

    // Bottom-center controls hint.
    el(
      'div',
      {
        class: 'hud-bottom-center',
        text: 'W=Γκάζι  S=Φρένο  A/D=Τιμόνι  Space=Χφ  C=Κάμερα  H=Κόρνα  L=Φώτα',
      },
      this.root
    )

    // Minimap container (filled by Minimap.js).
    this.minimapHost = el('div', { id: 'minimap' }, this.root)
  }

  makeBar(parent, label) {
    el('div', { text: label }, parent).style.cssText = 'font-size:10px;opacity:0.7'
    const bar = el('div', { class: 'bar' }, parent)
    const fill = el('span', {}, bar)
    return fill
  }

  // SVG arc path helper (degrees, clockwise from top).
  arcPath(cx, cy, r, startDeg, endDeg) {
    const a0 = (startDeg - 90) * (Math.PI / 180)
    const a1 = (endDeg - 90) * (Math.PI / 180)
    const x0 = cx + r * Math.cos(a0)
    const y0 = cy + r * Math.sin(a0)
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`
  }

  update(t, timeString) {
    // Top chips.
    this.speedChip.innerHTML = `Ταχύτητα: <b>${Math.round(t.speedKmh)}</b> km/h`
    this.gearChip.innerHTML = `Σχέση: <b>${t.gear}</b>`
    this.timeChip.innerHTML = `Ώρα: <b>${timeString}</b>`
    this.kmChip.innerHTML = `Χλμ: <b>${t.odometer.toFixed(1)}</b>`

    // Needle (−135°..+135° over speed range).
    const sp = Math.min(t.speedKmh, this.maxSpeed) / this.maxSpeed
    const deg = -135 + sp * 270
    this.needle.setAttribute('transform', `rotate(${deg} ${this.cx} ${this.cy})`)
    this.speedText.textContent = String(Math.round(t.speedKmh))

    // RPM arc fill via dash offset.
    if (!this.rpmArcLen && this.rpmArc.getTotalLength) this.rpmArcLen = this.rpmArc.getTotalLength()
    const rpmFrac = Math.min(t.rpm / t.redline, 1)
    if (this.rpmArcLen) {
      this.rpmArc.setAttribute('stroke-dasharray', this.rpmArcLen)
      this.rpmArc.setAttribute('stroke-dashoffset', this.rpmArcLen * (1 - rpmFrac))
    }
    this.rpmArc.setAttribute('stroke', rpmFrac > 0.85 ? '#ff5555' : rpmFrac > 0.65 ? '#ffcc44' : '#5fd0ff')

    // Engine temp bar (40..130 -> 0..100%).
    const et = Math.max(0, Math.min(1, (t.engineTemp - 40) / 90))
    this.engineBar.style.width = `${et * 100}%`
    this.engineBar.style.background =
      t.engineTemp > 120 ? '#ff5555' : t.engineTemp > 105 ? '#ffcc44' : '#5fff9f'

    // Fuel bar.
    this.fuelBar.style.width = `${t.fuel}%`
    this.fuelBar.style.background = t.fuel < 15 ? '#ff5555' : t.fuel < 30 ? '#ffcc44' : '#5fd0ff'

    // Tire temps.
    for (let i = 0; i < 4; i++) {
      const temp = t.tireTemps[i]
      this.tireCells[i].textContent = String(Math.round(temp))
      this.tireCells[i].style.color =
        temp > 120 ? '#ff5555' : temp > 100 ? '#ffcc44' : temp < 40 ? '#5fd0ff' : '#5fff9f'
    }
  }
}
