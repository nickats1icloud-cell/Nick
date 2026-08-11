import { useState } from 'react'
import { useChampionship } from '../../hooks/useChampionship.js'
import { claimDriver, requestPasswordReset, signIn, signOut, signUp } from '../../lib/lmu/auth.js'
import { initials } from '../../lib/lmu/utils.js'
import Badge from './Badge.jsx'
import Field from './Field.jsx'

/**
 * Πραγματική σύνδεση, όταν τρέχει backend. Ο ρόλος δεν επιλέγεται — προκύπτει
 * από το ποιος είσαι στο roster, και τον επιβάλλει η βάση.
 */
export default function AuthBar() {
  const { viewer, backend } = useChampionship()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const email = backend.session?.user?.email || ''
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

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

  async function handleSubmit(e) {
    e.preventDefault()
    await run(async () => {
      if (mode === 'signup') {
        const { needsConfirmation } = await signUp(form.email, form.password, form.name)
        setMessage(
          needsConfirmation
            ? { tone: 'ok', text: 'Έγινε! Επιβεβαίωσε το email σου και μετά συνδέσου.' }
            : { tone: 'ok', text: 'Καλώς ήρθες.' },
        )
        if (!needsConfirmation) setOpen(false)
      } else if (mode === 'reset') {
        await requestPasswordReset(form.email)
        setMessage({ tone: 'ok', text: 'Έστειλα σύνδεσμο επαναφοράς στο email σου.' })
      } else {
        await signIn(form.email, form.password)
        setOpen(false)
      }
      setForm({ email: '', password: '', name: '' })
    })
  }

  /* --- συνδεδεμένος --- */
  if (backend.session) {
    const tone = viewer.isAdmin ? 'accent' : viewer.isPrincipal ? 'ok' : 'warn'
    return (
      <div className="champ__identity">
        <div className="champ__identity-who">
          <span className="champ__avatar" aria-hidden="true">
            {initials(viewer.user?.name || email)}
          </span>
          <span className="champ__identity-text">
            <strong>{viewer.user?.name || email}</strong>
            <span>
              {viewer.user ? (
                <Badge tone={tone}>{viewer.roleLabel}</Badge>
              ) : (
                <Badge tone="muted">Δεν βρέθηκες στο roster</Badge>
              )}
              {viewer.team ? <span className="champ__identity-team"> · {viewer.team.name}</span> : null}
            </span>
          </span>
        </div>

        <div className="champ__identity-actions">
          {!viewer.user ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const linked = await claimDriver()
                  await backend.reload()
                  setMessage(
                    linked
                      ? { tone: 'ok', text: 'Συνδέθηκες με τη θέση σου στο roster.' }
                      : {
                          tone: 'warn',
                          text: 'Δεν βρήκα οδηγό με αυτό το email — ζήτα από τον αρχηγό σου να το προσθέσει.',
                        },
                  )
                })
              }
            >
              Βρες τη θέση μου
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={busy}
            onClick={() => run(() => signOut())}
          >
            Αποσύνδεση
          </button>
        </div>

        {message ? (
          <p className={`champ__notice champ__notice--${message.tone} champ__identity-msg`}>
            {message.text}
          </p>
        ) : null}
      </div>
    )
  }

  /* --- αποσυνδεδεμένος --- */
  return (
    <div className="champ__identity">
      {!open ? (
        <>
          <div className="champ__identity-who">
            <span className="champ__avatar" aria-hidden="true">
              👤
            </span>
            <span className="champ__identity-text">
              <strong>Επισκέπτης</strong>
              <span className="champ__muted">Βλέπεις καλεντάρι και βαθμολογίες</span>
            </span>
          </div>
          <div className="champ__identity-actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
              Σύνδεση
            </button>
          </div>
        </>
      ) : (
        <form className="champ__auth" onSubmit={handleSubmit}>
          <div className="champ__auth-tabs">
            {[
              ['signin', 'Σύνδεση'],
              ['signup', 'Νέος λογαριασμός'],
              ['reset', 'Ξέχασα τον κωδικό'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`champ__seg${mode === id ? ' is-active' : ''}`}
                onClick={() => {
                  setMode(id)
                  setMessage(null)
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="champ__auth-fields">
            {mode === 'signup' ? (
              <Field label="Όνομα">
                <input
                  className="champ__input"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Γιώργος Παπαδόπουλος"
                  autoComplete="name"
                />
              </Field>
            ) : null}

            <Field label="Email">
              <input
                className="champ__input"
                type="email"
                required
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                autoComplete="email"
              />
            </Field>

            {mode !== 'reset' ? (
              <Field label="Κωδικός" hint={mode === 'signup' ? 'Τουλάχιστον 6 χαρακτήρες' : ''}>
                <input
                  className="champ__input"
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => set({ password: e.target.value })}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </Field>
            ) : null}
          </div>

          <div className="champ__btn-row">
            <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
              {busy
                ? '…'
                : mode === 'signup'
                  ? 'Δημιουργία'
                  : mode === 'reset'
                    ? 'Στείλε σύνδεσμο'
                    : 'Σύνδεση'}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
              Άκυρο
            </button>
          </div>

          {message ? (
            <p className={`champ__notice champ__notice--${message.tone}`}>{message.text}</p>
          ) : null}

          <p className="champ__muted champ__auth-note">
            Ο ρόλος σου βγαίνει από το roster: ο διοργανωτής ή ο αρχηγός σου γράφει το email σου
            στην ομάδα, και μόλις συνδεθείς παίρνεις τα δικαιώματά σου αυτόματα.
          </p>
        </form>
      )}
    </div>
  )
}
