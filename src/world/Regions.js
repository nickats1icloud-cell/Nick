// Regions.js — defines the 6 biomes of Voxel Horizon and decides which biome a
// given world coordinate belongs to, using large-scale noise so regions form
// continuous blobs rather than a rigid grid.

import { TILES } from '../../shared/constants.js'

export const REGIONS = {
  METROPOLIS: 'metropolis',
  RIVIERA: 'riviera',
  ALPINE: 'alpine',
  DESERT: 'desert',
  RURAL: 'rural',
  INDUSTRIAL: 'industrial',
}

// Per-region surface parameters. `ground` is the dominant tile, `accent` is a
// secondary tile sprinkled in, `urban` controls how many buildings spawn.
export const REGION_DATA = {
  [REGIONS.METROPOLIS]: { label: 'Metropolis', ground: TILES.GRASS, accent: TILES.ROAD, urban: 0.85, buildingMax: 16 },
  [REGIONS.RIVIERA]: { label: 'Riviera Coast', ground: TILES.SAND, accent: TILES.WATER, urban: 0.18, buildingMax: 6 },
  [REGIONS.ALPINE]: { label: 'Alpine Peaks', ground: TILES.SNOW, accent: TILES.ROCK, urban: 0.05, buildingMax: 4 },
  [REGIONS.DESERT]: { label: 'Desert Badlands', ground: TILES.SAND, accent: TILES.ROCK, urban: 0.08, buildingMax: 5 },
  [REGIONS.RURAL]: { label: 'Rural Heartlands', ground: TILES.GRASS, accent: TILES.DIRT, urban: 0.25, buildingMax: 5 },
  [REGIONS.INDUSTRIAL]: { label: 'Industrial Port', ground: TILES.DIRT, accent: TILES.WATER, urban: 0.6, buildingMax: 8 },
}

const ORDER = [
  REGIONS.METROPOLIS,
  REGIONS.RIVIERA,
  REGIONS.ALPINE,
  REGIONS.DESERT,
  REGIONS.RURAL,
  REGIONS.INDUSTRIAL,
]

// Spatial scale of biomes: larger value => bigger regions.
const REGION_SCALE = 0.0016

// Decide the region for a world (x, z) using two low-frequency noise fields.
// Spawn (near origin) is forced to Metropolis so the player always starts in
// the city with a clean road grid.
export function getRegion(x, z, noiseA, noiseB) {
  if (Math.abs(x) < 160 && Math.abs(z) < 160) return REGIONS.METROPOLIS

  const a = (noiseA(x * REGION_SCALE, z * REGION_SCALE) + 1) / 2 // 0..1
  const b = (noiseB(x * REGION_SCALE, z * REGION_SCALE) + 1) / 2 // 0..1
  // Combine into an index across the 6 regions.
  const idx = Math.floor(((a * 0.6 + b * 0.4) * ORDER.length)) % ORDER.length
  return ORDER[idx]
}

export function getRegionData(region) {
  return REGION_DATA[region]
}
