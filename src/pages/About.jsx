import { Link } from 'react-router-dom'

export default function About() {
  return (
    <section>
      <h1>Σχετικά</h1>
      <p>
        React 18 + Vite εφαρμογή με τρία ανεξάρτητα εργαλεία. Όλα δουλεύουν
        αποκλειστικά στον browser — δεν υπάρχει backend και κανένα δεδομένο δεν
        ανεβαίνει πουθενά.
      </p>

      <h2>Τι περιλαμβάνει</h2>
      <ul>
        <li>
          <Link to="/championship">Race Control</Link> — management system για
          πρωτάθλημα αντοχής στο Le Mans Ultimate: ομάδες και αρχηγοί, καλεντάρι,
          πλάνα stint με έλεγχο κανονισμού, αποτελέσματα και βαθμολογίες. Τα
          δεδομένα μένουν στο <code>localStorage</code>, με backup/εισαγωγή σε
          JSON για συνεργασία.
        </li>
        <li>
          <Link to="/dashboard">Ψηφιακό καντράν</Link> — πλήρως λειτουργικό
          instrument cluster με προσομοίωση οχήματος.
        </li>
        <li>
          <Link to="/podcast">Ραδιοφωνικός προπονητής</Link> — ανάλυση
          ελληνόφωνου podcast από RSS και απομαγνητοφώνηση.
        </li>
      </ul>

      <h2>Δομή project</h2>
      <ul>
        <li>
          <code>src/pages/</code> — μία σελίδα ανά route (<code>champ/</code> για
          το πρωτάθλημα)
        </li>
        <li>
          <code>src/components/</code> — επαναχρησιμοποιήσιμα components
          (<code>dashboard/</code>, <code>podcast/</code>, <code>champ/</code>)
        </li>
        <li>
          <code>src/lib/lmu/</code> — η λογική του πρωταθλήματος: μοντέλο, store,
          stint, κανόνες, βαθμολογίες
        </li>
        <li>
          <code>src/hooks/</code> — προσομοίωση οχήματος και state πρωταθλήματος
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
        <li>
          <code>npm run lint</code> — έλεγχος κώδικα με ESLint
        </li>
      </ul>
    </section>
  )
}
