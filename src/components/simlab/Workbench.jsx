import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BOARD_NODE,
  boardGeometry,
  canvasSize,
  cardRects,
  GEO,
  partGeometry,
  pinPosition,
  polylineToPath,
  routeWire,
  sameRef,
} from '../../lib/simlab/circuit.js'
import { getPart, PIN_TYPES } from '../../lib/simlab/parts.js'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.5
import BoardArt from './BoardArt.jsx'
import PartIcon from './PartIcon.jsx'

/** Χρώμα καλωδίου: παίρνει τον τύπο του άκρου που είναι εξάρτημα. */
function wireColor(build, wire) {
  for (const ref of [wire.from, wire.to]) {
    if (ref.node === BOARD_NODE) continue
    const node = build.nodes.find((n) => n.id === ref.node)
    const part = node && getPart(node.partId)
    const pin = part?.pins.find((p) => p.id === ref.pin)
    if (pin) return PIN_TYPES[pin.type]?.color || '#6b7280'
  }
  return '#6b7280'
}

/** Σύντομη ζωντανή ένδειξη πάνω στην κάρτα, όσο τρέχει η προσομοίωση. */
function liveBadge(state) {
  if (!state) return null
  switch (state.kind) {
    case 'button':
      return { text: state.debounced ? 'ΠΑΤΗΜΕΝΟ' : 'ελεύθερο', tone: state.debounced ? 'on' : 'off' }
    case 'encoder':
      return { text: `${Math.round(state.counts / 4)} κλικ`, tone: 'info' }
    case 'analog':
      return { text: `${Math.round(state.axis * 100)}%`, tone: 'info' }
    case 'hx711':
      return { text: `${state.forceKg.toFixed(1)} kg`, tone: 'info' }
    case 'ledstrip':
      return { text: `${Math.round(state.currentMa)} mA`, tone: 'info' }
    case 'led':
      return { text: state.on ? 'ΑΝΑΜΜΕΝΟ' : 'σβηστό', tone: state.on ? 'on' : 'off' }
    case 'sevenseg':
      return { text: state.text, tone: 'info' }
    case 'gauge':
      return { text: `${Math.round(state.angle)}°${state.lagging ? ' ⚠' : ''}`, tone: state.lagging ? 'warn' : 'info' }
    case 'servo':
      return { text: `${Math.round(state.angle)}°`, tone: 'info' }
    case 'fan':
      return { text: `${Math.round(state.duty * 100)}%`, tone: 'info' }
    case 'haptic':
      return { text: state.duty > 0 ? `δόνηση ${Math.round(state.duty * 100)}%` : 'ήρεμο', tone: state.duty > 0 ? 'on' : 'off' }
    case 'buzzer':
      return { text: state.on ? '♪' : '—', tone: state.on ? 'on' : 'off' }
    case 'display':
      return { text: `${state.lines.length ? 'ενεργή' : 'σβηστή'}`, tone: state.lines.length ? 'on' : 'off' }
    default:
      return null
  }
}

function PinRow({ pin, side, selected, connected, onClick, title }) {
  return (
    <div
      className={`lab__pin lab__pin--${side}`}
      style={{ top: pin.y - GEO.rowH / 2, height: GEO.rowH }}
    >
      <button
        type="button"
        className={`lab__pin-dot${selected ? ' is-pending' : ''}${connected ? ' is-connected' : ''}`}
        style={{ background: connected ? PIN_TYPES[pin.type]?.color || '#6b7280' : undefined }}
        onClick={onClick}
        title={title}
        aria-label={`Pin ${pin.label}`}
      />
      <span className="lab__pin-label">{pin.label}</span>
    </div>
  )
}

export default function Workbench({
  build,
  board,
  engine,
  running,
  selectedId,
  pending,
  onSelect,
  onMove,
  onPinClick,
  onWireClick,
  onBackground,
}) {
  const dragRef = useRef(null)
  const panRef = useRef(null)
  const canvasRef = useRef(null)
  const [hoverWire, setHoverWire] = useState(null)
  const [zoom, setZoom] = useState(1)

  /** Θέση του δείκτη σε συντεταγμένες περιεχομένου (αναιρεί κύλιση και zoom). */
  const toContent = useCallback(
    (e) => {
      const el = canvasRef.current
      const rect = el.getBoundingClientRect()
      return {
        x: (e.clientX - rect.left + el.scrollLeft) / zoom,
        y: (e.clientY - rect.top + el.scrollTop) / zoom,
      }
    },
    [zoom]
  )

  /** Μεγέθυνση κρατώντας σταθερό το σημείο κάτω από τον δείκτη. */
  const zoomAt = useCallback(
    (factor, clientX, clientY) => {
      const el = canvasRef.current
      if (!el) return
      setZoom((z) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor))
        if (next === z) return z
        const rect = el.getBoundingClientRect()
        const px = clientX == null ? rect.width / 2 : clientX - rect.left
        const py = clientY == null ? rect.height / 2 : clientY - rect.top
        const cx = (px + el.scrollLeft) / z
        const cy = (py + el.scrollTop) / z
        requestAnimationFrame(() => {
          el.scrollLeft = cx * next - px
          el.scrollTop = cy * next - py
        })
        return next
      })
    },
    []
  )

  /** Προσαρμογή ώστε να χωρέσει ολόκληρη η κατασκευή. */
  const zoomToFit = useCallback(() => {
    const el = canvasRef.current
    if (!el) return
    const s = canvasSize(build, board)
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(el.clientWidth / s.width, el.clientHeight / s.height) * 0.96))
    setZoom(next)
    requestAnimationFrame(() => {
      el.scrollLeft = 0
      el.scrollTop = 0
    })
  }, [build, board])

  const startDrag = useCallback(
    (e, id, x, y) => {
      if (e.button !== 0) return
      const p = toContent(e)
      dragRef.current = { id, dx: p.x - x, dy: p.y - y }
      onSelect(id)
    },
    [onSelect, toContent]
  )

  useEffect(() => {
    const move = (e) => {
      const el = canvasRef.current
      if (!el) return
      // Μετακίνηση καμβά (σύρσιμο στο φόντο)
      const pan = panRef.current
      if (pan) {
        pan.moved = true
        el.scrollLeft = pan.left - (e.clientX - pan.x)
        el.scrollTop = pan.top - (e.clientY - pan.y)
        return
      }
      const drag = dragRef.current
      if (!drag) return
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - rect.left + el.scrollLeft) / zoom - drag.dx
      const y = (e.clientY - rect.top + el.scrollTop) / zoom - drag.dy
      onMove(drag.id, Math.max(0, Math.round(x / 4) * 4), Math.max(0, Math.round(y / 4) * 4))
    }
    const up = () => {
      // Κλικ χωρίς μετακίνηση στο φόντο = αποεπιλογή.
      if (panRef.current && !panRef.current.moved) onBackground()
      panRef.current = null
      dragRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [onMove, onBackground, zoom])

  /* Ctrl/⌘ + ροδέλα = zoom· σκέτη ροδέλα = κύλιση, όπως σε κάθε καμβά. */
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return undefined
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  /* Συντομεύσεις: + − 0 (και ⌘/Ctrl εκδοχές τους). */
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === '+' || e.key === '=') zoomAt(1.15)
      else if (e.key === '-' || e.key === '_') zoomAt(1 / 1.15)
      else if (e.key === '0') zoomToFit()
      else if (e.key === '1') setZoom(1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomAt, zoomToFit])

  const size = canvasSize(build, board)
  const boardGeo = boardGeometry(board)
  const connectedKeys = new Set()
  for (const w of build.wires) {
    connectedKeys.add(`${w.from.node}:${w.from.pin}`)
    connectedKeys.add(`${w.to.node}:${w.to.pin}`)
  }

  /* Οι διαδρομές είναι ακριβές (αποφυγή εμποδίων) και δεν αλλάζουν όσο τρέχει
     η προσομοίωση — υπολογίζονται μόνο όταν μετακινηθεί ή αλλάξει κάτι. */
  const routes = useMemo(() => {
    const rects = cardRects(build, board)
    return build.wires
      .map((wire, i) => {
        const a = pinPosition(build, board, wire.from)
        const b = pinPosition(build, board, wire.to)
        if (!a || !b) return null
        const lane = ((i % 7) - 3) * 7
        return {
          wire,
          a,
          b,
          d: polylineToPath(routeWire(a, b, rects, lane)),
          color: wireColor(build, wire),
        }
      })
      .filter(Boolean)
  }, [build, board])

  /**
   * «Φόντο» είναι ο καμβάς και τα δοχεία του — όχι οι κάρτες, τα καλώδια ή η
   * μπάρα zoom. Ο έλεγχος γίνεται με closest() γιατί ανάμεσα στον καμβά και
   * στο σημείο που πατάς παρεμβάλλονται τα δοχεία της κλίμακας.
   */
  const isBackground = (target) => {
    if (!(target instanceof Element)) return false
    if (target.closest('.lab__node') || target.closest('.lab__zoombar')) return false
    if (target.classList.contains('lab__wire-hit')) return false
    return true
  }

  const startPan = (e) => {
    if (e.button !== 0 && e.button !== 1) return
    const el = canvasRef.current
    panRef.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      moved: false,
    }
  }

  return (
    <div
      className="lab__canvas"
      ref={canvasRef}
      onPointerDown={(e) => {
        // Σύρσιμο στο φόντο = μετακίνηση· απλό κλικ = αποεπιλογή.
        if (isBackground(e.target)) startPan(e)
      }}
    >
      <div
        className="lab__canvas-inner"
        style={{ width: size.width * zoom, height: size.height * zoom }}
      >
        <div
          className="lab__canvas-scale"
          style={{
            width: size.width,
            height: size.height,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
        <svg className="lab__wires" width={size.width} height={size.height}>
          {routes.map(({ wire, a, b, d, color }) => {
            const touches =
              selectedId && (wire.from.node === selectedId || wire.to.node === selectedId)
            const dim = selectedId && !touches
            return (
              <g
                key={wire.id}
                className={`lab__wiregroup${touches ? ' is-lit' : ''}${dim ? ' is-dim' : ''}${
                  hoverWire === wire.id ? ' is-hover' : ''
                }`}
              >
                {/* Φαρδιά αόρατη ζώνη ώστε να πιάνεται εύκολα το κλικ. */}
                <path
                  d={d}
                  className="lab__wire-hit"
                  onClick={() => onWireClick(wire.id)}
                  onPointerEnter={() => setHoverWire(wire.id)}
                  onPointerLeave={() => setHoverWire(null)}
                >
                  <title>Κλικ για διαγραφή καλωδίου</title>
                </path>
                <path d={d} className="lab__wire" stroke={color} />
                <circle cx={a.x} cy={a.y} r="3" fill={color} className="lab__wire-end" />
                <circle cx={b.x} cy={b.y} r="3" fill={color} className="lab__wire-end" />
              </g>
            )
          })}
        </svg>

        {/* -------- Η πλακέτα -------- */}
        <div
          className={`lab__node lab__node--board${selectedId === BOARD_NODE ? ' is-selected' : ''}`}
          style={{
            left: build.boardPos.x,
            top: build.boardPos.y,
            width: GEO.boardW,
            height: boardGeo.height,
          }}
        >
          <div
            className="lab__node-head"
            onPointerDown={(e) => startDrag(e, BOARD_NODE, build.boardPos.x, build.boardPos.y)}
          >
            <span className="lab__node-icon"><PartIcon name="board" size={16} /></span>
            <span className="lab__node-title">{board.name}</span>
            {running && <span className={`lab__led${engine?.hid?.connected ? ' is-on' : ''}`} title="USB HID" />}
          </div>
          <BoardArt boardId={board.id} className="lab__boardart" />
          {boardGeo.pins.map((pin) => (
            <PinRow
              key={pin.id}
              pin={pin}
              side={pin.side}
              selected={pending && sameRef(pending, { node: BOARD_NODE, pin: pin.id })}
              connected={connectedKeys.has(`${BOARD_NODE}:${pin.id}`)}
              title={`${pin.label} — ${pin.caps.join(', ')}${pin.note ? ` · ${pin.note}` : ''}`}
              onClick={() => onPinClick({ node: BOARD_NODE, pin: pin.id })}
            />
          ))}
        </div>

        {/* -------- Τα εξαρτήματα -------- */}
        {build.nodes.map((node) => {
          const part = getPart(node.partId)
          if (!part) return null
          const geo = partGeometry(node)
          const state = engine?.nodes?.[node.id]
          const badge = running ? liveBadge(state) : null
          return (
            <div
              key={node.id}
              className={`lab__node${selectedId === node.id ? ' is-selected' : ''}`}
              style={{ left: node.x, top: node.y, width: geo.width, height: geo.height }}
            >
              <div
                className="lab__node-head"
                onPointerDown={(e) => startDrag(e, node.id, node.x, node.y)}
              >
                <span className="lab__node-icon">
                  <PartIcon name={part.icon} size={16} />
                </span>
                <span className="lab__node-title">{node.label || part.name}</span>
              </div>
              {geo.pins.map((pin) => (
                <PinRow
                  key={pin.id}
                  pin={pin}
                  side={pin.side}
                  selected={pending && sameRef(pending, { node: node.id, pin: pin.id })}
                  connected={connectedKeys.has(`${node.id}:${pin.id}`)}
                  title={`${pin.label} — ${PIN_TYPES[pin.type]?.label || pin.type}`}
                  onClick={() => onPinClick({ node: node.id, pin: pin.id })}
                />
              ))}
              {badge && <span className={`lab__badge lab__badge--${badge.tone}`}>{badge.text}</span>}
              {running && state?.kind === 'ledstrip' && (
                <div className="lab__strip">
                  {state.pixels.map((px, i) => (
                    <span
                      key={i}
                      style={{ background: `rgb(${px[0]},${px[1]},${px[2]})` }}
                      className="lab__strip-led"
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        </div>
      </div>

      <div className="lab__zoombar">
        <button type="button" onClick={() => zoomAt(1 / 1.2)} aria-label="Σμίκρυνση" title="Σμίκρυνση (−)">
          −
        </button>
        <button
          type="button"
          className="lab__zoombar-val"
          onClick={() => setZoom(1)}
          title="Επαναφορά στο 100% (1)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" onClick={() => zoomAt(1.2)} aria-label="Μεγέθυνση" title="Μεγέθυνση (+)">
          +
        </button>
        <button type="button" onClick={zoomToFit} title="Να χωρέσουν όλα (0)" aria-label="Προσαρμογή">
          ⤢
        </button>
      </div>

      {pending && (
        <p className="lab__hint">
          Επίλεξε το δεύτερο pin για να ολοκληρώσεις το καλώδιο — ή κλικ στο φόντο για ακύρωση.
        </p>
      )}
    </div>
  )
}
