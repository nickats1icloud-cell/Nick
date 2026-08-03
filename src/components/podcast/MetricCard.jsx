import { scoreTone } from '../../lib/score.js'

/**
 * Μία μετρική με τιμή, μονάδα και σύντομη εξήγηση. Το `score` (0-100) βάφει την
 * κάρτα ώστε να φαίνεται με μια ματιά τι πάει καλά και τι όχι.
 */
export default function MetricCard({ label, value, unit, hint, score, target }) {
  const tone = score == null ? 'neutral' : scoreTone(score)
  return (
    <div className={`pod__metric pod__metric--${tone}`}>
      <span className="pod__metric-label">{label}</span>
      <span className="pod__metric-value">
        {value ?? '—'}
        {unit && value != null ? <small>{unit}</small> : null}
      </span>
      {target ? <span className="pod__metric-target">στόχος: {target}</span> : null}
      {hint ? <p className="pod__metric-hint">{hint}</p> : null}
    </div>
  )
}
