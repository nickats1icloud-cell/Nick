import { scoreTone } from '../../lib/score.js'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function ScoreDial({ value, label, caption, size = 128 }) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null
  const tone = scoreTone(safe)
  const offset = safe == null ? CIRCUMFERENCE : CIRCUMFERENCE * (1 - safe / 100)

  return (
    <div className={`pod__dial pod__dial--${tone}`}>
      <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`${label}: ${safe ?? '—'} στα 100`}>
        <circle cx="60" cy="60" r={RADIUS} className="pod__dial-track" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          className="pod__dial-value"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="58" className="pod__dial-number">
          {safe ?? '—'}
        </text>
        <text x="60" y="78" className="pod__dial-unit">
          / 100
        </text>
      </svg>
      <div className="pod__dial-meta">
        <strong>{label}</strong>
        {caption ? <span>{caption}</span> : null}
      </div>
    </div>
  )
}
