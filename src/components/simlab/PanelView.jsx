import { useCallback, useEffect, useRef } from 'react'
import { formatLapTime } from '../../lib/simlab/telemetry.js'

/**
 * Το «πάνελ»: η κατασκευή όπως θα την είχες μπροστά σου.
 *
 * Εδώ δεν υπάρχουν sliders και αφηρημένες κάρτες — πατάς το κουμπί και βυθίζεται,
 * γυρίζεις τον διακόπτη και γυρίζει, πατάς το πεντάλ και κατεβαίνει. Τα σήματα
 * περνάνε από την ίδια μηχανή προσομοίωσης με τη σελίδα καλωδίωσης, οπότε η
 * αναπήδηση επαφών και ο θόρυβος του ADC φαίνονται και εδώ.
 */

/* ------------------------------------------------------------------ */
/* Βοηθητικά χειρισμού                                                 */
/* ------------------------------------------------------------------ */

/** Σύρσιμο με τον δείκτη: επιστρέφει χειριστές και κρατά την αιχμαλωσία. */
function useDrag(onMove, onEnd) {
  const ref = useRef(null)
  useEffect(() => {
    const move = (e) => {
      if (!ref.current) return
      onMove(e, ref.current)
    }
    const up = () => {
      if (!ref.current) return
      ref.current = null
      if (onEnd) onEnd()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [onMove, onEnd])
  return (e, start) => {
    e.preventDefault()
    ref.current = { x0: e.clientX, y0: e.clientY, ...start }
  }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/* ------------------------------------------------------------------ */
/* Εξαρτήματα εισόδου                                                  */
/* ------------------------------------------------------------------ */

function PushButton({ label, pressed, lit, onDown, onUp, color = '#c0392b' }) {
  return (
    <button
      type="button"
      className="pnl__hit"
      onPointerDown={(e) => {
        e.preventDefault()
        onDown()
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
      aria-pressed={pressed}
      aria-label={label}
    >
      <svg viewBox="0 0 72 72" className="pnl__svg">
        {/* σώμα / βάση */}
        <circle cx="36" cy="38" r="27" fill="#0d1016" stroke="#2a2f3a" strokeWidth="2" />
        <circle cx="36" cy="38" r="23" fill="#171b23" />
        {/* καπάκι — βυθίζεται 4px όταν πατιέται */}
        <g transform={`translate(0 ${pressed ? 4 : 0})`}>
          <circle cx="36" cy="32" r="20" fill={color} opacity={pressed ? 0.82 : 1} />
          <circle cx="36" cy="32" r="20" fill="url(#pnlBtnShine)" />
          <ellipse cx="36" cy="25" rx="13" ry="7" fill="#fff" opacity={pressed ? 0.07 : 0.16} />
        </g>
        {lit && <circle cx="36" cy="32" r="26" fill="none" stroke="#34d399" strokeWidth="2" opacity="0.85" />}
      </svg>
    </button>
  )
}

function ToggleSwitch({ label, on, onToggle }) {
  return (
    <button type="button" className="pnl__hit" onClick={onToggle} aria-pressed={on} aria-label={label}>
      <svg viewBox="0 0 72 72" className="pnl__svg">
        <rect x="22" y="14" width="28" height="46" rx="6" fill="#0d1016" stroke="#2a2f3a" strokeWidth="2" />
        <circle cx="36" cy={on ? 26 : 48} r="9" fill="#3b4252" />
        {/* ο μοχλός γέρνει προς τα πάνω ή προς τα κάτω */}
        <line
          x1="36"
          y1="37"
          x2="36"
          y2={on ? 20 : 54}
          stroke="#cbd5e1"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="36" cy={on ? 20 : 54} r="6" fill="#e2e8f0" />
        <text x="36" y="70" textAnchor="middle" className="pnl__tick">
          {on ? 'ON' : 'OFF'}
        </text>
      </svg>
    </button>
  )
}

function Knob({ label, value, marks, onDelta, spinning }) {
  const angle = -135 + value * 270
  const start = useDrag((e, s) => onDelta((s.y0 - e.clientY) / 160, s))
  return (
    <div
      className="pnl__hit"
      onPointerDown={(e) => start(e, { v0: value })}
      role="slider"
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onDelta(0.05, { v0: value })
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onDelta(-0.05, { v0: value })
      }}
    >
      <svg viewBox="0 0 72 72" className="pnl__svg">
        {marks &&
          Array.from({ length: 11 }, (_, i) => {
            const a = ((-135 + i * 27) * Math.PI) / 180
            return (
              <line
                key={i}
                x1={36 + Math.sin(a) * 30}
                y1={38 - Math.cos(a) * 30}
                x2={36 + Math.sin(a) * 26}
                y2={38 - Math.cos(a) * 26}
                stroke="#4b5563"
                strokeWidth="1.5"
              />
            )
          })}
        <circle cx="36" cy="38" r="22" fill="#1b1f28" stroke="#343b48" strokeWidth="2" />
        <g transform={`rotate(${angle} 36 38)`}>
          {/* ραβδώσεις για να φαίνεται η περιστροφή */}
          {Array.from({ length: 12 }, (_, i) => (
            <line
              key={i}
              x1={36}
              y1={18}
              x2={36}
              y2={22}
              stroke="#4b5563"
              strokeWidth="2"
              transform={`rotate(${i * 30} 36 38)`}
            />
          ))}
          <circle cx="36" cy="38" r="15" fill="#252b36" />
          <line x1="36" y1="38" x2="36" y2="25" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
        </g>
        {spinning && <circle cx="36" cy="38" r="26" fill="none" stroke="#7c5cff" strokeWidth="2" />}
      </svg>
    </div>
  )
}

function Pedal({ label, value, onChange, forceKg }) {
  const travel = value * 26
  const start = useDrag((e, s) => onChange(clamp(s.v0 + (e.clientY - s.y0) / 90, 0, 1)))
  return (
    <div
      className="pnl__hit pnl__hit--pedal"
      onPointerDown={(e) => start(e, { v0: value })}
      role="slider"
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') onChange(clamp(value + 0.08, 0, 1))
        if (e.key === 'ArrowUp') onChange(clamp(value - 0.08, 0, 1))
      }}
    >
      <svg viewBox="0 0 72 86" className="pnl__svg pnl__svg--tall">
        {/* βάση και μπράτσο */}
        <rect x="10" y="72" width="52" height="8" rx="3" fill="#1b1f28" stroke="#343b48" />
        <line x1="36" y1="74" x2="36" y2={30 + travel} stroke="#3b4252" strokeWidth="8" strokeLinecap="round" />
        {/* πλάκα πεντάλ */}
        <g transform={`translate(0 ${travel})`}>
          <rect x="14" y="14" width="44" height="20" rx="4" fill="#2b323f" stroke="#4b5563" strokeWidth="2" />
          {Array.from({ length: 4 }, (_, i) => (
            <line key={i} x1="20" y1={19 + i * 4} x2="52" y2={19 + i * 4} stroke="#111827" strokeWidth="1.5" />
          ))}
        </g>
        {/* ένδειξη δύναμης */}
        <rect x="62" y="14" width="6" height="58" rx="3" fill="#0d1016" stroke="#2a2f3a" />
        <rect x="62" y={72 - value * 58} width="6" height={value * 58} rx="3" fill="#ef4444" />
      </svg>
      {forceKg != null && <span className="pnl__readout">{forceKg.toFixed(1)} kg</span>}
    </div>
  )
}

function MagnetSensor({ label, near, onDown, onUp }) {
  return (
    <button
      type="button"
      className="pnl__hit"
      onPointerDown={(e) => {
        e.preventDefault()
        onDown()
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      aria-label={label}
      aria-pressed={near}
    >
      <svg viewBox="0 0 72 72" className="pnl__svg">
        {/* αισθητήρας */}
        <rect x="10" y="28" width="16" height="22" rx="2" fill="#1b1f28" stroke="#343b48" strokeWidth="2" />
        <line x1="14" y1="50" x2="14" y2="60" stroke="#6b7280" strokeWidth="1.5" />
        <line x1="18" y1="50" x2="18" y2="60" stroke="#6b7280" strokeWidth="1.5" />
        <line x1="22" y1="50" x2="22" y2="60" stroke="#6b7280" strokeWidth="1.5" />
        {/* μαγνήτης — πλησιάζει όταν πατάς */}
        <g transform={`translate(${near ? -14 : 0} 0)`}>
          <rect x="44" y="26" width="18" height="26" rx="3" fill="#dc2626" />
          <rect x="44" y="39" width="18" height="13" rx="3" fill="#f8fafc" />
        </g>
        {near && <circle cx="18" cy="39" r="24" fill="none" stroke="#34d399" strokeWidth="2" opacity="0.7" />}
      </svg>
    </button>
  )
}

function KeyMatrix({ label, rows, cols, keys, onToggle }) {
  return (
    <div className="pnl__matrix" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} aria-label={label}>
      {Array.from({ length: rows * cols }, (_, i) => (
        <button
          key={i}
          type="button"
          className={`pnl__key${keys.has(i) ? ' is-down' : ''}`}
          onClick={() => onToggle(i)}
        >
          {i + 1}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Εξαρτήματα εξόδου                                                   */
/* ------------------------------------------------------------------ */

function Bulb({ on, color }) {
  const COLORS = { red: '#ef4444', green: '#22c55e', blue: '#3b82f6', amber: '#f59e0b' }
  const c = COLORS[color] || '#ef4444'
  return (
    <svg viewBox="0 0 72 72" className="pnl__svg">
      <circle cx="36" cy="36" r="18" fill={on ? c : '#1f2937'} opacity={on ? 1 : 0.75} />
      {on && <circle cx="36" cy="36" r="26" fill={c} opacity="0.22" />}
      <circle cx="36" cy="36" r="18" fill="none" stroke="#343b48" strokeWidth="2" />
      <ellipse cx="30" cy="29" rx="6" ry="4" fill="#fff" opacity={on ? 0.45 : 0.08} />
    </svg>
  )
}

function SevenSeg({ text }) {
  return <span className="pnl__seg7">{text || '----'}</span>
}

function Screen({ lines }) {
  const big = lines.find((l) => l.big)
  const rows = lines.filter((l) => l.label)
  return (
    <div className="pnl__screen">
      {big && <span className={`pnl__screen-big is-${big.tone}`}>{big.big}</span>}
      <div className="pnl__screen-rows">
        {rows.map((r) => (
          <div key={r.label}>
            <span>{r.label}</span>
            <strong>{r.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function Dial({ angle, sweep, lagging }) {
  const start = -sweep / 2 - 90
  const rad = ((start + angle) * Math.PI) / 180
  return (
    <svg viewBox="0 0 72 72" className="pnl__svg">
      <circle cx="36" cy="36" r="28" fill="#0b0f16" stroke="#343b48" strokeWidth="2" />
      {Array.from({ length: 11 }, (_, i) => {
        const a = ((start + (sweep * i) / 10) * Math.PI) / 180
        return (
          <line
            key={i}
            x1={36 + Math.cos(a) * 23}
            y1={36 + Math.sin(a) * 23}
            x2={36 + Math.cos(a) * 27}
            y2={36 + Math.sin(a) * 27}
            stroke={i > 7 ? '#ef4444' : '#6b7280'}
            strokeWidth="2"
          />
        )
      })}
      <line
        x1="36"
        y1="36"
        x2={36 + Math.cos(rad) * 21}
        y2={36 + Math.sin(rad) * 21}
        stroke={lagging ? '#f59e0b' : '#ef4444'}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="36" cy="36" r="4" fill="#9ca3af" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Ένας σταθμός στο πάνελ                                              */
/* ------------------------------------------------------------------ */

function Station({ name, sub, wide, children }) {
  return (
    <div className={`pnl__station${wide ? ' pnl__station--wide' : ''}`}>
      <div className="pnl__viz">{children}</div>
      <span className="pnl__name">{name}</span>
      {sub && <span className="pnl__sub">{sub}</span>}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export default function PanelView({ firmware, engine, running, telemetry, controls, onControl }) {
  const spinTimer = useRef({})

  /** Το γύρισμα του encoder είναι ρυθμός· σβήνει μόνο του όταν σταματήσεις. */
  const nudge = useCallback(
    (nodeId, rate) => {
      onControl(nodeId, { spin: rate })
      clearTimeout(spinTimer.current[nodeId])
      spinTimer.current[nodeId] = setTimeout(() => onControl(nodeId, { spin: 0 }), 140)
    },
    [onControl]
  )

  useEffect(() => {
    const timers = spinTimer.current
    return () => Object.values(timers).forEach(clearTimeout)
  }, [])

  const inputs = firmware.inputs.filter((e) => e.wired)
  const outputs = firmware.outputs.filter((e) => e.wired)

  if (inputs.length === 0 && outputs.length === 0) {
    return (
      <div className="pnl pnl--empty">
        <p className="lab__muted">
          Άδειο πάνελ. Πήγαινε στην «Καλωδίωση», πρόσθεσε εξαρτήματα και σύνδεσέ τα — θα εμφανιστούν
          εδώ ως πραγματικά χειριστήρια.
        </p>
      </div>
    )
  }

  return (
    <div className="pnl">
      {/* Ένας κοινός ορισμός λάμψης για όλα τα κουμπιά. */}
      <svg width="0" height="0" aria-hidden="true">
        <defs>
          <radialGradient id="pnlBtnShine" cx="35%" cy="25%" r="75%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      {!running && (
        <p className="pnl__off">Η τροφοδοσία είναι κλειστή — τα χειριστήρια κινούνται, αλλά δεν στέλνουν σήμα.</p>
      )}

      <div className="pnl__grid">
        {inputs.map((entry) => {
          const st = engine.nodes[entry.nodeId] || {}
          const c = controls[entry.nodeId] || {}
          const v = entry.values

          if (entry.kind === 'button') {
            const isToggle = v.latch
            const active = isToggle ? !!st.latched : !!st.debounced
            const sub = st.presses
              ? `${st.presses} πατήματα${st.ghosts ? ` · ${st.ghosts} ψεύτικα` : ''}`
              : entry.buttons.length
                ? `κουμπί #${entry.buttons[0] + 1}`
                : ''
            if (entry.part.id === 'toggle') {
              return (
                <Station key={entry.nodeId} name={entry.label} sub={sub}>
                  <ToggleSwitch
                    label={entry.label}
                    on={!!c.pressed}
                    onToggle={() => onControl(entry.nodeId, { pressed: !c.pressed })}
                  />
                </Station>
              )
            }
            if (entry.part.id === 'hall-digital') {
              return (
                <Station key={entry.nodeId} name={entry.label} sub={sub}>
                  <MagnetSensor
                    label={entry.label}
                    near={!!c.pressed}
                    onDown={() => onControl(entry.nodeId, { pressed: true })}
                    onUp={() => onControl(entry.nodeId, { pressed: false })}
                  />
                </Station>
              )
            }
            return (
              <Station key={entry.nodeId} name={entry.label} sub={sub}>
                <PushButton
                  label={entry.label}
                  pressed={!!c.pressed}
                  lit={active}
                  color={entry.part.id === 'microswitch' ? '#475569' : '#c0392b'}
                  onDown={() => onControl(entry.nodeId, { pressed: true })}
                  onUp={() => onControl(entry.nodeId, { pressed: false })}
                />
              </Station>
            )
          }

          if (entry.kind === 'encoder') {
            const detents = v.detents || 20
            const turns = (st.counts || 0) / 4 / detents
            return (
              <Station
                key={entry.nodeId}
                name={entry.label}
                sub={`${Math.round((st.counts || 0) / 4)} κλικ${st.missed > 1 ? ` · ${Math.round(st.missed)} χαμένα` : ''}`}
              >
                <Knob
                  label={entry.label}
                  value={((turns % 1) + 1) % 1}
                  spinning={Math.abs(c.spin || 0) > 0.01}
                  onDelta={(d) => nudge(entry.nodeId, clamp(d * 70, -18, 18))}
                />
              </Station>
            )
          }

          if (entry.kind === 'analog') {
            return (
              <Station
                key={entry.nodeId}
                name={entry.label}
                sub={`άξονας ${entry.axis || '—'} · ${Math.round((st.axis || 0) * 1023)}`}
              >
                <Knob
                  label={entry.label}
                  marks
                  value={c.value ?? 0.5}
                  onDelta={(d, s) => onControl(entry.nodeId, { value: clamp((s.v0 ?? 0.5) + d, 0, 1) })}
                />
              </Station>
            )
          }

          if (entry.kind === 'hx711') {
            return (
              <Station
                key={entry.nodeId}
                name={entry.label}
                sub={`άξονας ${entry.axis || '—'} · ${Math.round((st.axis || 0) * 1023)}`}
              >
                <Pedal
                  label={entry.label}
                  value={c.value ?? 0}
                  forceKg={st.forceKg}
                  onChange={(x) => onControl(entry.nodeId, { value: x })}
                />
              </Station>
            )
          }

          if (entry.kind === 'matrix' || entry.kind === 'expander') {
            const rows = entry.kind === 'matrix' ? v.rows || 4 : 4
            const cols = entry.kind === 'matrix' ? v.cols || 4 : 4
            const keys = new Set(c.keys || [])
            return (
              <Station key={entry.nodeId} name={entry.label} sub={`${rows * cols} κουμπιά`} wide>
                <KeyMatrix
                  label={entry.label}
                  rows={rows}
                  cols={cols}
                  keys={keys}
                  onToggle={(i) => {
                    const next = new Set(keys)
                    if (next.has(i)) next.delete(i)
                    else next.add(i)
                    onControl(entry.nodeId, { keys: [...next] })
                  }}
                />
              </Station>
            )
          }

          return null
        })}

        {/* ------------------------- Έξοδοι ------------------------- */}
        {outputs.map((entry) => {
          const st = engine.nodes[entry.nodeId]
          if (!st) return null
          const v = entry.values

          if (st.kind === 'ledstrip') {
            return (
              <Station key={entry.nodeId} name={entry.label} sub={`${Math.round(st.currentMa || 0)} mA`} wide>
                <div className="pnl__strip">
                  {(st.pixels || []).map((px, i) => (
                    <span
                      key={i}
                      style={{
                        background: `rgb(${px[0]},${px[1]},${px[2]})`,
                        boxShadow: px[0] + px[1] + px[2] > 40 ? `0 0 10px rgb(${px[0]},${px[1]},${px[2]})` : 'none',
                      }}
                    />
                  ))}
                </div>
              </Station>
            )
          }
          if (st.kind === 'led') {
            return (
              <Station key={entry.nodeId} name={entry.label} sub={st.on ? 'αναμμένο' : 'σβηστό'}>
                <Bulb on={st.on} color={v.color} />
              </Station>
            )
          }
          if (st.kind === 'sevenseg') {
            return (
              <Station key={entry.nodeId} name={entry.label} sub={`${v.updateHz} Hz`}>
                <SevenSeg text={st.text} />
              </Station>
            )
          }
          if (st.kind === 'display') {
            return (
              <Station key={entry.nodeId} name={entry.label} sub={`${v.updateHz} Hz`} wide>
                <Screen lines={st.lines || []} />
              </Station>
            )
          }
          if (st.kind === 'gauge') {
            return (
              <Station key={entry.nodeId} name={entry.label} sub={st.lagging ? 'χάνει βήματα' : `${Math.round(st.angle)}°`}>
                <Dial angle={st.angle} sweep={v.sweepDeg || 270} lagging={st.lagging} />
              </Station>
            )
          }
          if (st.kind === 'fan') {
            return (
              <Station key={entry.nodeId} name={entry.label} sub={`${Math.round(st.duty * 100)}%`}>
                <span
                  className="pnl__fan"
                  style={{
                    animationDuration: st.duty > 0.02 ? `${Math.max(0.1, 1.1 - st.duty)}s` : '0s',
                    opacity: st.duty > 0.02 ? 1 : 0.3,
                  }}
                >
                  ✳
                </span>
              </Station>
            )
          }
          if (st.kind === 'haptic') {
            return (
              <Station key={entry.nodeId} name={entry.label} sub={st.duty > 0 ? `${Math.round(st.duty * 100)}%` : 'ήρεμο'}>
                <span
                  className={`pnl__haptic${st.duty > 0 ? ' is-buzzing' : ''}`}
                  style={{ opacity: 0.35 + st.duty * 0.65 }}
                />
              </Station>
            )
          }
          if (st.kind === 'buzzer') {
            return (
              <Station key={entry.nodeId} name={entry.label} sub={st.on ? `${v.toneHz} Hz` : '—'}>
                <span className={`pnl__buzzer${st.on ? ' is-on' : ''}`}>{st.on ? '♪♪♪' : '♪'}</span>
              </Station>
            )
          }
          if (st.kind === 'servo') {
            return (
              <Station key={entry.nodeId} name={entry.label} sub={`${Math.round(st.angle)}°`}>
                <svg viewBox="0 0 72 72" className="pnl__svg">
                  <rect x="22" y="34" width="28" height="26" rx="3" fill="#1b1f28" stroke="#343b48" strokeWidth="2" />
                  <circle cx="36" cy="30" r="7" fill="#2b323f" stroke="#4b5563" />
                  <g transform={`rotate(${st.angle - 90} 36 30)`}>
                    <rect x="34" y="6" width="4" height="26" rx="2" fill="#7c5cff" />
                  </g>
                </svg>
              </Station>
            )
          }
          return null
        })}
      </div>

      <div className="pnl__telemetry">
        <span>{telemetry.rpm} rpm</span>
        <span>{telemetry.speedKmh} km/h</span>
        <span>γρανάζι {telemetry.gear}</span>
        <span className={telemetry.abs ? 'is-bad' : ''}>{telemetry.abs ? 'ABS' : '—'}</span>
        <span>{formatLapTime(telemetry.lapTime)}</span>
      </div>
    </div>
  )
}
