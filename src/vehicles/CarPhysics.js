// CarPhysics.js — Cannon-es RaycastVehicle wrapper giving a simcade feel.
// Forward axis is local +Z, up is +Y, right is +X. Rear-wheel drive.

import * as CANNON from 'cannon-es'

const WHEEL_RADIUS = 0.36

export class CarPhysics {
  constructor(spec, physicsWorld, wheelMaterial, spawn = { x: 4, y: 2, z: 4 }) {
    this.spec = spec
    this.world = physicsWorld

    const { w, h, l } = spec.chassis
    const chassisShape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, l / 2))
    this.chassisBody = new CANNON.Body({ mass: spec.mass })
    // Lower the centre of mass for stability.
    this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0, 0))
    this.chassisBody.position.set(spawn.x, spawn.y, spawn.z)
    this.chassisBody.angularDamping = 0.4

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    })

    const wheelOptions = {
      radius: WHEEL_RADIUS,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: spec.suspensionStiffness,
      suspensionRestLength: spec.suspensionRestLength,
      frictionSlip: spec.frictionSlip,
      dampingRelaxation: spec.suspensionDamping,
      dampingCompression: spec.suspensionCompression,
      maxSuspensionForce: 100000,
      rollInfluence: spec.rollInfluence,
      // Axle along the local +X (right) axis; with +Z forward this makes
      // positive steering = left turn (A/Left). Flip the sign here if steering
      // ever feels inverted on your setup.
      axleLocal: new CANNON.Vec3(1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    }

    const xOff = w / 2
    const zOff = l / 2 - 0.6
    const yOff = -h / 2 + 0.1
    // FL, FR, RL, RR (matches TireSystem ordering)
    const connections = [
      new CANNON.Vec3(xOff, yOff, zOff),
      new CANNON.Vec3(-xOff, yOff, zOff),
      new CANNON.Vec3(xOff, yOff, -zOff),
      new CANNON.Vec3(-xOff, yOff, -zOff),
    ]
    for (const c of connections) {
      wheelOptions.chassisConnectionPointLocal.copy(c)
      this.vehicle.addWheel({ ...wheelOptions })
    }

    this.vehicle.addToWorld(physicsWorld)

    // Assign a friction material to each wheel's collision (handled via grip).
    this.baseFriction = spec.frictionSlip
    this.wheelMaterial = wheelMaterial

    this.frontWheels = [0, 1]
    this.rearWheels = [2, 3]
  }

  // throttle/brake 0..1, steer -1..1, handbrake bool, gripMul ~0.5..1.15,
  // engineForce already power-scaled by the gearbox/engine.
  applyControls(throttle, brake, steer, handbrake, gripMul, engineForce) {
    // Grip: scale each wheel's friction by the tire grip multiplier.
    const grip = this.baseFriction * gripMul
    for (let i = 0; i < 4; i++) {
      this.vehicle.wheelInfos[i].frictionSlip = handbrake && i >= 2 ? grip * 0.35 : grip
    }

    // Steering on the front axle.
    const steerAngle = steer * this.spec.maxSteerAngle
    for (const i of this.frontWheels) this.vehicle.setSteeringValue(steerAngle, i)

    // Drive the rear wheels. With this wheel/axle config a positive engine force
    // pushes toward local -Z, so we negate to drive toward +Z (the headlights /
    // camera-forward direction). Reverse uses a negative throttle.
    const force = throttle * engineForce
    for (const i of this.rearWheels) this.vehicle.applyEngineForce(-force, i)

    // Braking: service brakes on all, handbrake locks the rear.
    const brakeForce = brake * this.spec.brakeForce
    for (let i = 0; i < 4; i++) this.vehicle.setBrake(brakeForce, i)
    if (handbrake) {
      for (const i of this.rearWheels) this.vehicle.setBrake(this.spec.brakeForce * 1.4, i)
    }
  }

  getSpeed() {
    // m/s along the chassis forward axis.
    const v = this.chassisBody.velocity
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  }

  getForwardSpeed() {
    const forward = new CANNON.Vec3(0, 0, 1)
    this.chassisBody.quaternion.vmult(forward, forward)
    return this.chassisBody.velocity.dot(forward)
  }

  updateWheelTransforms() {
    for (let i = 0; i < 4; i++) this.vehicle.updateWheelTransform(i)
  }

  getChassisTransform() {
    return { position: this.chassisBody.position, quaternion: this.chassisBody.quaternion }
  }

  getWheelTransform(i) {
    return this.vehicle.wheelInfos[i].worldTransform
  }

  reset(spawn) {
    this.chassisBody.position.set(spawn.x, spawn.y, spawn.z)
    this.chassisBody.velocity.setZero()
    this.chassisBody.angularVelocity.setZero()
    this.chassisBody.quaternion.set(0, 0, 0, 1)
  }
}
