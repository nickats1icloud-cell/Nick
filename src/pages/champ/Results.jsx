import { useState } from 'react'
import { useChampionship } from '../../hooks/useChampionship.js'
import { eventWinners } from '../../lib/lmu/standings.js'
import { formatMinutes } from '../../lib/lmu/utils.js'
import Badge from '../../components/champ/Badge.jsx'
import ClassTag from '../../components/champ/ClassTag.jsx'
import Field from '../../components/champ/Field.jsx'
import ResultsEditor from '../../components/champ/ResultsEditor.jsx'

/** Καταχώρηση και δημοσίευση αποτελεσμάτων. Μόνο ο διοργανωτής γράφει. */
export default function Results() {
  const ctx = useChampionship()
  const { state, events, can, actions } = ctx
  const done = events.filter((e) => e.status === 'DONE')
  const [eventId, setEventId] = useState(() => done[done.length - 1]?.id || events[0]?.id || '')
  const event = ctx.eventById(eventId)
  const canEdit = can('results.edit')
  const result = event ? ctx.resultFor(event.id) : null

  if (!events.length) {
    return (
      <section className="champ__panel">
        <h2>Δεν υπάρχουν αγώνες</h2>
        <p className="champ__muted">Πρόσθεσε πρώτα αγώνες στο καλεντάρι.</p>
      </section>
    )
  }

  /** Παίρνει τους οδηγούς κάθε συμμετοχής από το πλάνο stint της ομάδας. */
  function pullDriversFromPlans() {
    if (!event || !result) return
    result.entries.forEach((entry) => {
      const plan = ctx.planFor(event.id, entry.teamId)
      if (!plan) return
      const driverIds = [...new Set(plan.stints.map((s) => s.driverId).filter(Boolean))]
      if (driverIds.length) actions.updateResultEntry(event.id, entry.teamId, { driverIds })
    })
  }

  return (
    <>
      <section className="champ__panel">
        <div className="champ__panel-head champ__panel-head--page">
          <div>
            <h2>Αποτελέσματα</h2>
            <p className="champ__muted">
              {event ? `${event.name} · ${formatMinutes(event.durationMinutes)}` : '—'}
            </p>
          </div>
          <Field label="Αγώνας">
            <select className="champ__input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  R{ev.round} · {ev.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {event ? (
          <>
            <div className="champ__planner-status">
              <Badge tone={event.status === 'DONE' ? 'ok' : 'accent'}>
                {event.status === 'DONE' ? 'Δημοσιευμένος' : 'Δεν έχει ολοκληρωθεί'}
              </Badge>
              {result?.publishedAt ? (
                <span className="champ__muted">
                  Δημοσιεύτηκε: {new Date(result.publishedAt).toLocaleString('el-GR')}
                </span>
              ) : null}
              {!canEdit ? (
                <span className="champ__muted">Μόνο η διοργάνωση καταχωρεί αποτελέσματα.</span>
              ) : null}
            </div>

            {eventWinners(state, event.id).length ? (
              <ul className="champ__event-winners">
                {eventWinners(state, event.id).map((w) => (
                  <li key={w.classId}>
                    <ClassTag classId={w.classId} short /> <strong>{w.team?.name}</strong> — νικητής
                    κατηγορίας
                  </li>
                ))}
              </ul>
            ) : null}

            {canEdit && result?.entries.length ? (
              <div className="champ__btn-row">
                <button type="button" className="btn btn--primary" onClick={() => actions.publishResults(event.id)}>
                  Δημοσίευση αποτελεσμάτων
                </button>
                <button type="button" className="btn btn--ghost" onClick={pullDriversFromPlans}>
                  Οδηγοί από τα πλάνα stint
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => actions.autofillResults(event.id)}>
                  Συμπλήρωσε ομάδες που λείπουν
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => {
                    if (window.confirm('Να διαγραφούν τα αποτελέσματα αυτού του αγώνα;')) {
                      actions.clearResults(event.id)
                    }
                  }}
                >
                  Καθάρισε
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {event ? <ResultsEditor event={event} canEdit={canEdit} /> : null}

      <section className="champ__panel champ__panel--muted">
        <h2>Πώς υπολογίζονται οι βαθμοί</h2>
        <ul className="champ__list">
          <li>
            Βαθμοί με βάση τη <strong>θέση στην κατηγορία</strong>:{' '}
            {state.championship.scoring.table.join(' · ')}
          </li>
          <li>
            +{state.championship.scoring.polePoint} για pole, +
            {state.championship.scoring.fastestLapPoint} για γρηγορότερο γύρο.
          </li>
          <li>
            Χρειάζεσαι τουλάχιστον{' '}
            {Math.round(state.championship.scoring.finishRequiredLapsShare * 100)}% των γύρων του
            νικητή της κατηγορίας για να βαθμολογηθείς.
          </li>
          <li>
            Οι βαθμοί των οδηγών πάνε σε όσους δηλώθηκαν στη συμμετοχή — αν δεν έχει δηλωθεί κανείς,
            μοιράζονται σε όλο το roster της ομάδας.
          </li>
          {state.championship.scoring.doublePointsEvents?.length ? (
            <li>
              Διπλοί βαθμοί:{' '}
              {state.championship.scoring.doublePointsEvents
                .map((id) => ctx.eventById(id)?.name || id)
                .join(', ')}
              .
            </li>
          ) : null}
        </ul>
      </section>
    </>
  )
}
