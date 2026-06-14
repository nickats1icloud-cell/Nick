// VehicleBase.js — orchestrates physics + tires + engine + an automatic gearbox
// + odometer, and builds/syncs the Three.js meshes. Exposes telemetry for the HUD.

import * as THREE from 'three'
import { CarPhysics } from './CarPhysics.js'
import { TireSystem } from './TireSystem.js'
import { EngineSystem } from './EngineSystem.js'
import { VEHICLE_CATEGORIES } from './VehicleData.js'

export class VehicleBase {
  constructor(category, scene, physicsWorld, wheelMaterial, spawn) {
    this.spec = VEHICLE_CATEGORIES[category]
    this.scene = scene

    this.physics = new CarPhysics(this.spec, physicsWorld, wheelMaterial, spawn)
    this.tires = new TireSystem('sport')
    this.engine = new EngineSystem(this.spec)

    // Drivetrain state.
    this.gear = 1 // 1..N (gearRatios length)
    this.rpm = this.spec.idleRpm
    this.odometer = 0 // km
    this.serviceHistory = []
    this.lastServiceKm = 0
    this.serviceIntervals = { oilChange: 5000, tireRotation: 10000, brakes: 30000, timingBelt: 80000 }

    this.lightsOn = false

    this.buildMeshes()
  }

  buildMeshes() {
    const { w, h, l } = this.spec.chassis
    this.group = new THREE.Group()

    // Body — blocky voxel-ish car.
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.spec.color })
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), bodyMat)
    body.castShadow = true
    this.group.add(body)

    // Cabin.
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x223044 })
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, h * 0.7, l * 0.42), cabinMat)
    cabin.position.set(0, h * 0.72, -l * 0.05)
    cabin.castShadow = true
    this.group.add(cabin)

    // Headlights (emissive blocks at the front, +Z).
    this.headlightMat = new THREE.MeshStandardMaterial({
      color: 0xfff2c0,
      emissive: 0x000000,
      emissiveIntensity: 1,
    })
    for (const sx of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), this.headlightMat)
      hl.position.set(sx * w * 0.3, 0, l / 2 + 0.02)
      this.group.add(hl)
    }

    this.scene.add(this.group)

    // Wheels — cylinders with axle along local X.
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 16)
    wheelGeo.rotateZ(Math.PI / 2)
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111317 })
    this.wheelMeshes = []
    for (let i = 0; i < 4; i++) {
      const wm = new THREE.Mesh(wheelGeo, wheelMat)
      wm.castShadow = true
      this.scene.add(wm)
      this.wheelMeshes.push(wm)
    }
  }

  // Automatic gearbox: derive engine rpm from forward speed and current gear,
  // shifting up/down to keep rpm in band.
  updateGearbox(fSpeed, throttle) {
    const ratios = this.spec.gearRatios
    const wheelCircumference = 2 * Math.PI * 0.36
    const wheelRps = Math.abs(fSpeed) / wheelCircumference
    const compute = (g) => wheelRps * ratios[g - 1] * this.spec.finalDrive * 60

    let rpm = compute(this.gear)
    if (rpm > this.spec.redline * 0.92 && this.gear < ratios.length) {
      this.gear++
      rpm = compute(this.gear)
    } else if (rpm < this.spec.idleRpm * 1.6 && this.gear > 1) {
      this.gear--
      rpm = compute(this.gear)
    }

    if (Math.abs(fSpeed) < 2) {
      // Idling / revving in place.
      this.gear = 1
      rpm = this.spec.idleRpm + throttle * (this.spec.redline - this.spec.idleRpm) * 0.45
    }
    this.rpm = THREE.MathUtils.clamp(rpm, this.spec.idleRpm, this.spec.redline)
  }

  // Torque curve factor 0..1 peaking around 60% of redline.
  torqueFactor() {
    const peak = this.spec.redline * 0.6
    const f = 1 - Math.abs(this.rpm - peak) / this.spec.redline
    return THREE.MathUtils.clamp(f, 0.35, 1)
  }

  update(dt, input) {
    const fSpeed = this.physics.getForwardSpeed() // m/s, signed
    const speedKmh = Math.abs(fSpeed) * 3.6

    // Resolve pedals into a signed throttle + brake (intuitive auto reverse).
    let throttle = 0
    let brake = 0
    if (fSpeed > 1) {
      throttle = input.accelerate ? 1 : 0
      brake = input.brake ? 1 : 0
    } else if (fSpeed < -1) {
      throttle = input.brake ? -1 : 0
      brake = input.accelerate ? 1 : 0
    } else {
      if (input.accelerate) throttle = 1
      else if (input.brake) throttle = -1
    }

    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0)
    const handbrake = !!input.handbrake

    this.updateGearbox(fSpeed, Math.abs(throttle))

    // Systems.
    this.engine.update(dt, Math.abs(throttle), this.rpm, this.odometer)
    const blowout = this.tires.update(dt, fSpeed, Math.abs(throttle), brake, handbrake)
    if (blowout !== null) console.warn(`[Vehicle] handling affected by blowout #${blowout}`)

    // Engine force: base * gear * torque curve * engine power, tapered near Vmax.
    const ratios = this.spec.gearRatios
    const gearFactor = ratios[this.gear - 1] / ratios[0]
    let force = this.spec.engineForce * (0.5 + gearFactor * 0.5) * this.torqueFactor()
    force *= this.engine.getPowerMultiplier()
    if (speedKmh > this.spec.maxSpeedKmh) force = 0

    const grip = this.tires.getGripMultiplier()
    this.physics.applyControls(throttle, brake, steer, handbrake, grip, force)

    // Odometer: integrate distance travelled.
    this.odometer += (Math.abs(fSpeed) * dt) / 1000 // km

    this.syncMeshes()
    this.updateLights()
  }

  syncMeshes() {
    const t = this.physics.getChassisTransform()
    this.group.position.copy(t.position)
    this.group.quaternion.copy(t.quaternion)

    this.physics.updateWheelTransforms()
    for (let i = 0; i < 4; i++) {
      const wt = this.physics.getWheelTransform(i)
      this.wheelMeshes[i].position.copy(wt.position)
      this.wheelMeshes[i].quaternion.copy(wt.quaternion)
    }
  }

  updateLights() {
    this.headlightMat.emissive.setHex(this.lightsOn ? 0xfff2c0 : 0x000000)
  }

  toggleLights() {
    this.lightsOn = !this.lightsOn
    console.log(`[Vehicle] lights ${this.lightsOn ? 'on' : 'off'}`)
  }

  // ---- Telemetry for the HUD ----
  getTelemetry() {
    return {
      speedKmh: Math.abs(this.physics.getForwardSpeed()) * 3.6,
      gear: Math.abs(this.physics.getForwardSpeed()) < 1 && !this.movingForward() ? 'N' : this.gear,
      rpm: this.rpm,
      redline: this.spec.redline,
      odometer: this.odometer,
      fuel: this.engine.fuelLevel,
      engineTemp: this.engine.temperature,
      engineHealth: this.engine.health,
      tireTemps: this.tires.getTemps(),
      tireWears: this.tires.getWears(),
      faults: this.engine.getFaultCodes(),
      lightsOn: this.lightsOn,
    }
  }

  movingForward() {
    return this.physics.getForwardSpeed() > 0.2
  }

  get position() {
    return this.physics.chassisBody.position
  }

  get quaternion() {
    return this.physics.chassisBody.quaternion
  }
}
