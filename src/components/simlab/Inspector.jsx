import { getPart } from '../../lib/simlab/parts.js'
import BoardArt from './BoardArt.jsx'
import { DEFAULT_SETTINGS } from '../../lib/simlab/circuit.js'

function Field({ param, value, onChange }) {
  const id = `prm-${param.key}`
  if (param.type === 'bool') {
    return (
      <label className="lab__field lab__field--check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(param.key, e.target.checked)}
        />
        <span>{param.label}</span>
      </label>
    )
  }
  if (param.type === 'select') {
    return (
      <label className="lab__field" htmlFor={id}>
        <span>{param.label}</span>
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            const raw = e.target.value
            const opt = param.options.find((o) => String(o.value) === raw)
            onChange(param.key, opt ? opt.value : raw)
          }}
        >
          {param.options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    )
  }
  return (
    <label className="lab__field" htmlFor={id}>
      <span>
        {param.label}
        {param.unit ? ` (${param.unit})` : ''}
      </span>
      <div className="lab__field-row">
        <input
          id={id}
          type="range"
          min={param.min}
          max={param.max}
          step={param.step}
          value={Number(value)}
          onChange={(e) => onChange(param.key, Number(e.target.value))}
        />
        <output>{value}</output>
      </div>
    </label>
  )
}

/** Ο ρόλος που πήρε αυτόματα το εξάρτημα στο firmware. */
function roleSummary(entry) {
  if (!entry) return null
  if (!entry.wired) return 'Δεν είναι καλωδιωμένο — δεν συμμετέχει ακόμη.'
  const bits = []
  if (entry.buttons?.length === 1) bits.push(`κουμπί HID #${entry.buttons[0] + 1}`)
  else if (entry.buttons?.length > 1)
    bits.push(`κουμπιά HID #${entry.buttons[0] + 1}–#${entry.buttons[entry.buttons.length - 1] + 1}`)
  if (entry.axis) bits.push(`άξονας ${entry.axis}`)
  for (const a of entry.axes || []) if (a) bits.push(`άξονας ${a}`)
  const pins = Object.entries(entry.pins || {})
  if (pins.length) bits.push(pins.map(([k, v]) => `${k}→${v}`).join(', '))
  return bits.join(' · ') || 'Έξοδος οδηγούμενη από την τηλεμετρία.'
}

export default function Inspector({
  build,
  node,
  board,
  boardSelected,
  firmware,
  onChangeValues,
  onChangeLabel,
  onDelete,
  onDuplicate,
  onUnwire,
  onChangeSettings,
}) {
  const settings = { ...DEFAULT_SETTINGS, ...build.settings }

  if (boardSelected && board) {
    const caps = (c) => board.pins.filter((p) => p.caps.includes(c)).length
    return (
      <div className="lab__panel">
        <h3>{board.name}</h3>
        <BoardArt boardId={board.id} className="lab__boardart--panel" />
        <p className="lab__note">{board.blurb}</p>
        <dl className="lab__specs">
          <div>
            <dt>Επεξεργαστής</dt>
            <dd>{board.mcu}</dd>
          </div>
          <div>
            <dt>Λογική</dt>
            <dd>{board.logic}V</dd>
          </div>
          <div>
            <dt>Ταχύτητα</dt>
            <dd>{board.clockMhz} MHz</dd>
          </div>
          <div>
            <dt>Flash</dt>
            <dd>{board.flashKb} KB</dd>
          </div>
          <div>
            <dt>RAM</dt>
            <dd>{board.ramKb} KB</dd>
          </div>
          <div>
            <dt>ADC</dt>
            <dd>{board.adcBits} bit</dd>
          </div>
          <div>
            <dt>USB HID</dt>
            <dd className={board.usbHid ? 'is-good' : 'is-bad'}>{board.usbHid ? 'ναι' : 'όχι'}</dd>
          </div>
          <div>
            <dt>Ρεύμα</dt>
            <dd>{board.maxCurrentMa} mA</dd>
          </div>
          <div>
            <dt>Ανά pin</dt>
            <dd>{board.pinMaxMa} mA</dd>
          </div>
          <div>
            <dt>Τιμή</dt>
            <dd>{board.price.toFixed(2)} €</dd>
          </div>
        </dl>
        <h4>Διαθέσιμα pins</h4>
        <ul className="lab__mini-list">
          {[
            ['Ψηφιακά', 'digital'],
            ['Αναλογικά (ADC)', 'analog'],
            ['PWM', 'pwm'],
            ['Interrupt', 'interrupt'],
            ['GND', 'gnd'],
          ].map(([label, cap]) => (
            <li key={cap}>
              <span>{label}</span>
              <strong>{caps(cap)}</strong>
            </li>
          ))}
        </ul>
        <h4>Στο Arduino IDE</h4>
        <p className="lab__muted">
          Tools ▸ Board ▸ <strong>{board.ideBoard}</strong>
        </p>
        <code className="lab__inline-code">arduino-cli compile --fqbn {board.fqbn}</code>
      </div>
    )
  }

  if (!node) {
    return (
      <div className="lab__panel">
        <h3>Ρυθμίσεις firmware</h3>
        <p className="lab__muted">
          Ισχύουν για όλη την κατασκευή. Επίλεξε ένα εξάρτημα στον πάγκο για τις δικές του ρυθμίσεις.
        </p>
        <label className="lab__field" htmlFor="set-debounce">
          <span>Debounce firmware (ms)</span>
          <div className="lab__field-row">
            <input
              id="set-debounce"
              type="range"
              min={0}
              max={30}
              step={1}
              value={settings.debounceMs}
              onChange={(e) => onChangeSettings({ debounceMs: Number(e.target.value) })}
            />
            <output>{settings.debounceMs}</output>
          </div>
        </label>
        <p className="lab__note">
          Στο 0 θα δεις ψεύτικα πατήματα από την αναπήδηση των επαφών. Πάνω από ~25ms αρχίζει να
          «χάνεται» το γρήγορο πάτημα.
        </p>
        <label className="lab__field" htmlFor="set-alpha">
          <span>Φίλτρο αναλογικών (EMA α)</span>
          <div className="lab__field-row">
            <input
              id="set-alpha"
              type="range"
              min={0.02}
              max={1}
              step={0.02}
              value={settings.filterAlpha}
              onChange={(e) => onChangeSettings({ filterAlpha: Number(e.target.value) })}
            />
            <output>{settings.filterAlpha.toFixed(2)}</output>
          </div>
        </label>
        <p className="lab__note">
          Χαμηλό α = σταθερή τιμή αλλά αργή αντίδραση. Στο 1 βλέπεις όλο τον θόρυβο του ADC.
        </p>
        <label className="lab__field" htmlFor="set-dz">
          <span>Νεκρή ζώνη άκρων (%)</span>
          <div className="lab__field-row">
            <input
              id="set-dz"
              type="range"
              min={0}
              max={20}
              step={1}
              value={settings.deadzonePct}
              onChange={(e) => onChangeSettings({ deadzonePct: Number(e.target.value) })}
            />
            <output>{settings.deadzonePct}</output>
          </div>
        </label>
        <p className="lab__note">
          Εξασφαλίζει ότι το πεντάλ φτάνει σίγουρα 0% και 100% παρά τον θόρυβο.
        </p>
      </div>
    )
  }

  const part = getPart(node.partId)
  const wireCount = build.wires.filter(
    (w) => w.from.node === node.id || w.to.node === node.id
  ).length
  const entry = [...firmware.inputs, ...firmware.outputs, ...firmware.passives].find(
    (e) => e.nodeId === node.id
  )

  return (
    <div className="lab__panel">
      <div className="lab__panel-head">
        <h3>{part.name}</h3>
        <div className="lab__panel-actions">
          <button type="button" className="btn btn--ghost" onClick={() => onDuplicate(node.id)}>
            Αντιγραφή
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => onUnwire(node.id)}
            disabled={wireCount === 0}
          >
            Αποσύνδεση ({wireCount})
          </button>
          <button type="button" className="btn btn--danger" onClick={() => onDelete(node.id)}>
            Διαγραφή
          </button>
        </div>
      </div>

      <label className="lab__field" htmlFor="node-label">
        <span>Όνομα στον πάγκο</span>
        <input
          id="node-label"
          type="text"
          value={node.label || part.name}
          onChange={(e) => onChangeLabel(node.id, e.target.value)}
        />
      </label>

      <p className="lab__role">{roleSummary(entry)}</p>
      <p className="lab__note">{part.tip}</p>

      {(part.params || []).map((param) => (
        <Field
          key={param.key}
          param={param}
          value={node.values[param.key]}
          onChange={(key, value) => onChangeValues(node.id, { [key]: value })}
        />
      ))}

      <dl className="lab__specs">
        <div>
          <dt>Τιμή</dt>
          <dd>{part.price.toFixed(2)} €</dd>
        </div>
        <div>
          <dt>Κατανάλωση</dt>
          <dd>{part.currentMa ? `${part.currentMa} mA` : part.externalCurrentMa ? `${part.externalCurrentMa} mA @12V` : '—'}</dd>
        </div>
        <div>
          <dt>Κόστος βρόχου</dt>
          <dd>{part.loopUs ? `${Math.round(part.loopUs(node.values, firmware.board))} µs` : '—'}</dd>
        </div>
      </dl>
    </div>
  )
}
