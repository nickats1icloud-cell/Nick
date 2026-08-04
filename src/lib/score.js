/** Χρωματικός τόνος για βαθμολογία 0-100 (κοινός για δείκτες, κάρτες, πίνακες). */
export function scoreTone(value) {
  if (!Number.isFinite(value)) return 'unknown'
  if (value >= 80) return 'good'
  if (value >= 60) return 'ok'
  if (value >= 40) return 'warn'
  return 'bad'
}
