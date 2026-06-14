export default function About() {
  return (
    <section>
      <h1>About</h1>
      <p>
        Αυτή είναι μια σελίδα δείγμα. Το project είναι στημένο με React 18,
        Vite και React Router — μια καθαρή βάση για να χτίσεις τη δική σου
        εφαρμογή.
      </p>
      <h2>Δομή project</h2>
      <ul>
        <li>
          <code>src/components/</code> — επαναχρησιμοποιήσιμα components (Layout,
          Navbar, Footer)
        </li>
        <li>
          <code>src/pages/</code> — μία σελίδα ανά route
        </li>
        <li>
          <code>src/App.jsx</code> — ορισμός των routes
        </li>
        <li>
          <code>src/index.css</code> — global styles και design tokens
        </li>
      </ul>
      <h2>Εντολές</h2>
      <ul>
        <li>
          <code>npm run dev</code> — εκκίνηση dev server
        </li>
        <li>
          <code>npm run build</code> — production build στο <code>dist/</code>
        </li>
        <li>
          <code>npm run preview</code> — προεπισκόπηση του build
        </li>
      </ul>
    </section>
  )
}
