// TireSystem.js — four tires with wear, temperature and pressure that affect
// grip. Heat builds from slip (throttle/brake/handbrake/speed) and bleeds off at
// rest. Below 20% wear or far from ideal temperature, grip drops; extreme heat
// or near-zero wear can cause a blowout.

// type -> { coldGrip, hotGrip, wearRate, idealTemp:[min,max] }
export const TIRE_TYPES = {
  street: { coldGrip: 0.75, hotGrip: 0.85, wearRate: 0.6, idealTemp: [60, 80] },
  sport: { coldGrip: 0.7, hotGrip: 0.95, wearRate: 1.0, idealTemp: [70, 90] },
  'semi-slick': { coldGrip: 0.6, hotGrip: 1.05, wearRate: 1.6, idealTemp: [80, 100] },
  slick: { coldGrip: 0.55, hotGrip: 1.12, wearRate: 1.8, idealTemp: [85, 105] },
  drag: { coldGrip: 0.5, hotGrip: 1.15, wearRate: 2.2, idealTemp: [90, 110] },
  drift: { coldGrip: 0.65, hotGrip: 0.8, wearRate: 2.2, idealTemp: [70, 90] },
  offroad: { coldGrip: 0.8, hotGrip: 0.82, wearRate: 0.8, idealTemp: [50, 80] },
  winter: { coldGrip: 0.85, hotGrip: 0.6, wearRate: 0.6, idealTemp: [0, 20] },
}

const AMBIENT = 20
const BLOWOUT_TEMP = 145

export class TireSystem {
  constructor(type = 'sport') {
    this.type = type
    // FL, FR, RL, RR
    this.tires = Array.from({ length: 4 }, () => ({
      wear: 100, // %
      temperature: AMBIENT, // °C
      pressure: 32, // PSI
      blownOut: false,
    }))
  }

  get spec() {
    return TIRE_TYPES[this.type] || TIRE_TYPES.sport
  }

  setType(type) {
    if (TIRE_TYPES[type]) this.type = type
  }

  // dt seconds, speed m/s, inputs 0..1 (handbrake boolean-ish).
  update(dt, speed, throttle, brake, handbrake) {
    const spec = this.spec
    const speedKmh = Math.abs(speed) * 3.6
    // Slip-driven heat: rear tires heat more under throttle, all under braking.
    // Tuned so hard driving settles near the ideal window (~90°C) rather than
    // overheating in seconds.
    const baseHeat = (speedKmh / 200) * 10 // rolling heat
    const driveHeat = throttle * 15
    const brakeHeat = brake * 18
    const handHeat = handbrake ? 35 : 0

    this.tires.forEach((t, i) => {
      if (t.blownOut) return
      const rear = i >= 2
      const heatIn =
        baseHeat + (rear ? driveHeat : driveHeat * 0.4) + brakeHeat + (rear ? handHeat : handHeat * 0.3)
      // Newton-like cooling toward ambient.
      const cool = (t.temperature - AMBIENT) * 0.3
      t.temperature += (heatIn - cool) * dt
      t.temperature = Math.max(AMBIENT, t.temperature)

      // Wear: proportional to usage and heat, scaled by tire type wear rate.
      const usage = (speedKmh / 100) * (0.4 + throttle * 0.6 + brake * 0.8 + (handbrake ? 1.5 : 0))
      t.wear -= usage * spec.wearRate * 0.02 * dt
      t.wear = Math.max(0, t.wear)

      // Slow pressure rise with temperature (hot air expands).
      t.pressure = 32 + (t.temperature - AMBIENT) * 0.06
    })

    return this.checkBlowout()
  }

  // Per-tire grip 0..~1.15. Combined multiplier is the average.
  tireGrip(t) {
    if (t.blownOut) return 0.25
    const spec = this.spec
    const [lo, hi] = spec.idealTemp
    let tempFactor
    if (t.temperature < lo) {
      // interpolate cold->hot up to ideal
      const f = Math.max(0, t.temperature - AMBIENT) / Math.max(1, lo - AMBIENT)
      tempFactor = spec.coldGrip + (spec.hotGrip - spec.coldGrip) * f
    } else if (t.temperature <= hi) {
      tempFactor = spec.hotGrip
    } else {
      // overheating loses grip beyond the ideal window
      const over = (t.temperature - hi) / 50
      tempFactor = spec.hotGrip * Math.max(0.5, 1 - over * 0.5)
    }

    // Wear penalty below 20%.
    const wearFactor = t.wear >= 20 ? 1 : 0.55 + (t.wear / 20) * 0.45

    // Pressure penalty away from 28..35.
    let pressFactor = 1
    if (t.pressure < 28) pressFactor = 0.9
    else if (t.pressure > 35) pressFactor = 0.93

    return tempFactor * wearFactor * pressFactor
  }

  getGripMultiplier() {
    const sum = this.tires.reduce((acc, t) => acc + this.tireGrip(t), 0)
    return sum / this.tires.length
  }

  checkBlowout() {
    for (let i = 0; i < this.tires.length; i++) {
      const t = this.tires[i]
      if (t.blownOut) continue
      if (t.temperature > BLOWOUT_TEMP || t.wear < 5) {
        // probabilistic blowout when in the danger zone
        if (Math.random() < 0.02) {
          t.blownOut = true
          console.warn(`[TireSystem] Blowout on tire ${i}! temp=${t.temperature.toFixed(0)} wear=${t.wear.toFixed(1)}`)
          return i
        }
      }
    }
    return null
  }

  getTemps() {
    return this.tires.map((t) => t.temperature)
  }

  getWears() {
    return this.tires.map((t) => t.wear)
  }

  repairAll() {
    this.tires.forEach((t) => {
      t.wear = 100
      t.temperature = AMBIENT
      t.pressure = 32
      t.blownOut = false
    })
    console.log('[TireSystem] all tires replaced')
  }
}
