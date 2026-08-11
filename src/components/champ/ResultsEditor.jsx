import { RESULT_STATUS } from '../../lib/lmu/constants.js'
import { classifyEvent, entryPoints } from '../../lib/lmu/standings.js'
import { formatLap, parseLap } from '../../lib/lmu/utils.js'
import { useChampionship } from '../../hooks/useChampionship.js'
import ClassTag from './ClassTag.jsx'

/**
 * Καταχώρηση αποτελεσμάτων ενός αγώνα, ανά κατηγορία. Οι βαθμοί υπολογίζονται
 * ζωντανά με το σύστημα βαθμολογίας του πρωταθλήματος, ώστε ο διοργανωτής να
 * βλέπει αμέσως τι δίνει η κάθε αλλαγή.
 */
export default function ResultsEditor({ event, canEdit }) {
  const { state, championship, teams, resultFor, actions } = useChampionship()
  const result = resultFor(event.id)

  if (!result || !result.entries.length) {
    return (
      <div className="champ__empty">
        <p>Δεν υπάρχει φύλλο αποτελεσμάτων για αυτόν τον αγώνα.</p>
        {canEdit ? (
          <button type="button" className="btn btn--primary" onClick={() => actions.autofillResults(event.id)}>
            Δημιούργησε φύλλο με όλες τις ομάδες
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <>
      {championship.classes.map((classId) => {
        const { ranked, winnerLaps } = classifyEvent({ result, teams, classId })
        if (!ranked.length) return null
        return (
          <section key={classId} className="champ__panel">
            <div className="champ__panel-head">
              <h3>
                <ClassTag classId={classId} /> αποτελέσματα
              </h3>
              <span className="champ__muted">Γύροι νικητή: {winnerLaps || '—'}</span>
            </div>

            <div className="champ__table-wrap">
              <table className="champ__table champ__table--results">
                <thead>
                  <tr>
                    <th>Θέση</th>
                    <th>Ομάδα</th>
                    <th>Κατάσταση</th>
                    <th>Γύροι</th>
                    <th>Καλύτερος γύρος</th>
                    <th title="Pole position">P</th>
                    <th title="Γρηγορότερος γύρος">FL</th>
                    <th title="Ποινή σε βαθμούς">Ποινή</th>
                    <th>Βαθμοί</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((entry) => {
                    const team = teams.find((t) => t.id === entry.teamId)
                    const pts = entryPoints({
                      entry,
                      classRank: entry.classRank,
                      winnerLaps,
                      event,
                      scoring: state.championship.scoring,
                    })
                    const set = (patch) => actions.updateResultEntry(event.id, entry.teamId, patch)
                    return (
                      <tr key={entry.teamId}>
                        <td className="champ__cell-num">
                          {canEdit ? (
                            <input
                              className="champ__input champ__input--num"
                              type="number"
                              min="0"
                              value={entry.position || ''}
                              placeholder="0"
                              title="Θέση στη γενική κατάταξη (0 = δεν τερμάτισε)"
                              onChange={(e) => set({ position: Number(e.target.value) || 0 })}
                            />
                          ) : (
                            entry.position || '—'
                          )}
                          <span className="champ__cell-sub">
                            {entry.classRank ? `${entry.classRank}ος κατ.` : '—'}
                          </span>
                        </td>

                        <td>
                          {team?.name || '—'}
                          <span className="champ__cell-sub">
                            #{team?.number} {team?.car}
                          </span>
                        </td>

                        <td>
                          {canEdit ? (
                            <select
                              className="champ__input champ__input--sm"
                              value={entry.status}
                              onChange={(e) => set({ status: e.target.value })}
                            >
                              {Object.values(RESULT_STATUS).map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            RESULT_STATUS[entry.status]?.label || entry.status
                          )}
                        </td>

                        <td>
                          {canEdit ? (
                            <input
                              className="champ__input champ__input--num"
                              type="number"
                              min="0"
                              value={entry.laps || ''}
                              onChange={(e) => set({ laps: Number(e.target.value) || 0 })}
                            />
                          ) : (
                            entry.laps
                          )}
                        </td>

                        <td>
                          {canEdit ? (
                            <input
                              className="champ__input champ__input--num"
                              type="text"
                              placeholder="1:32.456"
                              defaultValue={entry.bestLapSec ? formatLap(entry.bestLapSec) : ''}
                              onBlur={(e) => set({ bestLapSec: parseLap(e.target.value) })}
                            />
                          ) : (
                            formatLap(entry.bestLapSec)
                          )}
                        </td>

                        <td className="champ__cell-num">
                          <input
                            type="checkbox"
                            checked={Boolean(entry.pole)}
                            disabled={!canEdit}
                            onChange={(e) => set({ pole: e.target.checked })}
                          />
                        </td>

                        <td className="champ__cell-num">
                          <input
                            type="checkbox"
                            checked={Boolean(entry.fastestLap)}
                            disabled={!canEdit}
                            onChange={(e) => set({ fastestLap: e.target.checked })}
                          />
                        </td>

                        <td>
                          {canEdit ? (
                            <input
                              className="champ__input champ__input--num"
                              type="number"
                              min="0"
                              value={entry.penaltyPoints || ''}
                              onChange={(e) => set({ penaltyPoints: Number(e.target.value) || 0 })}
                            />
                          ) : (
                            entry.penaltyPoints || 0
                          )}
                        </td>

                        <td className="champ__cell-num champ__cell-points">
                          {pts.total}
                          {pts.multiplier === 2 ? <span className="champ__cell-sub">×2</span> : null}
                          {!pts.scored && entry.status === 'FINISHED' ? (
                            <span className="champ__cell-sub champ__warn-text">λίγοι γύροι</span>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </>
  )
}
