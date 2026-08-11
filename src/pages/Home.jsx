import { Link } from 'react-router-dom'

const features = [
  {
    title: 'Ομάδες & roster',
    body: 'Κάθε ομάδα με αυτοκίνητο, κατηγορία, νούμερο και οδηγούς σε Platinum/Gold/Silver/Bronze. Ο αρχηγός διαχειρίζεται το δικό του roster.',
  },
  {
    title: 'Stint planner',
    body: 'Χρονογραμμή αγώνα, καύσιμα, ελαστικά, στάσεις και αλλαγές οδηγών — με αυτόματη παραγωγή πλάνου για 4, 6, 12 ή 24 ώρες.',
  },
  {
    title: 'Μηχανή κανόνων',
    body: 'Μέγιστη συνεχόμενη οδήγηση, ελάχιστη ξεκούραση, πλαφόν χρόνου ανά οδηγό, σετ ελαστικών, διαθεσιμότητα. Το πλάνο δεν υποβάλλεται με σφάλματα.',
  },
  {
    title: 'Βαθμολογίες',
    body: 'Αποτελέσματα ανά κατηγορία, βαθμοί ομάδων και οδηγών, διπλοί βαθμοί, drop rounds και εξαγωγή σε Markdown.',
  },
]

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Race Control — πρωτάθλημα Le Mans Ultimate</h1>
        <p>
          Ένα ολοκληρωμένο management system για πρωταθλήματα αντοχής: ομάδες, αρχηγοί, οδηγοί,
          καλεντάρι, πλάνα stint με έλεγχο κανονισμού και βαθμολογίες. Όλα τρέχουν στον browser σου.
        </p>
        <div className="btn-row">
          <Link to="/championship" className="btn btn--primary">
            Άνοιξε το πρωτάθλημα
          </Link>
          <Link to="/dashboard" className="btn btn--ghost">
            Ψηφιακό καντράν
          </Link>
          <Link to="/podcast" className="btn btn--ghost">
            Ανάλυση podcast
          </Link>
        </div>
      </section>

      <section className="card-grid">
        {features.map((f) => (
          <article key={f.title} className="card">
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </article>
        ))}
      </section>
    </>
  )
}
