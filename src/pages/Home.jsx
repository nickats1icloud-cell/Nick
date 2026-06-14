import { useState } from 'react'
import { Link } from 'react-router-dom'

const features = [
  {
    title: 'Vite',
    body: 'Instant dev server με hot module replacement και γρήγορα production builds.',
  },
  {
    title: 'React Router',
    body: 'Client-side routing με layouts, nested routes και 404 handling.',
  },
  {
    title: 'Καθαρή δομή',
    body: 'Components και pages χωρισμένα, έτοιμα να επεκταθούν.',
  },
]

export default function Home() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section className="hero">
        <h1>Καλώς ήρθες στο starter σου</h1>
        <p>
          Ένα μοντέρνο React + Vite web app, έτοιμο για ανάπτυξη. Στήσε εδώ
          ό,τι θέλεις να φτιάξεις.
        </p>
        <div className="btn-row">
          <Link to="/about" className="btn btn--primary">
            Μάθε περισσότερα
          </Link>
          <a
            className="btn btn--ghost"
            href="https://vitejs.dev"
            target="_blank"
            rel="noreferrer"
          >
            Vite docs
          </a>
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
