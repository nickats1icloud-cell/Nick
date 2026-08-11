import { Link } from 'react-router-dom'
import { categoryInfo } from '../../lib/lmu/constants.js'
import ClassTag from './ClassTag.jsx'

/**
 * Πίνακας βαθμολογίας. `kind` = 'teams' | 'drivers'. Κάθε αγώνας γίνεται στήλη,
 * όπως στους επίσημους πίνακες του WEC.
 */
export default function StandingsTable({ rows, events, kind = 'teams', highlightTeamId }) {
  if (!rows.length) {
    return <p className="champ__muted">Δεν έχουν καταχωρηθεί αποτελέσματα σε αυτή την κατηγορία.</p>
  }
  const showDrops = rows.some((r) => r.droppedPoints)

  return (
    <div className="champ__table-wrap">
      <table className="champ__table champ__table--standings">
        <thead>
          <tr>
            <th>#</th>
            <th>{kind === 'teams' ? 'Ομάδα' : 'Οδηγός'}</th>
            {kind === 'drivers' ? <th>Ομάδα</th> : <th>Αυτοκίνητο</th>}
            {events.map((event) => (
              <th key={event.id} className="champ__cell-num" title={event.name}>
                R{event.round}
              </th>
            ))}
            <th className="champ__cell-num">Βαθμοί</th>
            {showDrops ? <th className="champ__cell-num">Χωρίς drop</th> : null}
            <th className="champ__cell-num" title="Νίκες / βάθρα">
              Ν/Β
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const teamId = kind === 'teams' ? row.id : row.team?.id
            return (
              <tr
                key={row.id}
                className={highlightTeamId && teamId === highlightTeamId ? 'is-mine' : undefined}
              >
                <td className="champ__cell-num champ__cell-rank">{row.rank}</td>
                <td>
                  {kind === 'teams' ? (
                    <Link to={`/championship/teams/${row.id}`} className="champ__link">
                      {row.name}
                    </Link>
                  ) : (
                    <>
                      {row.name}
                      {row.driver ? (
                        <span className="champ__cell-sub">{categoryInfo(row.driver.category).label}</span>
                      ) : null}
                    </>
                  )}
                </td>
                <td>
                  {kind === 'drivers' ? (
                    row.team?.name || '—'
                  ) : (
                    <span className="champ__cell-car">
                      #{row.team?.number} {row.team?.car}
                      <ClassTag classId={row.team?.carClass} short />
                    </span>
                  )}
                </td>
                {events.map((event) => (
                  <td key={event.id} className="champ__cell-num">
                    {row.byEvent[event.id] ?? '–'}
                  </td>
                ))}
                <td className="champ__cell-num champ__cell-points">{row.points}</td>
                {showDrops ? <td className="champ__cell-num champ__muted">{row.rawPoints}</td> : null}
                <td className="champ__cell-num champ__muted">
                  {row.wins}/{row.podiums}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
