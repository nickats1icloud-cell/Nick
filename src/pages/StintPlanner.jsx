import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { downloadText, safeFileName } from '../lib/download.js'
import {
  MINUTE_MS,
  assignDrivers,
  browserTimeZone,
  buildIcs,
  buildPlainText,
  buildStints,
  decodePlan,
  encodePlan,
  formatCountdown,
  formatDateTime,
  formatDuration,
  formatTime,
  instantToLocalInput,
  isDriverAvailable,
  listTimeZones,
  localInputToInstant,
  summarise,
} from '../lib/stintPlanner.js'

const STORAGE_KEY = 'lmu-stint-planner-v1'

const DRIVER_COLORS = [
  '#7c5cff',
  '#3ecf8e',
  '#ffb020',
  '#ff5c7c',
  '#3ec5ff',
  '#c77cff',
  '#8fd14f',
  '#ff8a3d',
]

const DURATION_PRESETS = [
  { label: '1ω', minutes: 60 },
  { label: '2ω', minutes: 120 },
  { label: '4ω', minutes: 240 },
  { label: '6ω', minutes: 360 },
  { label: '8ω', minutes: 480 },
  { label: '12ω', minutes: 720 },
  { label: '24ω', minutes: 1440 },
]

let driverSeq = 0
function newDriver(tz) {
  driverSeq += 1
  return {
    id: `d${Date.now().toString(36)}${driverSeq}`,
    name: '',
    tz,
    from: '00:00',
    to: '00:00',
  }
}

function defaultPlan() {
  const tz = browserTimeZone()
  const tomorrow = new Date(Date.now() + 24 * 60 * MINUTE_MS)
  const start = instantToLocalInput(tomorrow.getTime(), tz).slice(0, 11) + '14:00'
  return {
    name: 'Endurance αγώνας',
    raceTz: tz,
    start,
    durationMin: 360,
    stintMin: 60,
    pitSec: 60,
    allowBackToBack: false,
    drivers: [
      { ...newDriver(tz), name: 'Οδηγός 1' },
      { ...newDriver(tz), name: 'Οδηγός 2' },
    ],
    overrides: {},
  }
}

function loadInitialPlan(encoded) {
  if (encoded) {
    const shared = decodePlan(encoded)
    if (shared) return { ...defaultPlan(), ...shared }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && Array.isArray(saved.drivers)) return { ...defaultPlan(), ...saved }
  } catch {
    // Χαλασμένο localStorage — ξεκινάμε από την αρχή.
  }
  return defaultPlan()
}

export default function StintPlanner() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [plan, setPlan] = useState(() => loadInitialPlan(searchParams.get('plan')))
  const [now, setNow] = useState(() => Date.now())
  const [toast, setToast] = useState('')
  const zones = useMemo(() => listTimeZones(), [])
  const toastTimer = useRef(null)

  // Το shared link καταναλώνεται μία φορά· μετά δουλεύουμε τοπικά.
  useEffect(() => {
    if (searchParams.get('plan')) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
  }, [plan])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const flash = useCallback((message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }, [])

  const patch = useCallback((changes) => setPlan((p) => ({ ...p, ...changes })), [])

  const updateDriver = useCallback((id, changes) => {
    setPlan((p) => ({
      ...p,
      drivers: p.drivers.map((d) => (d.id === id ? { ...d, ...changes } : d)),
    }))
  }, [])

  const removeDriver = useCallback((id) => {
    setPlan((p) => {
      const overrides = { ...p.overrides }
      for (const key of Object.keys(overrides)) {
        if (overrides[key] === id) delete overrides[key]
      }
      return { ...p, drivers: p.drivers.filter((d) => d.id !== id), overrides }
    })
  }, [])

  const startMs = useMemo(
    () => localInputToInstant(plan.start, plan.raceTz),
    [plan.start, plan.raceTz],
  )

  const namedDrivers = useMemo(
    () => plan.drivers.filter((d) => d.name.trim()),
    [plan.drivers],
  )

  const driversById = useMemo(
    () => new Map(plan.drivers.map((d) => [d.id, d])),
    [plan.drivers],
  )

  const colorById = useMemo(
    () => new Map(plan.drivers.map((d, i) => [d.id, DRIVER_COLORS[i % DRIVER_COLORS.length]])),
    [plan.drivers],
  )

  const stints = useMemo(() => {
    if (!Number.isFinite(startMs)) return []
    return buildStints({
      startMs,
      durationMin: plan.durationMin,
      stintMin: plan.stintMin,
      pitSec: plan.pitSec,
    })
  }, [startMs, plan.durationMin, plan.stintMin, plan.pitSec])

  // Αυτόματη ανάθεση, με τις χειροκίνητες αλλαγές να υπερισχύουν.
  const assigned = useMemo(() => {
    const auto = assignDrivers(stints, namedDrivers, {
      allowBackToBack: plan.allowBackToBack,
    })
    return auto.map((stint) => {
      const override = plan.overrides?.[stint.index]
      if (!override) return stint
      const driver = driversById.get(override)
      if (!driver) return stint
      return {
        ...stint,
        driverId: driver.id,
        manual: true,
        status: isDriverAvailable(driver, stint.start, stint.end) ? 'ok' : 'uncovered',
      }
    })
  }, [stints, namedDrivers, plan.allowBackToBack, plan.overrides, driversById])

  const summary = useMemo(() => summarise(assigned, namedDrivers), [assigned, namedDrivers])

  const raceEnd = stints.length ? stints[stints.length - 1].end : startMs
  const uncovered = assigned.filter((s) => s.status === 'uncovered').length
  const totalMinutes = assigned.reduce((sum, s) => sum + s.minutes, 0)

  const currentStint = assigned.find((s) => now >= s.start && now < s.end)
  const nextStint = assigned.find((s) => s.start > now)

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?plan=${encodePlan(plan)}`
    try {
      await navigator.clipboard.writeText(url)
      flash('Το link αντιγράφηκε.')
    } catch {
      window.prompt('Αντίγραψε το link:', url)
    }
  }

  const handleCopyText = async () => {
    const text = buildPlainText(plan, assigned, driversById)
    try {
      await navigator.clipboard.writeText(text)
      flash('Το πλάνο αντιγράφηκε ως κείμενο.')
    } catch {
      window.prompt('Αντίγραψε το πλάνο:', text)
    }
  }

  return (
    <section className="stint">
      <header className="tool__head">
        <h1>Stint Planner</h1>
        <p>
          Προγραμματισμός βαρδιών για endurance αγώνες στο Le Mans Ultimate. Δήλωσε
          τη διάρκεια του αγώνα και τη διαθεσιμότητα κάθε οδηγού{' '}
          <strong>στη δική του ώρα</strong> — το πλάνο βγαίνει αυτόματα, μαζί με
          countdown για το επόμενο driver swap.
        </p>
      </header>

      <div className="tool__panel">
        <h2>Ο αγώνας</h2>
        <div className="tool__grid">
          <label className="field">
            <span>Ονομασία</span>
            <input
              type="text"
              value={plan.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Ζώνη ώρας αγώνα</span>
            <select value={plan.raceTz} onChange={(e) => patch({ raceTz: e.target.value })}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Εκκίνηση</span>
            <input
              type="datetime-local"
              value={plan.start}
              onChange={(e) => patch({ start: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Διάρκεια (λεπτά)</span>
            <input
              type="number"
              min="10"
              step="10"
              value={plan.durationMin}
              onChange={(e) => patch({ durationMin: Math.max(10, Number(e.target.value) || 0) })}
            />
          </label>

          <label className="field">
            <span>Διάρκεια stint (λεπτά)</span>
            <input
              type="number"
              min="5"
              step="5"
              value={plan.stintMin}
              onChange={(e) => patch({ stintMin: Math.max(5, Number(e.target.value) || 0) })}
            />
          </label>

          <label className="field">
            <span>Pit stop (δευτ.)</span>
            <input
              type="number"
              min="0"
              step="5"
              value={plan.pitSec}
              onChange={(e) => patch({ pitSec: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        </div>

        <div className="tool__row">
          <span className="tool__label">Γρήγορη επιλογή:</span>
          {DURATION_PRESETS.map((d) => (
            <button
              key={d.minutes}
              type="button"
              className={`chip${plan.durationMin === d.minutes ? ' chip--on' : ''}`}
              onClick={() => patch({ durationMin: d.minutes })}
            >
              {d.label}
            </button>
          ))}
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={plan.allowBackToBack}
            onChange={(e) => patch({ allowBackToBack: e.target.checked })}
          />
          <span>Επιτρέπονται διπλά (συνεχόμενα) stints από τον ίδιο οδηγό</span>
        </label>
      </div>

      <div className="tool__panel">
        <div className="tool__panelhead">
          <h2>Οδηγοί</h2>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() =>
              setPlan((p) => ({ ...p, drivers: [...p.drivers, newDriver(p.raceTz)] }))
            }
          >
            + Προσθήκη οδηγού
          </button>
        </div>
        <p className="tool__hint">
          Το παράθυρο διαθεσιμότητας είναι η <em>τοπική ώρα του κάθε οδηγού</em>. Άσε
          το 00:00–00:00 για 24ωρη διαθεσιμότητα.
        </p>

        {plan.drivers.map((d) => (
          <div key={d.id} className="stint__driver">
            <span className="stint__swatch" style={{ background: colorById.get(d.id) }} />
            <input
              type="text"
              className="stint__driverName"
              placeholder="Όνομα οδηγού"
              value={d.name}
              onChange={(e) => updateDriver(d.id, { name: e.target.value })}
            />
            <select value={d.tz} onChange={(e) => updateDriver(d.id, { tz: e.target.value })}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <input
              type="time"
              aria-label="Διαθέσιμος από"
              value={d.from}
              onChange={(e) => updateDriver(d.id, { from: e.target.value })}
            />
            <span className="stint__dash">→</span>
            <input
              type="time"
              aria-label="Διαθέσιμος έως"
              value={d.to}
              onChange={(e) => updateDriver(d.id, { to: e.target.value })}
            />
            <button
              type="button"
              className="stint__remove"
              aria-label={`Διαγραφή ${d.name || 'οδηγού'}`}
              onClick={() => removeDriver(d.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {!namedDrivers.length && (
        <p className="tool__empty">Δώσε όνομα σε τουλάχιστον έναν οδηγό για να βγει το πλάνο.</p>
      )}

      {namedDrivers.length > 0 && assigned.length > 0 && (
        <>
          <div className="tool__panel">
            <h2>Το πλάνο</h2>
            <div className="stint__stats">
              <div>
                <strong>{assigned.length}</strong>
                <span>stints</span>
              </div>
              <div>
                <strong>{formatDuration(totalMinutes)}</strong>
                <span>χρόνος οδήγησης</span>
              </div>
              <div>
                <strong>{formatTime(startMs, plan.raceTz)}</strong>
                <span>εκκίνηση</span>
              </div>
              <div>
                <strong>{formatTime(raceEnd, plan.raceTz)}</strong>
                <span>τερματισμός</span>
              </div>
              <div className={uncovered ? 'stint__warn' : ''}>
                <strong>{uncovered}</strong>
                <span>ακάλυπτα</span>
              </div>
            </div>

            {uncovered > 0 && (
              <p className="stint__alert">
                ⚠️ {uncovered} stint(s) πέφτουν εκτός της δηλωμένης διαθεσιμότητας. Άλλαξε
                διάρκεια stint, πρόσθεσε οδηγό ή διόρθωσε χειροκίνητα παρακάτω.
              </p>
            )}

            <div className="stint__timeline" role="img" aria-label="Οπτική γραμμή stints">
              {assigned.map((s) => (
                <div
                  key={s.index}
                  className={`stint__seg${s.status === 'uncovered' ? ' stint__seg--warn' : ''}`}
                  style={{
                    flexGrow: s.minutes,
                    background: colorById.get(s.driverId) || 'var(--surface-2)',
                  }}
                  title={`Stint ${s.index}: ${driversById.get(s.driverId)?.name || '—'} (${formatTime(
                    s.start,
                    plan.raceTz,
                  )}–${formatTime(s.end, plan.raceTz)})`}
                >
                  {s.index}
                </div>
              ))}
            </div>

            {(currentStint || nextStint) && (
              <div className="stint__live">
                {currentStint ? (
                  <p>
                    <span className="stint__pill">Τώρα</span> Stint {currentStint.index} —{' '}
                    <strong>{driversById.get(currentStint.driverId)?.name || '—'}</strong>. Επόμενο
                    swap σε <strong>{formatCountdown(currentStint.end - now)}</strong>
                    {nextStint && (
                      <>
                        {' '}
                        → <strong>{driversById.get(nextStint.driverId)?.name || '—'}</strong>
                      </>
                    )}
                  </p>
                ) : (
                  <p>
                    <span className="stint__pill">Εκκίνηση</span> σε{' '}
                    <strong>{formatCountdown(nextStint.start - now)}</strong> —{' '}
                    <strong>{driversById.get(nextStint.driverId)?.name || '—'}</strong> ξεκινάει.
                  </p>
                )}
              </div>
            )}

            <div className="tool__tablewrap">
              <table className="tool__table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Ώρα αγώνα</th>
                    <th>Διάρκεια</th>
                    <th>Οδηγός</th>
                    <th>Τοπική του ώρα</th>
                  </tr>
                </thead>
                <tbody>
                  {assigned.map((s) => {
                    const driver = driversById.get(s.driverId)
                    return (
                      <tr
                        key={s.index}
                        className={s.status === 'uncovered' ? 'tool__row--warn' : ''}
                      >
                        <td>{s.index}</td>
                        <td>
                          {formatDateTime(s.start, plan.raceTz)} – {formatTime(s.end, plan.raceTz)}
                        </td>
                        <td>{formatDuration(s.minutes)}</td>
                        <td>
                          <select
                            value={s.driverId || ''}
                            onChange={(e) =>
                              setPlan((p) => ({
                                ...p,
                                overrides: { ...p.overrides, [s.index]: e.target.value },
                              }))
                            }
                          >
                            {namedDrivers.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                          {s.manual && <span className="stint__tag">χειροκίνητο</span>}
                        </td>
                        <td>
                          {driver
                            ? `${formatTime(s.start, driver.tz)} – ${formatTime(s.end, driver.tz)}`
                            : '—'}
                          {s.status === 'uncovered' && <span className="stint__tag stint__tag--warn">εκτός</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {Object.keys(plan.overrides || {}).length > 0 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => patch({ overrides: {} })}
              >
                Επαναφορά αυτόματης ανάθεσης
              </button>
            )}
          </div>

          <div className="tool__panel">
            <h2>Ανά οδηγό</h2>
            <div className="tool__tablewrap">
              <table className="tool__table">
                <thead>
                  <tr>
                    <th>Οδηγός</th>
                    <th>Stints</th>
                    <th>Χρόνος οδήγησης</th>
                    <th>Ζώνη ώρας</th>
                    <th>Εκτός διαθεσιμότητας</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={row.driver.id}>
                      <td>
                        <span
                          className="stint__swatch"
                          style={{ background: colorById.get(row.driver.id) }}
                        />
                        {row.driver.name}
                      </td>
                      <td>{row.stints}</td>
                      <td>{formatDuration(row.minutes)}</td>
                      <td>{row.driver.tz}</td>
                      <td className={row.uncovered ? 'stint__warn' : ''}>{row.uncovered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="tool__actions">
            <button type="button" className="btn btn--primary" onClick={handleShare}>
              Αντιγραφή link
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleCopyText}>
              Αντιγραφή για Discord
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                downloadText(
                  `${safeFileName(plan.name, 'stints')}-stints.ics`,
                  buildIcs(plan, assigned, driversById),
                  'text/calendar',
                )
              }
            >
              Λήψη .ics
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                if (window.confirm('Να καθαρίσει το πλάνο και να ξεκινήσουμε από την αρχή;')) {
                  setPlan(defaultPlan())
                }
              }}
            >
              Νέο πλάνο
            </button>
          </div>
        </>
      )}

      {toast && <div className="tool__toast">{toast}</div>}
    </section>
  )
}
