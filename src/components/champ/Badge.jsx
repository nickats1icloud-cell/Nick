/** Μικρό χρωματιστό tag. tone: ok | warn | bad | muted | accent */
export default function Badge({ tone = 'muted', children, title }) {
  return (
    <span className={`champ__badge champ__badge--${tone}`} title={title}>
      {children}
    </span>
  )
}
