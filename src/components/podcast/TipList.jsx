const SEVERITY_LABEL = {
  high: 'Προτεραιότητα',
  medium: 'Αξίζει να το δεις',
  low: 'Λεπτομέρεια',
}

export default function TipList({ tips, emptyText = 'Δεν βρήκα κάτι σοβαρό εδώ. Καλή δουλειά.' }) {
  if (!tips?.length) return <p className="pod__empty">{emptyText}</p>

  return (
    <ol className="pod__tips">
      {tips.map((tip, index) => (
        <li key={`${tip.title}-${index}`} className={`pod__tip pod__tip--${tip.severity}`}>
          <span className="pod__tip-badge">{SEVERITY_LABEL[tip.severity]}</span>
          <h4>{tip.title}</h4>
          <p>{tip.detail}</p>
          {tip.drill ? (
            <p className="pod__tip-drill">
              <strong>Άσκηση:</strong> {tip.drill}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
