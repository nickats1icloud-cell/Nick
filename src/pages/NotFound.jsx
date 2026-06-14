import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="notfound">
      <h1>404</h1>
      <p>Η σελίδα που ψάχνεις δεν βρέθηκε.</p>
      <Link to="/" className="btn btn--primary">
        Επιστροφή στην αρχική
      </Link>
    </section>
  )
}
