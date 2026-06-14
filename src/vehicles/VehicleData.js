// VehicleData.js — stats for each vehicle category. Phase 1 ships a single
// hatchback/sport car, but the structure supports more categories later.

export const VEHICLE_CATEGORIES = {
  sport: {
    label: 'Sport Coupe',
    mass: 1400, // kg
    engineForce: 9000, // N at full throttle (pre tire/engine modifiers)
    brakeForce: 55,
    maxSteerAngle: 0.55, // radians
    suspensionStiffness: 32,
    suspensionRestLength: 0.32,
    suspensionDamping: 2.4,
    suspensionCompression: 4.0,
    frictionSlip: 2.6, // base tire grip (scaled by TireSystem)
    rollInfluence: 0.06,
    maxSpeedKmh: 240,
    gearRatios: [3.4, 2.3, 1.7, 1.3, 1.0, 0.82],
    finalDrive: 3.7,
    redline: 7200, // rpm
    idleRpm: 850,
    fuelCapacity: 55, // litres
    chassis: { w: 1.9, h: 0.7, l: 4.2 },
    color: 0xd23b3b,
  },
}

export const DEFAULT_VEHICLE = 'sport'
