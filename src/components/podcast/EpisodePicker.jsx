import { useState } from 'react'
import { analyzeEpisodeMeta } from '../../lib/feedAnalysis.js'
import { formatClock } from '../../lib/greekText.js'

function formatDate(date) {
  if (!date) return '—'
  return date.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function EpisodePicker({ episodes, selectedId, onSelect, analyzedIds = [] }) {
  const [limit, setLimit] = useState(8)
  const visible = episodes.slice(0, limit)
  const selected = episodes.find((e) => e.id === selectedId) || null
  const meta = selected ? analyzeEpisodeMeta(selected) : null

  return (
    <section className="pod__panel">
      <h2>3. Διάλεξε επεισόδιο</h2>
      <ul className="pod__episodes">
        {visible.map((episode) => (
          <li key={episode.id}>
            <button
              type="button"
              className={`pod__episode${episode.id === selectedId ? ' is-selected' : ''}`}
              onClick={() => onSelect(episode.id)}
            >
              <span className="pod__episode-title">{episode.title || 'Χωρίς τίτλο'}</span>
              <span className="pod__episode-meta">
                {formatDate(episode.published)}
                {episode.durationSec ? ` · ${formatClock(episode.durationSec)}` : ''}
                {analyzedIds.includes(episode.id) ? ' · ✓ αναλυμένο' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {limit < episodes.length ? (
        <button type="button" className="pod__link-btn" onClick={() => setLimit((n) => n + 12)}>
          Δείξε κι άλλα ({episodes.length - limit})
        </button>
      ) : null}

      {selected ? (
        <div className="pod__episode-detail">
          <h3>{selected.title}</h3>
          <p className="pod__note">
            {meta.titleLength} χαρακτήρες τίτλος · {meta.descWords} λέξεις shownotes
            {selected.durationSec ? ` · ${formatClock(selected.durationSec)}` : ''}
          </p>
          {meta.issues.length ? (
            <ul className="pod__issues">
              {meta.issues.map((issue, index) => (
                <li key={index} className={`pod__issue pod__issue--${issue.severity}`}>
                  {issue.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="pod__empty">Τα metadata αυτού του επεισοδίου είναι εντάξει.</p>
          )}
        </div>
      ) : null}
    </section>
  )
}
