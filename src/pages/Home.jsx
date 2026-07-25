import { useState } from 'react'
import { Link } from 'react-router-dom'
import HeroCard from '../components/HeroCard'

const features = [
  {
    title: 'Ψηφιακό καντράν',
    body: 'Στροφόμετρο, ταχύμετρο, θερμοκρασία, καύσιμο, boost, λάδι & τάση — στιλ Civic EK.',
  },
  {
    title: 'Πλήρως λειτουργικό',
    body: 'Μηχανή προσομοίωσης: οδήγησε με γκάζι/φρένο/ταχύτητες και δες τα όργανα να αντιδρούν.',
  },
  {
    title: 'Warning lights',
    body: 'Φλας, μεγάλη σκάλα, λάδι, μπαταρία, θερμοκρασία, check engine, ABS και άλλα.',
  },
]

export default function Home() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section className="hero">
        <HeroCard />

        <div className="btn-row">
          <Link to="/dashboard" className="btn btn--primary">
            Άνοιξε το καντράν
          </Link>
          <Link to="/about" className="btn btn--ghost">
            Μάθε περισσότερα
          </Link>
        </div>

        <div className="counter">
          <button onClick={() => setCount((c) => c - 1)} aria-label="Μείωση">
            −
          </button>
          <strong>{count}</strong>
          <button onClick={() => setCount((c) => c + 1)} aria-label="Αύξηση">
            +
          </button>
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
