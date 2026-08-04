import { formatClock } from '../../lib/greekText.js'

/**
 * Ράβδοι ανά λεπτό: πόσα παρασιτικά είπες σε κάθε λεπτό του επεισοδίου.
 * Τα ψηλά σημεία είναι αυτά που αξίζει να ξανακούσεις.
 */
export default function Timeline({ buckets }) {
  if (!buckets?.length) return null
  const max = Math.max(1, ...buckets.map((b) => b.fillers))

  return (
    <div className="pod__timeline">
      <h3>Παρασιτικά ανά λεπτό</h3>
      <div className="pod__timeline-bars" role="img" aria-label="Γράφημα παρασιτικών ανά λεπτό">
        {buckets.map((bucket) => {
          const height = Math.max(2, (bucket.fillers / max) * 100)
          const hot = bucket.fillers >= max * 0.75 && bucket.fillers > 2
          return (
            <span
              key={bucket.minute}
              className={`pod__timeline-bar${hot ? ' is-hot' : ''}`}
              style={{ height: `${height}%` }}
              title={`${formatClock(bucket.minute * 60)} — ${bucket.fillers} παρασιτικά, ${bucket.words} λέξεις`}
            />
          )
        })}
      </div>
      <div className="pod__timeline-axis">
        <span>0:00</span>
        <span>{formatClock(buckets.length * 60)}</span>
      </div>
    </div>
  )
}
