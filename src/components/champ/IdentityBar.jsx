import { ROLES } from '../../lib/lmu/constants.js'
import { initials } from '../../lib/lmu/utils.js'
import { useChampionship } from '../../hooks/useChampionship.js'
import Badge from './Badge.jsx'

/**
 * «Σύνδεση» με επιλογή ταυτότητας. Δεν υπάρχει server ούτε κωδικοί: διαλέγεις
 * ποιος είσαι και το UI ξεκλειδώνει ό,τι επιτρέπει ο ρόλος σου.
 */
export default function IdentityBar() {
  const { state, drivers, teams, viewer, actions } = useChampionship()

  const groups = [
    { label: 'Διοργάνωση', list: drivers.filter((d) => d.role === ROLES.ADMIN.id) },
    {
      label: 'Αρχηγοί ομάδων',
      list: drivers.filter((d) => d.role !== ROLES.ADMIN.id && teams.some((t) => t.principalId === d.id)),
    },
    {
      label: 'Οδηγοί',
      list: drivers.filter(
        (d) => d.role !== ROLES.ADMIN.id && !teams.some((t) => t.principalId === d.id),
      ),
    },
  ].filter((g) => g.list.length)

  const tone = viewer.isAdmin ? 'accent' : viewer.isPrincipal ? 'ok' : viewer.isGuest ? 'muted' : 'warn'

  return (
    <div className="champ__identity">
      <div className="champ__identity-who">
        <span className="champ__avatar" aria-hidden="true">
          {viewer.user ? initials(viewer.user.name) : '👤'}
        </span>
        <span className="champ__identity-text">
          <strong>{viewer.user?.name || 'Επισκέπτης'}</strong>
          <span>
            <Badge tone={tone}>{viewer.roleLabel}</Badge>
            {viewer.team ? <span className="champ__identity-team"> · {viewer.team.name}</span> : null}
          </span>
        </span>
      </div>

      <div className="champ__identity-actions">
        <label className="champ__identity-select">
          <span className="champ__sr">Σύνδεση ως</span>
          <select
            className="champ__input"
            value={state.session.userId || ''}
            onChange={(e) => (e.target.value ? actions.login(e.target.value) : actions.logout())}
          >
            <option value="">— Επισκέπτης (μόνο ανάγνωση) —</option>
            {groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.list.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {teams.find((t) => t.id === d.teamId)
                      ? ` — ${teams.find((t) => t.id === d.teamId).shortName || teams.find((t) => t.id === d.teamId).name}`
                      : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
