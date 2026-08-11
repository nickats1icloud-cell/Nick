import { useState } from 'react'
import { useChampionship } from '../../hooks/useChampionship.js'
import { classInfo } from '../../lib/lmu/constants.js'
import { downloadStandings } from '../../lib/lmu/exports.js'
import StandingsTable from '../../components/champ/StandingsTable.jsx'

/** Βαθμολογίες ομάδων και οδηγών, ανά κατηγορία. */
export default function StandingsPage() {
  const { state, standings, championship, viewer, events } = useChampionship()
  const [classId, setClassId] = useState(championship.classes[0])
  const [kind, setKind] = useState('teams')

  const table = standings.classes.find((c) => c.classId === classId)
  const rows = table ? table[kind] : []

  return (
    <>
      <section className="champ__panel-head champ__panel-head--page">
        <div>
          <h2>Βαθμολογία</h2>
          <p className="champ__muted">
            Μετά από {standings.events.length} από {events.length} αγώνες
            {championship.scoring.dropRounds
              ? ` · αφαιρούνται τα ${championship.scoring.dropRounds} χειρότερα αποτελέσματα`
              : ''}
          </p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => downloadStandings(state)}>
          Εξαγωγή .md
        </button>
      </section>

      <div className="champ__segmented">
        {championship.classes.map((id) => (
          <button
            key={id}
            type="button"
            className={`champ__seg${id === classId ? ' is-active' : ''}`}
            style={{ '--class-color': classInfo(id).color }}
            onClick={() => setClassId(id)}
          >
            {classInfo(id).label}
          </button>
        ))}
      </div>

      <div className="champ__segmented champ__segmented--sub">
        <button
          type="button"
          className={`champ__seg${kind === 'teams' ? ' is-active' : ''}`}
          onClick={() => setKind('teams')}
        >
          Ομάδες
        </button>
        <button
          type="button"
          className={`champ__seg${kind === 'drivers' ? ' is-active' : ''}`}
          onClick={() => setKind('drivers')}
        >
          Οδηγοί
        </button>
      </div>

      <section className="champ__panel">
        <StandingsTable
          rows={rows}
          events={standings.events}
          kind={kind}
          highlightTeamId={viewer.team?.id}
        />
        {rows.length ? (
          <p className="champ__muted">
            Ισοβαθμία λύνεται με περισσότερες νίκες, μετά με τις καλύτερες θέσεις. Η στήλη «Ν/Β»
            δείχνει νίκες και βάθρα κατηγορίας.
          </p>
        ) : null}
      </section>
    </>
  )
}
