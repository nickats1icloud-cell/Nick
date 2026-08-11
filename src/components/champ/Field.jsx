/**
 * Πεδίο φόρμας με ετικέτα και βοηθητικό κείμενο. Το control δίνεται ως
 * children, ώστε να δουλεύει με input / select / textarea χωρίς wrapper ανά τύπο.
 */
export default function Field({ label, hint, children, span }) {
  return (
    <label className={`champ__field${span ? ` champ__field--${span}` : ''}`}>
      <span className="champ__field-label">{label}</span>
      {children}
      {hint ? <span className="champ__field-hint">{hint}</span> : null}
    </label>
  )
}
