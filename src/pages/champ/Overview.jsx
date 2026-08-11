import { Link } from 'react-router-dom'
import { useChampionship } from '../../hooks/useChampionship.js'
import { AVAILABILITY, PLAN_STATUS, classInfo } from '../../lib/lmu/constants.js'
import { eventWinners } from '../../lib/lmu/standings.js'
import { formatDateTime, formatMinutes, relativeTime } from '../../lib/lmu/utils.js'
import Badge from '../../components/champ/Badge.jsx'
import EventCard from '../../components/champ/EventCard.jsx'
import StatTile from '../../components/champ/StatTile.jsx'

/** Η αρχική του management system: τι τρέχει, τι χρωστάς, πού βρίσκεσαι. */
export default function Overview() {
  const ctx = useChampionship()
  const { state, championship, viewer, standings, events, nextEvent, teams, drivers } = ctx

  const myTeams = viewer.isAdmin ? [] : viewer.ledTeams
  const myTeam = viewer.team
  const lastDone = [...events].reverse().find((e) => e.status === 'DONE')

  const submitted = nextEvent
    ? state.plans.filter((p) => p.eventId === nextEvent.id && p.status !== 'DRAFT').length
    : 0
  const pendingAvailability = nextEvent
    ? drivers.filter((d) => d.teamId && ctx.availabilityOf(nextEvent.id, d.id) === 'UNKNOWN').length
    : 0

  return (
    <>
      <section className="champ__grid champ__grid--tiles">
        <StatTile label="Ομάδες" value={teams.length} hint={`${drivers.filter((d) => d.teamId).length} οδηγοί`} />
        <StatTile
          label="Αγώνες"
          value={`${standings.events.length}/${events.length}`}
          hint="ολοκληρωμένοι"
        />
        <StatTile
          label="Πλάνα stint"
          value={nextEvent ? `${submitted}/${teams.length}` : '—'}
          hint={nextEvent ? 'υποβλήθηκαν για τον επόμενο' : 'χωρίς επόμενο αγώνα'}
          tone={nextEvent && submitted < teams.length ? 'warn' : 'ok'}
        />
        <StatTile
          label="Δηλώσεις που λείπουν"
          value={pendingAvailability}
          hint="οδηγοί χωρίς διαθεσιμότητα"
          tone={pendingAvailability ? 'warn' : 'ok'}
        />
      </section>

      {nextEvent ? (
        <section className="champ__panel">
          <div className="champ__panel-head">
            <h2>Επόμενος αγώνας</h2>
            {nextEvent.dateISO ? (
              <span className="champ__muted">
                {formatDateTime(nextEvent.dateISO)} · {relativeTime(nextEvent.dateISO)}
              </span>
            ) : null}
          </div>
          <EventCard
            event={nextEvent}
            doublePoints={championship.scoring.doublePointsEvents?.includes(nextEvent.id)}
          >
            <Link to="planner" className="btn btn--primary">
              Άνοιξε τον Stint Planner
            </Link>
            <Link to="calendar" className="btn btn--ghost">
              Καλεντάρι
            </Link>
          </EventCard>
        </section>
      ) : null}

      {myTeam ? (
        <section className="champ__panel">
          <div className="champ__panel-head">
            <h2>Η ομάδα μου — {myTeam.name}</h2>
            <Link to={`teams/${myTeam.id}`} className="champ__link">
              Καρτέλα ομάδας →
            </Link>
          </div>

          <div className="champ__grid champ__grid--2">
            <div>
              <h3>Πλάνα ανά αγώνα</h3>
              <ul className="champ__list">
                {events
                  .filter((e) => e.status !== 'DONE')
                  .map((event) => {
                    const plan = ctx.planFor(event.id, myTeam.id)
                    const status = plan ? PLAN_STATUS[plan.status] : null
                    return (
                      <li key={event.id} className="champ__list-row">
                        <span>
                          R{event.round} · {event.name}
                        </span>
                        <span>
                          {status ? (
                            <Badge tone={status.tone}>{status.label}</Badge>
                          ) : (
                            <Badge tone="muted">Δεν ξεκίνησε</Badge>
                          )}{' '}
                          <Link to={`planner/${event.id}/${myTeam.id}`} className="champ__link">
                            {plan?.stints.length ? 'Άνοιξε' : 'Φτιάξε πλάνο'}
                          </Link>
                        </span>
                      </li>
                    )
                  })}
                {!events.some((e) => e.status !== 'DONE') ? (
                  <li className="champ__muted">Το πρωτάθλημα ολοκληρώθηκε.</li>
                ) : null}
              </ul>
            </div>

            <div>
              <h3>Διαθεσιμότητα {nextEvent ? `— R${nextEvent.round}` : ''}</h3>
              <ul className="champ__list">
                {ctx.rosterOf(myTeam.id).map((driver) => {
                  const value = nextEvent ? ctx.availabilityOf(nextEvent.id, driver.id) : 'UNKNOWN'
                  const info = AVAILABILITY[value]
                  return (
                    <li key={driver.id} className="champ__list-row">
                      <span>
                        {driver.name}
                        {driver.id === viewer.user?.id ? <span className="champ__muted"> (εσύ)</span> : null}
                      </span>
                      <Badge tone={info.tone}>{info.label}</Badge>
                    </li>
                  )
                })}
              </ul>
              {nextEvent && ctx.can('availability.edit', { driverId: viewer.user?.id }) ? (
                <div className="champ__btn-row">
                  {['YES', 'MAYBE', 'NO'].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => ctx.actions.setAvailability(nextEvent.id, viewer.user.id, value)}
                    >
                      Δηλώνω: {AVAILABILITY[value].label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {myTeams.length > 1 ? (
        <p className="champ__notice">
          Είσαι αρχηγός σε {myTeams.length} ομάδες: {myTeams.map((t) => t.name).join(', ')}.
        </p>
      ) : null}

      <section className="champ__panel">
        <div className="champ__panel-head">
          <h2>Κορυφή βαθμολογίας</h2>
          <Link to="standings" className="champ__link">
            Πλήρης βαθμολογία →
          </Link>
        </div>
        <div className="champ__grid champ__grid--3">
          {standings.classes.map(({ classId, teams: rows }) => (
            <div key={classId} className="champ__mini">
              <h3 style={{ color: classInfo(classId).color }}>{classInfo(classId).label}</h3>
              <ol className="champ__mini-list">
                {rows.slice(0, 3).map((row) => (
                  <li key={row.id}>
                    <span>{row.name}</span>
                    <strong>{row.points}</strong>
                  </li>
                ))}
                {!rows.length ? <li className="champ__muted">Χωρίς αποτελέσματα.</li> : null}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {lastDone ? (
        <section className="champ__panel">
          <div className="champ__panel-head">
            <h2>Τελευταίος αγώνας</h2>
            <Link to="results" className="champ__link">
              Αποτελέσματα →
            </Link>
          </div>
          <EventCard event={lastDone} winners={eventWinners(state, lastDone.id)} />
        </section>
      ) : null}

      <section className="champ__panel champ__panel--muted">
        <h2>Ιστορικό ενεργειών</h2>
        <ul className="champ__log">
          {[...state.log]
            .reverse()
            .slice(0, 8)
            .map((entry, i) => (
              <li key={`${entry.at}-${i}`}>
                <span className="champ__muted">
                  {new Date(entry.at).toLocaleString('el-GR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>{' '}
                <strong>{entry.who}</strong> — {entry.text}
              </li>
            ))}
          {!state.log.length ? <li className="champ__muted">Καμία ενέργεια ακόμα.</li> : null}
        </ul>
        <p className="champ__muted">
          Συνολική διάρκεια σεζόν:{' '}
          {formatMinutes(events.reduce((acc, e) => acc + e.durationMinutes, 0))} αγωνιστικού χρόνου.
        </p>
      </section>
    </>
  )
}
