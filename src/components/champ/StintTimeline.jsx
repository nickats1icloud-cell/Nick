import { formatClock, formatMinutes, initials } from '../../lib/lmu/utils.js'

// Χρώματα ανά οδηγό στη χρονογραμμή — σταθερή σειρά, ώστε ο ίδιος οδηγός να
// έχει πάντα το ίδιο χρώμα μέσα στο πλάνο.
const DRIVER_COLORS = ['#7c5cff', '#00b8d9', '#ffb648', '#4ddc7a', '#ff5c8a', '#8f9bb3']

/**
 * Οπτική χρονογραμμή του αγώνα: κάθε stint είναι μια μπάρα με το χρώμα του
 * οδηγού, οι στάσεις φαίνονται ως κενά και μια κάθετη γραμμή δείχνει το τέλος
 * του αγώνα (η επίσημη διάρκεια).
 */
export default function StintTimeline({ computed }) {
  if (!computed || !computed.stints.length) return null

  const { stints, totals, targetSec } = computed
  const scale = Math.max(totals.totalSec, targetSec) || 1
  const driverOrder = [...new Set(stints.map((s) => s.driverId).filter(Boolean))]
  const colorOf = (driverId) => {
    const index = driverOrder.indexOf(driverId)
    return index < 0 ? '#3a4152' : DRIVER_COLORS[index % DRIVER_COLORS.length]
  }

  const hours = []
  for (let sec = 3600; sec < scale; sec += 3600) hours.push(sec)

  return (
    <div className="champ__timeline">
      <div className="champ__timeline-track">
        {hours.map((sec) => (
          <span
            key={sec}
            className="champ__timeline-hour"
            style={{ left: `${(sec / scale) * 100}%` }}
            data-label={`${Math.round(sec / 3600)}ω`}
          />
        ))}

        {stints.map((stint) => (
          <span
            key={stint.id}
            className={`champ__timeline-stint${stint.fuelShort ? ' is-bad' : ''}`}
            style={{
              left: `${(stint.startSec / scale) * 100}%`,
              width: `${(stint.drivingSec / scale) * 100}%`,
              '--stint-color': colorOf(stint.driverId),
            }}
            title={`Stint ${stint.index + 1} · ${stint.driverName || 'χωρίς οδηγό'} · ${
              stint.laps
            } γύροι · ${formatClock(stint.startSec)} → ${formatClock(stint.endSec)}`}
          >
            <span className="champ__timeline-label">
              {stint.driverId ? initials(stint.driverName) : '?'}
            </span>
          </span>
        ))}

        <span
          className="champ__timeline-finish"
          style={{ left: `${(targetSec / scale) * 100}%` }}
          title={`Τέλος αγώνα: ${formatMinutes(targetSec / 60)}`}
        />
      </div>

      <ul className="champ__timeline-legend">
        {driverOrder.map((driverId) => {
          const row = computed.perDriver.find((d) => d.driverId === driverId)
          return (
            <li key={driverId}>
              <span className="champ__dot" style={{ background: colorOf(driverId) }} />
              {row?.driver?.name || 'Άγνωστος'}
              <span className="champ__muted">
                {' '}
                · {formatMinutes((row?.driveSec || 0) / 60)} ({Math.round((row?.share || 0) * 100)}%)
              </span>
            </li>
          )
        })}
        {stints.some((s) => !s.driverId) ? (
          <li>
            <span className="champ__dot" style={{ background: '#3a4152' }} />
            Χωρίς οδηγό
          </li>
        ) : null}
      </ul>
    </div>
  )
}
