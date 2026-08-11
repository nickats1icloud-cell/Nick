import { useEffect, useState } from 'react'
import { useChampionship } from '../../hooks/useChampionship.js'
import { SUPABASE_URL } from '../../lib/lmu/config.js'
import { createChampionship, listChampionships, uploadState } from '../../lib/lmu/api.js'
import { loadState } from '../../lib/lmu/store.js'
import { buildSeedState } from '../../lib/lmu/seed.js'
import Badge from './Badge.jsx'
import Field from './Field.jsx'

/**
 * Το πάνελ του backend: σε ποιο πρωτάθλημα είμαστε συνδεδεμένοι, δημιουργία
 * νέου, και ανέβασμα ενός τοπικού πρωταθλήματος στο cloud (η γέφυρα από την
 * τοπική λειτουργία στην πραγματική βάση).
 */
export default function CloudPanel() {
  const { backend, state } = useChampionship()
  const [list, setList] = useState([])
  const [form, setForm] = useState({ name: '', season: String(new Date().getFullYear()), organizer: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!backend.isRemote || !backend.session) return
    listChampionships()
      .then(setList)
      .catch(() => setList([]))
  }, [backend.isRemote, backend.session, backend.championshipId])

  if (!backend.isRemote) {
    return (
      <section className="champ__panel">
        <div className="champ__panel-head">
          <h2>Backend</h2>
          <Badge tone="muted">τοπική λειτουργία</Badge>
        </div>
        <p className="champ__muted">
          Τρέχεις χωρίς server: όλα μένουν στο <code>localStorage</code> αυτού του browser και οι
          ρόλοι εφαρμόζονται μόνο στο UI.
        </p>
        <p className="champ__muted">
          Για να δουλέψει η ομάδα ταυτόχρονα από διαφορετικούς υπολογιστές, με πραγματική σύνδεση
          και δικαιώματα που επιβάλλει η βάση, ρύθμισε Supabase:
        </p>
        <ol className="champ__list">
          <li>
            Τρέξε το <code>supabase/migrations/001_championship.sql</code> στο SQL Editor του project
            σου.
          </li>
          <li>
            Βάλε <code>VITE_SUPABASE_URL</code> και <code>VITE_SUPABASE_ANON_KEY</code> σε ένα{' '}
            <code>.env.local</code> (ή στο <code>src/lib/lmu/config.js</code>).
          </li>
          <li>Ξεκίνα ξανά τον dev server — η εφαρμογή περνά μόνη της σε λειτουργία backend.</li>
        </ol>
      </section>
    )
  }

  const host = (() => {
    try {
      return new URL(SUPABASE_URL).host
    } catch {
      return SUPABASE_URL
    }
  })()

  async function run(work) {
    setBusy(true)
    setMessage(null)
    try {
      await work()
    } catch (error) {
      setMessage({ tone: 'bad', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const localSaved = loadState()

  return (
    <section className="champ__panel">
      <div className="champ__panel-head">
        <h2>Backend</h2>
        <Badge tone={backend.error ? 'bad' : 'ok'}>Supabase · {host}</Badge>
      </div>

      <ul className="champ__list">
        <li className="champ__list-row">
          <span>Λογαριασμός</span>
          <span>{backend.session?.user?.email || 'μη συνδεδεμένος (μόνο ανάγνωση)'}</span>
        </li>
        <li className="champ__list-row">
          <span>Πρωτάθλημα</span>
          <span>
            <code>{backend.championshipId || '—'}</code>
          </span>
        </li>
        <li className="champ__list-row">
          <span>Τελευταίος συγχρονισμός</span>
          <span>{backend.saving ? 'σε εξέλιξη…' : 'ενήμερο'}</span>
        </li>
      </ul>

      <div className="champ__btn-row">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => run(() => backend.reload())}
        >
          Ξαναδιάβασε από τη βάση
        </button>
      </div>

      {list.length > 1 ? (
        <Field label="Άλλαξε πρωτάθλημα" hint="Βλέπεις όσα σου επιτρέπει η βάση">
          <select
            className="champ__input"
            value={backend.championshipId || ''}
            onChange={(e) => backend.setChampionshipId(e.target.value)}
          >
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.season ? `· ${c.season}` : ''}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {!backend.session ? (
        <p className="champ__notice">
          Συνδέσου (πάνω δεξιά) για να δημιουργήσεις πρωτάθλημα ή να διαχειριστείς την ομάδα σου.
        </p>
      ) : (
        <>
          <h3>Νέο πρωτάθλημα στο cloud</h3>
          <form
            className="champ__form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                const id = await createChampionship({
                  ...form,
                  displayName: backend.session?.user?.email?.split('@')[0] || '',
                })
                backend.setChampionshipId(id)
                setMessage({ tone: 'ok', text: 'Έτοιμο — είσαι ο διοργανωτής του.' })
              })
            }}
          >
            <Field label="Όνομα" span="wide">
              <input
                className="champ__input"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Greek Endurance Series"
              />
            </Field>
            <Field label="Σεζόν">
              <input
                className="champ__input"
                value={form.season}
                onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
              />
            </Field>
            <Field label="Διοργανωτής">
              <input
                className="champ__input"
                value={form.organizer}
                onChange={(e) => setForm((f) => ({ ...f, organizer: e.target.value }))}
              />
            </Field>
            <div className="champ__field champ__field--wide champ__btn-row">
              <button type="submit" className="btn btn--primary" disabled={busy}>
                Δημιουργία
              </button>
            </div>
          </form>

          <h3>Ανέβασμα τοπικού πρωταθλήματος</h3>
          <p className="champ__muted">
            Αντιγράφει ομάδες, οδηγούς, καλεντάρι, διαθεσιμότητες, πλάνα και αποτελέσματα σε νέο
            πρωτάθλημα στη βάση. Τα ids που δεν είναι UUID (π.χ. του demo) ξαναφτιάχνονται,
            κρατώντας τις σχέσεις.
          </p>
          <div className="champ__btn-row">
            {localSaved ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const id = await uploadState(localSaved, {
                      displayName: backend.session?.user?.email?.split('@')[0] || '',
                    })
                    backend.setChampionshipId(id)
                    setMessage({
                      tone: 'ok',
                      text: `Ανέβηκε «${localSaved.championship.name}» στο cloud.`,
                    })
                  })
                }
              >
                Ανέβασε το τοπικό «{localSaved.championship.name}»
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const id = await uploadState(buildSeedState(), {
                    displayName: backend.session?.user?.email?.split('@')[0] || '',
                  })
                  backend.setChampionshipId(id)
                  setMessage({ tone: 'ok', text: 'Ανέβηκε το πρωτάθλημα επίδειξης.' })
                })
              }
            >
              Ανέβασε το πρωτάθλημα επίδειξης
            </button>
            {state.teams.length ? (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const id = await uploadState(state, {
                      displayName: backend.session?.user?.email?.split('@')[0] || '',
                    })
                    backend.setChampionshipId(id)
                    setMessage({ tone: 'ok', text: 'Έγινε αντίγραφο του τρέχοντος πρωταθλήματος.' })
                  })
                }
              >
                Αντίγραφο του τρέχοντος
              </button>
            ) : null}
          </div>
        </>
      )}

      {message ? (
        <p className={`champ__notice champ__notice--${message.tone}`}>{message.text}</p>
      ) : null}
    </section>
  )
}
