const SEVERITY_LABEL = { error: 'Σφάλμα', warn: 'Προσοχή', info: 'Σημείωση' }

function Bar({ label, value, max, unit, tone }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="lab__meter">
      <div className="lab__meter-top">
        <span>{label}</span>
        <strong>
          {Math.round(value)}
          {unit} / {Math.round(max)}
          {unit}
        </strong>
      </div>
      <div className="lab__meter-track">
        <div className={`lab__meter-fill is-${tone || (pct > 90 ? 'bad' : pct > 75 ? 'warn' : 'good')}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function AnalysisPanel({ firmware, drc, onFocus }) {
  const { timing, memory, board } = firmware
  const latencyTone = timing.loopHz >= 250 ? 'good' : timing.loopHz >= 100 ? 'warn' : 'bad'

  return (
    <div className="lab__panel">
      <h3>Έλεγχος σχεδίασης</h3>

      <div className="lab__summary">
        <div className={`lab__stat is-${drc.errors ? 'bad' : 'good'}`}>
          <strong>{drc.errors}</strong>
          <span>σφάλματα</span>
        </div>
        <div className={`lab__stat is-${drc.warnings ? 'warn' : 'good'}`}>
          <strong>{drc.warnings}</strong>
          <span>προειδοποιήσεις</span>
        </div>
        <div className={`lab__stat is-${latencyTone}`}>
          <strong>{timing.loopHz}</strong>
          <span>Hz βρόχος</span>
        </div>
        <div className={`lab__stat is-${latencyTone}`}>
          <strong>{timing.latencyMs}</strong>
          <span>ms καθυστέρηση</span>
        </div>
      </div>

      {drc.findings.length === 0 ? (
        <p className="lab__ok">Κανένα εύρημα. Η κατασκευή είναι έτοιμη για δοκιμή.</p>
      ) : (
        <ul className="lab__findings">
          {drc.findings.map((f) => (
            <li key={f.id} className={`lab__finding is-${f.severity}`}>
              <button
                type="button"
                className="lab__finding-btn"
                onClick={() => f.nodeId && onFocus(f.nodeId)}
                disabled={!f.nodeId}
              >
                <span className="lab__finding-tag">{SEVERITY_LABEL[f.severity]}</span>
                <strong>{f.title}</strong>
                <p>{f.detail}</p>
                <p className="lab__fix">→ {f.fix}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h4>Προϋπολογισμός βρόχου</h4>
      <p className="lab__muted">
        Ο βρόχος τρέχει {timing.loopHz}Hz ({timing.loopUs}µs ανά επανάληψη). Κάθε εξάρτημα κοστίζει:
      </p>
      <ul className="lab__breakdown">
        {timing.breakdown.slice(0, 8).map((b, i) => (
          <li key={`${b.label}-${i}`}>
            <button type="button" onClick={() => b.nodeId && onFocus(b.nodeId)} disabled={!b.nodeId}>
              <span>{b.label}</span>
              <span className="lab__breakdown-bar">
                <span style={{ width: `${Math.min(100, (b.us / timing.loopUs) * 100)}%` }} />
              </span>
              <strong>{Math.round(b.us)}µs</strong>
            </button>
          </li>
        ))}
        {timing.breakdown.length === 0 && <li className="lab__muted">Άδειος πάγκος.</li>}
      </ul>

      <h4>Ρεύμα</h4>
      <Bar label="Από την πλακέτα" value={drc.power.boardRailMa} max={board.maxCurrentMa} unit="mA" />
      {drc.power.externalMa > 0 && (
        <Bar
          label="Από εξωτερική πηγή"
          value={drc.power.externalMa}
          max={Math.max(drc.power.externalMa, drc.power.supplyAmps * 1000 || drc.power.externalMa)}
          unit="mA"
          tone={drc.power.supplyAmps * 1000 >= drc.power.externalMa ? 'good' : 'bad'}
        />
      )}
      <ul className="lab__mini-list">
        {drc.power.items.slice(0, 6).map((item, i) => (
          <li key={`${item.label}-${i}`}>
            <span>{item.label}</span>
            <span className="lab__muted">{item.rail}</span>
            <strong>{Math.round(item.ma)} mA</strong>
          </li>
        ))}
      </ul>

      <h4>Μνήμη</h4>
      <Bar label="Flash" value={memory.flashKb} max={board.flashKb} unit="KB" />
      <Bar label="RAM" value={memory.ramB} max={board.ramKb * 1024} unit="B" />
    </div>
  )
}
