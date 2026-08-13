/** Οι έξοδοι της κατασκευής, όπως θα τις έβλεπες στον πάγκο. */

function Dial({ angle, sweep, label, lagging }) {
  const start = -sweep / 2 - 90
  const rad = ((start + angle) * Math.PI) / 180
  const cx = 46
  const cy = 46
  const r = 34
  return (
    <svg viewBox="0 0 92 92" className="lab__dial" role="img" aria-label={label}>
      <circle cx={cx} cy={cy} r={r} className="lab__dial-face" />
      {Array.from({ length: 11 }, (_, i) => {
        const a = ((start + (sweep * i) / 10) * Math.PI) / 180
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * (r - 6)}
            y1={cy + Math.sin(a) * (r - 6)}
            x2={cx + Math.cos(a) * r}
            y2={cy + Math.sin(a) * r}
            className="lab__dial-tick"
          />
        )
      })}
      <line
        x1={cx}
        y1={cy}
        x2={cx + Math.cos(rad) * (r - 8)}
        y2={cy + Math.sin(rad) * (r - 8)}
        className={`lab__dial-needle${lagging ? ' is-lagging' : ''}`}
      />
      <circle cx={cx} cy={cy} r={3} className="lab__dial-hub" />
    </svg>
  )
}

function Screen({ lines }) {
  const big = lines.find((l) => l.big)
  const rows = lines.filter((l) => l.label)
  return (
    <div className="lab__screen">
      {big && <span className={`lab__screen-big is-${big.tone}`}>{big.big}</span>}
      <div className="lab__screen-rows">
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

export default function OutputsView({ firmware, engine, running }) {
  const outputs = firmware.outputs.filter((o) => o.wired)
  if (outputs.length === 0) {
    return (
      <div className="lab__outputs lab__outputs--empty">
        <p className="lab__muted">
          Δεν υπάρχουν έξοδοι. Πρόσθεσε ταινία LED, οθόνη ή ανεμιστήρα για να δεις την τηλεμετρία να
          παίρνει μορφή.
        </p>
      </div>
    )
  }

  return (
    <div className="lab__outputs">
      {outputs.map((entry) => {
        const st = engine.nodes[entry.nodeId]
        if (!st) return null
        return (
          <div key={entry.nodeId} className="lab__output">
            <span className="lab__output-name">{entry.label}</span>

            {st.kind === 'ledstrip' && (
              <div className="lab__strip lab__strip--big">
                {st.pixels.map((px, i) => (
                  <span
                    key={i}
                    className="lab__strip-led"
                    style={{
                      background: `rgb(${px[0]},${px[1]},${px[2]})`,
                      boxShadow:
                        px[0] + px[1] + px[2] > 40
                          ? `0 0 8px rgb(${px[0]},${px[1]},${px[2]})`
                          : 'none',
                    }}
                  />
                ))}
              </div>
            )}

            {st.kind === 'display' && <Screen lines={st.lines} />}

            {st.kind === 'sevenseg' && <span className="lab__seg7">{st.text}</span>}

            {st.kind === 'gauge' && (
              <Dial
                angle={st.angle}
                sweep={entry.values.sweepDeg || 270}
                label={entry.label}
                lagging={st.lagging}
              />
            )}

            {st.kind === 'servo' && (
              <div className="lab__servo">
                <span
                  className="lab__servo-arm"
                  style={{ transform: `rotate(${st.angle - 90}deg)` }}
                />
                <small>{Math.round(st.angle)}°</small>
              </div>
            )}

            {st.kind === 'fan' && (
              <div className="lab__fan">
                <span
                  className="lab__fan-blade"
                  style={{
                    animationDuration: st.duty > 0.02 ? `${Math.max(0.12, 1.2 - st.duty)}s` : '0s',
                    opacity: st.duty > 0.02 ? 1 : 0.35,
                  }}
                >
                  ✳
                </span>
                <small>{Math.round(st.duty * 100)}%</small>
              </div>
            )}

            {st.kind === 'haptic' && (
              <div className="lab__haptic">
                <span
                  className={`lab__haptic-box${st.duty > 0 ? ' is-buzzing' : ''}`}
                  style={{ opacity: 0.35 + st.duty * 0.65 }}
                />
                <small>{st.duty > 0 ? `${Math.round(st.duty * 100)}%` : 'ήρεμο'}</small>
              </div>
            )}

            {st.kind === 'buzzer' && (
              <span className={`lab__buzzer${st.on ? ' is-on' : ''}`}>{st.on ? '♪♪♪' : '—'}</span>
            )}

            {st.kind === 'led' && (
              <span
                className={`lab__bulb${st.on ? ' is-on' : ''} lab__bulb--${entry.values.color}`}
              />
            )}
          </div>
        )
      })}
      {!running && <p className="lab__muted">Άναψε την τροφοδοσία για ζωντανή εικόνα.</p>}
    </div>
  )
}
