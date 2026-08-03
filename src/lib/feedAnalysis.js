// Ανάλυση του feed: συνέπεια δημοσιεύσεων, διάρκειες, τίτλοι, shownotes και
// μεταδεδομένα. Είναι ό,τι βλέπει ο ακροατής πριν πατήσει play — και ό,τι
// βλέπουν τα apps για να σε προτείνουν.

import { normalizeWord, STOPWORDS, tokenize, tokenizeNormalized } from './greekText.js'

const DAY = 24 * 60 * 60 * 1000

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function mean(values) {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stdev(values) {
  const m = mean(values)
  if (m == null || values.length < 2) return null
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)))
}

function pct(part, whole) {
  return whole ? Math.round((part / whole) * 100) : 0
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function scoreRange(value, goodLo, goodHi, hardLo, hardHi) {
  if (!Number.isFinite(value)) return null
  if (value >= goodLo && value <= goodHi) return 100
  if (value < goodLo) return value <= hardLo ? 0 : Math.round(((value - hardLo) / (goodLo - hardLo)) * 100)
  return value >= hardHi ? 0 : Math.round(((hardHi - value) / (hardHi - goodHi)) * 100)
}

const WEEKDAYS = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο']
const TIMESTAMP_RE = /(?:^|\s)\(?\d{1,2}:\d{2}(?::\d{2})?\)?/

/** Έλεγχοι για ένα μεμονωμένο επεισόδιο — τα ίδια που τρέχουμε και συνολικά. */
export function analyzeEpisodeMeta(episode) {
  const title = episode.title || ''
  const description = episode.description || ''
  const descWords = tokenize(description).length
  const issues = []

  if (title.length > 65) {
    issues.push({
      severity: 'medium',
      text: `Ο τίτλος έχει ${title.length} χαρακτήρες — στα podcast apps κόβεται γύρω στους 40-60. Βάλε το ουσιαστικό μπροστά.`,
    })
  }
  if (title.length < 18) {
    issues.push({
      severity: 'medium',
      text: 'Πολύ κοντός τίτλος: δεν λέει τι θα ακούσει κάποιος που δεν σε ξέρει.',
    })
  }
  if (/^(επεισοδιο|episode|ep)\s*\d+/i.test(normalizeWord(title))) {
    issues.push({
      severity: 'low',
      text: 'Ο τίτλος ξεκινά με τον αριθμό επεισοδίου. Βάλε πρώτα το θέμα και τον αριθμό στο τέλος ή στο πεδίο itunes:episode.',
    })
  }
  if (descWords < 25) {
    issues.push({
      severity: 'high',
      text: `Τα shownotes έχουν μόλις ${descWords} λέξεις. Γράψε 60-150 λέξεις με το τι συζητάτε — είναι το κείμενο που βρίσκει η αναζήτηση.`,
    })
  }
  if (!TIMESTAMP_RE.test(description)) {
    issues.push({
      severity: 'medium',
      text: 'Δεν υπάρχουν κεφάλαια/χρονοσημάνσεις στα shownotes. Σε ωριαίο επεισόδιο βοηθούν πολύ τον ακροατή να επιστρέψει.',
    })
  }
  if (!/https?:\/\//i.test(episode.descriptionHtml || description)) {
    issues.push({
      severity: 'low',
      text: 'Δεν υπάρχει κανένας σύνδεσμος (Discord, YouTube, καλεσμένος, πηγές).',
    })
  }
  if (!episode.episodeNumber) {
    issues.push({
      severity: 'low',
      text: 'Λείπει το itunes:episode — χωρίς αυτό η σειρά στα apps βασίζεται μόνο στην ημερομηνία.',
    })
  }
  return { issues, titleLength: title.length, descWords }
}

export function analyzeFeed(feed) {
  const episodes = feed.episodes.filter(Boolean)
  const total = episodes.length
  if (!total) return null

  const dated = episodes.filter((e) => e.published).sort((a, b) => a.published - b.published)
  const gaps = []
  for (let i = 1; i < dated.length; i += 1) {
    gaps.push((dated[i].published - dated[i - 1].published) / DAY)
  }
  const medianGap = median(gaps)
  const gapStdev = stdev(gaps)
  const longestGap = gaps.length ? Math.max(...gaps) : null
  const daysSinceLast = dated.length
    ? (Date.now() - dated[dated.length - 1].published.getTime()) / DAY
    : null
  // Συντελεστής μεταβλητότητας: πόσο ασταθές είναι το πρόγραμμα δημοσίευσης.
  const cadenceCv = medianGap && gapStdev != null ? gapStdev / medianGap : null

  const weekdayCounts = new Array(7).fill(0)
  for (const e of dated) weekdayCounts[e.published.getDay()] += 1
  const topWeekdayIndex = weekdayCounts.indexOf(Math.max(...weekdayCounts))
  const weekdayShare = pct(weekdayCounts[topWeekdayIndex], dated.length)

  const durations = episodes.map((e) => e.durationSec).filter((d) => Number.isFinite(d) && d > 0)
  const medianDuration = median(durations)
  const durationCv =
    medianDuration && durations.length > 1 ? stdev(durations) / medianDuration : null

  const titles = episodes.map((e) => e.title || '')
  const titleLengths = titles.map((t) => t.length)
  const longTitles = titleLengths.filter((n) => n > 65).length
  const numbered = titles.filter((t) => /^(επεισ|episode|ep\b|#)/i.test(normalizeWord(t))).length
  const withGuest = titles.filter((t) => /(με τον|με την|φιλοξεν|καλεσμ|feat\.?|w\/)/i.test(t)).length
  const shouty = titles.filter((t) => {
    const letters = t.replace(/[^\p{L}]/gu, '')
    return letters.length > 6 && letters === letters.toUpperCase()
  }).length
  // Πόσοι τίτλοι ξεκινούν με το ίδιο μοτίβο — δείχνει «καλούπι» χωρίς πληροφορία.
  const firstWords = titles.map((t) => tokenizeNormalized(t).slice(0, 2).join(' ')).filter(Boolean)
  const firstWordCounts = new Map()
  for (const fw of firstWords) firstWordCounts.set(fw, (firstWordCounts.get(fw) || 0) + 1)
  const repeatedOpening = Math.max(0, ...firstWordCounts.values())

  const descWords = episodes.map((e) => tokenize(e.description || '').length)
  const thinNotes = descWords.filter((n) => n < 25).length
  const withChapters = episodes.filter((e) => TIMESTAMP_RE.test(e.description || '')).length
  const withLinks = episodes.filter((e) =>
    /https?:\/\//i.test(e.descriptionHtml || e.description || ''),
  ).length
  const withEpisodeNumber = episodes.filter((e) => e.episodeNumber).length

  // Λέξεις-κλειδιά από τίτλους + shownotes: τι «λέει» το feed σου στην αναζήτηση.
  const keywordCounts = new Map()
  for (const e of episodes) {
    const tokens = tokenizeNormalized(`${e.title} ${e.description}`)
    for (const token of new Set(tokens)) {
      if (token.length < 4 || STOPWORDS.has(token) || /^\d+$/.test(token)) continue
      keywordCounts.set(token, (keywordCounts.get(token) || 0) + 1)
    }
  }
  const keywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }))

  const scores = {}
  scores.cadence = cadenceCv != null ? scoreRange(cadenceCv, 0, 0.35, -1, 1.3) : null
  scores.freshness = daysSinceLast != null ? scoreRange(daysSinceLast, 0, 21, -1, 90) : null
  scores.duration = durationCv != null ? scoreRange(durationCv, 0, 0.3, -1, 1.1) : null
  scores.titles = Math.max(
    0,
    100 - pct(longTitles, total) - pct(shouty, total) * 2 - Math.max(0, pct(repeatedOpening, total) - 30),
  )
  scores.shownotes = Math.round(
    (100 - pct(thinNotes, total)) * 0.5 + pct(withChapters, total) * 0.3 + pct(withLinks, total) * 0.2,
  )
  scores.metadata = Math.round(
    pct(withEpisodeNumber, total) * 0.4 +
      (feed.image ? 20 : 0) +
      (feed.description?.length > 120 ? 20 : 0) +
      (/^el/i.test(feed.language || '') ? 10 : 0) +
      (feed.category ? 10 : 0),
  )

  const values = Object.values(scores).filter((v) => Number.isFinite(v))
  const overall = values.length ? Math.round(mean(values)) : null

  const analysis = {
    total,
    firstDate: dated[0]?.published || null,
    lastDate: dated[dated.length - 1]?.published || null,
    medianGapDays: round(medianGap),
    cadenceCv: round(cadenceCv, 2),
    longestGapDays: round(longestGap),
    daysSinceLast: round(daysSinceLast),
    topWeekday: WEEKDAYS[topWeekdayIndex],
    weekdayShare,
    medianDurationMin: medianDuration ? Math.round(medianDuration / 60) : null,
    durationCv: round(durationCv, 2),
    durationsKnown: durations.length,
    titles: {
      avgLength: Math.round(mean(titleLengths) || 0),
      longPct: pct(longTitles, total),
      numberedPct: pct(numbered, total),
      guestPct: pct(withGuest, total),
      shouty,
      repeatedOpeningPct: pct(repeatedOpening, total),
    },
    shownotes: {
      avgWords: Math.round(mean(descWords) || 0),
      thinPct: pct(thinNotes, total),
      chaptersPct: pct(withChapters, total),
      linksPct: pct(withLinks, total),
    },
    metadata: {
      episodeNumberPct: pct(withEpisodeNumber, total),
      hasImage: Boolean(feed.image),
      language: feed.language || '',
      category: feed.category || '',
    },
    keywords,
    scores: { ...scores, overall },
  }

  analysis.tips = buildFeedTips(analysis, feed)
  return analysis
}

function tip(severity, title, detail, action) {
  return { severity, title, detail, drill: action }
}

function buildFeedTips(a, feed) {
  const tips = []

  if (a.daysSinceLast != null && a.daysSinceLast > 45) {
    tips.push(
      tip(
        'high',
        `${Math.round(a.daysSinceLast)} μέρες από το τελευταίο επεισόδιο`,
        'Τα podcast apps και ο αλγόριθμος του Spotify δίνουν προτεραιότητα σε ενεργά feeds· οι ακροατές ξεχνούν ακόμα πιο γρήγορα.',
        'Βγάλε ένα σύντομο επεισόδιο 15 λεπτών αυτή την εβδομάδα (π.χ. «τι άλλαξε στο iRacing season update») για να ξαναμπείς σε ρυθμό.',
      ),
    )
  }
  if (a.cadenceCv != null && a.cadenceCv > 0.6) {
    tips.push(
      tip(
        'high',
        `Ασταθές πρόγραμμα δημοσίευσης (διάμεσος ${a.medianGapDays} μέρες, μέγιστο κενό ${a.longestGapDays})`,
        'Ο ακροατής δεν ξέρει πότε να σε περιμένει, οπότε δεν χτίζεται συνήθεια.',
        `Κλείδωσε μέρα και ώρα — το feed δείχνει ${a.topWeekday} ως πιο συχνή μέρα (${a.weekdayShare}%). Προγραμμάτισε 4 επεισόδια μπροστά.`,
      ),
    )
  }
  if (a.durationCv != null && a.durationCv > 0.5) {
    tips.push(
      tip(
        'medium',
        `Πολύ ανομοιόμορφες διάρκειες (διάμεσος ${a.medianDurationMin}′)`,
        'Άλλοτε 20 λεπτά, άλλοτε δύο ώρες: ο ακροατής δεν ξέρει αν χωράει το επεισόδιο στη διαδρομή του.',
        'Όρισε δύο σταθερές φόρμες: «σύντομο» 20-25′ για ειδήσεις και «κανονικό» 55-70′ για συνέντευξη, και δήλωσέ το στον τίτλο.',
      ),
    )
  }
  if (a.shownotes.thinPct > 40) {
    tips.push(
      tip(
        'high',
        `${a.shownotes.thinPct}% των επεισοδίων έχουν σχεδόν άδεια shownotes`,
        `Μέσος όρος ${a.shownotes.avgWords} λέξεις. Τα shownotes είναι το μόνο κείμενο που διαβάζει η αναζήτηση — χωρίς αυτά σε βρίσκουν μόνο όσοι σε ξέρουν ήδη.`,
        'Πρότυπο 5 γραμμών: τι συζητάμε, ποιος είναι ο καλεσμένος, 3 κεφάλαια με χρόνους, σύνδεσμοι, κάλεσμα.',
      ),
    )
  }
  if (a.shownotes.chaptersPct < 40) {
    tips.push(
      tip(
        'medium',
        `Μόνο ${a.shownotes.chaptersPct}% των επεισοδίων έχουν κεφάλαια`,
        'Σε μεγάλα επεισόδια sim racing (setup, reviews, αγώνες) οι χρονοσημάνσεις αυξάνουν τον χρόνο ακρόασης γιατί ο κόσμος βρίσκει το κομμάτι που τον ενδιαφέρει.',
        'Κράτα χρόνους ενώ ηχογραφείς και γράψε 4-6 κεφάλαια στη μορφή «12:30 — Το νέο FFB του ACC».',
      ),
    )
  }
  if (a.titles.longPct > 30) {
    tips.push(
      tip(
        'medium',
        `${a.titles.longPct}% των τίτλων κόβονται στα apps`,
        `Μέσο μήκος ${a.titles.avgLength} χαρακτήρες. Οι λίστες στο Spotify δείχνουν περίπου 40-60.`,
        'Κράτα τη μορφή «Θέμα σε 5 λέξεις — Καλεσμένος» και βάλε τις λεπτομέρειες στα shownotes.',
      ),
    )
  }
  if (a.titles.repeatedOpeningPct > 45) {
    tips.push(
      tip(
        'low',
        `Οι μισοί τίτλοι ξεκινούν με τις ίδιες λέξεις (${a.titles.repeatedOpeningPct}%)`,
        'Το σταθερό πρόθεμα σπαταλά τον χώρο που βλέπει ο ακροατής πριν κοπεί ο τίτλος.',
        'Άσε το όνομα του podcast για το artwork και ξεκίνα τον τίτλο με το θέμα.',
      ),
    )
  }
  if (a.metadata.episodeNumberPct < 60) {
    tips.push(
      tip(
        'low',
        `Μόνο ${a.metadata.episodeNumberPct}% των επεισοδίων έχουν αριθμό επεισοδίου στα metadata`,
        'Χωρίς itunes:episode/season η σειρά ακρόασης μπερδεύεται, ειδικά όταν κάποιος ξεκινά από την αρχή.',
        'Συμπλήρωσε αριθμό επεισοδίου (και σεζόν αν έχεις) στη φόρμα ανεβάσματος.',
      ),
    )
  }
  if (!/^el/i.test(a.metadata.language || '')) {
    tips.push(
      tip(
        'medium',
        `Η γλώσσα του feed είναι «${a.metadata.language || 'κενή'}»`,
        'Ένα ελληνόφωνο podcast που δηλώνεται ως en-US χάνει από τις ελληνικές λίστες και τις προτάσεις.',
        'Βάλε language: el ή el-GR στις ρυθμίσεις του podcast host.',
      ),
    )
  }
  if (!feed.description || feed.description.length < 120) {
    tips.push(
      tip(
        'medium',
        'Η περιγραφή του podcast είναι πολύ σύντομη',
        'Είναι το πρώτο πράγμα που διαβάζει κάποιος που σε βρήκε τυχαία.',
        'Γράψε 3 προτάσεις: για ποιον είναι (Έλληνες sim racers), τι θα ακούσει (τεστ, setups, κουβέντες με οδηγούς), κάθε πότε βγαίνει.',
      ),
    )
  }
  if (a.titles.guestPct > 0 && a.titles.guestPct < 25 && a.total > 8) {
    tips.push(
      tip(
        'low',
        'Οι καλεσμένοι σπάνια φαίνονται στον τίτλο',
        'Το όνομα ενός γνωστού οδηγού στον τίτλο φέρνει κόσμο από αναζήτηση και από το δικό του κοινό.',
        'Μορφή: «Θέμα — με τον [Όνομα], [ιδιότητα]».',
      ),
    )
  }

  const order = { high: 0, medium: 1, low: 2 }
  return tips.sort((x, y) => order[x.severity] - order[y.severity])
}
