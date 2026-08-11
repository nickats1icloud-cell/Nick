import { categoryInfo } from '../../lib/lmu/constants.js'
import { formatMinutes } from '../../lib/lmu/utils.js'
import Badge from './Badge.jsx'

/**
 * Πόσο οδηγεί ο καθένας. Η κάθετη γραμμή είναι το πλαφόν του κανονισμού — αν
 * μια μπάρα το περάσει, βάφεται κόκκινη.
 */
export default function DriverLoad({ computed, rules }) {
  if (!computed?.perDriver.length) return null
  const targetSec = computed.targetSec || computed.totals.totalSec || 1
  const capShare = Math.min(1, rules.maxDriveShare || 1)
  const minShare = ((rules.minDriveMinutes || 0) * 60) / targetSec

  return (
    <div className="champ__load">
      {computed.perDriver.map((row) => {
        const over = row.share > capShare + 0.001
        const under = minShare > 0 && row.share < minShare - 0.001
        return (
          <div key={row.driverId || 'none'} className="champ__load-row">
            <span className="champ__load-name">
              {row.driver?.name || 'Χωρίς οδηγό'}
              {row.driver ? (
                <Badge tone="muted">{categoryInfo(row.driver.category).short}</Badge>
              ) : null}
            </span>
            <span className="champ__load-bar">
              <span
                className={`champ__load-fill${over ? ' is-over' : ''}${under ? ' is-under' : ''}`}
                style={{ width: `${Math.min(100, row.share * 100)}%` }}
              />
              <span className="champ__load-cap" style={{ left: `${capShare * 100}%` }} />
            </span>
            <span className="champ__load-value">
              {formatMinutes(row.driveSec / 60)}
              <span className="champ__muted"> · {Math.round(row.share * 100)}%</span>
            </span>
            <span className="champ__load-meta">
              {row.stints} stint · μέγ. σερί {formatMinutes(row.longestBlockSec / 60)}
              {row.minRestSec !== null ? ` · ξεκούραση ${formatMinutes(row.minRestSec / 60)}` : ''}
            </span>
          </div>
        )
      })}
      <p className="champ__muted champ__load-note">
        Πλαφόν κανονισμού: {Math.round(capShare * 100)}% του αγώνα ανά οδηγό
        {rules.minDriveMinutes ? ` · ελάχιστο ${formatMinutes(rules.minDriveMinutes)}` : ''} · μέγιστο
        συνεχόμενο {formatMinutes(rules.maxStintMinutes)}.
      </p>
    </div>
  )
}
