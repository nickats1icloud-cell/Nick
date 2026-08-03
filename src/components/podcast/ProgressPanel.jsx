import { scoreTone } from '../../lib/score.js'

function delta(current, previous, { lowerIsBetter = false } = {}) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  const diff = Math.round((current - previous) * 10) / 10
  if (diff === 0) return { text: '=', tone: 'neutral' }
  const better = lowerIsBetter ? diff < 0 : diff > 0
  return { text: `${diff > 0 ? '+' : ''}${diff}`, tone: better ? 'good' : 'bad' }
}

/** Το ιστορικό αναλύσεων: εδώ φαίνεται αν όντως βελτιώνεσαι επεισόδιο με επεισόδιο. */
export default function ProgressPanel({ history, onClear }) {
  if (!history?.length) return null
  const rows = [...history].reverse()

  return (
    <section className="pod__panel">
      <h2>6. Πρόοδος</h2>
      <p className="pod__lead">
        {history.length} αναλύσεις αποθηκευμένες τοπικά. Στόχος: η βαθμολογία ανεβαίνει και τα
        παρασιτικά πέφτουν.
      </p>
      <table className="pod__table">
        <thead>
          <tr>
            <th>Επεισόδιο</th>
            <th>Ημ/νία</th>
            <th>Βαθμός</th>
            <th>Παρασιτικά/λεπτό</th>
            <th>Λέξεις/λεπτό</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry, index) => {
            const previous = rows[index + 1]
            const scoreDelta = previous ? delta(entry.overall, previous.overall) : null
            const fillerDelta = previous
              ? delta(entry.fillersPerMin, previous.fillersPerMin, { lowerIsBetter: true })
              : null
            return (
              <tr key={`${entry.id}-${entry.at}`}>
                <td>{entry.title}</td>
                <td>{new Date(entry.at).toLocaleDateString('el-GR')}</td>
                <td className={`pod__cell--${scoreTone(entry.overall)}`}>
                  {entry.overall ?? '—'}
                  {scoreDelta ? <small className={`pod__delta pod__delta--${scoreDelta.tone}`}>{scoreDelta.text}</small> : null}
                </td>
                <td>
                  {entry.fillersPerMin ?? '—'}
                  {fillerDelta ? <small className={`pod__delta pod__delta--${fillerDelta.tone}`}>{fillerDelta.text}</small> : null}
                </td>
                <td>{entry.wpm ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button type="button" className="pod__link-btn" onClick={onClear}>
        Διαγραφή ιστορικού
      </button>
    </section>
  )
}
