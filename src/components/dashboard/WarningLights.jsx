/**
 * Σειρά ενδεικτικών λυχνιών. Κάθε λυχνία ανάβει με δικό της χρώμα όταν είναι
 * ενεργή, αλλιώς μένει σβηστή (αχνή).
 */

const LIGHTS = [
  { key: 'left', symbol: '◀', color: '#2ec27e', title: 'Φλας αριστερά' },
  { key: 'right', symbol: '▶', color: '#2ec27e', title: 'Φλας δεξιά' },
  { key: 'highBeam', symbol: '≣D', color: '#3b82f6', title: 'Μεγάλη σκάλα' },
  { key: 'handbrake', symbol: '(P)', color: '#ff3b30', title: 'Χειρόφρενο' },
  { key: 'temp', symbol: '🌡', color: '#ff3b30', title: 'Υπερθέρμανση' },
  { key: 'oil', symbol: '🛢', color: '#ff3b30', title: 'Πίεση λαδιού' },
  { key: 'battery', symbol: '🔋', color: '#ff3b30', title: 'Φόρτιση μπαταρίας' },
  { key: 'fuelLow', symbol: '⛽', color: '#f5a623', title: 'Χαμηλό καύσιμο' },
  { key: 'checkEngine', symbol: '⚙', color: '#f5a623', title: 'Check engine' },
  { key: 'abs', symbol: 'ABS', color: '#f5a623', title: 'ABS' },
]

export default function WarningLights({ warnings }) {
  return (
    <div className="lights" role="status" aria-label="Ενδεικτικές λυχνίες">
      {LIGHTS.map((l) => {
        const on = !!warnings[l.key]
        return (
          <span
            key={l.key}
            className={`light${on ? ' light--on' : ''}`}
            style={on ? { color: l.color, borderColor: l.color } : undefined}
            title={l.title}
          >
            {l.symbol}
          </span>
        )
      })}
    </div>
  )
}
