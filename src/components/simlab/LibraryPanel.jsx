import { allLibraries } from '../../lib/simlab/libraries.js'

const SOURCE_LABEL = {
  manager: 'Library Manager',
  zip: 'ZIP από GitHub',
  builtin: 'Ενσωματωμένη',
  core: 'Board core',
}

/**
 * Οι πραγματικές βιβλιοθήκες Arduino που τραβάει η κατασκευή.
 * Πάνω: αυτές που χρειάζεσαι τώρα. Κάτω: όλο το μητρώο για αναφορά.
 */
export default function LibraryPanel({ firmware }) {
  const used = firmware.memory.libs
  const usedIds = new Set(used.map((l) => l.id))
  const rest = allLibraries().filter((l) => !usedIds.has(l.id))

  return (
    <div className="lab__panel">
      <h3>Βιβλιοθήκες Arduino</h3>

      <div className="lab__summary">
        <div className="lab__stat is-good">
          <strong>{used.length}</strong>
          <span>σε χρήση</span>
        </div>
        <div className="lab__stat is-good">
          <strong>{firmware.memory.flashKb}</strong>
          <span>KB flash</span>
        </div>
        <div className="lab__stat is-good">
          <strong>{firmware.memory.ramB}</strong>
          <span>B RAM</span>
        </div>
      </div>

      {used.length === 0 ? (
        <p className="lab__muted">
          Καμία ακόμη — καλωδίωσε ένα εξάρτημα και θα εμφανιστεί η βιβλιοθήκη που του αντιστοιχεί.
        </p>
      ) : (
        <ul className="lab__libs">
          {used.map((lib) => (
            <li key={lib.id} className="lab__lib">
              <div className="lab__lib-head">
                <strong>{lib.name}</strong>
                <span className={`lab__pill is-${lib.source === 'manager' ? 'good' : 'info'}`}>
                  {SOURCE_LABEL[lib.source]}
                </span>
              </div>
              <p className="lab__muted">
                {lib.author} · v{lib.version} · ~{lib.flashKb}KB flash, {lib.ramB}B RAM
                {lib.ramPerUnit ? ` (+${lib.ramPerUnit}B ανά LED)` : ''}
              </p>
              <p className="lab__note">{lib.note}</p>
              {lib.includes.length > 0 && (
                <code className="lab__inline-code">
                  {lib.includes.map((i) => `#include <${i}>`).join('  ')}
                </code>
              )}
              {lib.source !== 'builtin' && lib.source !== 'core' && (
                <code className="lab__inline-code">{lib.cli}</code>
              )}
              <a href={lib.url} target="_blank" rel="noreferrer">
                Πηγαίος κώδικας & τεκμηρίωση →
              </a>
            </li>
          ))}
        </ul>
      )}

      {firmware.memory.incompatible.length > 0 && (
        <>
          <h4>Ασύμβατες με αυτή την πλακέτα</h4>
          <ul className="lab__libs">
            {firmware.memory.incompatible.map((lib) => (
              <li key={lib.id} className="lab__lib is-bad">
                <strong>{lib.name}</strong>
                <p className="lab__muted">Υποστηρίζει μόνο: {lib.arch.join(', ')}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4>Όλο το μητρώο</h4>
      <ul className="lab__mini-list">
        {rest.map((lib) => (
          <li key={lib.id}>
            <a href={lib.url} target="_blank" rel="noreferrer">
              {lib.name}
            </a>
            <span className="lab__muted">{lib.author}</span>
            <span className="lab__muted">{SOURCE_LABEL[lib.source]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
