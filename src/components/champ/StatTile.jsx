/** Πλακίδιο με ένα νούμερο-κλειδί και προαιρετική υποσημείωση. */
export default function StatTile({ label, value, hint, tone }) {
  return (
    <div className={`champ__tile${tone ? ` champ__tile--${tone}` : ''}`}>
      <span className="champ__tile-label">{label}</span>
      <strong className="champ__tile-value">{value}</strong>
      {hint ? <span className="champ__tile-hint">{hint}</span> : null}
    </div>
  )
}
