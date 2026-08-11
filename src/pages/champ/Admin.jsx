import { useRef, useState } from 'react'
import { useChampionship } from '../../hooks/useChampionship.js'
import { CLASSES, POINTS_PRESETS, ROLES } from '../../lib/lmu/constants.js'
import { downloadBackup, parseBackup } from '../../lib/lmu/exports.js'
import { uploadState } from '../../lib/lmu/api.js'
import Badge from '../../components/champ/Badge.jsx'
import CloudPanel from '../../components/champ/CloudPanel.jsx'
import Field from '../../components/champ/Field.jsx'

/** Διαχείριση: backend, στοιχεία πρωταθλήματος, κανόνες, βαθμολογία, ρόλοι, δεδομένα. */
export default function Admin() {
  const { state, championship, events, drivers, teams, viewer, can, actions, backend } =
    useChampionship()
  const canEdit = can('championship.edit')
  const fileInput = useRef(null)
  const [message, setMessage] = useState(null)

  const rules = championship.rules
  const scoring = championship.scoring

  async function handleImport(file) {
    if (!file) return
    try {
      const text = await file.text()
      const data = parseBackup(text)
      if (backend.isRemote) {
        // Με backend, η «εισαγωγή» σημαίνει ανέβασμα σε νέο πρωτάθλημα στη βάση
        // — δεν πατάμε πάνω στα δεδομένα των άλλων.
        const id = await uploadState(data, {
          displayName: backend.session?.user?.email?.split('@')[0] || '',
        })
        backend.setChampionshipId(id)
        setMessage({
          tone: 'ok',
          text: `Ανέβηκε στο cloud ως νέο πρωτάθλημα: ${data.championship?.name || '—'}.`,
        })
      } else {
        actions.importState(data)
        setMessage({ tone: 'ok', text: `Φορτώθηκε: ${data.championship?.name || 'πρωτάθλημα'}.` })
      }
    } catch (error) {
      setMessage({ tone: 'bad', text: error.message })
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <>
      {!canEdit ? (
        <p className="champ__notice">
          Βλέπεις τις ρυθμίσεις σε ανάγνωση. Αλλαγές κάνει μόνο ο ρόλος «{ROLES.ADMIN.label}» —
          άλλαξε ταυτότητα από πάνω δεξιά αν είσαι η διοργάνωση.
        </p>
      ) : null}

      {message ? (
        <p className={`champ__notice champ__notice--${message.tone}`}>{message.text}</p>
      ) : null}

      <CloudPanel />

      <section className="champ__panel">
        <h2>Στοιχεία πρωταθλήματος</h2>
        <div className="champ__form-grid">
          <Field label="Όνομα" span="wide">
            <input
              className="champ__input"
              disabled={!canEdit}
              value={championship.name}
              onChange={(e) => actions.updateChampionship({ name: e.target.value })}
            />
          </Field>
          <Field label="Σεζόν">
            <input
              className="champ__input"
              disabled={!canEdit}
              value={championship.season}
              onChange={(e) => actions.updateChampionship({ season: e.target.value })}
            />
          </Field>
          <Field label="Διοργανωτής">
            <input
              className="champ__input"
              disabled={!canEdit}
              value={championship.organizer}
              onChange={(e) => actions.updateChampionship({ organizer: e.target.value })}
            />
          </Field>
          <Field label="Περιγραφή" span="wide">
            <textarea
              className="champ__input"
              rows="3"
              disabled={!canEdit}
              value={championship.description}
              onChange={(e) => actions.updateChampionship({ description: e.target.value })}
            />
          </Field>
          <Field label="Κατηγορίες που τρέχουν" span="wide">
            <div className="champ__checks-inline">
              {CLASSES.map((c) => (
                <label key={c.id} className="champ__check">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={championship.classes.includes(c.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...championship.classes, c.id]
                        : championship.classes.filter((id) => id !== c.id)
                      if (next.length) actions.updateChampionship({ classes: next })
                    }}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </section>

      <section className="champ__panel">
        <h2>Κανόνες αγωνιστικού χρόνου</h2>
        <p className="champ__muted">
          Αυτά τα νούμερα τροφοδοτούν τη μηχανή ελέγχου του Stint Planner. Άλλαξέ τα και όλα τα
          πλάνα ελέγχονται ξανά αμέσως.
        </p>
        <div className="champ__form-grid">
          {[
            ['maxStintMinutes', 'Μέγιστη συνεχόμενη οδήγηση (λεπτά)', 'Πόσο μπορεί να οδηγήσει ένας οδηγός χωρίς αλλαγή'],
            ['minRestMinutes', 'Ελάχιστη ξεκούραση (λεπτά)', 'Ανάμεσα σε δύο βάρδιες του ίδιου οδηγού'],
            ['minDriveMinutes', 'Ελάχιστος χρόνος ανά οδηγό (λεπτά)', '0 για ανενεργό'],
            ['minAmDriveMinutes', 'Ελάχιστος χρόνος Silver/Bronze (λεπτά)', '0 για ανενεργό'],
            ['minDriversPerCar', 'Ελάχιστοι οδηγοί ανά αυτοκίνητο'],
            ['maxDriversPerCar', 'Μέγιστοι οδηγοί ανά αυτοκίνητο'],
            ['tyreSetsPerEvent', 'Σετ ελαστικών ανά αγώνα'],
            ['driverChangeSec', 'Χρόνος αλλαγής οδηγού (δευτ.)'],
            ['tyreChangeSec', 'Χρόνος αλλαγής ελαστικών (δευτ.)'],
            ['refuelRateLps', 'Ρυθμός ρεφιουλαρίσματος (L/δευτ.)'],
            ['planLockHoursBefore', 'Κλείδωμα πλάνων (ώρες πριν)'],
          ].map(([key, label, hint]) => (
            <Field key={key} label={label} hint={hint}>
              <input
                className="champ__input champ__input--num"
                type="number"
                step={key === 'refuelRateLps' ? '0.1' : '1'}
                min="0"
                disabled={!canEdit}
                value={rules[key]}
                onChange={(e) => actions.updateRules({ [key]: Number(e.target.value) })}
              />
            </Field>
          ))}
          <Field
            label="Πλαφόν χρόνου ανά οδηγό (%)"
            hint="Μέγιστο ποσοστό της διάρκειας του αγώνα"
          >
            <input
              className="champ__input champ__input--num"
              type="number"
              min="10"
              max="100"
              disabled={!canEdit}
              value={Math.round(rules.maxDriveShare * 100)}
              onChange={(e) =>
                actions.updateRules({ maxDriveShare: Math.max(0.1, Number(e.target.value) / 100) })
              }
            />
          </Field>
        </div>
      </section>

      <section className="champ__panel">
        <h2>Σύστημα βαθμολογίας</h2>
        <div className="champ__form-grid">
          <Field label="Έτοιμο σύστημα">
            <select
              className="champ__input"
              disabled={!canEdit}
              value={scoring.preset}
              onChange={(e) =>
                actions.updateScoring({
                  preset: e.target.value,
                  table: POINTS_PRESETS[e.target.value].table,
                })
              }
            >
              {Object.entries(POINTS_PRESETS).map(([id, preset]) => (
                <option key={id} value={id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Πίνακας βαθμών" span="wide" hint="Χωρισμένοι με κόμμα, από την 1η θέση">
            <input
              className="champ__input"
              disabled={!canEdit}
              defaultValue={scoring.table.join(', ')}
              key={scoring.table.join(',')}
              onBlur={(e) => {
                const table = e.target.value
                  .split(',')
                  .map((v) => Number(v.trim()))
                  .filter((v) => Number.isFinite(v))
                if (table.length) actions.updateScoring({ table, preset: 'CUSTOM' })
              }}
            />
          </Field>
          <Field label="Βαθμός pole">
            <input
              className="champ__input champ__input--num"
              type="number"
              min="0"
              disabled={!canEdit}
              value={scoring.polePoint}
              onChange={(e) => actions.updateScoring({ polePoint: Number(e.target.value) })}
            />
          </Field>
          <Field label="Βαθμός γρηγορότερου γύρου">
            <input
              className="champ__input champ__input--num"
              type="number"
              min="0"
              disabled={!canEdit}
              value={scoring.fastestLapPoint}
              onChange={(e) => actions.updateScoring({ fastestLapPoint: Number(e.target.value) })}
            />
          </Field>
          <Field label="Ελάχιστο % γύρων νικητή">
            <input
              className="champ__input champ__input--num"
              type="number"
              min="0"
              max="100"
              disabled={!canEdit}
              value={Math.round(scoring.finishRequiredLapsShare * 100)}
              onChange={(e) =>
                actions.updateScoring({ finishRequiredLapsShare: Number(e.target.value) / 100 })
              }
            />
          </Field>
          <Field label="Drop rounds" hint="Πόσα χειρότερα αποτελέσματα αφαιρούνται">
            <input
              className="champ__input champ__input--num"
              type="number"
              min="0"
              max="5"
              disabled={!canEdit}
              value={scoring.dropRounds}
              onChange={(e) => actions.updateScoring({ dropRounds: Number(e.target.value) })}
            />
          </Field>
          <Field label="Αγώνες με διπλούς βαθμούς" span="wide">
            <div className="champ__checks-inline">
              {events.map((event) => (
                <label key={event.id} className="champ__check">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={scoring.doublePointsEvents?.includes(event.id)}
                    onChange={(e) => {
                      const current = scoring.doublePointsEvents || []
                      actions.updateScoring({
                        doublePointsEvents: e.target.checked
                          ? [...current, event.id]
                          : current.filter((id) => id !== event.id),
                      })
                    }}
                  />
                  R{event.round}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </section>

      {viewer.isAdmin ? (
        <section className="champ__panel">
          <h2>Ρόλοι χρηστών</h2>
          <p className="champ__muted">
            Ο ρόλος «{ROLES.ADMIN.label}» βλέπει και αλλάζει τα πάντα. Ο αρχηγός ορίζεται από την
            καρτέλα κάθε ομάδας.
          </p>
          <div className="champ__table-wrap">
            <table className="champ__table">
              <thead>
                <tr>
                  <th>Όνομα</th>
                  <th>Ομάδα</th>
                  <th>Ρόλος</th>
                  <th>Αρχηγός σε</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.id}>
                    <td>{driver.name}</td>
                    <td>{teams.find((t) => t.id === driver.teamId)?.name || '—'}</td>
                    <td>
                      <select
                        className="champ__input champ__input--sm"
                        value={driver.role}
                        onChange={(e) => actions.updateDriver(driver.id, { role: e.target.value })}
                      >
                        {Object.values(ROLES).map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {teams.find((t) => t.principalId === driver.id) ? (
                        <Badge tone="accent">
                          {teams.find((t) => t.principalId === driver.id).name}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="champ__panel">
        <h2>Δεδομένα</h2>
        <p className="champ__muted">
          {backend.isRemote
            ? 'Τα δεδομένα ζουν στη βάση και τα βλέπει όλη η διοργάνωση. Το backup είναι για δικό σου αρχείο ή για να ξεκινήσεις νέα σεζόν.'
            : 'Όλα ζουν στον browser σου (localStorage) — δεν φεύγει τίποτα σε server. Για να δουλέψει ομάδα με ομάδα, κατέβασε backup και στείλ’ το· ο άλλος κάνει εισαγωγή.'}
        </p>
        <div className="champ__btn-row">
          <button type="button" className="btn btn--primary" onClick={() => downloadBackup(state)}>
            Κατέβασε backup (.json)
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => fileInput.current?.click()}>
            {backend.isRemote ? 'Ανέβασε backup στο cloud' : 'Εισαγωγή από αρχείο'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="champ__sr"
            onChange={(e) => handleImport(e.target.files?.[0])}
          />
          {canEdit && !backend.isRemote ? (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  if (window.confirm('Να φορτωθεί ξανά το πρωτάθλημα επίδειξης; Θα χαθούν οι αλλαγές σου.')) {
                    actions.loadDemo()
                    setMessage({ tone: 'ok', text: 'Φορτώθηκε το πρωτάθλημα επίδειξης.' })
                  }
                }}
              >
                Φόρτωσε δεδομένα επίδειξης
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  if (window.confirm('Να σβηστούν ΟΛΑ και να ξεκινήσει κενό πρωτάθλημα;')) {
                    actions.resetAll()
                    setMessage({ tone: 'ok', text: 'Ξεκίνησε κενό πρωτάθλημα.' })
                  }
                }}
              >
                Κενό πρωτάθλημα
              </button>
            </>
          ) : null}
        </div>
        <ul className="champ__list">
          <li className="champ__list-row">
            <span>Ομάδες / οδηγοί / αγώνες</span>
            <span>
              {teams.length} / {drivers.length} / {events.length}
            </span>
          </li>
          <li className="champ__list-row">
            <span>Πλάνα stint</span>
            <span>{state.plans.length}</span>
          </li>
          <li className="champ__list-row">
            <span>Φύλλα αποτελεσμάτων</span>
            <span>{state.results.length}</span>
          </li>
        </ul>
      </section>

      <section className="champ__panel champ__panel--muted">
        <h2>Πλήρες ιστορικό</h2>
        <ul className="champ__log">
          {[...state.log].reverse().map((entry, i) => (
            <li key={`${entry.at}-${i}`}>
              <span className="champ__muted">{new Date(entry.at).toLocaleString('el-GR')}</span>{' '}
              <strong>{entry.who}</strong> — {entry.text}
            </li>
          ))}
          {!state.log.length ? <li className="champ__muted">Κενό.</li> : null}
        </ul>
      </section>
    </>
  )
}
