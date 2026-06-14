// Shared constants for Voxel Horizon.
// Code in English, UI strings in Greek (see HUD).

// Voxel tile types.
export const TILES = {
  ROAD: 0, // asphalt — grey
  GRASS: 1, // grass — green
  BUILDING: 2, // building — grey/blue
  WATER: 3, // water — blue, animated
  SAND: 4, // sand — yellow
  DIRT: 5, // dirt — brown
  SNOW: 6, // snow — white
  ROCK: 7, // rock — dark grey
}

// Base colours per tile (hex). Slight per-instance variation added at build time.
export const TILE_COLORS = {
  [TILES.ROAD]: 0x3a3d42,
  [TILES.GRASS]: 0x4f8f3f,
  [TILES.BUILDING]: 0x6b7689,
  [TILES.WATER]: 0x2e6fb0,
  [TILES.SAND]: 0xd9c27a,
  [TILES.DIRT]: 0x8a6240,
  [TILES.SNOW]: 0xf0f4f8,
  [TILES.ROCK]: 0x4b4f55,
}

// World/chunk configuration.
export const CHUNK_SIZE = 16 // voxels per chunk edge (x/z)
export const RENDER_DISTANCE = 5 // chunks around the player
export const VOXEL_SIZE = 1 // world units per voxel
export const WATER_LEVEL = -0.6 // visual water surface (below ground top at y=0)

// Road grid layout (Metropolis style): roads carved on a repeating grid.
export const BLOCK_SIZE = 24 // distance between road centrelines
export const ROAD_WIDTH = 5 // width of a road in voxels

// Keyboard mapping (KeyboardEvent.code values).
export const CONTROLS = {
  ACCELERATE: ['KeyW', 'ArrowUp'],
  BRAKE: ['KeyS', 'ArrowDown'],
  LEFT: ['KeyA', 'ArrowLeft'],
  RIGHT: ['KeyD', 'ArrowRight'],
  HANDBRAKE: ['Space'],
  CAMERA: ['KeyC'],
  ENTER_EXIT: ['KeyE'],
  RUN: ['ShiftLeft'],
  HORN: ['KeyH'],
  LIGHTS: ['KeyL'],
}

// Day/night timing.
export const DAY = {
  START_MINUTES: 8 * 60, // start at 08:00
  REAL_SECONDS_PER_DAY: 30 * 60, // 30 real minutes = 24 game hours
}
