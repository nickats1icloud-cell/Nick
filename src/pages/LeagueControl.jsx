import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { downloadText, safeFileName } from '../lib/download.js'
import { classesOf, formatLapTime, parseResultsXml } from '../lib/lmuResults.js'
import {
  DEFAULT_SETTINGS,
  POINT_PRESETS,
  computeStandings,
  scoreEvent,
  standingsToCsv,
} from '../lib/championship.js'

const STORAGE_KEY = 'lmu-league-control-v1'

function defaultLeague() {
  return {
    version: 1,
    name: 'Το πρωτάθλημά μου',
    settings: { ...DEFAULT_SETTINGS },
    events: [],
  }
}

function loadLeague() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && Array.isArray(saved.events)) {
      return { ...defaultLeague(), ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } }
    }
  } catch {
    // Χαλασμένο localStorage — ξεκινάμε από την αρχή.
  }
  return defaultLeague()
}

export default function LeagueControl() {
  const [league, setLeague] = useState(loadLeague)
  const [errors, setErrors] = useState([])
  const [openEvent, setOpenEvent] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef(null)
  const importInput = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(league))
  }, [league])

  const setSetting = useCallback((changes) => {
    setLeague((l) => ({ ...l, settings: { ...l.settings, ...changes } }))
  }, [])

  const addFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return

    const parsed = []
    const failed = []

    for (const file of files) {
      try {
        const text = await file.text()
        parsed.push(parseResultsXml(text, file.name))
      } catch (err) {
        failed.push(`${file.name}: ${err.message}`)
      }
    }

    setErrors(failed)
    if (parsed.length) {
      setLeague((l) => ({ ...l, events: [...l.events, ...parsed] }))
    }
  }, [])

  const updateEvent = useCallback((id, changes) => {
    setLeague((l) => ({
      ...l,
      events: l.events.map((e) => (e.id === id ? { ...e, ...changes } : e)),
    }))
  }, [])

  const setAdjustment = useCallback((eventId, entryId, changes) => {
    setLeague((l) => ({
      ...l,
      events: l.events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              adjustments: {
                ...e.adjustments,
                [entryId]: { ...(e.adjustments?.[entryId] || {}), ...changes },
              },
            }
          : e,
      ),
    }))
  }, [])

  const removeEvent = useCallback((id) => {
    setLeague((l) => ({ ...l, events: l.events.filter((e) => e.id !== id) }))
    setOpenEvent((cur) => (cur === id ? null : cur))
  }, [])

  const moveEvent = useCallback((id, delta) => {
    setLeague((l) => {
      const i = l.events.findIndex((e) => e.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= l.events.length) return l
      const events = [...l.events]
      ;[events[i], events[j]] = [events[j], events[i]]
      return { ...l, events }
    })
  }, [])

  const standings = useMemo(
    () => computeStandings(league.events, league.settings),
    [league.events, league.settings],
  )

  const handleImport = async (fileList) => {
    const file = fileList?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!Array.isArray(data.events)) throw new Error('Λείπουν τα events.')
      setLeague({ ...defaultLeague(), ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings } })
      setErrors([])
    } catch (err) {
      setErrors([`Αποτυχία εισαγωγής: ${err.message}`])
    }
  }

  return (
    <section className="league">
      <header className="tool__head">
        <h1>League Control</h1>
        <p>
          Διαχείριση πρωταθλήματος Le Mans Ultimate: ανέβασε τα αρχεία αποτελεσμάτων και
          βγάλε βαθμολογία ανά κλάση, με ποινές, drop scores και εξαγωγή. Τα αρχεία{' '}
          <strong>δεν ανεβαίνουν πουθενά</strong> — διαβάζονται τοπικά στον browser.
        </p>
      </header>

      <div className="tool__panel">
        <label className="field">
          <span>Όνομα πρωταθλήματος</span>
          <input
            type="text"
            value={league.name}
            onChange={(e) => setLeague((l) => ({ ...l, name: e.target.value }))}
          />
        </label>
      </div>

      <div
        className={`league__drop${dragging ? ' league__drop--over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
      >
        <p>
          Σύρε εδώ τα <code>.xml</code> αποτελεσμάτων ή
        </p>
        <button type="button" className="btn btn--primary" onClick={() => fileInput.current?.click()}>
          Επίλεξε αρχεία
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".xml"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <small>
          Θα τα βρεις στο <code>…\Le Mans Ultimate\UserData\Log\Results\</code>
        </small>
      </div>

      {errors.length > 0 && (
        <ul className="league__errors">
          {errors.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}

      <div className="tool__panel">
        <h2>Βαθμολόγηση</h2>
        <div className="tool__grid">
          <label className="field">
            <span>Σύστημα βαθμών</span>
            <select
              value={league.settings.pointsKey}
              onChange={(e) => setSetting({ pointsKey: e.target.value })}
            >
              {Object.entries(POINT_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          {league.settings.pointsKey === 'custom' && (
            <label className="field">
              <span>Βαθμοί ανά θέση</span>
              <input
                type="text"
                value={league.settings.customPoints}
                placeholder="25, 18, 15, …"
                onChange={(e) => setSetting({ customPoints: e.target.value })}
              />
            </label>
          )}

          <label className="field">
            <span>Βαθμοί pole</span>
            <input
              type="number"
              min="0"
              value={league.settings.polePoints}
              onChange={(e) => setSetting({ polePoints: Number(e.target.value) || 0 })}
            />
          </label>

          <label className="field">
            <span>Βαθμοί γρήγορου γύρου</span>
            <input
              type="number"
              min="0"
              value={league.settings.fastestLapPoints}
              onChange={(e) => setSetting({ fastestLapPoints: Number(e.target.value) || 0 })}
            />
          </label>

          <label className="field">
            <span>Γρήγορος γύρος μόνο για top-N (0 = χωρίς όριο)</span>
            <input
              type="number"
              min="0"
              value={league.settings.fastestLapTopN}
              onChange={(e) => setSetting({ fastestLapTopN: Number(e.target.value) || 0 })}
            />
          </label>

          <label className="field">
            <span>Ελάχιστο % γύρων για κατάταξη</span>
            <input
              type="number"
              min="0"
              max="100"
              value={league.settings.minLapsPercent}
              onChange={(e) => setSetting({ minLapsPercent: Number(e.target.value) || 0 })}
            />
          </label>

          <label className="field">
            <span>Drop χειρότερων αποτελεσμάτων</span>
            <input
              type="number"
              min="0"
              value={league.settings.dropWorst}
              onChange={(e) => setSetting({ dropWorst: Number(e.target.value) || 0 })}
            />
          </label>
        </div>
      </div>

      <div className="tool__panel">
        <h2>Αγώνες ({league.events.length})</h2>
        {!league.events.length && (
          <p className="tool__empty">Δεν έχεις ανεβάσει ακόμα αποτελέσματα.</p>
        )}

        {league.events.map((event, i) => (
          <div key={event.id} className="league__event">
            <div className="league__eventhead">
              <button
                type="button"
                className="league__eventtitle"
                onClick={() => setOpenEvent((cur) => (cur === event.id ? null : event.id))}
              >
                <strong>
                  {i + 1}. {event.label || event.track}
                </strong>
                <small>
                  {event.date} · {event.sessionType} · {event.entries.length} συμμετοχές ·{' '}
                  {classesOf(event).join(', ')}
                </small>
              </button>
              <label className="league__mult">
                ×
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={event.multiplier}
                  onChange={(e) =>
                    updateEvent(event.id, { multiplier: Number(e.target.value) || 1 })
                  }
                />
              </label>
              <button
                type="button"
                className="stint__remove"
                aria-label="Πάνω"
                onClick={() => moveEvent(event.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="stint__remove"
                aria-label="Κάτω"
                onClick={() => moveEvent(event.id, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="stint__remove"
                aria-label="Διαγραφή αγώνα"
                onClick={() => removeEvent(event.id)}
              >
                ×
              </button>
            </div>

            {openEvent === event.id && (
              <div className="league__eventbody">
                {Array.from(scoreEvent(event, league.settings), ([carClass, rows]) => (
                  <div key={carClass}>
                    <h3>{carClass}</h3>
                    <div className="tool__tablewrap">
                      <table className="tool__table">
                        <thead>
                          <tr>
                            <th>Θέση</th>
                            <th>Οδηγός</th>
                            <th>Ομάδα</th>
                            <th>Γύροι</th>
                            <th>Καλύτερος</th>
                            <th>Βαθμοί</th>
                            <th>Ποινή</th>
                            <th>DSQ</th>
                            <th>Σημείωση</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr
                              key={row.entry.id}
                              className={row.excluded || !row.classified ? 'tool__row--muted' : ''}
                            >
                              <td>{row.classPos ?? 'DSQ'}</td>
                              <td>
                                {row.entry.name}
                                {row.isFastest && <span className="stint__tag">FL</span>}
                                {row.entry.gridPos === 1 && <span className="stint__tag">pole</span>}
                              </td>
                              <td>{row.entry.team || '—'}</td>
                              <td>
                                {row.entry.laps}
                                {!row.classified && !row.excluded && (
                                  <span className="stint__tag stint__tag--warn">εκτός</span>
                                )}
                              </td>
                              <td>{formatLapTime(row.entry.bestLap)}</td>
                              <td>
                                <strong>{row.points}</strong>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  className="league__num"
                                  value={event.adjustments?.[row.entry.id]?.penalty ?? 0}
                                  onChange={(e) =>
                                    setAdjustment(event.id, row.entry.id, {
                                      penalty: Number(e.target.value) || 0,
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={!!event.adjustments?.[row.entry.id]?.excluded}
                                  onChange={(e) =>
                                    setAdjustment(event.id, row.entry.id, {
                                      excluded: e.target.checked,
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="league__note"
                                  placeholder="—"
                                  value={event.adjustments?.[row.entry.id]?.note ?? ''}
                                  onChange={(e) =>
                                    setAdjustment(event.id, row.entry.id, { note: e.target.value })
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {standings.map(({ carClass, rows }) => (
        <div key={carClass} className="tool__panel">
          <h2>Βαθμολογία — {carClass}</h2>
          <div className="tool__tablewrap">
            <table className="tool__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Οδηγός</th>
                  <th>Ομάδα</th>
                  {league.events.map((e, i) => (
                    <th key={e.id} title={e.label}>
                      {i + 1}
                    </th>
                  ))}
                  <th>Νίκες</th>
                  <th>Σύνολο</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.rank}</td>
                    <td>{row.name}</td>
                    <td>{row.team || '—'}</td>
                    {league.events.map((e) => {
                      const r = row.results[e.id]
                      if (!r) return <td key={e.id}>—</td>
                      return (
                        <td key={e.id} className={row.dropped.has(e.id) ? 'league__dropped' : ''}>
                          {r.points}
                        </td>
                      )
                    })}
                    <td>{row.wins}</td>
                    <td>
                      <strong>{row.total}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {league.settings.dropWorst > 0 && (
            <p className="tool__hint">
              Τα διαγραμμένα αποτελέσματα εμφανίζονται σβησμένα και δεν προσμετρώνται.
            </p>
          )}
        </div>
      ))}

      <div className="tool__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!standings.length}
          onClick={() =>
            downloadText(
              `${safeFileName(league.name, 'league')}-standings.csv`,
              standingsToCsv(standings, league.events),
              'text/csv',
            )
          }
        >
          Εξαγωγή CSV
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() =>
            downloadText(
              `${safeFileName(league.name, 'league')}.json`,
              JSON.stringify(league, null, 2),
              'application/json',
            )
          }
        >
          Αποθήκευση πρωταθλήματος (.json)
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => importInput.current?.click()}
        >
          Φόρτωση από .json
        </button>
        <input
          ref={importInput}
          type="file"
          accept=".json"
          hidden
          onChange={(e) => {
            handleImport(e.target.files)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            if (window.confirm('Να διαγραφεί όλο το πρωτάθλημα;')) setLeague(defaultLeague())
          }}
        >
          Καθαρισμός
        </button>
      </div>
    </section>
  )
}
