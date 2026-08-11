import { useState } from 'react'
import { useChampionship } from '../../hooks/useChampionship.js'
import { CARS_BY_CLASS, CLASSES, categoryInfo } from '../../lib/lmu/constants.js'
import Badge from '../../components/champ/Badge.jsx'
import ClassTag from '../../components/champ/ClassTag.jsx'
import Field from '../../components/champ/Field.jsx'
import TeamCard from '../../components/champ/TeamCard.jsx'

/** Λίστα ομάδων ανά κατηγορία + δημιουργία ομάδας και διαχείριση ελεύθερων οδηγών. */
export default function Teams() {
  const { teams, drivers, championship, standings, viewer, can, actions } = useChampionship()
  const [filter, setFilter] = useState('ALL')
  const [creating, setCreating] = useState(false)
  const canCreate = can('teams.create')

  const visible = teams.filter((t) => filter === 'ALL' || t.carClass === filter)
  const freeAgents = drivers.filter((d) => !d.teamId && d.role !== 'ADMIN')

  const standingsFor = (team) => {
    const table = standings.classes.find((c) => c.classId === team.carClass)
    return table?.teams.find((row) => row.id === team.id) || null
  }

  return (
    <>
      <section className="champ__panel-head champ__panel-head--page">
        <div>
          <h2>Ομάδες</h2>
          <p className="champ__muted">
            {teams.length} ομάδες · {drivers.filter((d) => d.teamId).length} δηλωμένοι οδηγοί
          </p>
        </div>
        <div className="champ__btn-row">
          <select className="champ__input" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">Όλες οι κατηγορίες</option>
            {championship.classes.map((id) => (
              <option key={id} value={id}>
                {CLASSES.find((c) => c.id === id)?.label || id}
              </option>
            ))}
          </select>
          {canCreate ? (
            <button type="button" className="btn btn--primary" onClick={() => setCreating((v) => !v)}>
              {creating ? 'Άκυρο' : '+ Νέα ομάδα'}
            </button>
          ) : null}
        </div>
      </section>

      {creating ? (
        <TeamForm
          classes={championship.classes}
          onSubmit={(patch) => {
            actions.addTeam(patch)
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      <section className="champ__grid champ__grid--cards">
        {visible.map((team) => {
          const row = standingsFor(team)
          return (
            <TeamCard
              key={team.id}
              team={team}
              points={row?.points}
              rank={row?.rank}
              isMine={viewer.ledTeams.some((t) => t.id === team.id) || viewer.team?.id === team.id}
            />
          )
        })}
        {!visible.length ? <p className="champ__muted">Καμία ομάδα σε αυτή την κατηγορία.</p> : null}
      </section>

      <section className="champ__panel">
        <div className="champ__panel-head">
          <h2>Ελεύθεροι οδηγοί</h2>
          <span className="champ__muted">{freeAgents.length} χωρίς ομάδα</span>
        </div>
        {freeAgents.length ? (
          <ul className="champ__list">
            {freeAgents.map((driver) => (
              <li key={driver.id} className="champ__list-row">
                <span>
                  {driver.name} <Badge tone="muted">{categoryInfo(driver.category).label}</Badge>
                </span>
                {can('teams.create') || viewer.isPrincipal ? (
                  <select
                    className="champ__input champ__input--sm"
                    value=""
                    onChange={(e) => e.target.value && actions.assignDriver(e.target.value, driver.id)}
                  >
                    <option value="">Ανάθεση σε ομάδα…</option>
                    {(viewer.isAdmin ? teams : viewer.ledTeams).map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <ClassTag classId="LMP2" short />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="champ__muted">Όλοι οι οδηγοί έχουν ομάδα.</p>
        )}
      </section>
    </>
  )
}

/** Φόρμα δημιουργίας ομάδας. */
function TeamForm({ classes, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    shortName: '',
    carClass: classes[0] || 'LMP2',
    car: CARS_BY_CLASS[classes[0] || 'LMP2']?.[0] || '',
    number: '',
    color: '#7c5cff',
  })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const cars = CARS_BY_CLASS[form.carClass] || []

  return (
    <form
      className="champ__panel champ__form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
    >
      <h3>Νέα ομάδα</h3>
      <div className="champ__form-grid">
        <Field label="Όνομα ομάδας" span="wide">
          <input
            className="champ__input"
            required
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Aegean Motorsport"
          />
        </Field>
        <Field label="Συντομογραφία" hint="3 γράμματα για τους πίνακες">
          <input
            className="champ__input"
            maxLength="4"
            value={form.shortName}
            onChange={(e) => set({ shortName: e.target.value.toUpperCase() })}
            placeholder="AEG"
          />
        </Field>
        <Field label="Κατηγορία">
          <select
            className="champ__input"
            value={form.carClass}
            onChange={(e) =>
              set({ carClass: e.target.value, car: CARS_BY_CLASS[e.target.value]?.[0] || '' })
            }
          >
            {classes.map((id) => (
              <option key={id} value={id}>
                {CLASSES.find((c) => c.id === id)?.label || id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Αυτοκίνητο">
          <select className="champ__input" value={form.car} onChange={(e) => set({ car: e.target.value })}>
            {cars.map((car) => (
              <option key={car} value={car}>
                {car}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Νούμερο">
          <input
            className="champ__input"
            value={form.number}
            onChange={(e) => set({ number: e.target.value })}
            placeholder="7"
          />
        </Field>
        <Field label="Χρώμα">
          <input
            className="champ__input champ__input--color"
            type="color"
            value={form.color}
            onChange={(e) => set({ color: e.target.value })}
          />
        </Field>
      </div>
      <div className="champ__btn-row">
        <button type="submit" className="btn btn--primary">
          Δημιουργία
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Άκυρο
        </button>
      </div>
    </form>
  )
}
