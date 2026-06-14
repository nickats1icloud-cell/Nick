// DayNightCycle.js — moving sun/moon, sky colour, stars and dynamic lighting.
// gameTime is tracked in minutes (0..1440). 30 real minutes = 24 game hours.

import * as THREE from 'three'
import { DAY } from '../../shared/constants.js'

// Keyframed sky colours through the day (minutes -> hex).
const SKY_KEYS = [
  { t: 0, c: 0x05070f }, // midnight
  { t: 300, c: 0x0a1230 }, // 05:00 pre-dawn
  { t: 360, c: 0xff8c5a }, // 06:00 dawn
  { t: 420, c: 0x8fb8e0 }, // 07:00 morning
  { t: 720, c: 0x5fa8e8 }, // 12:00 midday
  { t: 1020, c: 0x7fb0d8 }, // 17:00 afternoon
  { t: 1110, c: 0xff7a45 }, // 18:30 sunset
  { t: 1200, c: 0x1a1f44 }, // 20:00 dusk
  { t: 1440, c: 0x05070f }, // midnight
]

function lerpColorTable(table, t) {
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i]
    const b = table[i + 1]
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t || 1)
      return new THREE.Color(a.c).lerp(new THREE.Color(b.c), f)
    }
  }
  return new THREE.Color(table[0].c)
}

export class DayNightCycle {
  constructor(scene) {
    this.scene = scene
    this.gameTime = DAY.START_MINUTES
    this.minutesPerRealSecond = 1440 / DAY.REAL_SECONDS_PER_DAY

    // Lights.
    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 1.0)
    this.sunLight.castShadow = true
    this.sunLight.shadow.mapSize.set(2048, 2048)
    this.sunLight.shadow.camera.near = 1
    this.sunLight.shadow.camera.far = 220
    const s = 90
    this.sunLight.shadow.camera.left = -s
    this.sunLight.shadow.camera.right = s
    this.sunLight.shadow.camera.top = s
    this.sunLight.shadow.camera.bottom = -s
    this.sunLight.shadow.bias = -0.0008
    scene.add(this.sunLight)
    scene.add(this.sunLight.target)

    this.ambientLight = new THREE.AmbientLight(0xbfd0ff, 0.4)
    scene.add(this.ambientLight)

    this.hemisphereLight = new THREE.HemisphereLight(0x9fc0ff, 0x4a3b2a, 0.5)
    scene.add(this.hemisphereLight)

    this.scene.fog = new THREE.Fog(0x5fa8e8, 60, 240)

    this.buildStars()
    this.buildMoon()
  }

  buildStars() {
    const count = 1200
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Random point on upper hemisphere shell.
      const r = 400
      const u = Math.random()
      const v = Math.random() * 0.5 // upper hemisphere
      const theta = u * Math.PI * 2
      const phi = Math.acos(1 - 2 * v)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 30
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    this.stars = new THREE.Points(geo, this.starMat)
    this.scene.add(this.stars)
  }

  buildMoon() {
    const geo = new THREE.SphereGeometry(8, 16, 16)
    const mat = new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false })
    this.moon = new THREE.Mesh(geo, mat)
    this.scene.add(this.moon)

    const sunGeo = new THREE.SphereGeometry(10, 16, 16)
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false })
    this.sunSphere = new THREE.Mesh(sunGeo, sunMat)
    this.scene.add(this.sunSphere)
  }

  // 0..1 daylight factor from the sun's elevation.
  getLightIntensity(minutes = this.gameTime) {
    // Sun elevation: peaks at noon (720), below horizon at night.
    const angle = ((minutes - 360) / 1440) * Math.PI * 2 // sunrise ~ 06:00
    const elevation = Math.sin(angle)
    return THREE.MathUtils.clamp(elevation, 0, 1)
  }

  getSkyColor(minutes = this.gameTime) {
    return lerpColorTable(SKY_KEYS, minutes)
  }

  getTimeString() {
    const total = Math.floor(this.gameTime) % 1440
    const h = Math.floor(total / 60)
    const m = total % 60
    const ampm = h < 12 ? 'πμ' : 'μμ'
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    return `${hh}:${mm} ${ampm}`
  }

  update(dt, center = new THREE.Vector3()) {
    this.gameTime = (this.gameTime + dt * this.minutesPerRealSecond) % 1440

    const daylight = this.getLightIntensity()
    const angle = ((this.gameTime - 360) / 1440) * Math.PI * 2
    const radius = 180

    // Sun position (orbits around the player/center).
    const sunPos = new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      Math.sin(angle * 0.5) * radius * 0.3
    )
    this.sunLight.position.copy(center).add(sunPos)
    this.sunLight.target.position.copy(center)
    this.sunSphere.position.copy(this.sunLight.position)
    this.sunSphere.visible = sunPos.y > -10

    // Moon is opposite the sun.
    this.moon.position.copy(center).sub(sunPos)
    this.moon.visible = sunPos.y < 10

    // Light intensities.
    this.sunLight.intensity = 0.15 + daylight * 1.1
    this.ambientLight.intensity = 0.2 + daylight * 0.45
    this.hemisphereLight.intensity = 0.25 + daylight * 0.45
    const warm = new THREE.Color(0xfff4e0)
    const cool = new THREE.Color(0x9fb6ff)
    this.sunLight.color.copy(cool).lerp(warm, daylight)

    // Sky + fog colour.
    const sky = this.getSkyColor()
    this.scene.background = sky
    if (this.scene.fog) this.scene.fog.color.copy(sky)

    // Stars fade in at night.
    const night = 1 - daylight
    this.starMat.opacity = THREE.MathUtils.clamp((night - 0.5) * 2, 0, 1)
    this.stars.position.copy(center)
  }
}
