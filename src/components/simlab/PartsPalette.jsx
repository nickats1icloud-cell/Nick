import { useMemo, useState } from 'react'
import { CATEGORIES, searchParts } from '../../lib/simlab/parts.js'

/** Η βιβλιοθήκη εξαρτημάτων: αναζήτηση, κατηγορίες, κλικ για προσθήκη. */
export default function PartsPalette({ onAdd }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(() => new Set(['input', 'output']))

  const results = useMemo(() => searchParts(query), [query])
  const searching = query.trim().length > 0

  const toggle = (id) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside className="lab__palette">
      <div className="lab__palette-head">
        <h2>Βιβλιοθήκη</h2>
        <input
          className="lab__search"
          type="search"
          value={query}
          placeholder="Αναζήτηση εξαρτήματος…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="lab__palette-body">
        {CATEGORIES.map((cat) => {
          const items = results.filter((p) => p.category === cat.id)
          if (searching && items.length === 0) return null
          const expanded = searching || open.has(cat.id)
          return (
            <section key={cat.id} className="lab__cat">
              <button
                type="button"
                className="lab__cat-head"
                onClick={() => toggle(cat.id)}
                aria-expanded={expanded}
              >
                <span>{cat.label}</span>
                <span className="lab__cat-count">{items.length}</span>
              </button>
              {expanded && (
                <ul className="lab__part-list">
                  {items.map((part) => (
                    <li key={part.id}>
                      <button type="button" className="lab__part" onClick={() => onAdd(part.id)}>
                        <span className="lab__part-icon" aria-hidden="true">
                          {part.icon}
                        </span>
                        <span className="lab__part-text">
                          <strong>{part.name}</strong>
                          <small>{part.tip}</small>
                        </span>
                        <span className="lab__part-price">{part.price.toFixed(2)}€</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
        {searching && results.length === 0 && (
          <p className="lab__empty">Κανένα εξάρτημα δεν ταιριάζει με «{query}».</p>
        )}
      </div>
    </aside>
  )
}
