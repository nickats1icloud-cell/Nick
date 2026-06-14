// Minimap.js — 2D overhead view sampling the world around the player. North-up
// with a rotating player marker. Throttled so it doesn't sample every frame.

import { TILES, TILE_COLORS } from '../../shared/constants.js'

export class Minimap {
  constructor(host, world, { range = 48, step = 2 } = {}) {
    this.world = world
    this.range = range // world units shown each side of the player
    this.step = step // sampling resolution
    this.frame = 0

    this.canvas = document.createElement('canvas')
    this.canvas.width = 120
    this.canvas.height = 120
    host.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')

    // Pre-stringify tile colours.
    this.colorStr = {}
    for (const k in TILE_COLORS) this.colorStr[k] = '#' + TILE_COLORS[k].toString(16).padStart(6, '0')
  }

  update(px, pz, heading) {
    // Throttle to ~12 fps.
    this.frame++
    if (this.frame % 5 !== 0) return

    const ctx = this.ctx
    const W = this.canvas.width
    const H = this.canvas.height
    const scale = W / (this.range * 2)

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0a0e18'
    ctx.fillRect(0, 0, W, H)

    const cx0 = Math.floor(px)
    const cz0 = Math.floor(pz)
    const cell = this.step * scale + 1

    for (let dx = -this.range; dx <= this.range; dx += this.step) {
      for (let dz = -this.range; dz <= this.range; dz += this.step) {
        const col = this.world.getColumn(cx0 + dx, cz0 + dz)
        let tile = col.tile
        if (col.buildingHeight > 0) tile = TILES.BUILDING
        ctx.fillStyle = this.colorStr[tile] || '#444'
        const sx = (dx + this.range) * scale
        const sy = (dz + this.range) * scale
        ctx.fillRect(sx, sy, cell, cell)
      }
    }

    // Player marker (triangle pointing toward heading).
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.rotate(heading)
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#5fd0ff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, -7)
    ctx.lineTo(5, 6)
    ctx.lineTo(-5, 6)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    // Border ring.
    ctx.strokeStyle = 'rgba(120,170,255,0.3)'
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1)
  }
}
