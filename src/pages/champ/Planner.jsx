import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePlan, useChampionship } from '../../hooks/useChampionship.js'
import { PLAN_STATUS, trackInfo } from '../../lib/lmu/constants.js'
import { computePlan, lapsPerTank } from '../../lib/lmu/stints.js'
import { validatePlan } from '../../lib/lmu/rules.js'
import { downloadPlan } from '../../lib/lmu/exports.js'
import { formatDuration, formatLap, formatMinutes, parseLap, round } from '../../lib/lmu/utils.js'
import Badge from '../../components/champ/Badge.jsx'
import ClassTag from '../../components/champ/ClassTag.jsx'
import DriverLoad from '../../components/champ/DriverLoad.jsx'
import Field from '../../components/champ/Field.jsx'
import RuleChecks from '../../components/champ/RuleChecks.jsx'
import StatTile from '../../components/champ/StatTile.jsx'
import StintTable from '../../components/champ/StintTable.jsx'
import StintTimeline from '../../components/champ/StintTimeline.jsx'

/**
 * Ο Stint Planner: μία ομάδα, ένας αγώνας, όλο το πλάνο. Ό,τι αλλάζεις
 * υπολογίζεται ξανά αμέσως (χρονογραμμή, καύσιμα, φόρτος οδηγών, κανονισμός).
 */
export default function Planner() {
  const params = useParams()
  const navigate = useNavigate()
  const ctx = useChampionship()
  const { state, events, teams, viewer, nextEvent, championship, can, actions } = ctx

  const eventId = params.eventId || nextEvent?.id || events[0]?.id || null
  const defaultTeam = viewer.team?.id || ctx.myTeams[0]?.id || teams[0]?.id || null
  const teamId = params.teamId || defaultTeam

  // Κρατάμε το URL συγχρονισμένο, ώστε το πλάνο να μοιράζεται με link.
  useEffect(() => {
    if (eventId && teamId && (!params.eventId || !params.teamId)) {
      navigate(`/championship/planner/${eventId}/${teamId}`, { replace: true })
    }
  }, [eventId, teamId, params.eventId, params.teamId, navigate])

  const { plan, computed, validation, team, event } = usePlan(eventId, teamId)

  // Επισκόπηση για τον διοργανωτή: πού βρίσκεται κάθε ομάδα σε αυτόν τον αγώνα.
  const overview = useMemo(() => {
    if (!viewer.isAdmin || !event) return []
    return teams.map((t) => {
      const teamPlan = ctx.planFor(event.id, t.id)
      if (!teamPlan) return { team: t, plan: null, computed: null, validation: null }
      const c = computePlan({
        plan: teamPlan,
        team: t,
        event,
        drivers: state.drivers,
        rules: championship.rules,
      })
      return {
        team: t,
        plan: teamPlan,
        computed: c,
        validation: validatePlan({
          computed: c,
          plan: teamPlan,
          team: t,
          event,
          drivers: state.drivers,
          availability: state.availability,
          rules: championship.rules,
        }),
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.isAdmin, event, teams, state.plans, state.drivers, state.availability, championship.rules])

  if (!events.length || !teams.length) {
    return (
      <section className="champ__panel">
        <h2>Ο planner χρειάζεται αγώνα και ομάδα</h2>
        <p className="champ__muted">
          Πρόσθεσε πρώτα έναν αγώνα στο <Link to="/championship/calendar">καλεντάρι</Link> και μία{' '}
          <Link to="/championship/teams">ομάδα</Link>.
        </p>
      </section>
    )
  }

  if (!plan || !computed) {
    return (
      <section className="champ__panel">
        <h2>Φόρτωση πλάνου…</h2>
      </section>
    )
  }

  const track = trackInfo(event?.trackId)
  const status = PLAN_STATUS[plan.status]
  const locked = plan.status === 'APPROVED' && !viewer.isAdmin
  const canEdit = can('plan.edit', { teamId: team.id }) && !locked
  const roster = ctx.rosterOf(team.id)
  const exportPayload = { plan, computed, validation, team, event, championship }

  return (
    <>
      <section className="champ__panel">
        <div className="champ__panel-head champ__panel-head--page">
          <div>
            <span className="champ__eyebrow">Stint Planner</span>
            <h2>
              {team.name} <ClassTag classId={team.carClass} short />
            </h2>
            <p className="champ__muted">
              R{event.round} · {event.name} · {track?.name} · {formatMinutes(event.durationMinutes)}
            </p>
          </div>
          <div className="champ__planner-select">
            <Field label="Αγώνας">
              <select
                className="champ__input"
                value={eventId}
                onChange={(e) => navigate(`/championship/planner/${e.target.value}/${teamId}`)}
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    R{ev.round} · {ev.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ομάδα">
              <select
                className="champ__input"
                value={teamId}
                onChange={(e) => navigate(`/championship/planner/${eventId}/${e.target.value}`)}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.number} {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="champ__planner-status">
          <Badge tone={status.tone}>{status.label}</Badge>
          {locked ? (
            <span className="champ__muted">
              Το πλάνο είναι εγκεκριμένο και κλειδωμένο — ζήτα από τη διοργάνωση να το ξεκλειδώσει.
            </span>
          ) : null}
          {!can('plan.edit', { teamId: team.id }) ? (
            <span className="champ__muted">
              Βλέπεις το πλάνο σε ανάγνωση. Επεξεργασία έχουν ο αρχηγός της ομάδας και η διοργάνωση.
            </span>
          ) : null}
        </div>

        <div className="champ__grid champ__grid--tiles">
          <StatTile
            label="Κάλυψη αγώνα"
            value={`${Math.round(computed.coverage * 100)}%`}
            hint={`${formatDuration(computed.totals.totalSec)} / ${formatMinutes(event.durationMinutes)}`}
            tone={computed.deltaSec < -30 ? 'bad' : 'ok'}
          />
          <StatTile label="Stint" value={computed.stints.length} hint={`${computed.totals.stops} στάσεις`} />
          <StatTile label="Γύροι" value={computed.totals.laps} hint={`${computed.totals.distanceKm} km`} />
          <StatTile
            label="Έλεγχος κανόνων"
            value={`${validation.errors} / ${validation.warnings}`}
            hint="σφάλματα / προειδοποιήσεις"
            tone={validation.errors ? 'bad' : validation.warnings ? 'warn' : 'ok'}
          />
        </div>
      </section>

      <section className="champ__panel">
        <div className="champ__panel-head">
          <h2>Το αυτοκίνητο σε αυτή την πίστα</h2>
          {canEdit ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => actions.resetCar(plan.id)}>
              Επαναφορά προτεινόμενων
            </button>
          ) : null}
        </div>
        <div className="champ__form-grid champ__form-grid--inline">
          <Field label="Ρεζερβουάρ (L)">
            <input
              className="champ__input champ__input--num"
              type="number"
              min="1"
              disabled={!canEdit}
              value={computed.car.tankL}
              onChange={(e) => actions.updateCar(plan.id, { tankL: Number(e.target.value) })}
            />
          </Field>
          <Field label="Κατανάλωση (L/γύρο)">
            <input
              className="champ__input champ__input--num"
              type="number"
              step="0.05"
              min="0.1"
              disabled={!canEdit}
              value={computed.car.fuelPerLapL}
              onChange={(e) => actions.updateCar(plan.id, { fuelPerLapL: Number(e.target.value) })}
            />
          </Field>
          <Field label="Χρόνος γύρου" hint="μέσος ρυθμός αγώνα">
            <input
              className="champ__input champ__input--num"
              type="text"
              disabled={!canEdit}
              defaultValue={formatLap(computed.car.lapTimeSec)}
              key={`lap-${plan.id}-${computed.car.lapTimeSec}`}
              onBlur={(e) => {
                const parsed = parseLap(e.target.value)
                if (parsed > 0) actions.updateCar(plan.id, { lapTimeSec: parsed })
              }}
            />
          </Field>
          <Field label="Ζωή ελαστικών (γύροι)">
            <input
              className="champ__input champ__input--num"
              type="number"
              min="1"
              disabled={!canEdit}
              value={computed.car.tyreLifeLaps}
              onChange={(e) => actions.updateCar(plan.id, { tyreLifeLaps: Number(e.target.value) })}
            />
          </Field>
          <Field label="Γύροι με γεμάτο ρεζερβουάρ">
            <output className="champ__output">
              {lapsPerTank(computed.car)} γύροι ·{' '}
              {formatMinutes((lapsPerTank(computed.car) * computed.car.lapTimeSec) / 60)}
            </output>
          </Field>
          <Field label="Θεωρητικοί γύροι αγώνα">
            <output className="champ__output">
              ≈ {Math.floor((event.durationMinutes * 60) / computed.car.lapTimeSec)} γύροι ·{' '}
              {round(((event.durationMinutes * 60) / computed.car.lapTimeSec) * (track?.lengthKm || 0), 0)} km
            </output>
          </Field>
        </div>
      </section>

      <section className="champ__panel">
        <div className="champ__panel-head">
          <h2>Χρονογραμμή αγώνα</h2>
          <span className="champ__muted">
            Καύσιμα {computed.totals.fuelL} L · {computed.totals.tyreSets} σετ ελαστικών · pit{' '}
            {formatDuration(computed.totals.pitSec)}
          </span>
        </div>
        <StintTimeline computed={computed} />

        {canEdit ? (
          <div className="champ__btn-row">
            <button type="button" className="btn btn--primary" onClick={() => actions.autofillPlan(plan.id)}>
              Αυτόματο πλάνο
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => actions.addStint(plan.id, { driverId: roster[0]?.id || null })}
            >
              + Stint
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                if (window.confirm('Να καθαριστούν όλα τα stint;')) actions.clearPlan(plan.id)
              }}
            >
              Καθάρισε
            </button>
          </div>
        ) : null}
      </section>

      {computed.stints.length ? (
        <section className="champ__panel">
          <h2>Πλάνο stint</h2>
          <StintTable
            computed={computed}
            plan={plan}
            roster={roster}
            canEdit={canEdit}
            actions={actions}
            availabilityOf={ctx.availabilityOf}
            eventId={event.id}
          />
        </section>
      ) : (
        <section className="champ__panel champ__empty">
          <p>Το πλάνο είναι άδειο.</p>
          {canEdit ? (
            <button type="button" className="btn btn--primary" onClick={() => actions.autofillPlan(plan.id)}>
              Φτιάξε αυτόματο πλάνο για {formatMinutes(event.durationMinutes)}
            </button>
          ) : null}
        </section>
      )}

      {computed.stints.length ? (
        <section className="champ__panel">
          <h2>Φόρτος οδηγών</h2>
          <DriverLoad computed={computed} rules={championship.rules} />
        </section>
      ) : null}

      <RuleChecks validation={validation} />

      <section className="champ__panel">
        <div className="champ__panel-head">
          <h2>Στρατηγική & υποβολή</h2>
          <span className="champ__muted">
            Τελευταία αλλαγή: {new Date(plan.updatedAt).toLocaleString('el-GR')}
          </span>
        </div>

        <Field label="Σημειώσεις στρατηγικής (τις βλέπει και η διοργάνωση)" span="wide">
          <textarea
            className="champ__input"
            rows="3"
            disabled={!canEdit}
            value={plan.strategyNote}
            placeholder="π.χ. Διπλό stint στα ελαστικά, ο Bronze μπαίνει στο 3ο stint, full wet αν βρέξει μετά τις 2 ώρες."
            onChange={(e) => actions.updatePlan(plan.id, { strategyNote: e.target.value })}
          />
        </Field>

        <div className="champ__btn-row">
          {can('plan.submit', { teamId: team.id }) && plan.status !== 'APPROVED' ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={!validation.ok}
              title={validation.ok ? '' : 'Διόρθωσε πρώτα τα σφάλματα του κανονισμού'}
              onClick={() => actions.setPlanStatus(plan.id, 'SUBMITTED')}
            >
              Υποβολή στη διοργάνωση
            </button>
          ) : null}

          {can('plan.approve') ? (
            <>
              <button
                type="button"
                className="btn btn--primary"
                disabled={plan.status === 'APPROVED'}
                onClick={() => actions.setPlanStatus(plan.id, 'APPROVED')}
              >
                Έγκριση
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => actions.setPlanStatus(plan.id, 'CHANGES')}
              >
                Επιστροφή για αλλαγές
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => actions.setPlanStatus(plan.id, 'DRAFT')}
              >
                Ξεκλείδωμα
              </button>
            </>
          ) : null}

          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => downloadPlan(exportPayload, 'md')}
          >
            Εξαγωγή .md
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => downloadPlan(exportPayload, 'csv')}
          >
            Εξαγωγή .csv
          </button>
        </div>
      </section>

      {viewer.isAdmin ? (
        <section className="champ__panel">
          <h2>Κατάσταση πλάνων — R{event.round}</h2>
          <div className="champ__table-wrap">
            <table className="champ__table">
              <thead>
                <tr>
                  <th>Ομάδα</th>
                  <th>Κατηγορία</th>
                  <th>Κατάσταση</th>
                  <th>Stint</th>
                  <th>Κάλυψη</th>
                  <th>Έλεγχος</th>
                  <th aria-label="Ενέργειες" />
                </tr>
              </thead>
              <tbody>
                {overview.map(({ team: t, plan: p, computed: c, validation: v }) => (
                  <tr key={t.id} className={t.id === team.id ? 'is-mine' : undefined}>
                    <td>{t.name}</td>
                    <td>
                      <ClassTag classId={t.carClass} short />
                    </td>
                    <td>
                      <Badge tone={p ? PLAN_STATUS[p.status].tone : 'muted'}>
                        {p ? PLAN_STATUS[p.status].label : 'Χωρίς πλάνο'}
                      </Badge>
                    </td>
                    <td>{p?.stints.length || 0}</td>
                    <td>{c ? `${Math.round(c.coverage * 100)}%` : '—'}</td>
                    <td>
                      {v ? (
                        <Badge tone={v.errors ? 'bad' : v.warnings ? 'warn' : 'ok'}>
                          {v.errors} / {v.warnings}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/championship/planner/${event.id}/${t.id}`}
                        className="champ__link"
                      >
                        Άνοιξε →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  )
}
