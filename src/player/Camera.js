// Camera.js — three follow cameras: Chase, Hood, Top-down. Press C to cycle.

import * as THREE from 'three'

export const CAMERA_MODES = ['chase', 'hood', 'topdown']
export const CAMERA_LABELS = { chase: 'Καταδίωξη', hood: 'Καπό', topdown: 'Από πάνω' }

export class CameraRig {
  constructor(camera) {
    this.camera = camera
    this.modeIndex = 0
    this._pos = new THREE.Vector3()
    this._look = new THREE.Vector3()
    this._tmp = new THREE.Vector3()
  }

  get mode() {
    return CAMERA_MODES[this.modeIndex]
  }

  next() {
    this.modeIndex = (this.modeIndex + 1) % CAMERA_MODES.length
    console.log(`[Camera] mode: ${this.mode}`)
    return this.mode
  }

  // vehicle exposes .position (CANNON.Vec3) and .quaternion (CANNON.Quaternion).
  update(vehicle, dt) {
    const p = vehicle.position
    const q = vehicle.quaternion
    const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w)
    const carPos = this._tmp.set(p.x, p.y, p.z)

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat)
    const up = new THREE.Vector3(0, 1, 0)

    if (this.mode === 'chase') {
      const desired = carPos
        .clone()
        .addScaledVector(forward, -7)
        .addScaledVector(up, 3.4)
      // Smooth follow.
      const lerp = 1 - Math.pow(0.001, dt)
      this._pos.lerp(desired, THREE.MathUtils.clamp(lerp, 0, 1))
      this.camera.position.copy(this._pos)
      this._look.lerp(carPos.clone().addScaledVector(forward, 4), 0.3)
      this.camera.lookAt(this._look)
    } else if (this.mode === 'hood') {
      const pos = carPos.clone().addScaledVector(forward, 1.2).addScaledVector(up, 1.1)
      this.camera.position.copy(pos)
      this.camera.lookAt(carPos.clone().addScaledVector(forward, 12).addScaledVector(up, 0.8))
      this._pos.copy(pos)
    } else {
      // top-down
      const pos = carPos.clone().addScaledVector(up, 30).addScaledVector(forward, 0.01)
      this.camera.position.copy(pos)
      this.camera.lookAt(carPos)
      this._pos.copy(pos)
    }
  }

  // Snap instantly (used on first frame / respawn).
  snap(vehicle) {
    this.update(vehicle, 1)
    this._pos.copy(this.camera.position)
  }
}
