import { AVAILABILITY, TYRE_ACTIONS } from '../../lib/lmu/constants.js'
import { formatClock, formatDuration, formatLap, parseLap, round } from '../../lib/lmu/utils.js'

/**
 * Ο πίνακας του πλάνου. Αριστερά τα πεδία που συμπληρώνει η ομάδα (οδηγός,
 * γύροι, χρόνος γύρου, ελαστικά, καύσιμα), δεξιά ό,τι υπολογίζεται μόνο του
 * (ώρα αγώνα, διάρκεια, στάση, λίτρα, σετ).
 */
export default function StintTable({
  computed,
  plan,
  roster = [],
  canEdit,
  actions,
  availabilityOf,
  eventId,
}) {
  const change = (stintId, patch) => actions.updateStint(plan.id, stintId, patch)

  return (
    <div className="champ__table-wrap">
      <table className="champ__table champ__table--stints">
        <thead>
          <tr>
            <th>#</th>
            <th>Οδηγός</th>
            <th>Γύροι</th>
            <th>Χρόνος γύρου</th>
            <th>Ελαστικά</th>
            <th>Καύσιμα</th>
            <th>Ώρα αγώνα</th>
            <th>Διάρκεια</th>
            <th>Στάση</th>
            <th>Σημείωση</th>
            {canEdit ? <th aria-label="Ενέργειες" /> : null}
          </tr>
        </thead>
        <tbody>
          {computed.stints.map((stint) => {
            const availability = availabilityOf(eventId, stint.driverId)
            return (
              <tr key={stint.id} className={stint.fuelShort ? 'is-bad' : undefined}>
                <td className="champ__cell-num">{stint.index + 1}</td>

                <td>
                  {canEdit ? (
                    <select
                      className="champ__input champ__input--sm"
                      value={stint.driverId || ''}
                      onChange={(e) => change(stint.id, { driverId: e.target.value || null })}
                    >
                      <option value="">— διάλεξε οδηγό —</option>
                      {roster.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                          {availabilityOf(eventId, d.id) === 'NO' ? ' (μη διαθέσιμος)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    stint.driverName || '—'
                  )}
                  {stint.driverId && availability !== 'YES' ? (
                    <span className={`champ__flag champ__flag--${AVAILABILITY[availability].tone}`}>
                      {AVAILABILITY[availability].short}
                    </span>
                  ) : null}
                </td>

                <td>
                  {canEdit ? (
                    <input
                      className="champ__input champ__input--num"
                      type="number"
                      min="1"
                      max="400"
                      value={stint.laps}
                      onChange={(e) => change(stint.id, { laps: Math.max(1, Number(e.target.value)) })}
                    />
                  ) : (
                    stint.laps
                  )}
                </td>

                <td>
                  {canEdit ? (
                    <input
                      className="champ__input champ__input--num"
                      type="text"
                      inputMode="decimal"
                      placeholder={formatLap(computed.car.lapTimeSec)}
                      defaultValue={stint.lapTimeSec ? formatLap(stint.lapTimeSec) : ''}
                      title="Άφησέ το κενό για τον χρόνο αναφοράς της πίστας + το pace του οδηγού"
                      onBlur={(e) => change(stint.id, { lapTimeSec: parseLap(e.target.value) })}
                    />
                  ) : (
                    formatLap(stint.lapTimeSec)
                  )}
                </td>

                <td>
                  {canEdit && stint.index > 0 ? (
                    <select
                      className="champ__input champ__input--sm"
                      value={stint.tyres}
                      onChange={(e) => change(stint.id, { tyres: e.target.value })}
                    >
                      {Object.values(TYRE_ACTIONS).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={stint.tyreOverrun ? 'champ__warn-text' : undefined}>
                      {stint.changedTyres ? `Σετ ${stint.tyreSetNo}` : 'Ίδια'} · {stint.lapsOnSet}γ
                    </span>
                  )}
                  {canEdit && stint.tyreOverrun ? (
                    <span className="champ__flag champ__flag--warn" title="Πάνω από τη ζωή του σετ">
                      {stint.lapsOnSet}γ
                    </span>
                  ) : null}
                </td>

                <td>
                  {canEdit ? (
                    <input
                      className="champ__input champ__input--num"
                      type="number"
                      min="0"
                      step="1"
                      placeholder={String(round(stint.fuelNeedL, 0))}
                      value={stint.fuelAddedL || ''}
                      title="Κενό = όσα λίτρα χρειάζονται για τους γύρους του stint"
                      onChange={(e) => change(stint.id, { fuelAddedL: Number(e.target.value) || 0 })}
                    />
                  ) : (
                    `+${stint.refuelL} L`
                  )}
                  <span className="champ__cell-sub">
                    {stint.fuelShort
                      ? `λείπουν ${Math.abs(stint.fuelEndL)} L`
                      : `μένουν ${stint.fuelEndL} L`}
                  </span>
                </td>

                <td className="champ__cell-mono">
                  {formatClock(stint.startSec)}
                  <span className="champ__cell-sub">→ {formatClock(stint.endSec)}</span>
                </td>

                <td className="champ__cell-mono">{formatDuration(stint.drivingSec)}</td>

                <td className="champ__cell-mono">
                  {stint.pitSec ? formatDuration(stint.pitSec) : '—'}
                  {stint.driverChanged ? <span className="champ__cell-sub">αλλαγή οδηγού</span> : null}
                </td>

                <td>
                  {canEdit ? (
                    <input
                      className="champ__input champ__input--sm"
                      type="text"
                      value={stint.note || ''}
                      placeholder="π.χ. full wet"
                      onChange={(e) => change(stint.id, { note: e.target.value })}
                    />
                  ) : (
                    stint.note || '—'
                  )}
                </td>

                {canEdit ? (
                  <td className="champ__cell-actions">
                    <button
                      type="button"
                      className="champ__icon-btn"
                      title="Πιο πάνω"
                      onClick={() => actions.moveStint(plan.id, stint.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="champ__icon-btn"
                      title="Πιο κάτω"
                      onClick={() => actions.moveStint(plan.id, stint.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="champ__icon-btn champ__icon-btn--danger"
                      title="Διαγραφή stint"
                      onClick={() => actions.removeStint(plan.id, stint.id)}
                    >
                      ✕
                    </button>
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan="2">Σύνολο</th>
            <th>{computed.totals.laps}</th>
            <th colSpan="2">{computed.totals.tyreSets} σετ</th>
            <th>{computed.totals.fuelL} L</th>
            <th colSpan="2">{formatDuration(computed.totals.totalSec)}</th>
            <th>{formatDuration(computed.totals.pitSec)}</th>
            <th colSpan={canEdit ? 2 : 1}>{computed.totals.stops} στάσεις</th>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
