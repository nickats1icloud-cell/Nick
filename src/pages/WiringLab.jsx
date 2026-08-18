import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PartsPalette from '../components/simlab/PartsPalette.jsx'
import Workbench from '../components/simlab/Workbench.jsx'
import Inspector from '../components/simlab/Inspector.jsx'
import useBuildStore from '../hooks/useBuildStore.js'

import { BOARDS, getBoard } from '../lib/simlab/boards.js'
import {
  BOARD_NODE,
  addNode,
  addWire,
  autoLayout,
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
import { loadPreset } from '../lib/simlab/presets.js'

/**
 * Η καλωδίωση σε δική της σελίδα.
 *
 * Ίδιος πάγκος με το εργαστήριο, αλλά με όλο το πλάτος και ύψος της οθόνης
 * στη διάθεσή του — για όταν η κατασκευή μεγαλώσει. Μοιράζεται την κατασκευή
 * με το `/lab` μέσω localStorage, οπότε ό,τι αλλάζεις εδώ φαίνεται εκεί και
 * αντίστροφα, ακόμη και με τις δύο καρτέλες ανοιχτές.
 */
export default function WiringLab() {
  const [build, setBuild, history] = useBuildStore(() => loadPreset('button-box'))
  const [selectedId, setSelectedId] = useState(null)
  const [pending, setPending] = useState(null)
  const [showPalette, setShowPalette] = useState(true)
  const [showInspector, setShowInspector] = useState(true)

  const board = useMemo(() => getBoard(build.boardId), [build.boardId])
  const firmware = useMemo(() => deriveFirmware(build), [build])
  const drc = useMemo(() => runDrc(build, firmware), [build, firmware])

  const handleAdd = useCallback(
    (partId) => {
      setBuild((b) => {
        const n = b.nodes.length
        return addNode(b, partId, {
          x: b.boardPos.x + 420,
          y: 60 + (n % 5) * 170,
        })
      })
      setShowInspector(true)
    },
    [setBuild]
  )

  const handleMove = useCallback(
    (id, x, y) => {
      setBuild((b) => (id === BOARD_NODE ? { ...b, boardPos: { x, y } } : updateNode(b, id, { x, y })))
    },
    [setBuild]
  )

  const handlePinClick = useCallback(
    (ref) => {
      setPending((prev) => {
        if (!prev) return ref
        if (sameRef(prev, ref)) return null
        setBuild((b) => addWire(b, prev, ref))
        return null
      })
    },
    [setBuild]
  )

  /* Delete/Backspace: σβήσιμο επιλεγμένου εξαρτήματος. */
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
  }, [selectedId, setBuild])

  const selectedNode = build.nodes.find((n) => n.id === selectedId) || null

  return (
    <div className="wire">
      <header className="wire__bar">
        <div className="wire__bar-left">
          <Link to="/lab" className="btn btn--ghost wire__back">
            ← Εργαστήριο
          </Link>
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
            {drc.errors
              ? `${drc.errors} σφάλματα`
              : drc.warnings
                ? `${drc.warnings} προσοχή`
                : 'καθαρό'}
          </span>
          <span className="lab__muted wire__count">
            {build.nodes.length} εξαρτήματα · {build.wires.length} καλώδια
          </span>
        </div>

        <div className="wire__bar-right">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={history.undo}
            disabled={!history.canUndo}
            title="Αναίρεση (Ctrl+Z)"
          >
            ↶ Αναίρεση
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={history.redo}
            disabled={!history.canRedo}
            title="Επανάληψη (Ctrl+Shift+Z)"
            aria-label="Επανάληψη"
          >
            ↷
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setBuild((b) => autoLayout(b))}>
            Τακτοποίηση
          </button>
          <button
            type="button"
            className={`btn btn--ghost${showPalette ? ' is-on' : ''}`}
            onClick={() => setShowPalette((v) => !v)}
            aria-pressed={showPalette}
          >
            Βιβλιοθήκη
          </button>
          <button
            type="button"
            className={`btn btn--ghost${showInspector ? ' is-on' : ''}`}
            onClick={() => setShowInspector((v) => !v)}
            aria-pressed={showInspector}
          >
            Ρυθμίσεις
          </button>
        </div>
      </header>

      <div
        className="wire__body"
        data-palette={showPalette ? 'on' : 'off'}
        data-inspector={showInspector ? 'on' : 'off'}
      >
        {showPalette && <PartsPalette onAdd={handleAdd} />}

        <Workbench
          build={build}
          board={board}
          engine={null}
          running={false}
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

        {showInspector && (
          <div className="wire__side">
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
          </div>
        )}
      </div>

      <p className="wire__help">
        Κλικ σε δύο pins για καλώδιο · τα πράσινα pins είναι τα συμβατά · <kbd>Esc</kbd> ακύρωση ·
        σύρε το φόντο για μετακίνηση · <kbd>Ctrl</kbd>+ροδέλα ή <kbd>+</kbd>/<kbd>−</kbd> για zoom ·
        <kbd>0</kbd> να χωρέσουν όλα · <kbd>Ctrl</kbd>+<kbd>Z</kbd> αναίρεση · <kbd>Del</kbd> διαγραφή
      </p>
    </div>
  )
}
