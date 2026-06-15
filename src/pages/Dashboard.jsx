import { useEffect } from 'react'
import useVehicleSim, { MAX_RPM, MAX_SPEED, REDLINE_RPM } from '../hooks/useVehicleSim.js'
import Gauge from '../components/dashboard/Gauge.jsx'
import BarGauge from '../components/dashboard/BarGauge.jsx'
import WarningLights from '../components/dashboard/WarningLights.jsx'

const GEAR_LABEL = (g) => (g === 0 ? 'N' : String(g))

export default function Dashboard() {
  const [v, api] = useVehicleSim()

  // Έλεγχος με πληκτρολόγιο.
  useEffect(() => {
    const down = (e) => {
      if (e.repeat) return
      switch (e.key) {
        case 'ArrowUp': case 'w': api.setThrottle(true); break
        case 'ArrowDown': case 's': api.setBrake(true); break
        case 'a': api.toggleLeft(); break
        case 'd': api.toggleRight(); break
        case 'h': api.toggleHighBeam(); break
        case 'p': api.toggleHandbrake(); break
        default: return
      }
      e.preventDefault()
    }
    const up = (e) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': api.setThrottle(false); break
        case 'ArrowDown': case 's': api.setBrake(false); break
        default: return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [api])

  // Κρατάει το γκάζι/φρένο πατημένο όσο κρατιέται το κουμπί (mouse/touch).
  const hold = (fn) => ({
    onMouseDown: () => fn(true),
    onMouseUp: () => fn(false),
    onMouseLeave: () => fn(false),
    onTouchStart: (e) => { e.preventDefault(); fn(true) },
    onTouchEnd: (e) => { e.preventDefault(); fn(false) },
  })

  return (
    <div className="dash">
      <div className="dash__cluster">
        <WarningLights warnings={v.warnings} />

        <div className="dash__gauges">
          {/* Στροφόμετρο */}
          <div className="dash__pod">
            <Gauge
              value={v.rpm / 1000}
              max={MAX_RPM / 1000}
              majorStep={1}
              redlineFrom={REDLINE_RPM / 1000}
              label="TACHO"
              unit="x1000 r/min"
              digits={1}
              accent="#ff3b30"
            />
          </div>

          {/* Κεντρική ψηφιακή οθόνη */}
          <div className="dash__center">
            <div className="dash__speed">
              <span className="dash__speed-num">{Math.round(v.speed)}</span>
              <span className="dash__speed-unit">km/h</span>
            </div>
            <div className={`dash__gear${v.gear === 0 ? ' is-neutral' : ''}`}>
              {GEAR_LABEL(v.gear)}
            </div>
            <div className="dash__odo">
              <div>
                <small>ODO</small>
                {v.odometer.toFixed(0)} km
              </div>
              <div>
                <small>TRIP</small>
                {v.trip.toFixed(1)} km
              </div>
            </div>
          </div>

          {/* Ταχύμετρο */}
          <div className="dash__pod">
            <Gauge
              value={v.speed}
              max={MAX_SPEED}
              majorStep={20}
              label="SPEED"
              unit="km/h"
              digits={0}
              accent="#3b82f6"
            />
          </div>
        </div>

        {/* Δευτερεύοντα όργανα */}
        <div className="dash__bars">
          <BarGauge
            icon="🌡"
            label="ΝΕΡΟ"
            value={v.coolant}
            min={40}
            max={125}
            unit="°C"
            warn={v.coolant > 110}
          />
          <BarGauge
            icon="⛽"
            label="ΚΑΥΣΙΜΟ"
            value={v.fuel}
            max={100}
            unit="%"
            warn={v.fuel < 12}
          />
          <BarGauge
            icon="🚀"
            label="BOOST"
            value={v.boost}
            min={-0.6}
            max={1.2}
            unit="bar"
            digits={2}
          />
          <BarGauge
            icon="🛢"
            label="ΛΑΔΙ"
            value={v.oilPressure}
            max={6}
            unit="bar"
            digits={1}
            warn={v.ignition && v.oilPressure < 1}
          />
          <BarGauge
            icon="🔋"
            label="ΤΑΣΗ"
            value={v.voltage}
            min={11}
            max={15}
            unit="V"
            digits={1}
            warn={v.voltage < 12.6}
          />
        </div>
      </div>

      {/* Χειριστήρια */}
      <div className="dash__controls">
        <div className="dash__pedals">
          <button className="pedal pedal--gas" {...hold(api.setThrottle)}>
            ΓΚΑΖΙ
          </button>
          <button className="pedal pedal--brake" {...hold(api.setBrake)}>
            ΦΡΕΝΟ
          </button>
        </div>
        <div className="dash__switches">
          <button className="switch" onClick={api.toggleLeft}>◀ Φλας</button>
          <button className="switch" onClick={api.toggleRight}>Φλας ▶</button>
          <button className="switch" onClick={api.toggleHighBeam}>Μεγάλη</button>
          <button className="switch" onClick={api.toggleHandbrake}>Χειρόφρενο</button>
          <button className="switch" onClick={api.toggleIgnition}>Μίζα</button>
          <button className="switch" onClick={api.refuel}>Γέμισμα</button>
          <button className="switch" onClick={api.resetTrip}>Reset trip</button>
        </div>
        <p className="dash__hint">
          Πλήκτρα: <kbd>↑</kbd>/<kbd>W</kbd> γκάζι · <kbd>↓</kbd>/<kbd>S</kbd> φρένο ·
          <kbd>A</kbd>/<kbd>D</kbd> φλας · <kbd>H</kbd> μεγάλη · <kbd>P</kbd> χειρόφρενο
        </p>
      </div>
    </div>
  )
}
