import { useMemo, useState } from 'react'

const COLORS = ['#38bdf8', '#fbbf24', '#34d399', '#f472b6', '#a78bfa', '#fb923c', '#f87171', '#22d3ee']
const W = 720
const H = 150

/**
 * Παλμογράφος: δείχνει το ωμό σήμα δίπλα στο φιλτραρισμένο.
 * Εδώ φαίνεται γιατί χρειάζεσαι debounce και φίλτρο — και τι κοστίζουν.
 */
export default function ScopeView({ scope }) {
  const [hidden, setHidden] = useState(() => new Set())

  // Ο buffer της μηχανής μεταβάλλεται επί τόπου, οπότε η ταυτότητα του
  // αντικειμένου δεν αλλάζει ποτέ: κλειδώνουμε στο τελευταίο δείγμα.
  const lastT = scope.samples.length ? scope.samples[scope.samples.length - 1].t : 0

  const paths = useMemo(() => {
    const samples = scope.samples
    if (samples.length < 2) return []
    const t0 = samples[0].t
    const t1 = samples[samples.length - 1].t
    const span = Math.max(0.001, t1 - t0)
    return scope.channels.map((name, i) => {
      let d = ''
      samples.forEach((s, idx) => {
        const value = s.values[name]
        if (value == null) return
        const x = ((s.t - t0) / span) * W
        const y = H - 6 - Math.max(0, Math.min(1, value)) * (H - 16)
        d += `${idx === 0 || d === '' ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `
      })
      return { name, d, color: COLORS[i % COLORS.length] }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, lastT])

  const toggle = (name) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="lab__scope">
      <div className="lab__scope-head">
        <h4>Παλμογράφος</h4>
        <div className="lab__scope-legend">
          {paths.map((p) => (
            <button
              key={p.name}
              type="button"
              className={`lab__legend${hidden.has(p.name) ? ' is-off' : ''}`}
              onClick={() => toggle(p.name)}
            >
              <span style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="lab__scope-svg" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={H - 6 - g * (H - 16)} y2={H - 6 - g * (H - 16)} className="lab__scope-grid" />
        ))}
        {paths
          .filter((p) => !hidden.has(p.name))
          .map((p) => (
            <path key={p.name} d={p.d} fill="none" stroke={p.color} strokeWidth="1.6" />
          ))}
      </svg>
      {scope.samples.length < 2 && (
        <p className="lab__muted">Άναψε την τροφοδοσία και πείραξε τα χειριστήρια.</p>
      )}
    </div>
  )
}
