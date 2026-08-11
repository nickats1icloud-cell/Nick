// Εξαγωγές: πλάνο stint σε Markdown/CSV (για Discord ή εκτύπωση στο pit),
// βαθμολογίες σε Markdown και πλήρες backup/restore του πρωταθλήματος σε JSON.

import { classInfo, trackInfo } from './constants.js'
import { computeStandings } from './standings.js'
import { formatClock, formatDate, formatDuration, formatLap, formatMinutes, round } from './utils.js'

/** Κατεβάζει κείμενο ως αρχείο — δουλεύει χωρίς backend. */
export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function slug(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9α-ω]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

/* ------------------------------------------------------------- stint plan */

export function planToMarkdown({ plan, computed, validation, team, event, championship }) {
  const track = trackInfo(event?.trackId)
  const lines = []
  lines.push(`# Πλάνο stint — ${team?.name || 'Ομάδα'}`)
  lines.push('')
  lines.push(`**Αγώνας:** ${event?.name || '—'} (Αγώνας ${event?.round})`)
  lines.push(`**Πίστα:** ${track?.name || '—'} · ${round(track?.lengthKm, 3)} km`)
  lines.push(`**Διάρκεια:** ${formatMinutes(event?.durationMinutes)}  ·  **Ημερομηνία:** ${formatDate(event?.dateISO)}`)
  lines.push(
    `**Αυτοκίνητο:** #${team?.number || '—'} ${team?.car || ''} (${classInfo(team?.carClass).label})`,
  )
  lines.push(
    `**Πρωτάθλημα:** ${championship?.name || '—'} ${championship?.season || ''}`.trim(),
  )
  lines.push('')

  lines.push('## Σύνολα')
  lines.push('')
  lines.push('| Μέγεθος | Τιμή |')
  lines.push('| --- | --- |')
  lines.push(`| Συνολικός χρόνος | ${formatDuration(computed.totals.totalSec)} |`)
  lines.push(`| Γύροι | ${computed.totals.laps} |`)
  lines.push(`| Απόσταση | ${computed.totals.distanceKm} km |`)
  lines.push(`| Στάσεις | ${computed.totals.stops} |`)
  lines.push(`| Καύσιμα | ${computed.totals.fuelL} L |`)
  lines.push(`| Σετ ελαστικών | ${computed.totals.tyreSets} |`)
  lines.push(`| Οδηγοί | ${computed.totals.driverCount} |`)
  lines.push('')

  lines.push('## Stint')
  lines.push('')
  lines.push('| # | Οδηγός | Από | Έως | Γύροι | Χρόνος γύρου | Διάρκεια | Καύσιμα | Ελαστικά |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  computed.stints.forEach((stint) => {
    lines.push(
      `| ${stint.index + 1} | ${stint.driverName || '—'} | ${formatClock(stint.startSec)} | ${formatClock(
        stint.endSec,
      )} | ${stint.laps} | ${formatLap(stint.lapTimeSec)} | ${formatDuration(
        stint.drivingSec,
      )} | +${stint.refuelL} L | ${stint.changedTyres ? `νέα (σετ ${stint.tyreSetNo})` : 'ίδια'} |`,
    )
  })
  lines.push('')

  lines.push('## Χρόνος ανά οδηγό')
  lines.push('')
  lines.push('| Οδηγός | Χρόνος | Ποσοστό | Γύροι | Stint | Μέγιστο σερί |')
  lines.push('| --- | --- | --- | --- | --- | --- |')
  computed.perDriver.forEach((row) => {
    lines.push(
      `| ${row.driver?.name || '—'} | ${formatMinutes(row.driveSec / 60)} | ${Math.round(
        row.share * 100,
      )}% | ${row.laps} | ${row.stints} | ${formatMinutes(row.longestBlockSec / 60)} |`,
    )
  })
  lines.push('')

  if (plan?.strategyNote) {
    lines.push('## Σημειώσεις στρατηγικής')
    lines.push('')
    lines.push(plan.strategyNote)
    lines.push('')
  }

  lines.push('## Έλεγχος κανονισμού')
  lines.push('')
  const icon = { error: '❌', warn: '⚠️', ok: '✅' }
  validation.checks.forEach((c) => {
    lines.push(`- ${icon[c.level]} **${c.title}** — ${c.detail}`)
  })
  lines.push('')
  lines.push(
    `_Παράχθηκε από το Race Control · ${new Date().toLocaleString('el-GR')} · ${
      validation.errors
    } σφάλματα, ${validation.warnings} προειδοποιήσεις._`,
  )
  return lines.join('\n')
}

export function planToCsv({ computed }) {
  const header = [
    'stint',
    'odigos',
    'apo_sec',
    'eos_sec',
    'gyroi',
    'xronos_gyrou_sec',
    'diarkeia_sec',
    'pit_sec',
    'kausima_L',
    'elastika',
    'set_no',
  ]
  const rows = computed.stints.map((s) => [
    s.index + 1,
    s.driverName || '',
    Math.round(s.startSec),
    Math.round(s.endSec),
    s.laps,
    round(s.lapTimeSec, 3),
    Math.round(s.drivingSec),
    Math.round(s.pitSec),
    s.refuelL,
    s.changedTyres ? 'NEW' : 'KEEP',
    s.tyreSetNo,
  ])
  return [header, ...rows].map((row) => row.join(',')).join('\n')
}

export function downloadPlan(payload, format = 'md') {
  const base = `stint-plan-${slug(payload.team?.shortName || payload.team?.name)}-${slug(
    payload.event?.name,
  )}`
  if (format === 'csv') {
    downloadText(`${base}.csv`, planToCsv(payload), 'text/csv;charset=utf-8')
    return
  }
  downloadText(`${base}.md`, planToMarkdown(payload), 'text/markdown;charset=utf-8')
}

/* ------------------------------------------------------------- standings */

export function standingsToMarkdown(state) {
  const standings = computeStandings(state)
  const lines = []
  lines.push(`# ${state.championship.name} — ${state.championship.season}`)
  lines.push('')
  lines.push(
    `Βαθμολογία μετά από ${standings.events.length} από ${state.events.length} αγώνες.`,
  )
  lines.push('')

  standings.classes.forEach(({ classId, teams, drivers }) => {
    lines.push(`## ${classInfo(classId).label}`)
    lines.push('')
    lines.push('### Ομάδες')
    lines.push('')
    lines.push(`| # | Ομάδα | ${standings.events.map((e) => `R${e.round}`).join(' | ')} | Βαθμοί |`)
    lines.push(`| --- | --- | ${standings.events.map(() => '---').join(' | ')} | --- |`)
    teams.forEach((row) => {
      const perEvent = standings.events.map((e) => row.byEvent[e.id] ?? '–')
      lines.push(`| ${row.rank} | ${row.name} | ${perEvent.join(' | ')} | **${row.points}** |`)
    })
    lines.push('')
    lines.push('### Οδηγοί')
    lines.push('')
    lines.push('| # | Οδηγός | Ομάδα | Βαθμοί | Νίκες |')
    lines.push('| --- | --- | --- | --- | --- |')
    drivers.forEach((row) => {
      lines.push(`| ${row.rank} | ${row.name} | ${row.team?.name || '—'} | **${row.points}** | ${row.wins} |`)
    })
    lines.push('')
  })
  lines.push(`_Παράχθηκε ${new Date().toLocaleString('el-GR')}._`)
  return lines.join('\n')
}

export function downloadStandings(state) {
  downloadText(
    `standings-${slug(state.championship.name)}-${state.championship.season}.md`,
    standingsToMarkdown(state),
    'text/markdown;charset=utf-8',
  )
}

/* ---------------------------------------------------------------- backup */

export function exportStateJson(state) {
  const payload = {
    app: 'nick-lmu-championship',
    exportedAt: new Date().toISOString(),
    ...state,
  }
  return JSON.stringify(payload, null, 2)
}

export function downloadBackup(state) {
  downloadText(
    `${slug(state.championship.name)}-${state.championship.season}.json`,
    exportStateJson(state),
    'application/json',
  )
}

/** Διαβάζει αρχείο backup. Πετάει Error με ελληνικό μήνυμα αν δεν είναι έγκυρο. */
export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Το αρχείο δεν είναι έγκυρο JSON.')
  }
  if (!data || typeof data !== 'object' || !data.championship) {
    throw new Error('Δεν βρήκα πρωτάθλημα μέσα στο αρχείο — είναι σίγουρα backup του Race Control;')
  }
  return data
}
