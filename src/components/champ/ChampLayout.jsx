import { NavLink, Outlet } from 'react-router-dom'
import { useChampionship } from '../../hooks/useChampionship.js'
import IdentityBar from './IdentityBar.jsx'

const TABS = [
  { to: '.', label: 'Επισκόπηση', end: true },
  { to: 'calendar', label: 'Καλεντάρι' },
  { to: 'teams', label: 'Ομάδες' },
  { to: 'planner', label: 'Stint Planner' },
  { to: 'results', label: 'Αποτελέσματα' },
  { to: 'standings', label: 'Βαθμολογία' },
  { to: 'admin', label: 'Διαχείριση' },
]

/** Το κέλυφος του management system: τίτλος, καρτέλες, ταυτότητα χρήστη. */
export default function ChampLayout() {
  const { championship, storageOk, events, standings } = useChampionship()
  const done = standings.events.length

  return (
    <div className="champ container">
      <header className="champ__header">
        <div className="champ__header-main">
          <span className="champ__eyebrow">Race Control · Le Mans Ultimate</span>
          <h1>{championship.name}</h1>
          <p className="champ__lead">
            Σεζόν {championship.season}
            {championship.organizer ? ` · ${championship.organizer}` : ''} · {done}/{events.length}{' '}
            αγώνες ολοκληρωμένοι
          </p>
        </div>
        <IdentityBar />
      </header>

      {!storageOk ? (
        <p className="champ__notice champ__notice--bad">
          Δεν μπορώ να γράψω στο localStorage του browser (ιδιωτική περιήγηση ή γεμάτος χώρος). Η
          εφαρμογή δουλεύει, αλλά <strong>οι αλλαγές θα χαθούν στο refresh</strong> — κατέβασε
          backup από τη Διαχείριση.
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
