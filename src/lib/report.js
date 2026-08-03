// Εξαγωγή της ανάλυσης σε Markdown, για να το έχεις δίπλα σου όταν γράφεις το
// script του επόμενου επεισοδίου.

function tipsToMarkdown(tips) {
  if (!tips?.length) return '_Καμία σημείωση._\n'
  return tips
    .map(
      (tip) =>
        `- **${tip.title}**\n  - ${tip.detail}\n${tip.drill ? `  - _Άσκηση:_ ${tip.drill}\n` : ''}`,
    )
    .join('')
}

export function buildReport({ feed, feedAnalysis, episode, speech }) {
  const lines = []
  lines.push(`# Ανάλυση podcast${feed?.title ? ` — ${feed.title}` : ''}`)
  lines.push('')
  lines.push(`_Δημιουργήθηκε: ${new Date().toLocaleString('el-GR')}_`)
  lines.push('')

  if (feedAnalysis) {
    lines.push('## Feed')
    lines.push('')
    lines.push(`- Συνολικός βαθμός feed: **${feedAnalysis.scores.overall ?? '—'}/100**`)
    lines.push(`- Επεισόδια: ${feedAnalysis.total}`)
    lines.push(`- Διάμεσο κενό δημοσίευσης: ${feedAnalysis.medianGapDays ?? '—'} μέρες`)
    lines.push(`- Διάμεση διάρκεια: ${feedAnalysis.medianDurationMin ?? '—'}′`)
    lines.push(`- Λέξεις ανά shownotes: ${feedAnalysis.shownotes.avgWords}`)
    lines.push('')
    lines.push('### Τι να διορθώσεις στο feed')
    lines.push('')
    lines.push(tipsToMarkdown(feedAnalysis.tips))
  }

  if (speech) {
    lines.push(`## Επεισόδιο${episode?.title ? `: ${episode.title}` : ''}`)
    lines.push('')
    lines.push(`- Βαθμός παρουσίασης: **${speech.scores.overall ?? '—'}/100**`)
    lines.push(`- Ρυθμός: ${speech.wpm ?? '—'} λέξεις/λεπτό`)
    lines.push(
      `- Παρασιτικά: ${speech.fillers.total} (${speech.fillers.perMin ?? '—'} ανά λεπτό, ${speech.fillers.ratePct}% των λέξεων)`,
    )
    lines.push(`- Μέσο μήκος πρότασης: ${speech.sentences.avgWords} λέξεις`)
    lines.push(`- Ερωτήσεις: ${speech.questions.total} (${speech.questions.openPct}% ανοιχτές)`)
    if (speech.multiSpeaker) {
      lines.push(
        `- Κατανομή ομιλίας: ${speech.speakers.map((s) => `${s.name} ${s.sharePct}%`).join(', ')}`,
      )
    }
    if (speech.fillers.items.length) {
      lines.push(
        `- Κορυφαία γεμίσματα: ${speech.fillers.items
          .slice(0, 5)
          .map((i) => `«${i.phrase}» ×${i.count}`)
          .join(', ')}`,
      )
    }
    lines.push('')
    lines.push('### Τι να δουλέψεις')
    lines.push('')
    lines.push(tipsToMarkdown(speech.tips))
  }

  return lines.join('\n')
}

export function downloadReport(markdown, filename = 'analysi-podcast.md') {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
