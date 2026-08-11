import { useState } from 'react'

const ICON = { error: '✕', warn: '!', ok: '✓' }
const TITLE = { error: 'Σφάλμα', warn: 'Προσοχή', ok: 'ΟΚ' }

/** Η αναφορά της μηχανής κανόνων: τι δεν περνά, τι είναι ρίσκο, τι είναι εντάξει. */
export default function RuleChecks({ validation }) {
  const [onlyProblems, setOnlyProblems] = useState(false)
  if (!validation) return null

  const visible = onlyProblems
    ? validation.checks.filter((c) => c.level !== 'ok')
    : validation.checks

  return (
    <section className="champ__panel">
      <div className="champ__panel-head">
        <h2>Έλεγχος κανονισμού</h2>
        <div className="champ__panel-actions">
          <span className={`champ__score champ__score--${validation.ok ? 'ok' : 'bad'}`}>
            {validation.score}/100
          </span>
          <label className="champ__check">
            <input
              type="checkbox"
              checked={onlyProblems}
              onChange={(e) => setOnlyProblems(e.target.checked)}
            />
            Μόνο προβλήματα
          </label>
        </div>
      </div>

      <p className="champ__muted champ__rules-summary">
        {validation.errors} σφάλματα · {validation.warnings} προειδοποιήσεις · {validation.passed}{' '}
        έλεγχοι πέρασαν
        {validation.ok ? ' — το πλάνο μπορεί να υποβληθεί.' : ' — διόρθωσε τα σφάλματα για υποβολή.'}
      </p>

      <ul className="champ__checks">
        {visible.map((c, i) => (
          <li key={`${c.code}-${i}`} className={`champ__check-row champ__check-row--${c.level}`}>
            <span className="champ__check-icon" title={TITLE[c.level]}>
              {ICON[c.level]}
            </span>
            <span>
              <strong>{c.title}</strong>
              <span className="champ__check-detail">{c.detail}</span>
            </span>
          </li>
        ))}
        {!visible.length ? <li className="champ__muted">Κανένα πρόβλημα.</li> : null}
      </ul>
    </section>
  )
}
