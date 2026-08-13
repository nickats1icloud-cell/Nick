import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import PartsPalette from '../components/simlab/PartsPalette.jsx'
import Workbench from '../components/simlab/Workbench.jsx'
import Inspector from '../components/simlab/Inspector.jsx'
import AnalysisPanel from '../components/simlab/AnalysisPanel.jsx'
import TestBench from '../components/simlab/TestBench.jsx'
import OutputsView from '../components/simlab/OutputsView.jsx'
import PanelView from '../components/simlab/PanelView.jsx'
import ScopeView from '../components/simlab/ScopeView.jsx'
import CodePanel from '../components/simlab/CodePanel.jsx'
import LibraryPanel from '../components/simlab/LibraryPanel.jsx'
import BomPanel from '../components/simlab/BomPanel.jsx'

import { BOARDS, getBoard } from '../lib/simlab/boards.js'
import {
  BOARD_NODE,
  DEFAULT_SETTINGS,
  addNode,
  addWire,
  createBuild,
  duplicateNode,
  removeNode,
  removeWire,
  sameRef,
  setBoard,
  updateNode,
  updateNodeValues,
  updateSettings,
} from '../lib/simlab/circuit.js'
import { deriveFirmware } from '../lib/simlab/firmware.js'
import { runDrc } from '../lib/simlab/drc.js'
import { createEngine, resetEngine, stepEngine } from '../lib/simlab/engine.js'
import { createTelemetry, stepTelemetry, telemetrySnapshot } from '../lib/simlab/telemetry.js'
import { PRESETS, loadPreset } from '../lib/simlab/presets.js'
import { sketchName } from '../lib/simlab/codegen.js'
import {
  deleteBuild,
  downloadFile,
  listSavedBuilds,
  loadCurrent,
  parseBuildJson,
  saveBuild,
  storeCurrent,
} from '../lib/simlab/storage.js'

const TABS = [
  { id: 'inspect', label: 'Επιθεώρηση' },
  { id: 'check', label: 'Έλεγχος' },
  { id: 'test', label: 'Δοκιμή' },
  { id: 'code', label: 'Κώδικας' },
  { id: 'libs', label: 'Βιβλιοθήκες' },
  { id: 'bom', label: 'Υλικά' },
]

const RENDER_INTERVAL_MS = 33

export default function SimLab() {
  const [build, setBuild] = useState(() => loadCurrent() || loadPreset('button-box'))
  const [selectedId, setSelectedId] = useState(null)
  const [pending, setPending] = useState(null)
  const [tab, setTab] = useState('check')
  const [view, setView] = useState('wiring')
  const [running, setRunning] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [saved, setSaved] = useState(() => listSavedBuilds())
  const [status, setStatus] = useState('')

  const [telemetryMode, setTelemetryMode] = useState('lap')
  const [trackId, setTrackId] = useState('club')
  const [manual, setManual] = useState({ throttle: 0, brake: 0, gear: 2, pitLimiter: false, flag: 'none' })
  const [controls, setControls] = useState({})

  const [, forceRender] = useReducer((n) => n + 1, 0)

  const engineRef = useRef(createEngine())
  const telRef = useRef(createTelemetry('club'))
  const rafRef = useRef(0)
  const lastRenderRef = useRef(0)

  const board = useMemo(() => getBoard(build.boardId), [build.boardId])
  const firmware = useMemo(() => deriveFirmware(build), [build])
  const drc = useMemo(() => runDrc(build, firmware), [build, firmware])
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...build.settings }), [build.settings])

  /* Οι ζωντανές τιμές που διαβάζει ο βρόχος — refs για να μην τον ξαναστήνουμε. */
  const liveRef = useRef({ firmware, settings, controls, telemetryMode, manual })
  liveRef.current = { firmware, settings, controls, telemetryMode, manual }

  /* ------------------------- Ο βρόχος ------------------------- */
  useEffect(() => {
    if (!running) return undefined
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const live = liveRef.current
      telRef.current.mode = live.telemetryMode
      telRef.current.trackId = trackId
      stepTelemetry(telRef.current, dt, live.manual)
      stepEngine(engineRef.current, {
        firmware: live.firmware,
        telemetry: telemetrySnapshot(telRef.current),
        controls: live.controls,
        settings: live.settings,
        dt,
      })
      if (now - lastRenderRef.current >= RENDER_INTERVAL_MS) {
        lastRenderRef.current = now
        forceRender()
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [running, trackId])

  /* Αυτόματη αποθήκευση της τρέχουσας κατασκευής. */
  useEffect(() => {
    storeCurrent(build)
  }, [build])

  /* Delete: σβήσιμο επιλεγμένου εξαρτήματος. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (!selectedId || selectedId === BOARD_NODE) return
      e.preventDefault()
      setBuild((b) => removeNode(b, selectedId))
      setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  const flash = useCallback((message) => {
    setStatus(message)
    setTimeout(() => setStatus(''), 2600)
  }, [])

  /* ------------------------- Ενέργειες ------------------------- */
  const handleAdd = useCallback(
    (partId) => {
      setBuild((b) => {
        const n = b.nodes.length
        const pos = { x: 420 + (n % 3) * 250, y: 60 + Math.floor(n / 3) * 190 }
        const next = addNode(b, partId, pos)
        return next
      })
      setTab('inspect')
    },
    []
  )

  const handleMove = useCallback((id, x, y) => {
    setBuild((b) =>
      id === BOARD_NODE ? { ...b, boardPos: { x, y } } : updateNode(b, id, { x, y })
    )
  }, [])

  const handlePinClick = useCallback(
    (ref) => {
      setPending((prev) => {
        if (!prev) return ref
        if (sameRef(prev, ref)) return null
        setBuild((b) => addWire(b, prev, ref))
        return null
      })
    },
    []
  )

  const handleControl = useCallback((nodeId, patch) => {
    setControls((prev) => ({ ...prev, [nodeId]: { ...prev[nodeId], ...patch } }))
  }, [])

  const togglePower = () => {
    if (running) {
      setRunning(false)
    } else {
      resetEngine(engineRef.current)
      telRef.current = createTelemetry(trackId)
      setRunning(true)
      setTab('test')
    }
  }

  const handleLoadPreset = (id) => {
    const next = loadPreset(id)
    if (!next) return
    setBuild(next)
    setSelectedId(null)
    setPending(null)
    setShowPresets(false)
    resetEngine(engineRef.current)
    flash(`Φορτώθηκε: ${next.name}`)
  }

  const handleImport = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setBuild(parseBuildJson(String(reader.result)))
        setSelectedId(null)
        flash('Η κατασκευή φορτώθηκε.')
      } catch (err) {
        flash(`Δεν διαβάστηκε το αρχείο: ${err.message}`)
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const selectedNode = build.nodes.find((n) => n.id === selectedId) || null
  const engine = engineRef.current
  const telemetry = telemetrySnapshot(telRef.current)

  return (
    <div className="lab">
      {/* ---------------------- Μπάρα ---------------------- */}
      <header className="lab__bar">
        <div className="lab__bar-left">
          <input
            className="lab__name"
            value={build.name}
            onChange={(e) => setBuild((b) => ({ ...b, name: e.target.value }))}
            aria-label="Όνομα κατασκευής"
          />
          <select
            value={build.boardId}
            onChange={(e) => setBuild((b) => setBoard(b, e.target.value))}
            aria-label="Πλακέτα"
          >
            {BOARDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className={`lab__pill is-${drc.errors ? 'bad' : drc.warnings ? 'warn' : 'good'}`}>
            {drc.errors ? `${drc.errors} σφάλματα` : drc.warnings ? `${drc.warnings} προσοχή` : 'καθαρό'}
          </span>
        </div>

        <div className="lab__bar-right">
          <button type="button" className="btn btn--ghost" onClick={() => setShowPresets((s) => !s)}>
            Έτοιμες κατασκευές
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setSaved(saveBuild(build))
              flash('Αποθηκεύτηκε στον browser.')
            }}
          >
            Αποθήκευση
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() =>
              downloadFile(`${sketchName(build.name)}.json`, JSON.stringify(build, null, 2), 'application/json')
            }
          >
            Εξαγωγή
          </button>
          <label className="btn btn--ghost lab__import">
            Εισαγωγή
            <input type="file" accept="application/json" onChange={handleImport} hidden />
          </label>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setBuild(createBuild(build.boardId, 'Νέα κατασκευή'))
              setSelectedId(null)
              resetEngine(engineRef.current)
            }}
          >
            Καθαρό
          </button>
          <button
            type="button"
            className={`btn ${running ? 'btn--danger' : 'btn--primary'}`}
            onClick={togglePower}
          >
            {running ? 'Διακοπή' : 'Τροφοδοσία'}
          </button>
        </div>
      </header>

      {status && <p className="lab__status">{status}</p>}

      {showPresets && (
        <div className="lab__presets">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="lab__preset" onClick={() => handleLoadPreset(p.id)}>
              <strong>{p.name}</strong>
              <span className="lab__preset-meta">
                {p.level} · ~{p.hours}h
              </span>
              <small>{p.summary}</small>
            </button>
          ))}
          {saved.length > 0 && (
            <div className="lab__preset lab__preset--saved">
              <strong>Δικές σου</strong>
              <ul>
                {saved.map((b) => (
                  <li key={b.name}>
                    <button type="button" onClick={() => { setBuild(b); setShowPresets(false) }}>
                      {b.name}
                    </button>
                    <button
                      type="button"
                      className="lab__x"
                      onClick={() => setSaved(deleteBuild(b.name))}
                      aria-label={`Διαγραφή ${b.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ---------------------- Κυρίως ---------------------- */}
      <div className="lab__main">
        <PartsPalette onAdd={handleAdd} />

        <div className="lab__center">
          <div className="lab__viewswitch">
            <div className="lab__seg">
              <button
                type="button"
                className={view === 'wiring' ? 'is-on' : ''}
                onClick={() => setView('wiring')}
              >
                Καλωδίωση
              </button>
              <button
                type="button"
                className={view === 'panel' ? 'is-on' : ''}
                onClick={() => setView('panel')}
              >
                Πάνελ
              </button>
            </div>
            <span className="lab__muted">
              {view === 'wiring'
                ? 'Κλικ σε δύο pins για καλώδιο · κλικ σε καλώδιο για διαγραφή'
                : 'Πάτα, γύρισε και τράβα τα χειριστήρια όπως στον πραγματικό πάγκο'}
            </span>
          </div>

          {view === 'panel' ? (
            <PanelView
              firmware={firmware}
              engine={engine}
              running={running}
              telemetry={telemetry}
              controls={controls}
              onControl={handleControl}
            />
          ) : (
            <>
          <Workbench
            build={build}
            board={board}
            engine={engine}
            running={running}
            selectedId={selectedId}
            pending={pending}
            onSelect={setSelectedId}
            onMove={handleMove}
            onPinClick={handlePinClick}
            onWireClick={(id) => setBuild((b) => removeWire(b, id))}
            onBackground={() => {
              setPending(null)
              setSelectedId(null)
            }}
          />
          <OutputsView firmware={firmware} engine={engine} running={running} />
            </>
          )}
          <ScopeView scope={engine.scope} />
        </div>

        <div className="lab__side">
          <nav className="lab__tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? 'is-on' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === 'inspect' && (
            <Inspector
              build={build}
              node={selectedNode}
              board={board}
              boardSelected={selectedId === BOARD_NODE}
              firmware={firmware}
              onChangeValues={(id, patch) => setBuild((b) => updateNodeValues(b, id, patch))}
              onChangeLabel={(id, label) => setBuild((b) => updateNode(b, id, { label }))}
              onDelete={(id) => {
                setBuild((b) => removeNode(b, id))
                setSelectedId(null)
              }}
              onDuplicate={(id) => setBuild((b) => duplicateNode(b, id))}
              onUnwire={(id) =>
                setBuild((b) => ({
                  ...b,
                  wires: b.wires.filter((w) => w.from.node !== id && w.to.node !== id),
                }))
              }
              onChangeSettings={(patch) => setBuild((b) => updateSettings(b, patch))}
            />
          )}
          {tab === 'check' && (
            <AnalysisPanel
              firmware={firmware}
              drc={drc}
              onFocus={(id) => {
                setSelectedId(id)
                setTab('inspect')
              }}
            />
          )}
          {tab === 'test' && (
            <TestBench
              firmware={firmware}
              engine={engine}
              running={running}
              telemetry={telemetry}
              telemetryMode={telemetryMode}
              trackId={trackId}
              manual={manual}
              controls={controls}
              onSetMode={setTelemetryMode}
              onSetTrack={setTrackId}
              onManual={(patch) => setManual((m) => ({ ...m, ...patch }))}
              onControl={handleControl}
            />
          )}
          {tab === 'code' && <CodePanel build={build} firmware={firmware} />}
          {tab === 'libs' && <LibraryPanel firmware={firmware} />}
          {tab === 'bom' && <BomPanel build={build} firmware={firmware} />}
        </div>
      </div>
    </div>
  )
}
