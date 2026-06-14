// EngineSystem.js — temperature, oil, coolant, fuel, RPM and health with a few
// progressive faults. Produces a power multiplier (0..1) that CarPhysics uses to
// scale engine force, plus OBD-style fault codes for the HUD/diagnostics.

const AMBIENT = 20

export class EngineSystem {
  constructor(spec) {
    this.spec = spec
    this.temperature = AMBIENT // °C — optimal 85..105, danger 120+
    this.oilLevel = 100 // %
    this.oilQuality = 100 // % — degrades with use
    this.coolantLevel = 100 // %
    this.fuelLevel = 100 // % of capacity
    this.rpm = 0
    this.health = 100

    this.faults = {
      oilLeak: false,
      coolantLeak: false,
      turboFailure: false,
      headGasket: false,
      timingBelt: false,
    }
  }

  // dt seconds, throttle 0..1, rpm current engine rpm, odometerKm for wear-age.
  update(dt, throttle, rpm, odometerKm) {
    this.rpm = rpm

    // Thermal model: load + rpm heat the engine; coolant + airflow cool it.
    // Tuned so the engine settles around 85-105°C in normal driving and only
    // creeps into the danger zone under sustained high load / low coolant.
    const load = throttle * (rpm / this.spec.redline)
    const heatIn = 12 + load * 42
    const coolingEff = (this.coolantLevel / 100) * (this.faults.headGasket ? 0.5 : 1)
    // Thermostat: weak cooling below ~88°C (warm-up + holds operating temp),
    // full cooling above it. Sustained high load can still exceed capacity.
    const thermostat = this.temperature < 88 ? 0.2 : 1
    const heatOut = (this.temperature - AMBIENT) * 0.6 * (0.5 + 0.5 * coolingEff) * thermostat
    this.temperature += (heatIn - heatOut) * dt
    this.temperature = Math.max(AMBIENT, this.temperature)

    // Oil degrades; leaks drain level.
    this.degradeOil(dt, load)
    if (this.faults.oilLeak) this.oilLevel = Math.max(0, this.oilLevel - 0.4 * dt)
    if (this.faults.coolantLeak) this.coolantLevel = Math.max(0, this.coolantLevel - 0.5 * dt)

    this.consumeFuel(dt, load)
    this.checkOverheat(dt)
    this.rollFaults(odometerKm)
  }

  consumeFuel(dt, load) {
    // ~ idle + load consumption, expressed as % of tank per second.
    const litresPerSec = 0.0009 + load * 0.012
    const pct = (litresPerSec / this.spec.fuelCapacity) * 100
    this.fuelLevel = Math.max(0, this.fuelLevel - pct * dt)
  }

  degradeOil(dt, load) {
    this.oilQuality = Math.max(0, this.oilQuality - (0.02 + load * 0.05) * dt)
    // Low oil quality slowly damages the engine.
    if (this.oilQuality < 20) this.health = Math.max(0, this.health - 0.05 * dt)
  }

  checkOverheat(dt) {
    if (this.temperature > 120) {
      const over = (this.temperature - 120) / 30
      this.health = Math.max(0, this.health - over * 2 * dt)
      if (this.temperature > 130 && Math.random() < 0.01) {
        this.faults.headGasket = true
        console.warn('[Engine] head gasket failed from overheating')
      }
    }
  }

  rollFaults(odometerKm) {
    // Timing belt wears out between 60k and 100k km.
    if (!this.faults.timingBelt && odometerKm > 60000) {
      const risk = (odometerKm - 60000) / 40000 // 0..1 over 40k km window
      if (Math.random() < risk * 0.00005) {
        this.faults.timingBelt = true
        this.health = Math.max(0, this.health - 60)
        console.warn('[Engine] timing belt snapped!')
      }
    }
  }

  // 0..1 multiplier applied to engine force.
  getPowerMultiplier() {
    if (this.fuelLevel <= 0) return 0
    if (this.faults.timingBelt) return 0
    let m = 1
    if (this.temperature > 120) m *= 0.6 // limp mode when overheating
    if (this.oilLevel < 20) m *= 0.7
    if (this.faults.turboFailure) m *= 0.75
    m *= 0.5 + (this.health / 100) * 0.5
    return Math.max(0, m)
  }

  getFaultCodes() {
    const codes = []
    if (this.faults.oilLeak) codes.push('P0520') // oil pressure
    if (this.faults.coolantLeak) codes.push('P0128') // coolant
    if (this.faults.turboFailure) codes.push('P0299') // turbo underboost
    if (this.faults.headGasket) codes.push('P0217') // overheat
    if (this.faults.timingBelt) codes.push('P0016') // timing
    if (this.temperature > 120) codes.push('P0217')
    if (this.oilLevel < 20) codes.push('P0524')
    return [...new Set(codes)]
  }

  service() {
    this.oilLevel = 100
    this.oilQuality = 100
    this.coolantLevel = 100
    this.faults.oilLeak = false
    this.faults.coolantLeak = false
    console.log('[Engine] serviced: oil + coolant restored')
  }

  refuel() {
    this.fuelLevel = 100
  }
}
