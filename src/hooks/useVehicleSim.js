import { useEffect, useRef, useState } from 'react'

/**
 * Προσομοίωση οχήματος για το ψηφιακό καντράν.
 *
 * Δεν είναι πραγματικό φυσικό μοντέλο — είναι αρκετά ρεαλιστικό ώστε τα όργανα
 * να αντιδρούν πειστικά όταν "οδηγείς". Όλη η κατάσταση ενημερώνεται σε έναν
 * βρόχο requestAnimationFrame και επιστρέφεται ως plain object.
 *
 * Έλεγχοι (controls): boolean flags που τα ανεβάζει/κατεβάζει το UI.
 *   - throttle: πατημένο γκάζι
 *   - brake: πατημένο φρένο
 */

export const REDLINE_RPM = 7200
export const MAX_RPM = 8000
export const MAX_SPEED = 220 // km/h στο όργανο
export const MAX_BOOST = 1.2 // bar

// Σχέση στροφών ανά km/h για κάθε σχέση μετάδοσης (τελική + κιβώτιο).
const GEAR_RATIOS = [110, 70, 48, 36, 28] // rpm ανά km/h
const SHIFT_UP_RPM = 6200
const SHIFT_DOWN_RPM = 2200
const IDLE_RPM = 850

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

const initialState = {
  ignition: true,
  speed: 0, // km/h
  rpm: IDLE_RPM,
  gear: 1, // 0 = N
  throttle: 0, // 0..1 (smoothed)
  coolant: 40, // °C
  fuel: 72, // % stage
  boost: 0, // bar
  oilPressure: 2.4, // bar
  voltage: 14.2, // V
  odometer: 84213.4, // km
  trip: 0, // km
  warnings: {
    left: false,
    right: false,
    highBeam: false,
    handbrake: false,
    checkEngine: false,
    oil: false,
    battery: false,
    temp: false,
    fuelLow: false,
    abs: false,
    rev: false,
  },
}

export default function useVehicleSim() {
  const [state, setState] = useState(initialState)

  // Έλεγχοι που μπορεί να αλλάξει το UI χωρίς να ξανα-render-άρει τον βρόχο.
  const controls = useRef({ throttle: false, brake: false, ignition: true })
  const toggles = useRef({
    left: false,
    right: false,
    highBeam: false,
    handbrake: true,
  })

  // Mutable αντίγραφο της κατάστασης για τον βρόχο φυσικής.
  const sim = useRef({ ...initialState })
  const raf = useRef(0)
  const last = useRef(0)
  const blink = useRef({ on: false, t: 0 })

  useEffect(() => {
    function frame(now) {
      raf.current = requestAnimationFrame(frame)
      if (!last.current) last.current = now
      const dt = Math.min(0.05, (now - last.current) / 1000) // s, capped
      last.current = now

      const s = sim.current
      const c = controls.current
      const tg = toggles.current

      s.ignition = c.ignition

      if (!s.ignition) {
        // Μηχανή σβηστή: όλα πέφτουν.
        s.rpm = Math.max(0, s.rpm - 2500 * dt)
        s.throttle = 0
        s.boost = 0
        s.oilPressure = Math.max(0, s.oilPressure - 4 * dt)
        s.voltage = 12.4
        s.speed = Math.max(0, s.speed - 6 * dt)
      } else {
        // --- Γκάζι (smoothing) ---
        const target = c.throttle ? 1 : 0
        const rate = c.throttle ? 3.5 : 5
        s.throttle = clamp(s.throttle + (target - s.throttle) * rate * dt, 0, 1)

        // --- Επιτάχυνση / επιβράδυνση ---
        // Δύναμη κινητήρα μειώνεται σε υψηλές ταχύτητες (αεροδυναμική αντίσταση).
        const drag = 0.0009 * s.speed * s.speed
        const engineForce = s.throttle * (140 - s.speed * 0.45)
        const braking = c.brake ? 90 : 0
        const handbrake = tg.handbrake ? 40 : 0
        const rollResist = 6

        let accel = engineForce - drag - braking - handbrake - rollResist
        if (s.speed <= 0 && accel < 0) accel = 0
        s.speed = clamp(s.speed + accel * dt * 0.18, 0, MAX_SPEED)

        // --- Σχέση μετάδοσης (αυτόματο κιβώτιο) ---
        if (s.speed < 2) {
          s.gear = c.throttle ? 1 : 0
        } else {
          const ratio = GEAR_RATIOS[clamp(s.gear - 1, 0, GEAR_RATIOS.length - 1)]
          const projected = s.speed * ratio
          if (projected > SHIFT_UP_RPM && s.gear < GEAR_RATIOS.length) s.gear += 1
          else if (projected < SHIFT_DOWN_RPM && s.gear > 1) s.gear -= 1
        }

        // --- RPM ---
        let targetRpm
        if (s.gear === 0) {
          // Νεκρά: στροφές ακολουθούν το γκάζι.
          targetRpm = IDLE_RPM + s.throttle * 5500
        } else {
          const ratio = GEAR_RATIOS[s.gear - 1]
          targetRpm = Math.max(IDLE_RPM, s.speed * ratio + s.throttle * 400)
        }
        s.rpm = clamp(s.rpm + (targetRpm - s.rpm) * 8 * dt, 0, MAX_RPM)

        // --- Boost (turbo): χτίζεται με γκάζι + στροφές ---
        const boostTarget =
          s.throttle * clamp((s.rpm - 2500) / 4000, 0, 1) * MAX_BOOST
        const boostRate = boostTarget > s.boost ? 4 : 6
        s.boost = clamp(s.boost + (boostTarget - s.boost) * boostRate * dt, -0.6, MAX_BOOST)

        // --- Θερμοκρασία νερού: ζεσταίνεται μέχρι ~90°C, ανεβαίνει με φορτίο ---
        const tempTarget = 90 + s.throttle * 8 + clamp((s.rpm - 4000) / 1000, 0, 6)
        s.coolant = clamp(s.coolant + (tempTarget - s.coolant) * 0.04 * dt * 10, 20, 125)

        // --- Πίεση λαδιού: συνάρτηση στροφών ---
        const oilTarget = 1.0 + (s.rpm / MAX_RPM) * 4.5
        s.oilPressure = clamp(s.oilPressure + (oilTarget - s.oilPressure) * 6 * dt, 0, 6)

        // --- Τάση μπαταρίας ---
        const voltTarget = 14.0 + (s.rpm > 1200 ? 0.4 : -1.0) - s.throttle * 0.1
        s.voltage = clamp(s.voltage + (voltTarget - s.voltage) * 2 * dt, 11.5, 14.8)

        // --- Καύσιμο & χιλιόμετρα ---
        const kmThisFrame = (s.speed / 3600) * dt
        s.odometer += kmThisFrame
        s.trip += kmThisFrame
        const burn = (0.0002 + s.throttle * 0.0009 + s.rpm * 0.0000002) * dt
        s.fuel = clamp(s.fuel - burn * 100, 0, 100)
      }

      // --- Φλας (blink @ ~1.5Hz) ---
      blink.current.t += dt
      if (blink.current.t > 0.36) {
        blink.current.t = 0
        blink.current.on = !blink.current.on
      }
      const blinkOn = blink.current.on

      // --- Προειδοποιητικές λυχνίες ---
      const warnings = {
        left: tg.left && blinkOn,
        right: tg.right && blinkOn,
        highBeam: tg.highBeam,
        handbrake: tg.handbrake,
        checkEngine: s.rpm >= MAX_RPM - 50,
        oil: s.ignition && s.oilPressure < 1.0,
        battery: s.voltage < 12.6,
        temp: s.coolant > 110,
        fuelLow: s.fuel < 12,
        abs: c.brake && s.speed > 60,
        rev: s.rpm >= REDLINE_RPM,
      }

      setState({
        ignition: s.ignition,
        speed: s.speed,
        rpm: s.rpm,
        gear: s.gear,
        throttle: s.throttle,
        coolant: s.coolant,
        fuel: s.fuel,
        boost: s.boost,
        oilPressure: s.oilPressure,
        voltage: s.voltage,
        odometer: s.odometer,
        trip: s.trip,
        warnings,
      })
    }

    raf.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  const api = {
    setThrottle: (v) => (controls.current.throttle = v),
    setBrake: (v) => (controls.current.brake = v),
    toggleIgnition: () => (controls.current.ignition = !controls.current.ignition),
    toggleLeft: () => {
      toggles.current.left = !toggles.current.left
      if (toggles.current.left) toggles.current.right = false
    },
    toggleRight: () => {
      toggles.current.right = !toggles.current.right
      if (toggles.current.right) toggles.current.left = false
    },
    toggleHighBeam: () => (toggles.current.highBeam = !toggles.current.highBeam),
    toggleHandbrake: () => (toggles.current.handbrake = !toggles.current.handbrake),
    resetTrip: () => (sim.current.trip = 0),
    refuel: () => (sim.current.fuel = 100),
  }

  return [state, api]
}
