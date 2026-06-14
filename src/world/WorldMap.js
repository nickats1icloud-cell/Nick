// WorldMap.js — procedural voxel world. Ground top sits at y = 0 everywhere so
// the flat physics ground plane matches the visuals. Variation is expressed
// through tile type (colour), water lakes, and building columns (which get box
// colliders in ChunkManager). This keeps Phase 1 driving robust while still
// looking like a varied voxel city/landscape.

import { createNoise2D } from 'simplex-noise'
import { TILES, BLOCK_SIZE, ROAD_WIDTH } from '../../shared/constants.js'
import { getRegion, getRegionData } from './Regions.js'

// Small deterministic hash -> [0,1) so generation is stable across chunk reloads.
function hash2(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0
  h = (h ^ (h >> 13)) * 1274126177
  h = h ^ (h >> 16)
  return ((h >>> 0) % 100000) / 100000
}

export class WorldMap {
  constructor(seed = 1337) {
    // simplex-noise v4: createNoise2D takes a PRNG; we seed it deterministically.
    let s = seed >>> 0
    const rng = () => {
      // mulberry32
      s |= 0
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    this.noiseElevation = createNoise2D(rng)
    this.noiseDetail = createNoise2D(rng)
    this.noiseRegionA = createNoise2D(rng)
    this.noiseRegionB = createNoise2D(rng)
    this.noiseWater = createNoise2D(rng)
  }

  regionAt(x, z) {
    return getRegion(x, z, this.noiseRegionA, this.noiseRegionB)
  }

  // Is this column part of the road grid?
  isRoad(x, z) {
    const mx = ((x % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE
    const mz = ((z % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE
    return mx < ROAD_WIDTH || mz < ROAD_WIDTH
  }

  // Full description of a world column at integer (x, z).
  // Returns { tile, buildingHeight } where buildingHeight === 0 means none.
  getColumn(x, z) {
    if (this.isRoad(x, z)) {
      return { tile: TILES.ROAD, buildingHeight: 0 }
    }

    const region = this.regionAt(x, z)
    const data = getRegionData(region)

    // Water lakes / sea: low water-noise carves water bodies (stronger where the
    // region's accent is water).
    const w = this.noiseWater(x * 0.012, z * 0.012)
    const waterBias = data.accent === TILES.WATER ? 0.25 : -0.55
    if (w + waterBias > 0.45) {
      return { tile: TILES.WATER, buildingHeight: 0 }
    }

    // Buildings: only on "block interior" cells, scattered by urban density.
    const insideBlockX = (((x % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE) >= ROAD_WIDTH + 1
    const insideBlockZ = (((z % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE) >= ROAD_WIDTH + 1
    if (insideBlockX && insideBlockZ) {
      const r = hash2(x, z)
      if (r < data.urban) {
        // Building footprints clump: use coarse cell so neighbours share height.
        const cellH = hash2(Math.floor(x / 3), Math.floor(z / 3))
        const height = Math.max(2, Math.floor(2 + cellH * data.buildingMax))
        return { tile: TILES.BUILDING, buildingHeight: height }
      }
    }

    // Otherwise ground tile, with accent sprinkle driven by detail noise.
    const d = this.noiseDetail(x * 0.06, z * 0.06)
    let tile = data.ground
    if (data.accent !== TILES.WATER && d > 0.55) tile = data.accent
    return { tile, buildingHeight: 0 }
  }
}
