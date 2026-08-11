import { NavLink, Outlet } from 'react-router-dom'
import { useChampionship } from '../../hooks/useChampionship.js'
import IdentityBar from './IdentityBar.jsx'
import Badge from './Badge.jsx'

const TABS = [
  { to: '.', label: 'Επισκόπηση', end: true },
  { to: 'calendar', label: 'Καλεντάρι' },
  { to: 'teams', label: 'Ομάδες' },
  { to: 'planner', label: 'Stint Planner' },
  { to: 'results', label: 'Αποτελέσματα' },
  { to: 'standings', label: 'Βαθμολογία' },
  { to: 'admin', label: 'Διαχείριση' },
]

/** Το κέλυφος του management system: τίτλος, καρτέλες, ταυτότητα, κατάσταση sync. */
export default function ChampLayout() {
  const { championship, storageOk, events, standings, backend } = useChampionship()
  const done = standings.events.length

  return (
    <div className="champ container">
      <header className="champ__header">
        <div className="champ__header-main">
          <span className="champ__eyebrow">
            Race Control · Le Mans Ultimate
            {backend.isRemote ? (
              <Badge tone={backend.error ? 'bad' : backend.saving ? 'warn' : 'ok'}>
                {backend.error ? 'σφάλμα sync' : backend.saving ? 'αποθηκεύει…' : 'συνδεδεμένο'}
              </Badge>
            ) : (
              <Badge tone="muted">τοπική λειτουργία</Badge>
            )}
          </span>
          <h1>{championship.name}</h1>
          <p className="champ__lead">
            Σεζόν {championship.season}
            {championship.organizer ? ` · ${championship.organizer}` : ''} · {done}/{events.length}{' '}
            αγώνες ολοκληρωμένοι
          </p>
        </div>
        <IdentityBar />
      </header>

      {backend.error ? (
        <p className="champ__notice champ__notice--bad">
          <strong>Η βάση απέρριψε την αλλαγή.</strong> {backend.error}{' '}
          <button type="button" className="btn btn--ghost btn--sm" onClick={backend.dismissError}>
            Εντάξει
          </button>
        </p>
      ) : null}

      {!backend.isRemote && !storageOk ? (
        <p className="champ__notice champ__notice--bad">
          Δεν μπορώ να γράψω στο localStorage του browser (ιδιωτική περιήγηση ή γεμάτος χώρος). Η
          εφαρμογή δουλεύει, αλλά <strong>οι αλλαγές θα χαθούν στο refresh</strong> — κατέβασε
          backup από τη Διαχείριση.
        </p>
      ) : null}

      {backend.isRemote && backend.loading ? (
        <p className="champ__notice">Φορτώνω το πρωτάθλημα από τη βάση…</p>
      ) : null}

      {backend.isRemote && backend.ready && !backend.championshipId ? (
        <p className="champ__notice champ__notice--warn">
          Δεν υπάρχει ακόμα πρωτάθλημα στη βάση.{' '}
          {backend.session ? (
            <>
              Πήγαινε στη <NavLink to="admin">Διαχείριση</NavLink> για να φτιάξεις ένα ή να ανεβάσεις
              το τοπικό σου.
            </>
          ) : (
            'Συνδέσου για να φτιάξεις ένα.'
          )}
        </p>
      ) : null}

      <nav className="champ__tabs">
        {TABS.map((tab) => (
          <NavLink key={tab.label} to={tab.to} end={tab.end} className="champ__tab">
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
