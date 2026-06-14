// ChunkManager.js — streams voxel chunks around the player. Each chunk renders
// three InstancedMeshes (ground, buildings, water) for performance, and creates
// static box colliders for buildings only in the chunks closest to the player.

import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { CHUNK_SIZE, RENDER_DISTANCE, TILES, TILE_COLORS, WATER_LEVEL } from '../../shared/constants.js'

const COLLISION_DISTANCE = 1 // chunks around player that get building colliders
const UNIT = new THREE.Object3D() // scratch object for matrix composition

export class ChunkManager {
  constructor(world, scene, physicsWorld, physicsMaterial) {
    this.world = world
    this.scene = scene
    this.physicsWorld = physicsWorld
    this.physicsMaterial = physicsMaterial

    this.chunks = new Map() // key -> chunk record
    this.waterMeshes = [] // for animation
    this.currentKey = null

    // Shared geometry/materials (reused by every chunk's instanced meshes).
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1)
    this.groundMat = new THREE.MeshLambertMaterial({ vertexColors: false })
    this.buildingMat = new THREE.MeshLambertMaterial({ vertexColors: false })
    this.waterMat = new THREE.MeshLambertMaterial({
      color: 0x2e6fb0,
      transparent: true,
      opacity: 0.78,
    })
  }

  key(cx, cz) {
    return `${cx},${cz}`
  }

  // Build all geometry + colliders for one chunk.
  buildChunk(cx, cz, withColliders) {
    const group = new THREE.Group()
    const bodies = []

    const baseX = cx * CHUNK_SIZE
    const baseZ = cz * CHUNK_SIZE

    // First pass: gather per-column data and counts.
    const ground = []
    const buildings = []
    const water = []
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = baseX + lx
        const z = baseZ + lz
        const col = this.world.getColumn(x, z)
        if (col.tile === TILES.WATER) {
          water.push({ x, z })
          // seabed ground tile beneath water for colour under the surface
          ground.push({ x, z, tile: TILES.DIRT })
        } else if (col.buildingHeight > 0) {
          buildings.push({ x, z, h: col.buildingHeight })
          ground.push({ x, z, tile: TILES.ROAD }) // pavement under building
        } else {
          ground.push({ x, z, tile: col.tile })
        }
      }
    }

    // Ground instanced mesh.
    const groundMesh = new THREE.InstancedMesh(this.boxGeo, this.groundMat, ground.length)
    const color = new THREE.Color()
    ground.forEach((g, i) => {
      UNIT.position.set(g.x + 0.5, -0.5, g.z + 0.5)
      UNIT.scale.set(1, 1, 1)
      UNIT.updateMatrix()
      groundMesh.setMatrixAt(i, UNIT.matrix)
      color.setHex(TILE_COLORS[g.tile])
      this.varyColor(color, g.x, g.z)
      groundMesh.setColorAt(i, color)
    })
    groundMesh.instanceMatrix.needsUpdate = true
    if (groundMesh.instanceColor) groundMesh.instanceColor.needsUpdate = true
    groundMesh.castShadow = false
    groundMesh.receiveShadow = true
    group.add(groundMesh)

    // Buildings instanced mesh.
    if (buildings.length) {
      const bMesh = new THREE.InstancedMesh(this.boxGeo, this.buildingMat, buildings.length)
      buildings.forEach((b, i) => {
        UNIT.position.set(b.x + 0.5, b.h / 2, b.z + 0.5)
        UNIT.scale.set(1, b.h, 1)
        UNIT.updateMatrix()
        bMesh.setMatrixAt(i, UNIT.matrix)
        color.setHex(TILE_COLORS[TILES.BUILDING])
        this.varyColor(color, b.x * 7 + b.h, b.z * 13)
        bMesh.setColorAt(i, color)
      })
      bMesh.instanceMatrix.needsUpdate = true
      if (bMesh.instanceColor) bMesh.instanceColor.needsUpdate = true
      bMesh.castShadow = true
      bMesh.receiveShadow = true
      group.add(bMesh)

      if (withColliders) {
        for (const b of buildings) {
          const shape = new CANNON.Box(new CANNON.Vec3(0.5, b.h / 2, 0.5))
          const body = new CANNON.Body({ mass: 0, material: this.physicsMaterial })
          body.addShape(shape)
          body.position.set(b.x + 0.5, b.h / 2, b.z + 0.5)
          this.physicsWorld.addBody(body)
          bodies.push(body)
        }
      }
    }

    // Water instanced mesh (thin slabs at the water surface).
    if (water.length) {
      const wMesh = new THREE.InstancedMesh(this.boxGeo, this.waterMat, water.length)
      water.forEach((wv, i) => {
        UNIT.position.set(wv.x + 0.5, WATER_LEVEL, wv.z + 0.5)
        UNIT.scale.set(1, 0.2, 1)
        UNIT.updateMatrix()
        wMesh.setMatrixAt(i, UNIT.matrix)
      })
      wMesh.instanceMatrix.needsUpdate = true
      group.add(wMesh)
      this.waterMeshes.push(wMesh)
    }

    this.scene.add(group)
    return { group, bodies, cx, cz, hasColliders: withColliders }
  }

  // Slight deterministic colour variation for a voxel look.
  varyColor(color, x, z) {
    const n = (((x * 73 + z * 151) % 17) / 17 - 0.5) * 0.12
    color.offsetHSL(0, 0, n)
  }

  removeChunk(rec) {
    this.scene.remove(rec.group)
    rec.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose()
    })
    // remove water meshes from animation list
    rec.group.children.forEach((c) => {
      const idx = this.waterMeshes.indexOf(c)
      if (idx >= 0) this.waterMeshes.splice(idx, 1)
    })
    for (const b of rec.bodies) this.physicsWorld.removeBody(b)
    rec.bodies.length = 0
  }

  addColliders(rec) {
    const baseX = rec.cx * CHUNK_SIZE
    const baseZ = rec.cz * CHUNK_SIZE
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = baseX + lx
        const z = baseZ + lz
        const col = this.world.getColumn(x, z)
        if (col.buildingHeight > 0) {
          const shape = new CANNON.Box(new CANNON.Vec3(0.5, col.buildingHeight / 2, 0.5))
          const body = new CANNON.Body({ mass: 0, material: this.physicsMaterial })
          body.addShape(shape)
          body.position.set(x + 0.5, col.buildingHeight / 2, z + 0.5)
          this.physicsWorld.addBody(body)
          rec.bodies.push(body)
        }
      }
    }
    rec.hasColliders = true
  }

  removeColliders(rec) {
    for (const b of rec.bodies) this.physicsWorld.removeBody(b)
    rec.bodies.length = 0
    rec.hasColliders = false
  }

  // Called every frame with the player's world position.
  update(worldX, worldZ) {
    const pcx = Math.floor(worldX / CHUNK_SIZE)
    const pcz = Math.floor(worldZ / CHUNK_SIZE)
    const key = this.key(pcx, pcz)
    if (key === this.currentKey) return
    this.currentKey = key

    const needed = new Set()
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const cx = pcx + dx
        const cz = pcz + dz
        const k = this.key(cx, cz)
        needed.add(k)
        const within = Math.max(Math.abs(dx), Math.abs(dz)) <= COLLISION_DISTANCE
        let rec = this.chunks.get(k)
        if (!rec) {
          rec = this.buildChunk(cx, cz, within)
          this.chunks.set(k, rec)
        } else if (within && !rec.hasColliders) {
          this.addColliders(rec)
        } else if (!within && rec.hasColliders) {
          this.removeColliders(rec)
        }
      }
    }

    // Unload chunks no longer needed.
    for (const [k, rec] of this.chunks) {
      if (!needed.has(k)) {
        this.removeChunk(rec)
        this.chunks.delete(k)
      }
    }
    console.log(`[ChunkManager] active chunks: ${this.chunks.size}`)
  }

  // Animate water surface bob.
  animate(time) {
    const y = WATER_LEVEL + Math.sin(time * 1.5) * 0.06
    for (const m of this.waterMeshes) m.position.y = y - WATER_LEVEL
  }
}
