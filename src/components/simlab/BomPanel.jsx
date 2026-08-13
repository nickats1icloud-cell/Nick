import { useMemo } from 'react'
import { bomToCsv, computeBom } from '../../lib/simlab/bom.js'
import { downloadFile } from '../../lib/simlab/storage.js'
import { sketchName } from '../../lib/simlab/codegen.js'

export default function BomPanel({ build, firmware }) {
  const bom = useMemo(() => computeBom(build, firmware), [build, firmware])
  const groups = [...new Set(bom.rows.map((r) => r.group))]

  return (
    <div className="lab__panel">
      <div className="lab__panel-head">
        <h3>Λίστα υλικών</h3>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => downloadFile(`${sketchName(build.name)}_bom.csv`, bomToCsv(bom), 'text/csv;charset=utf-8')}
        >
          Λήψη CSV
        </button>
      </div>

      <div className="lab__summary">
        <div className="lab__stat is-good">
          <strong>{bom.total.toFixed(2)}€</strong>
          <span>σύνολο</span>
        </div>
        <div className="lab__stat is-good">
          <strong>{bom.controls}</strong>
          <span>εντολές</span>
        </div>
        <div className="lab__stat is-good">
          <strong>{bom.perControl.toFixed(2)}€</strong>
          <span>ανά εντολή</span>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group} className="lab__bom-group">
          <h4>{group}</h4>
          <table className="lab__table">
            <thead>
              <tr>
                <th>Εξάρτημα</th>
                <th>Ποσ.</th>
                <th>Μονάδα</th>
                <th>Σύνολο</th>
              </tr>
            </thead>
            <tbody>
              {bom.rows
                .filter((r) => r.group === group)
                .map((r, i) => (
                  <tr key={`${r.id}-${i}`}>
                    <td>
                      {r.name}
                      {r.note && <small>{r.note}</small>}
                    </td>
                    <td>{r.qty}</td>
                    <td>{r.unit.toFixed(2)}€</td>
                    <td>{r.total.toFixed(2)}€</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}

      <p className="lab__note">
        Τιμές ενδεικτικές λιανικής. Παραγγέλνοντας τα μικρά (κουμπιά, encoders, διόδους) μαζικά,
        πέφτουν συνήθως στο μισό.
      </p>
    </div>
  )
}
