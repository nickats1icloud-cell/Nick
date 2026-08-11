import { Link } from 'react-router-dom'
import { useChampionship } from '../../hooks/useChampionship.js'
import { categoryInfo } from '../../lib/lmu/constants.js'
import Badge from './Badge.jsx'
import ClassTag from './ClassTag.jsx'

/** Κάρτα ομάδας: αυτοκίνητο, αρχηγός, roster και βαθμοί μέχρι τώρα. */
export default function TeamCard({ team, points, rank, isMine }) {
  const { rosterOf, driverById } = useChampionship()
  const roster = rosterOf(team.id)
  const principal = driverById(team.principalId)

  return (
    <article className={`champ__team-card${isMine ? ' is-mine' : ''}`}>
      <header className="champ__team-head" style={{ '--team-color': team.color }}>
        <span className="champ__team-number">#{team.number || '—'}</span>
        <div>
          <h3>
            <Link to={`/championship/teams/${team.id}`} className="champ__link">
              {team.name}
            </Link>
          </h3>
          <p className="champ__muted">
            {team.car || 'χωρίς αυτοκίνητο'} <ClassTag classId={team.carClass} short />
          </p>
        </div>
        {typeof points === 'number' ? (
          <span className="champ__team-points" title="Βαθμοί κατηγορίας">
            {points}
            <small>{rank ? `${rank}η θέση` : 'βαθμοί'}</small>
          </span>
        ) : null}
      </header>

      <dl className="champ__team-meta">
        <div>
          <dt>Αρχηγός</dt>
          <dd>{principal?.name || <span className="champ__warn-text">δεν έχει οριστεί</span>}</dd>
        </div>
        <div>
          <dt>Οδηγοί</dt>
          <dd>{roster.length}</dd>
        </div>
      </dl>

      <ul className="champ__chips">
        {roster.map((d) => (
          <li key={d.id}>
            <Badge tone={d.id === team.principalId ? 'accent' : 'muted'}>
              {d.name} · {categoryInfo(d.category).short}
            </Badge>
          </li>
        ))}
        {!roster.length ? <li className="champ__muted">Κανένας οδηγός ακόμα.</li> : null}
      </ul>
    </article>
  )
}
