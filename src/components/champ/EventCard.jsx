import { trackInfo } from '../../lib/lmu/constants.js'
import { formatDate, formatMinutes, relativeTime, round } from '../../lib/lmu/utils.js'
import Badge from './Badge.jsx'
import ClassTag from './ClassTag.jsx'

const STATUS = {
  UPCOMING: { label: 'Επόμενος', tone: 'accent' },
  LIVE: { label: 'Σε εξέλιξη', tone: 'warn' },
  DONE: { label: 'Ολοκληρώθηκε', tone: 'muted' },
}

/** Κάρτα αγώνα για το καλεντάρι και την επισκόπηση. */
export default function EventCard({ event, winners = [], doublePoints, children }) {
  const track = trackInfo(event.trackId)
  const status = STATUS[event.status] || STATUS.UPCOMING

  return (
    <article className="champ__event">
      <div className="champ__event-round">
        <span>R{event.round}</span>
      </div>

      <div className="champ__event-body">
        <header className="champ__event-head">
          <h3>{event.name}</h3>
          <span className="champ__event-tags">
            <Badge tone={status.tone}>{status.label}</Badge>
            {doublePoints ? <Badge tone="warn">Διπλοί βαθμοί</Badge> : null}
          </span>
        </header>

        <p className="champ__muted">
          {track?.name || 'χωρίς πίστα'}
          {track ? ` · ${round(track.lengthKm, 3)} km` : ''} · {formatMinutes(event.durationMinutes)}
        </p>
        <p className="champ__muted">
          {formatDate(event.dateISO)}
          {event.dateISO && event.status !== 'DONE' ? ` · ${relativeTime(event.dateISO)}` : ''}
        </p>

        {event.notes ? <p className="champ__event-notes">{event.notes}</p> : null}

        {winners.length ? (
          <ul className="champ__event-winners">
            {winners.map((w) => (
              <li key={w.classId}>
                <ClassTag classId={w.classId} short /> {w.team?.name || '—'}
              </li>
            ))}
          </ul>
        ) : null}

        {children ? <div className="champ__event-actions">{children}</div> : null}
      </div>
    </article>
  )
}
