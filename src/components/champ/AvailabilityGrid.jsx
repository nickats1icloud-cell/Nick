import { AVAILABILITY, categoryInfo } from '../../lib/lmu/constants.js'
import { useChampionship } from '../../hooks/useChampionship.js'

const OPTIONS = ['YES', 'MAYBE', 'NO', 'UNKNOWN']

/**
 * Δηλώσεις διαθεσιμότητας: γραμμή ο οδηγός, στήλη ο αγώνας. Ο οδηγός αλλάζει
 * μόνο τη δική του γραμμή, ο αρχηγός όλης της ομάδας, ο διοργανωτής τα πάντα.
 */
export default function AvailabilityGrid({ teamId, events }) {
  const { rosterOf, availabilityOf, actions, can } = useChampionship()
  const roster = rosterOf(teamId)
  const upcoming = events.filter((e) => e.status !== 'DONE')

  if (!roster.length) return <p className="champ__muted">Η ομάδα δεν έχει οδηγούς ακόμα.</p>
  if (!upcoming.length) return <p className="champ__muted">Δεν υπάρχουν επόμενοι αγώνες.</p>

  return (
    <div className="champ__table-wrap">
      <table className="champ__table champ__table--availability">
        <thead>
          <tr>
            <th>Οδηγός</th>
            {upcoming.map((event) => (
              <th key={event.id} title={event.name}>
                R{event.round}
                <span className="champ__cell-sub">{event.name.split(' ').slice(-1)[0]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roster.map((driver) => {
            const editable = can('availability.edit', { driverId: driver.id })
            return (
              <tr key={driver.id}>
                <th scope="row">
                  {driver.name}
                  <span className="champ__cell-sub">{categoryInfo(driver.category).label}</span>
                </th>
                {upcoming.map((event) => {
                  const value = availabilityOf(event.id, driver.id)
                  return (
                    <td key={event.id}>
                      {editable ? (
                        <select
                          className={`champ__input champ__input--sm champ__avail champ__avail--${AVAILABILITY[value].tone}`}
                          value={value}
                          onChange={(e) =>
                            actions.setAvailability(event.id, driver.id, e.target.value)
                          }
                        >
                          {OPTIONS.map((id) => (
                            <option key={id} value={id}>
                              {AVAILABILITY[id].label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`champ__flag champ__flag--${AVAILABILITY[value].tone}`}>
                          {AVAILABILITY[value].short}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
