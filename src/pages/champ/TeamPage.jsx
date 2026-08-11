import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useChampionship } from '../../hooks/useChampionship.js'
import {
  AVAILABILITY,
  CARS_BY_CLASS,
  CLASSES,
  DRIVER_CATEGORIES,
  PLAN_STATUS,
  RESULT_STATUS,
  categoryInfo,
} from '../../lib/lmu/constants.js'
import { classifyEvent } from '../../lib/lmu/standings.js'
import { formatLap } from '../../lib/lmu/utils.js'
import AvailabilityGrid from '../../components/champ/AvailabilityGrid.jsx'
import Badge from '../../components/champ/Badge.jsx'
import ClassTag from '../../components/champ/ClassTag.jsx'
import Field from '../../components/champ/Field.jsx'
import StatTile from '../../components/champ/StatTile.jsx'

/** Καρτέλα ομάδας: στοιχεία, roster, διαθεσιμότητες, πλάνα και αποτελέσματα. */
export default function TeamPage() {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const ctx = useChampionship()
  const { state, events, standings, drivers, can, actions } = ctx
  const team = ctx.teamById(teamId)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)

  if (!team) {
    return (
      <section className="champ__panel">
        <h2>Η ομάδα δεν βρέθηκε</h2>
        <p className="champ__muted">Μπορεί να διαγράφηκε.</p>
        <Link to="/championship/teams" className="btn btn--ghost">
          ← Πίσω στις ομάδες
        </Link>
      </section>
    )
  }

  const canEdit = can('team.edit', { teamId: team.id })
  const canManageRoster = can('roster.edit', { teamId: team.id })
  const roster = ctx.rosterOf(team.id)
  const row = standings.classes
    .find((c) => c.classId === team.carClass)
    ?.teams.find((r) => r.id === team.id)
  const nextEvent = ctx.nextEvent

  return (
    <>
      <section className="champ__panel">
        <div className="champ__panel-head">
          <div>
            <span className="champ__eyebrow">
              #{team.number || '—'} · <ClassTag classId={team.carClass} />
            </span>
            <h2>{team.name}</h2>
            <p className="champ__muted">{team.car || 'χωρίς αυτοκίνητο'}</p>
          </div>
          <div className="champ__btn-row">
            {canEdit ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing((v) => !v)}>
                {editing ? 'Κλείσε' : 'Επεξεργασία'}
              </button>
            ) : null}
            {nextEvent ? (
              <Link
                to={`/championship/planner/${nextEvent.id}/${team.id}`}
                className="btn btn--primary btn--sm"
              >
                Stint plan R{nextEvent.round}
              </Link>
            ) : null}
            {can('teams.delete') ? (
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => {
                  if (window.confirm(`Να διαγραφεί η ομάδα «${team.name}»;`)) {
                    actions.removeTeam(team.id)
                    navigate('/championship/teams')
                  }
                }}
              >
                Διαγραφή ομάδας
              </button>
            ) : null}
          </div>
        </div>

        <div className="champ__grid champ__grid--tiles">
          <StatTile label="Βαθμοί" value={row?.points ?? 0} hint={row ? `${row.rank}η θέση κατηγορίας` : '—'} />
          <StatTile label="Νίκες" value={row?.wins ?? 0} hint={`${row?.podiums ?? 0} βάθρα`} />
          <StatTile label="Οδηγοί" value={roster.length} hint={`${state.championship.rules.minDriversPerCar}–${state.championship.rules.maxDriversPerCar} επιτρέπονται`} />
          <StatTile label="Εγκαταλείψεις" value={row?.dnfs ?? 0} hint={`${row?.starts ?? 0} εκκινήσεις`} />
        </div>

        {editing ? (
          <div className="champ__form-grid champ__form-grid--inline">
            <Field label="Όνομα">
              <input
                className="champ__input"
                value={team.name}
                onChange={(e) => actions.updateTeam(team.id, { name: e.target.value })}
              />
            </Field>
            <Field label="Συντομογραφία">
              <input
                className="champ__input"
                maxLength="4"
                value={team.shortName}
                onChange={(e) => actions.updateTeam(team.id, { shortName: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Νούμερο">
              <input
                className="champ__input"
                value={team.number}
                onChange={(e) => actions.updateTeam(team.id, { number: e.target.value })}
              />
            </Field>
            <Field label="Κατηγορία" hint={can('championship.edit') ? '' : 'μόνο ο διοργανωτής'}>
              <select
                className="champ__input"
                value={team.carClass}
                disabled={!can('championship.edit')}
                onChange={(e) => actions.updateTeam(team.id, { carClass: e.target.value })}
              >
                {CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Αυτοκίνητο">
              <select
                className="champ__input"
                value={team.car}
                onChange={(e) => actions.updateTeam(team.id, { car: e.target.value })}
              >
                {(CARS_BY_CLASS[team.carClass] || []).map((car) => (
                  <option key={car} value={car}>
                    {car}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Χρώμα">
              <input
                className="champ__input champ__input--color"
                type="color"
                value={team.color}
                onChange={(e) => actions.updateTeam(team.id, { color: e.target.value })}
              />
            </Field>
            <Field label="Σημειώσεις ομάδας" span="wide">
              <textarea
                className="champ__input"
                rows="2"
                value={team.notes}
                onChange={(e) => actions.updateTeam(team.id, { notes: e.target.value })}
              />
            </Field>
          </div>
        ) : null}
      </section>

      <section className="champ__panel">
        <div className="champ__panel-head">
          <h2>Roster</h2>
          {canManageRoster ? (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setAdding((v) => !v)}>
              {adding ? 'Άκυρο' : '+ Οδηγός'}
            </button>
          ) : null}
        </div>

        {adding ? (
          <DriverForm
            onSubmit={(patch) => {
              actions.addDriver({ ...patch, teamId: team.id })
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        ) : null}

        <div className="champ__table-wrap">
          <table className="champ__table">
            <thead>
              <tr>
                <th>Οδηγός</th>
                <th>Κατηγορία</th>
                <th title="Διαφορά από τον χρόνο αναφοράς της πίστας">Pace</th>
                <th>Ρόλος</th>
                {nextEvent ? <th>R{nextEvent.round}</th> : null}
                {canManageRoster ? <th aria-label="Ενέργειες" /> : null}
              </tr>
            </thead>
            <tbody>
              {roster.map((driver) => {
                const availability = nextEvent
                  ? AVAILABILITY[ctx.availabilityOf(nextEvent.id, driver.id)]
                  : null
                return (
                  <tr key={driver.id}>
                    <td>
                      {canManageRoster ? (
                        <input
                          className="champ__input champ__input--sm"
                          value={driver.name}
                          onChange={(e) => actions.updateDriver(driver.id, { name: e.target.value })}
                        />
                      ) : (
                        driver.name
                      )}
                      {driver.discord ? <span className="champ__cell-sub">{driver.discord}</span> : null}
                    </td>
                    <td>
                      {canManageRoster ? (
                        <select
                          className="champ__input champ__input--sm"
                          value={driver.category}
                          onChange={(e) => actions.updateDriver(driver.id, { category: e.target.value })}
                        >
                          {DRIVER_CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        categoryInfo(driver.category).label
                      )}
                    </td>
                    <td>
                      {canManageRoster ? (
                        <input
                          className="champ__input champ__input--num"
                          type="number"
                          step="0.1"
                          value={driver.paceDeltaSec}
                          title="Δευτερόλεπτα ανά γύρο σε σχέση με τον χρόνο αναφοράς"
                          onChange={(e) =>
                            actions.updateDriver(driver.id, { paceDeltaSec: Number(e.target.value) })
                          }
                        />
                      ) : (
                        `${driver.paceDeltaSec > 0 ? '+' : ''}${driver.paceDeltaSec}s`
                      )}
                    </td>
                    <td>
                      {driver.id === team.principalId ? (
                        <Badge tone="accent">Αρχηγός</Badge>
                      ) : (
                        <Badge tone="muted">Οδηγός</Badge>
                      )}
                    </td>
                    {nextEvent ? (
                      <td>
                        <Badge tone={availability.tone}>{availability.short}</Badge>
                      </td>
                    ) : null}
                    {canManageRoster ? (
                      <td className="champ__cell-actions">
                        {driver.id !== team.principalId ? (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => actions.setPrincipal(team.id, driver.id)}
                          >
                            Κάν’ τον αρχηγό
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="champ__icon-btn champ__icon-btn--danger"
                          title="Αφαίρεση από την ομάδα"
                          onClick={() => actions.unassignDriver(team.id, driver.id)}
                        >
                          ✕
                        </button>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
              {!roster.length ? (
                <tr>
                  <td colSpan="6" className="champ__muted">
                    Δεν έχει δηλωθεί κανένας οδηγός.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {canManageRoster && drivers.some((d) => !d.teamId && d.role !== 'ADMIN') ? (
          <div className="champ__btn-row">
            <select
              className="champ__input"
              value=""
              onChange={(e) => e.target.value && actions.assignDriver(team.id, e.target.value)}
            >
              <option value="">Πρόσθεσε ελεύθερο οδηγό…</option>
              {drivers
                .filter((d) => !d.teamId && d.role !== 'ADMIN')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {categoryInfo(d.category).label}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
      </section>

      <section className="champ__panel">
        <h2>Διαθεσιμότητα οδηγών</h2>
        <p className="champ__muted">
          Ο κάθε οδηγός δηλώνει μόνος του· ο αρχηγός μπορεί να συμπληρώσει για όλους.
        </p>
        <AvailabilityGrid teamId={team.id} events={events} />
      </section>

      <section className="champ__panel">
        <h2>Πλάνα stint</h2>
        <ul className="champ__list">
          {events.map((event) => {
            const plan = ctx.planFor(event.id, team.id)
            const status = plan ? PLAN_STATUS[plan.status] : null
            return (
              <li key={event.id} className="champ__list-row">
                <span>
                  R{event.round} · {event.name}
                  {plan?.stints.length ? (
                    <span className="champ__muted"> · {plan.stints.length} stint</span>
                  ) : null}
                </span>
                <span className="champ__row-end">
                  {status ? <Badge tone={status.tone}>{status.label}</Badge> : <Badge>Χωρίς πλάνο</Badge>}
                  <Link to={`/championship/planner/${event.id}/${team.id}`} className="champ__link">
                    Άνοιξε →
                  </Link>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="champ__panel">
        <h2>Αποτελέσματα σεζόν</h2>
        <div className="champ__table-wrap">
          <table className="champ__table">
            <thead>
              <tr>
                <th>Αγώνας</th>
                <th>Θέση κατηγορίας</th>
                <th>Κατάσταση</th>
                <th>Γύροι</th>
                <th>Καλύτερος γύρος</th>
                <th>Βαθμοί</th>
              </tr>
            </thead>
            <tbody>
              {standings.events.map((event) => {
                const result = ctx.resultFor(event.id)
                const { ranked } = classifyEvent({ result, teams: state.teams, classId: team.carClass })
                const entry = ranked.find((e) => e.teamId === team.id)
                if (!entry) return null
                return (
                  <tr key={event.id}>
                    <td>
                      R{event.round} · {event.name}
                    </td>
                    <td>{entry.classRank || '—'}</td>
                    <td>{RESULT_STATUS[entry.status]?.label || entry.status}</td>
                    <td>{entry.laps}</td>
                    <td>{formatLap(entry.bestLapSec)}</td>
                    <td className="champ__cell-points">{row?.byEvent[event.id] ?? 0}</td>
                  </tr>
                )
              })}
              {!standings.events.length ? (
                <tr>
                  <td colSpan="6" className="champ__muted">
                    Δεν έχει γίνει ακόμα αγώνας.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

/** Φόρμα νέου οδηγού. */
function DriverForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    category: 'SILVER',
    country: 'Ελλάδα',
    discord: '',
    steamId: '',
    paceDeltaSec: 1,
  })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  return (
    <form
      className="champ__form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
    >
      <div className="champ__form-grid">
        <Field label="Ονοματεπώνυμο" span="wide">
          <input
            className="champ__input"
            required
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Γιάννης Παπαδάκης"
          />
        </Field>
        <Field label="Κατηγορία">
          <select className="champ__input" value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {DRIVER_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Discord">
          <input
            className="champ__input"
            value={form.discord}
            onChange={(e) => set({ discord: e.target.value })}
            placeholder="@nickname"
          />
        </Field>
        <Field label="Steam ID" hint="για την ταυτοποίηση στο LMU">
          <input
            className="champ__input"
            value={form.steamId}
            onChange={(e) => set({ steamId: e.target.value })}
          />
        </Field>
        <Field label="Pace (s/γύρο)" hint="σε σχέση με τον χρόνο αναφοράς">
          <input
            className="champ__input champ__input--num"
            type="number"
            step="0.1"
            value={form.paceDeltaSec}
            onChange={(e) => set({ paceDeltaSec: Number(e.target.value) })}
          />
        </Field>
      </div>
      <div className="champ__btn-row">
        <button type="submit" className="btn btn--primary">
          Πρόσθεσε στο roster
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Άκυρο
        </button>
      </div>
    </form>
  )
}
