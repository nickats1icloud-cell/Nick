// main.js — Voxel Horizon entry point. Sets up Three.js rendering, the Cannon-es
// physics world, the streamed voxel world, day/night cycle, the player vehicle,
// cameras, HUD, minimap and mobile controls, then runs the game loop.

import * as THREE from 'three'
import * as CANNON from 'cannon-es'

import './styles.css'
import { WorldMap } from './world/WorldMap.js'
import { ChunkManager } from './world/ChunkManager.js'
import { DayNightCycle } from './world/DayNightCycle.js'
import { VehicleBase } from './vehicles/VehicleBase.js'
import { DEFAULT_VEHICLE, VEHICLE_CATEGORIES } from './vehicles/VehicleData.js'
import { Player } from './player/Player.js'
import { CameraRig } from './player/Camera.js'
import { HUD } from './ui/HUD.js'
import { Minimap } from './ui/Minimap.js'
import { MobileControls } from './ui/MobileControls.js'

class Game {
  constructor() {
    this.setStatus('Δημιουργία σκηνής…', 10)
    this.initRenderer()
    this.initPhysics()
    this.setStatus('Δημιουργία κόσμου…', 35)
    this.initWorld()
    this.setStatus('Φόρτωση οχήματος…', 60)
    this.initVehicle()
    this.setStatus('Ρύθμιση χειριστηρίων…', 85)
    this.initControlsAndUI()

    window.addEventListener('resize', () => this.onResize())

    this.clock = new THREE.Clock()
    this.accumulator = 0
    this.fixedStep = 1 / 60

    this.setStatus('Έτοιμο!', 100)
    setTimeout(() => document.getElementById('loading').classList.add('hidden'), 400)

    this.loop = this.loop.bind(this)
    requestAnimationFrame(this.loop)
  }

  setStatus(text, pct) {
    const s = document.getElementById('loading-status')
    const f = document.getElementById('loading-bar-fill')
    if (s) s.textContent = text
    if (f) f.style.width = `${pct}%`
  }

  initRenderer() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    )
    this.camera.position.set(0, 8, -12)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    document.getElementById('game').appendChild(this.renderer.domElement)
  }

  initPhysics() {
    this.physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
    this.physicsWorld.broadphase = new CANNON.SAPBroadphase(this.physicsWorld)
    this.physicsWorld.defaultContactMaterial.friction = 0.3

    this.groundMaterial = new CANNON.Material('ground')
    this.wheelMaterial = new CANNON.Material('wheel')

    // Flat ground plane at y = 0 (matches voxel ground tops).
    const ground = new CANNON.Body({ mass: 0, material: this.groundMaterial })
    ground.addShape(new CANNON.Plane())
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    this.physicsWorld.addBody(ground)

    // Visual flat receiver so far-away ground isn't empty before chunks load.
    const floorGeo = new THREE.PlaneGeometry(2000, 2000)
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x2c3a26 })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.02
    floor.receiveShadow = true
    // (chunks render on top; this is a safety backdrop)
    this.sceneFloor = floor
  }

  initWorld() {
    this.world = new WorldMap(20260614)
    this.scene.add(this.sceneFloor)
    this.chunks = new ChunkManager(this.world, this.scene, this.physicsWorld, this.groundMaterial)
    this.dayNight = new DayNightCycle(this.scene)

    // Build the first ring of chunks around spawn before the first frame.
    this.chunks.update(2.5, 2.5)
  }

  initVehicle() {
    const spawn = { x: 2.5, y: 1.4, z: 2.5 }
    this.vehicle = new VehicleBase(DEFAULT_VEHICLE, this.scene, this.physicsWorld, this.wheelMaterial, spawn)

    // Wheel-ground contact (chassis bumps); raycast grip handled in CarPhysics.
    const contact = new CANNON.ContactMaterial(this.groundMaterial, this.wheelMaterial, {
      friction: 0.4,
      restitution: 0,
    })
    this.physicsWorld.addContactMaterial(contact)
  }

  initControlsAndUI() {
    this.cameraRig = new CameraRig(this.camera)

    this.player = new Player({
      onCameraToggle: () => this.cameraRig.next(),
      onLights: () => this.vehicle.toggleLights(),
      onHorn: () => this.horn(),
    })

    const maxSpeed = VEHICLE_CATEGORIES[DEFAULT_VEHICLE].maxSpeedKmh
    this.hud = new HUD(document.getElementById('hud'), maxSpeed)
    this.minimap = new Minimap(this.hud.minimapHost, this.world)

    this.mobile = new MobileControls(document.getElementById('mobile-controls'), this.player.input, {
      onCamera: () => this.cameraRig.next(),
      onLights: () => this.vehicle.toggleLights(),
      onHorn: () => this.horn(),
    })

    this.cameraRig.snap(this.vehicle)
  }

  horn() {
    try {
      const ctx = (this._audio = this._audio || new (window.AudioContext || window.webkitAudioContext)())
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 320
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.35)
    } catch (e) {
      console.warn('[Audio] horn failed', e)
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  loop() {
    requestAnimationFrame(this.loop)
    let dt = this.clock.getDelta()
    if (dt > 0.1) dt = 0.1 // avoid spiral after tab switch
    const time = this.clock.elapsedTime

    const input = this.player.getInput()

    // Vehicle systems + controls (applies forces for the upcoming step).
    this.vehicle.update(dt, input)

    // Fixed-step physics.
    this.accumulator += dt
    while (this.accumulator >= this.fixedStep) {
      this.physicsWorld.step(this.fixedStep)
      this.accumulator -= this.fixedStep
    }
    this.vehicle.syncMeshes()

    // World streaming + animation.
    const p = this.vehicle.position
    this.chunks.update(p.x, p.z)
    this.chunks.animate(time)
    this.dayNight.update(dt, new THREE.Vector3(p.x, 0, p.z))

    // Camera.
    this.cameraRig.update(this.vehicle, dt)

    // HUD + minimap.
    const tel = this.vehicle.getTelemetry()
    this.hud.update(tel, this.dayNight.getTimeString())
    const q = this.vehicle.quaternion
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w))
    const heading = Math.atan2(fwd.x, -fwd.z)
    this.minimap.update(p.x, p.z, heading)

    this.renderer.render(this.scene, this.camera)
  }
}

new Game()
