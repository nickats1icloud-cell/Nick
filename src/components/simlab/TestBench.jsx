import { TRACKS, formatLapTime } from '../../lib/simlab/telemetry.js'

const FLAGS = [
  { value: 'none', label: 'Καμία' },
  { value: 'yellow', label: 'Κίτρινη' },
  { value: 'blue', label: 'Μπλε' },
  { value: 'white', label: 'Λευκή' },
]

function HoldButton({ label, onDown, onUp, active }) {
  return (
    <button
      type="button"
      className={`lab__hold${active ? ' is-active' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault()
        onDown()
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
    >
      {label}
    </button>
  )
}

/** Χειριστήρια για κάθε είσοδο της κατασκευής — «άγγιξε» το εξάρτημα. */
function InputControl({ entry, control, state, onControl }) {
  const v = entry.values

  if (entry.kind === 'button') {
    return (
      <div className="lab__ctrl">
        <span className="lab__ctrl-name">{entry.label}</span>
        <HoldButton
          label={v.latch ? 'Εναλλαγή' : 'Κράτα πατημένο'}
          active={!!control.pressed}
          onDown={() => onControl(entry.nodeId, { pressed: true })}
          onUp={() => onControl(entry.nodeId, { pressed: false })}
        />
        {state && (
          <span className="lab__ctrl-meta">
            {state.presses} πατήματα
            {state.ghosts > 0 && <em className="is-bad"> · {state.ghosts} ψεύτικα</em>}
          </span>
        )}
      </div>
    )
  }

  if (entry.kind === 'encoder') {
    return (
      <div className="lab__ctrl">
        <span className="lab__ctrl-name">{entry.label}</span>
        <div className="lab__ctrl-row">
          <HoldButton
            label="◀ αριστερά"
            active={(control.spin || 0) < 0}
            onDown={() => onControl(entry.nodeId, { spin: -8 })}
            onUp={() => onControl(entry.nodeId, { spin: 0 })}
          />
          <HoldButton
            label="δεξιά ▶"
            active={(control.spin || 0) > 0}
            onDown={() => onControl(entry.nodeId, { spin: 8 })}
            onUp={() => onControl(entry.nodeId, { spin: 0 })}
          />
        </div>
        {state && (
          <span className="lab__ctrl-meta">
            {Math.round(state.counts / 4)} κλικ
            {state.missed > 1 && <em className="is-bad"> · {Math.round(state.missed)} χαμένα βήματα</em>}
          </span>
        )}
      </div>
    )
  }

  if (entry.kind === 'matrix' || entry.kind === 'expander') {
    const rows = entry.kind === 'matrix' ? v.rows || 4 : 4
    const cols = entry.kind === 'matrix' ? v.cols || 4 : 4
    const keys = new Set(control.keys || [])
    return (
      <div className="lab__ctrl">
        <span className="lab__ctrl-name">{entry.label}</span>
        <div className="lab__matrix" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: rows * cols }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`lab__matrix-key${keys.has(i) ? ' is-on' : ''}`}
              onClick={() => {
                const next = new Set(keys)
                if (next.has(i)) next.delete(i)
                else next.add(i)
                onControl(entry.nodeId, { keys: [...next] })
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <span className="lab__ctrl-meta">Κλικ για κράτημα — δοκίμασε 3 μαζί χωρίς διόδους.</span>
      </div>
    )
  }

  if (entry.kind === 'analog') {
    return (
      <div className="lab__ctrl">
        <span className="lab__ctrl-name">{entry.label}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={control.value ?? 0.5}
          onChange={(e) => onControl(entry.nodeId, { value: Number(e.target.value) })}
        />
        {state && (
          <span className="lab__ctrl-meta">
            ωμό {Math.round(state.counts)} → άξονας {Math.round(state.axis * 1023)}
          </span>
        )}
      </div>
    )
  }

  if (entry.kind === 'hx711') {
    return (
      <div className="lab__ctrl">
        <span className="lab__ctrl-name">{entry.label} — πάτημα πεντάλ</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={control.value ?? 0}
          onChange={(e) => onControl(entry.nodeId, { value: Number(e.target.value) })}
        />
        {state && (
          <span className="lab__ctrl-meta">
            {state.forceKg.toFixed(1)} kg → άξονας {Math.round(state.axis * 1023)}
          </span>
        )}
      </div>
    )
  }

  if (entry.kind === 'ads1115') {
    return (
      <div className="lab__ctrl">
        <span className="lab__ctrl-name">{entry.label}</span>
        {entry.axes.map((axis, i) => (
          <input
            key={i}
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={control[`ch${i}`] ?? 0.5}
            onChange={(e) => onControl(entry.nodeId, { [`ch${i}`]: Number(e.target.value) })}
          />
        ))}
      </div>
    )
  }

  return null
}

export default function TestBench({
  firmware,
  engine,
  running,
  telemetry,
  telemetryMode,
  trackId,
  manual,
  controls,
  onSetMode,
  onSetTrack,
  onManual,
  onControl,
}) {
  const inputs = firmware.inputs.filter((e) => e.wired)

  return (
    <div className="lab__panel">
      <h3>Πάγκος δοκιμής</h3>

      {!running && (
        <p className="lab__note">
          Πάτα «Τροφοδοσία» στην μπάρα πάνω για να ξεκινήσει η προσομοίωση.
        </p>
      )}

      <div className="lab__summary">
        <div className={`lab__stat is-${engine.stats.brownout ? 'bad' : 'good'}`}>
          <strong>{engine.stats.currentMa}</strong>
          <span>mA τώρα</span>
        </div>
        <div
          className={`lab__stat is-${engine.stats.peakMa > firmware.board.maxCurrentMa ? 'bad' : 'good'}`}
        >
          <strong>{engine.stats.peakMa}</strong>
          <span>mA αιχμή</span>
        </div>
        <div className="lab__stat is-good">
          <strong>{engine.stats.loopHz}</strong>
          <span>Hz βρόχος</span>
        </div>
        <div className={`lab__stat is-${engine.stats.ghostPresses ? 'bad' : 'good'}`}>
          <strong>{engine.stats.ghostPresses}</strong>
          <span>ψεύτικα πατήματα</span>
        </div>
        <div className={`lab__stat is-${engine.stats.missedSteps > 2 ? 'warn' : 'good'}`}>
          <strong>{Math.round(engine.stats.missedSteps)}</strong>
          <span>χαμένα βήματα</span>
        </div>
        <div className={`lab__stat is-${engine.stats.resets ? 'bad' : 'good'}`}>
          <strong>{engine.stats.resets}</strong>
          <span>brownout resets</span>
        </div>
      </div>

      {engine.stats.brownout && (
        <p className="lab__alert">
          Πτώση τάσης: η κατανάλωση ξεπερνάει ό,τι δίνει το USB. Η πλακέτα κάνει επανεκκίνηση.
        </p>
      )}

      {/* ---------------- Τηλεμετρία ---------------- */}
      <h4>Πηγή τηλεμετρίας</h4>
      <div className="lab__seg">
        <button
          type="button"
          className={telemetryMode === 'lap' ? 'is-on' : ''}
          onClick={() => onSetMode('lap')}
        >
          Αυτόματος γύρος
        </button>
        <button
          type="button"
          className={telemetryMode === 'manual' ? 'is-on' : ''}
          onClick={() => onSetMode('manual')}
        >
          Χειροκίνητα
        </button>
      </div>

      {telemetryMode === 'lap' ? (
        <>
          <label className="lab__field" htmlFor="track">
            <span>Πίστα</span>
            <select id="track" value={trackId} onChange={(e) => onSetTrack(e.target.value)}>
              {TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <dl className="lab__specs">
            <div>
              <dt>Γύρος</dt>
              <dd>{formatLapTime(telemetry.lapTime)}</dd>
            </div>
            <div>
              <dt>Καλύτερος</dt>
              <dd>{formatLapTime(telemetry.bestLap)}</dd>
            </div>
            <div>
              <dt>Delta</dt>
              <dd className={telemetry.delta <= 0 ? 'is-good' : 'is-bad'}>
                {(telemetry.delta >= 0 ? '+' : '') + telemetry.delta.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>Σημαία</dt>
              <dd>{telemetry.flag === 'none' ? '—' : telemetry.flag}</dd>
            </div>
          </dl>
        </>
      ) : (
        <div className="lab__manual">
          <label className="lab__field" htmlFor="m-thr">
            <span>Γκάζι {Math.round(manual.throttle * 100)}%</span>
            <input
              id="m-thr"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={manual.throttle}
              onChange={(e) => onManual({ throttle: Number(e.target.value) })}
            />
          </label>
          <label className="lab__field" htmlFor="m-brk">
            <span>Φρένο {Math.round(manual.brake * 100)}%</span>
            <input
              id="m-brk"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={manual.brake}
              onChange={(e) => onManual({ brake: Number(e.target.value) })}
            />
          </label>
          <label className="lab__field" htmlFor="m-gear">
            <span>Ταχύτητα {manual.gear + 1}</span>
            <input
              id="m-gear"
              type="range"
              min={0}
              max={5}
              step={1}
              value={manual.gear}
              onChange={(e) => onManual({ gear: Number(e.target.value) })}
            />
          </label>
          <label className="lab__field lab__field--check" htmlFor="m-pit">
            <input
              id="m-pit"
              type="checkbox"
              checked={manual.pitLimiter}
              onChange={(e) => onManual({ pitLimiter: e.target.checked })}
            />
            <span>Pit limiter</span>
          </label>
          <label className="lab__field" htmlFor="m-flag">
            <span>Σημαία</span>
            <select
              id="m-flag"
              value={manual.flag}
              onChange={(e) => onManual({ flag: e.target.value })}
            >
              {FLAGS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="lab__tel-strip">
        <span>{telemetry.rpm} rpm</span>
        <span>{telemetry.speedKmh} km/h</span>
        <span>γρανάζι {telemetry.gear}</span>
        <span className={telemetry.abs ? 'is-bad' : ''}>{telemetry.abs ? 'ABS' : '—'}</span>
        <span>{telemetry.fuelPct.toFixed(0)}% καύσιμο</span>
      </div>

      {/* ---------------- Χειριστήρια εισόδων ---------------- */}
      <h4>Χειριστήρια</h4>
      {inputs.length === 0 ? (
        <p className="lab__muted">Καλωδίωσε εισόδους για να εμφανιστούν εδώ.</p>
      ) : (
        <div className="lab__ctrls">
          {inputs.map((entry) => (
            <InputControl
              key={entry.nodeId}
              entry={entry}
              control={controls[entry.nodeId] || {}}
              state={engine.nodes[entry.nodeId]}
              onControl={onControl}
            />
          ))}
        </div>
      )}

      {/* ---------------- HID ---------------- */}
      <h4>
        Χειριστήριο στα Windows{' '}
        <span className={`lab__pill is-${engine.hid.connected ? 'good' : 'bad'}`}>
          {engine.hid.connected ? 'συνδεδεμένο' : 'εκτός'}
        </span>
      </h4>
      {firmware.hid.needed ? (
        <>
          <div className="lab__hid-buttons">
            {Array.from({ length: firmware.hid.buttonCount }, (_, i) => (
              <span key={i} className={`lab__hid-btn${engine.hid.buttons[i] ? ' is-on' : ''}`}>
                {i + 1}
              </span>
            ))}
          </div>
          <div className="lab__hid-axes">
            {Object.entries(engine.hid.axes).map(([axis, data]) => (
              <div key={axis} className="lab__axis">
                <span className="lab__axis-name">{axis}</span>
                <div className="lab__axis-track">
                  <div className="lab__axis-fill" style={{ width: `${data.value * 100}%` }} />
                </div>
                <span className="lab__axis-value">
                  {Math.round(data.value * 1023)}
                  {data.extra ? ` · ${data.extra}` : ''}
                </span>
              </div>
            ))}
            {Object.keys(engine.hid.axes).length === 0 && (
              <p className="lab__muted">Κανένας αναλογικός άξονας.</p>
            )}
          </div>
        </>
      ) : (
        <p className="lab__muted">Η κατασκευή δεν έχει εισόδους HID — μόνο εξόδους τηλεμετρίας.</p>
      )}

      {/* ---------------- Σειριακή ---------------- */}
      {engine.serial.length > 0 && (
        <>
          <h4>Σειριακή έξοδος</h4>
          <pre className="lab__serial">
            {engine.serial.slice(-12).map((l) => l.line).join('\n')}
          </pre>
        </>
      )}
    </div>
  )
}
