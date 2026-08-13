import { useMemo, useState } from 'react'
import { generateSketch, librariesScript, simhubTemplate } from '../../lib/simlab/codegen.js'
import { downloadFile } from '../../lib/simlab/storage.js'
import { DEFAULT_SETTINGS } from '../../lib/simlab/circuit.js'

const TABS = [
  { id: 'ino', label: 'Σκίτσο .ino' },
  { id: 'libs', label: 'Εγκατάσταση' },
  { id: 'simhub', label: 'SimHub' },
]

function CopyButton({ text }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn btn--ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        } catch {
          setDone(false)
        }
      }}
    >
      {done ? 'Αντιγράφηκε ✓' : 'Αντιγραφή'}
    </button>
  )
}

export default function CodePanel({ build, firmware }) {
  const [tab, setTab] = useState('ino')
  const sketch = useMemo(
    () => generateSketch(build, firmware, { ...DEFAULT_SETTINGS, ...build.settings }),
    [build, firmware]
  )
  const libs = useMemo(() => librariesScript(firmware), [firmware])
  const simhub = useMemo(() => simhubTemplate(), [])

  const content = tab === 'ino' ? sketch : tab === 'libs' ? libs : simhub
  const filename =
    tab === 'ino'
      ? `${build.name.replace(/\s+/g, '_')}.ino`
      : tab === 'libs'
        ? 'install_libraries.sh'
        : 'simhub_template.txt'

  return (
    <div className="lab__panel">
      <div className="lab__panel-head">
        <h3>Κώδικας</h3>
        <div className="lab__panel-actions">
          <CopyButton text={content} />
          <button type="button" className="btn btn--ghost" onClick={() => downloadFile(filename, content)}>
            Λήψη
          </button>
        </div>
      </div>

      <div className="lab__seg">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ino' && (
        <p className="lab__note">
          Παράγεται από την καλωδίωση: ίδια pins, ίδιες βιβλιοθήκες, ίδιες ρυθμίσεις φίλτρων με την
          προσομοίωση. Άλλαξε κάτι στον πάγκο και ο κώδικας ενημερώνεται.
        </p>
      )}
      {tab === 'libs' && (
        <p className="lab__note">
          Τρέξε τις εντολές με το <code>arduino-cli</code>, ή ψάξε τα ονόματα στον Library Manager
          του IDE (καρτέλα «Βιβλιοθήκες»).
        </p>
      )}
      {tab === 'simhub' && (
        <p className="lab__note">
          SimHub ▸ Custom Serial Devices ▸ νέα συσκευή ▸ «Update messages». Επικόλλησε αυτό και βάλε
          ταχύτητα 115200. Στέλνει ακριβώς ό,τι διαβάζει η <code>parseTelemetry()</code>.
        </p>
      )}

      <pre className="lab__code">{content}</pre>
    </div>
  )
}
