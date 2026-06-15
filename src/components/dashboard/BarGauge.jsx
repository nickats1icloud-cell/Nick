/**
 * Μικρό γραμμικό όργανο με ετικέτα, ψηφιακή τιμή και μπάρα γεμίσματος.
 * Χρησιμοποιείται για θερμοκρασία, καύσιμο, boost, πίεση λαδιού και τάση.
 */
export default function BarGauge({
  icon,
  label,
  value,
  min = 0,
  max,
  unit,
  digits = 0,
  warn = false,
  display,
}) {
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)))
  const pct = (ratio * 100).toFixed(1)

  return (
    <div className={`bargauge${warn ? ' bargauge--warn' : ''}`}>
      <div className="bargauge__head">
        <span className="bargauge__label">
          {icon && <span className="bargauge__icon" aria-hidden>{icon}</span>}
          {label}
        </span>
        <span className="bargauge__value">
          {display ?? value.toFixed(digits)}
          <em>{unit}</em>
        </span>
      </div>
      <div className="bargauge__track">
        <div className="bargauge__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
