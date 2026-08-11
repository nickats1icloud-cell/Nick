import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useChampionship } from '../../hooks/useChampionship.js'
import { TRACKS, trackInfo } from '../../lib/lmu/constants.js'
import { eventWinners } from '../../lib/lmu/standings.js'
import { formatMinutes } from '../../lib/lmu/utils.js'
import EventCard from '../../components/champ/EventCard.jsx'
import Field from '../../components/champ/Field.jsx'

const DURATION_PRESETS = [
  { label: '1 ώρα (sprint)', value: 60 },
  { label: '2 ώρες 40′', value: 160 },
  { label: '4 ώρες', value: 240 },
  { label: '6 ώρες', value: 360 },
  { label: '8 ώρες', value: 480 },
  { label: '12 ώρες', value: 720 },
  { label: '24 ώρες', value: 1440 },
]

const STATUSES = [
  { id: 'UPCOMING', label: 'Επόμενος' },
  { id: 'LIVE', label: 'Σε εξέλιξη' },
  { id: 'DONE', label: 'Ολοκληρώθηκε' },
]

/** Το καλεντάρι της σεζόν. Ο διοργανωτής προσθέτει/αλλάζει αγώνες. */
export default function Calendar() {
  const { state, events, championship, can, actions } = useChampionship()
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const canEdit = can('events.edit')

  const totalMinutes = events.reduce((acc, e) => acc + e.durationMinutes, 0)

  return (
    <>
      <section className="champ__panel-head champ__panel-head--page">
        <div>
          <h2>Καλεντάρι σεζόν {championship.season}</h2>
          <p className="champ__muted">
            {events.length} αγώνες · {formatMinutes(totalMinutes)} συνολικός αγωνιστικός χρόνος
          </p>
        </div>
        {canEdit ? (
          <button type="button" className="btn btn--primary" onClick={() => setCreating((v) => !v)}>
            {creating ? 'Άκυρο' : '+ Νέος αγώνας'}
          </button>
        ) : null}
      </section>

      {creating ? (
        <EventForm
          onSubmit={(patch) => {
            actions.addEvent(patch)
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      <div className="champ__events">
        {events.map((event) => (
          <div key={event.id}>
            <EventCard
              event={event}
              winners={event.status === 'DONE' ? eventWinners(state, event.id) : []}
              doublePoints={championship.scoring.doublePointsEvents?.includes(event.id)}
            >
              <Link to={`/championship/planner/${event.id}`} className="btn btn--ghost btn--sm">
                Stint plans
              </Link>
              <Link to="/championship/results" className="btn btn--ghost btn--sm">
                Αποτελέσματα
              </Link>
              {canEdit ? (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setEditing(editing === event.id ? null : event.id)}
                  >
                    {editing === event.id ? 'Κλείσε' : 'Επεξεργασία'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Να διαγραφεί ο αγώνας «${event.name}»; Θα χαθούν και τα πλάνα και τα αποτελέσματά του.`,
                        )
                      ) {
                        actions.removeEvent(event.id)
                      }
                    }}
                  >
                    Διαγραφή
                  </button>
                </>
              ) : null}
            </EventCard>

            {editing === event.id ? (
              <EventForm
                event={event}
                onSubmit={(patch) => {
                  actions.updateEvent(event.id, patch)
                  setEditing(null)
                }}
                onCancel={() => setEditing(null)}
              />
            ) : null}
          </div>
        ))}
        {!events.length ? (
          <p className="champ__muted">
            Το καλεντάρι είναι κενό. {canEdit ? 'Πρόσθεσε τον πρώτο αγώνα.' : ''}
          </p>
        ) : null}
      </div>
    </>
  )
}

/** Φόρμα αγώνα — ίδια για δημιουργία και για επεξεργασία. */
function EventForm({ event, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: event?.name || '',
    trackId: event?.trackId || TRACKS[0].id,
    dateISO: event?.dateISO || '',
    durationMinutes: event?.durationMinutes || 360,
    round: event?.round || undefined,
    status: event?.status || 'UPCOMING',
    notes: event?.notes || '',
  }))

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const track = trackInfo(form.trackId)

  function handleTrack(trackId) {
    const next = trackInfo(trackId)
    // Αν ο τίτλος δεν έχει πειραχτεί, πρότεινε έναν με βάση την πίστα.
    const auto = !form.name || TRACKS.some((t) => form.name.includes(t.name))
    set({
      trackId,
      name: auto && next ? `${formatMinutes(form.durationMinutes)} — ${next.name}` : form.name,
    })
  }

  return (
    <form
      className="champ__panel champ__form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          ...form,
          durationMinutes: Number(form.durationMinutes),
          round: form.round ? Number(form.round) : undefined,
        })
      }}
    >
      <h3>{event ? 'Επεξεργασία αγώνα' : 'Νέος αγώνας'}</h3>
      <div className="champ__form-grid">
        <Field label="Όνομα αγώνα" span="wide">
          <input
            className="champ__input"
            required
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="6 Ώρες Fuji"
          />
        </Field>

        <Field label="Πίστα" hint={track ? `${track.lengthKm} km · ${track.country}` : ''}>
          <select className="champ__input" value={form.trackId} onChange={(e) => handleTrack(e.target.value)}>
            {TRACKS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ημερομηνία & ώρα εκκίνησης">
          <input
            className="champ__input"
            type="datetime-local"
            value={form.dateISO}
            onChange={(e) => set({ dateISO: e.target.value })}
          />
        </Field>

        <Field label="Διάρκεια">
          <select
            className="champ__input"
            value={form.durationMinutes}
            onChange={(e) => set({ durationMinutes: Number(e.target.value) })}
          >
            {DURATION_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            {!DURATION_PRESETS.some((p) => p.value === Number(form.durationMinutes)) ? (
              <option value={form.durationMinutes}>{formatMinutes(form.durationMinutes)}</option>
            ) : null}
          </select>
        </Field>

        <Field label="Λεπτά (χειροκίνητα)">
          <input
            className="champ__input"
            type="number"
            min="10"
            max="1440"
            value={form.durationMinutes}
            onChange={(e) => set({ durationMinutes: Number(e.target.value) })}
          />
        </Field>

        <Field label="Κατάσταση">
          <select className="champ__input" value={form.status} onChange={(e) => set({ status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        {event ? (
          <Field label="Αριθμός αγώνα">
            <input
              className="champ__input"
              type="number"
              min="1"
              value={form.round}
              onChange={(e) => set({ round: e.target.value })}
            />
          </Field>
        ) : null}

        <Field label="Σημειώσεις για τις ομάδες" span="wide">
          <textarea
            className="champ__input"
            rows="2"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="π.χ. υποχρεωτικά 3 οδηγοί, διπλοί βαθμοί"
          />
        </Field>
      </div>

      <div className="champ__btn-row">
        <button type="submit" className="btn btn--primary">
          {event ? 'Αποθήκευση' : 'Πρόσθεσε στο καλεντάρι'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Άκυρο
        </button>
      </div>
    </form>
  )
}
