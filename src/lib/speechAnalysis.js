// Ανάλυση ελληνικής ομιλίας από απομαγνητοφώνηση επεισοδίου.
//
// Όλα γίνονται τοπικά στον browser: μετράμε ρυθμό, παρασιτικά, δομή λόγου,
// ερωτήσεις, ισορροπία ομιλητών και νεκρό χρόνο, βγάζουμε βαθμολογίες 0-100 και
// από αυτές συγκεκριμένες συμβουλές με ασκήσεις.

import {
  countSyllables,
  formatClock,
  isQuestion,
  normalizeWord,
  repeatedPhrases,
  splitSentences,
  tokenize,
  tokenizeNormalized,
  topContentWords,
} from './greekText.js'

// ---------------------------------------------------------------- λεξιλόγια

// Κάθε φράση είναι κανονικοποιημένη (πεζά, χωρίς τόνους, σίγμα αντί για ς).
export const FILLERS = [
  // ήχοι δισταγμού
  { phrase: 'εε', category: 'hesitation' },
  { phrase: 'εεε', category: 'hesitation' },
  { phrase: 'εμ', category: 'hesitation' },
  { phrase: 'μμ', category: 'hesitation' },
  { phrase: 'χμ', category: 'hesitation' },
  { phrase: 'αα', category: 'hesitation' },
  { phrase: 'ααα', category: 'hesitation' },
  // λέξεις-γεμίσματα
  { phrase: 'βασικα', category: 'crutch' },
  { phrase: 'δηλαδη', category: 'crutch' },
  { phrase: 'ας πουμε', category: 'crutch' },
  { phrase: 'να πουμε', category: 'crutch' },
  { phrase: 'ξερω γω', category: 'crutch' },
  { phrase: 'ξερεισ', category: 'crutch' },
  { phrase: 'καταλαβαινεισ', category: 'crutch' },
  { phrase: 'καταλαβεσ', category: 'crutch' },
  { phrase: 'τελοσ παντων', category: 'crutch' },
  { phrase: 'τροπον τινα', category: 'crutch' },
  { phrase: 'στην ουσια', category: 'crutch' },
  { phrase: 'ουσιαστικα', category: 'crutch' },
  { phrase: 'πρακτικα', category: 'crutch' },
  { phrase: 'θελω να πω', category: 'crutch' },
  { phrase: 'τι να σου πω', category: 'crutch' },
  { phrase: 'ρε παιδι μου', category: 'crutch' },
  { phrase: 'ρε φιλε', category: 'crutch' },
  { phrase: 'ρε συ', category: 'crutch' },
  { phrase: 'καπωσ ετσι', category: 'crutch' },
  { phrase: 'τετοιο πραγμα', category: 'crutch' },
  { phrase: 'και τα λοιπα', category: 'crutch' },
  // συνδετικά που εύκολα γίνονται τικ
  { phrase: 'λοιπον', category: 'connector' },
  { phrase: 'οποτε', category: 'connector' },
  { phrase: 'ενταξει', category: 'connector' },
  { phrase: 'γενικα', category: 'connector' },
  { phrase: 'απλα', category: 'connector' },
  // υπεκφυγές / αμφιβολία
  { phrase: 'νομιζω', category: 'hedge' },
  { phrase: 'μαλλον', category: 'hedge' },
  { phrase: 'ισωσ', category: 'hedge' },
  { phrase: 'καπωσ', category: 'hedge' },
  { phrase: 'δεν ξερω', category: 'hedge' },
  { phrase: 'κατα καποιον τροπο', category: 'hedge' },
  { phrase: 'σχετικα', category: 'hedge' },
]

export const FILLER_CATEGORIES = {
  hesitation: 'Ήχοι δισταγμού',
  crutch: 'Λέξεις-γεμίσματα',
  connector: 'Συνδετικά-τικ',
  hedge: 'Υπεκφυγές',
}

const HESITATION_RE = /^(ε{2,}|α{2,}|μ{2,}|εμ+|χμ+|ααμ+|ουμ+)$/

// Ορολογία του sim racing: αγγλικά που είναι ΟΚ να μένουν ως έχουν.
const SIM_TERMS = new Set([
  'iracing', 'acc', 'assetto', 'corsa', 'competizione', 'rfactor', 'automobilista',
  'ams2', 'lmu', 'raceroom', 'gran', 'turismo', 'forza', 'setup', 'setups', 'ffb',
  'force', 'feedback', 'rig', 'wheelbase', 'wheel', 'pedals', 'sim', 'racing',
  'simracing', 'esports', 'lobby', 'stint', 'quali', 'qualifying', 'practice',
  'race', 'league', 'championship', 'endurance', 'sprint', 'apex', 'braking',
  'trail', 'oversteer', 'understeer', 'grip', 'downforce', 'slipstream', 'draft',
  'undercut', 'overcut', 'pit', 'stop', 'safety', 'car', 'gt3', 'gt4', 'lmp2',
  'hypercar', 'formula', 'f1', 'nordschleife', 'spa', 'monza', 'imola', 'daytona',
  'nurburgring', 'laptime', 'delta', 'telemetry', 'motion', 'triple', 'vr',
  'fanatec', 'moza', 'simucube', 'logitech', 'thrustmaster', 'simagic', 'asetek',
])

// Αγγλικά που έχουν καθαρή ελληνική λέξη — καλό είναι να μεταφράζονται.
const AVOIDABLE_EN = new Set([
  'actually', 'basically', 'anyway', 'guys', 'content', 'community', 'feeling',
  'point', 'level', 'sorry', 'ok', 'okay', 'nice', 'crazy', 'skill', 'timing',
  'update', 'feature', 'issue', 'problem', 'random', 'focus', 'mood', 'vibe',
  'story', 'topic', 'episode', 'season', 'live', 'stream', 'follow', 'link',
])

const TOPIC_MAP = [
  { label: 'iRacing', words: ['iracing'] },
  { label: 'Assetto Corsa / ACC', words: ['assetto', 'acc', 'competizione'] },
  { label: 'Le Mans Ultimate / rFactor', words: ['lmu', 'rfactor', 'motorsport games'] },
  { label: 'Automobilista / RaceRoom', words: ['automobilista', 'ams2', 'raceroom'] },
  { label: 'Gran Turismo / Forza', words: ['gran', 'turismo', 'forza'] },
  { label: 'Εξοπλισμός (τιμόνια, rig)', words: ['τιμονι', 'τιμονια', 'βαση', 'rig', 'wheelbase', 'fanatec', 'moza', 'simucube', 'πενταλ', 'pedals', 'simagic', 'asetek'] },
  { label: 'Setup & τεχνική', words: ['setup', 'setups', 'ελατηρια', 'αμορτισερ', 'διαφορικο', 'ffb', 'telemetry', 'downforce'] },
  { label: 'Οδηγικές τεχνικές', words: ['φρεναρισμα', 'apex', 'trail', 'oversteer', 'understeer', 'γραμμη', 'braking'] },
  { label: 'Πρωταθλήματα / esports', words: ['πρωταθλημα', 'league', 'championship', 'esports', 'αγωνασ', 'endurance', 'σεζον'] },
  { label: 'Κοινότητα & events', words: ['κοινοτητα', 'community', 'παρεα', 'εκδηλωση', 'event', 'meetup'] },
]

// -------------------------------------------------------------- βοηθητικά

/** 100 μέσα στο [goodLo, goodHi], πέφτει γραμμικά σε 0 στα hardLo / hardHi. */
function scoreRange(value, goodLo, goodHi, hardLo, hardHi) {
  if (!Number.isFinite(value)) return null
  if (value >= goodLo && value <= goodHi) return 100
  if (value < goodLo) {
    if (value <= hardLo) return 0
    return Math.round(((value - hardLo) / (goodLo - hardLo)) * 100)
  }
  if (value >= hardHi) return 0
  return Math.round(((hardHi - value) / (hardHi - goodHi)) * 100)
}

function pct(part, whole) {
  if (!whole) return 0
  return (part / whole) * 100
}

function round(value, digits = 1) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Moving-average TTR: πιο δίκαιο από το σκέτο TTR σε μεγάλα κείμενα. */
function mattr(tokens, window = 200) {
  if (tokens.length === 0) return null
  if (tokens.length <= window) return new Set(tokens).size / tokens.length
  let sum = 0
  let windows = 0
  for (let i = 0; i + window <= tokens.length; i += 25) {
    sum += new Set(tokens.slice(i, i + window)).size / window
    windows += 1
  }
  return windows ? sum / windows : null
}

// ------------------------------------------------------------- παρασιτικά

const FILLER_INDEX = new Map()
let MAX_FILLER_WORDS = 1
for (const filler of FILLERS) {
  const phrase = filler.phrase.split(' ').map(normalizeWord).join(' ')
  FILLER_INDEX.set(phrase, { ...filler, phrase })
  MAX_FILLER_WORDS = Math.max(MAX_FILLER_WORDS, phrase.split(' ').length)
}

/**
 * Περνάει τα tokens μία φορά και «τρώει» το μεγαλύτερο παρασιτικό που ταιριάζει
 * σε κάθε θέση, ώστε το «ας πούμε» να μη μετρηθεί και ως «πούμε».
 */
function findFillers(tokens) {
  const hits = []
  let i = 0
  while (i < tokens.length) {
    let matched = null
    for (let size = MAX_FILLER_WORDS; size >= 1; size -= 1) {
      if (i + size > tokens.length) continue
      const phrase = tokens.slice(i, i + size).join(' ')
      const entry = FILLER_INDEX.get(phrase)
      if (entry) {
        matched = { ...entry, index: i, size }
        break
      }
    }
    if (!matched && HESITATION_RE.test(tokens[i])) {
      matched = { phrase: tokens[i], category: 'hesitation', index: i, size: 1 }
    }
    if (matched) {
      hits.push(matched)
      i += matched.size
    } else {
      i += 1
    }
  }
  return hits
}

// ------------------------------------------------------------------ ανάλυση

export function analyzeSpeech(transcript, options = {}) {
  if (!transcript || !transcript.segments?.length) return null
  const { durationSec: overrideDuration = null } = options

  const text = transcript.text
  const words = tokenize(text)
  const tokens = words.map(normalizeWord)
  const wordCount = words.length

  const durationSec = overrideDuration || transcript.durationSec || null
  const durationMin = durationSec ? durationSec / 60 : null

  // --- ρυθμός
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0)
  const wpm = durationMin ? wordCount / durationMin : null
  const syllablesPerSec = durationSec ? syllables / durationSec : null

  // --- παρασιτικά
  const fillerHits = findFillers(tokens)
  const byPhrase = new Map()
  for (const hit of fillerHits) {
    const current = byPhrase.get(hit.phrase) || { ...hit, count: 0 }
    current.count += 1
    byPhrase.set(hit.phrase, current)
  }
  const fillerItems = [...byPhrase.values()]
    .sort((a, b) => b.count - a.count)
    .map((item) => ({
      phrase: item.phrase,
      category: item.category,
      count: item.count,
      per1000: round(pct(item.count, wordCount) * 10, 1),
    }))
  const fillerTotal = fillerHits.length
  const fillerPerMin = durationMin ? fillerTotal / durationMin : null
  const fillerRatePct = round(pct(fillerTotal, wordCount), 1)

  // --- λεξιλόγιο
  const unique = new Set(tokens).size
  // Κάτω από ~250 λέξεις ο δείκτης λεξιλογίου δεν λέει τίποτα αξιόπιστο.
  const richness = tokens.length >= 250 ? mattr(tokens) : null

  // --- προτάσεις
  const sentences = splitSentences(text)
  const sentenceLengths = sentences.map((s) => tokenize(s).length)
  const avgSentenceWords = sentenceLengths.length
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
    : 0
  const longSentences = sentenceLengths.filter((n) => n > 30).length
  const longestIndex = sentenceLengths.reduce(
    (best, n, idx) => (n > sentenceLengths[best] ? idx : best),
    0,
  )

  // --- ερωτήσεις
  const questionSentences = sentences.filter(isQuestion)
  const openStarters = ['τι', 'πωσ', 'γιατι', 'ποιο', 'ποια', 'ποιοσ', 'πεσ', 'περιγραψε', 'εξηγησε']
  const openQuestions = questionSentences.filter((s) => {
    const first = tokenizeNormalized(s)[0]
    return first && openStarters.includes(first)
  })
  const questionsPer10Min = durationMin ? (questionSentences.length / durationMin) * 10 : null

  // --- ομιλητές & μονόλογοι
  const speakerStats = new Map()
  let longestMonologue = { seconds: 0, words: 0, speaker: null, start: null }
  let run = { speaker: null, words: 0, start: null, end: null }

  for (const segment of transcript.segments) {
    const segWords = tokenize(segment.text).length
    const name = segment.speaker || 'Ομιλητής'
    const seconds =
      segment.start != null && segment.end != null ? Math.max(0, segment.end - segment.start) : 0
    const stat = speakerStats.get(name) || { name, words: 0, seconds: 0 }
    stat.words += segWords
    stat.seconds += seconds
    speakerStats.set(name, stat)

    if (run.speaker === name) {
      run.words += segWords
      run.end = segment.end ?? run.end
    } else {
      run = { speaker: name, words: segWords, start: segment.start, end: segment.end }
    }
    const runSeconds =
      run.start != null && run.end != null ? run.end - run.start : run.words / 2.4
    if (runSeconds > longestMonologue.seconds) {
      longestMonologue = {
        seconds: runSeconds,
        words: run.words,
        speaker: run.speaker,
        start: run.start,
      }
    }
  }
  const speakers = [...speakerStats.values()]
    .map((s) => ({ ...s, sharePct: round(pct(s.words, wordCount), 1) }))
    .sort((a, b) => b.words - a.words)
  const multiSpeaker = speakers.length > 1
  const topShare = speakers[0]?.sharePct ?? 100

  // --- παύσεις / νεκρός χρόνος
  let pauseCount = 0
  let pauseSeconds = 0
  let longestPause = { seconds: 0, at: null }
  if (transcript.hasTiming) {
    for (let i = 1; i < transcript.segments.length; i += 1) {
      const prev = transcript.segments[i - 1]
      const cur = transcript.segments[i]
      if (prev.end == null || cur.start == null) continue
      const gap = cur.start - prev.end
      if (gap >= 1.5) {
        pauseCount += 1
        pauseSeconds += gap
        if (gap > longestPause.seconds) longestPause = { seconds: gap, at: prev.end }
      }
    }
  }
  const deadAirPct = durationSec ? round(pct(pauseSeconds, durationSec), 1) : null

  // --- αγγλικά / ορολογία
  const latinTokens = tokens.filter((t) => /^[a-z][a-z0-9'-]*$/.test(t))
  const jargonCounts = new Map()
  const avoidableCounts = new Map()
  for (const token of latinTokens) {
    const target = SIM_TERMS.has(token) ? jargonCounts : AVOIDABLE_EN.has(token) ? avoidableCounts : null
    if (target) target.set(token, (target.get(token) || 0) + 1)
  }
  const toList = (map) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count }))

  // --- θεματολογία
  const tokenSet = new Set(tokens)
  const topics = TOPIC_MAP.filter((topic) => topic.words.some((w) => tokenSet.has(normalizeWord(w)))).map(
    (t) => t.label,
  )

  // --- άνοιγμα & κλείσιμο
  const opening = sliceByTime(transcript, 0, 60) || text.slice(0, 750)
  const closing =
    (durationSec ? sliceByTime(transcript, durationSec - 90, durationSec) : null) ||
    text.slice(-900)
  const openingNorm = normalizeWord(opening)
  const closingNorm = normalizeWord(closing)
  const hook = {
    text: opening,
    hasQuestion: /[;?]/.test(opening),
    namesTopic: /(σημερα|επεισοδιο|θα μιλησουμε|θα δουμε|θεμα|κουβεντα)/.test(openingNorm),
    hasGuest: /(καλεσμεν|μαζι μου|φιλοξεν)/.test(openingNorm),
    tooLongIntro: tokenize(opening).length > 190,
  }
  const outro = {
    text: closing,
    hasCta: /(κανε|καντε|αφηστε|γραψτε|στειλτε|σχολιο|βαθμολογ|εγγραφ|subscribe|follow|like)/.test(
      closingNorm,
    ),
    teasesNext: /(επομεν|την αλλη εβδομαδα|θα τα πουμε|στο επομενο)/.test(closingNorm),
  }

  // --- χρονογραμμή ανά λεπτό (για το γράφημα)
  const timeline = buildTimeline(transcript, durationSec)

  // --- στιγμές για ξανακοίταγμα
  const hotspots = timeline
    .filter((m) => m.fillers >= 3)
    .sort((a, b) => b.fillers - a.fillers)
    .slice(0, 3)
    .map((m) => ({ at: m.minute * 60, fillers: m.fillers, label: formatClock(m.minute * 60) }))

  // ------------------------------------------------------------ βαθμολογίες
  const scores = {}
  scores.pace = wpm != null ? scoreRange(wpm, 120, 165, 70, 235) : null
  scores.fillers =
    fillerPerMin != null
      ? scoreRange(fillerPerMin, 0, 2.5, -1, 13)
      : scoreRange(fillerRatePct, 0, 1.6, -1, 8)
  const clarityBase = scoreRange(avgSentenceWords, 8, 20, 3, 45) ?? 60
  const longPenalty = Math.min(30, pct(longSentences, sentences.length || 1))
  scores.clarity = Math.max(0, Math.round(clarityBase - longPenalty))
  scores.richness = richness != null ? scoreRange(richness, 0.62, 1, 0.38, 1.01) : null
  const questionScore = questionsPer10Min != null ? scoreRange(questionsPer10Min, 2.5, 12, 0, 30) : null
  const balanceScore = multiSpeaker ? scoreRange(topShare, 35, 62, 5, 92) : null
  const monologueScore = scoreRange(longestMonologue.seconds, 0, 150, -1, 480)
  scores.engagement = average([questionScore, balanceScore, monologueScore])
  const structureBits = [
    hook.hasQuestion || hook.namesTopic,
    hook.hasGuest || hook.namesTopic,
    !hook.tooLongIntro,
    outro.hasCta,
    outro.teasesNext,
  ]
  scores.structure = Math.round(pct(structureBits.filter(Boolean).length, structureBits.length))
  scores.flow = deadAirPct != null ? scoreRange(deadAirPct, 0, 6, -1, 25) : null

  const weights = {
    pace: 1.1,
    fillers: 1.5,
    clarity: 1.2,
    richness: 0.8,
    engagement: 1.2,
    structure: 1,
    flow: 0.6,
  }
  const overall = weightedAverage(scores, weights)

  const analysis = {
    // Κάτω από 300 λέξεις τα ποσοστά κουνιούνται πολύ — το λέμε στο UI.
    shortSample: wordCount < 300,
    wordCount,
    durationSec,
    durationMin,
    wpm: wpm != null ? Math.round(wpm) : null,
    syllablesPerSec: syllablesPerSec != null ? round(syllablesPerSec, 2) : null,
    fillers: {
      total: fillerTotal,
      perMin: fillerPerMin != null ? round(fillerPerMin, 1) : null,
      ratePct: fillerRatePct,
      items: fillerItems,
    },
    vocabulary: {
      unique,
      richness: richness != null ? round(richness, 3) : null,
      topWords: topContentWords(
        tokens.filter((t) => !FILLER_INDEX.has(t) && !HESITATION_RE.test(t)),
      ),
      repeats: repeatedPhrases(tokens),
    },
    sentences: {
      count: sentences.length,
      avgWords: round(avgSentenceWords, 1),
      longCount: longSentences,
      longPct: round(pct(longSentences, sentences.length || 1), 1),
      longest: sentenceLengths[longestIndex] || 0,
      longestText: sentences[longestIndex] || '',
    },
    questions: {
      total: questionSentences.length,
      per10Min: questionsPer10Min != null ? round(questionsPer10Min, 1) : null,
      openPct: round(pct(openQuestions.length, questionSentences.length || 1), 0),
      examples: questionSentences.slice(0, 5),
    },
    speakers,
    multiSpeaker,
    topShare,
    longestMonologue,
    pauses: {
      count: pauseCount,
      totalSec: Math.round(pauseSeconds),
      deadAirPct,
      longest: longestPause,
      available: transcript.hasTiming,
    },
    english: {
      jargon: toList(jargonCounts),
      avoidable: toList(avoidableCounts),
      avoidableTotal: [...avoidableCounts.values()].reduce((a, b) => a + b, 0),
    },
    topics,
    hook,
    outro,
    timeline,
    hotspots,
    scores: { ...scores, overall },
  }

  analysis.tips = buildSpeechTips(analysis)
  return analysis
}

function average(values) {
  const valid = values.filter((v) => Number.isFinite(v))
  if (!valid.length) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
}

function weightedAverage(scores, weights) {
  let sum = 0
  let total = 0
  for (const [key, weight] of Object.entries(weights)) {
    const value = scores[key]
    if (!Number.isFinite(value)) continue
    sum += value * weight
    total += weight
  }
  return total ? Math.round(sum / total) : null
}

function sliceByTime(transcript, from, to) {
  if (!transcript.hasTiming) return null
  const parts = transcript.segments
    .filter((s) => s.start != null && s.start >= from && s.start <= to)
    .map((s) => s.text)
  return parts.length ? parts.join(' ') : null
}

function buildTimeline(transcript, durationSec) {
  if (!transcript.hasTiming || !durationSec) return []
  const minutes = Math.max(1, Math.ceil(durationSec / 60))
  const buckets = Array.from({ length: minutes }, (_, i) => ({ minute: i, words: 0, fillers: 0 }))
  for (const segment of transcript.segments) {
    if (segment.start == null) continue
    const index = Math.min(minutes - 1, Math.floor(segment.start / 60))
    const tokens = tokenizeNormalized(segment.text)
    buckets[index].words += tokens.length
    buckets[index].fillers += findFillers(tokens).length
  }
  return buckets
}

// ------------------------------------------------------------------ συμβουλές

function tip(severity, title, detail, drill) {
  return { severity, title, detail, drill }
}

function buildSpeechTips(a) {
  const tips = []
  const f = a.fillers

  if (f.perMin != null && f.perMin > 6) {
    tips.push(
      tip(
        'high',
        `Πολλά παρασιτικά: ${f.perMin} ανά λεπτό`,
        `Μέτρησα ${f.total} γεμίσματα σε ${Math.round(a.durationMin)} λεπτά. Το «${f.items[0]?.phrase}» μόνο του εμφανίζεται ${f.items[0]?.count} φορές. Ο στόχος για ραδιοφωνικό αποτέλεσμα είναι κάτω από 3 ανά λεπτό.`,
        'Άσκηση σιωπής: κάθε φορά που θες να πεις «εεε» ή «βασικά», κάνε παύση 1 δευτερολέπτου. Ηχογράφησε 3 λεπτά μονόλογο για το τελευταίο σου race και μέτρα ξανά.',
      ),
    )
  } else if (f.perMin != null && f.perMin > 3) {
    tips.push(
      tip(
        'medium',
        `Παρασιτικά υπό έλεγχο αλλά όχι καθαρά: ${f.perMin}/λεπτό`,
        `Κυρίως το «${f.items[0]?.phrase}» (${f.items[0]?.count} φορές). Δεν χαλάει το επεισόδιο, αλλά ακούγεται στα ήσυχα σημεία.`,
        'Διάλεξε ΜΙΑ φράση-τικ και απαγόρευσέ την για ένα ολόκληρο επεισόδιο. Βάλε το χαρτάκι μπροστά στο μικρόφωνο.',
      ),
    )
  }

  const connectors = f.items.filter((i) => i.category === 'connector' && i.count >= 15)
  if (connectors.length) {
    tips.push(
      tip(
        'medium',
        `Ξεκινάς πολλές προτάσεις με «${connectors[0].phrase}»`,
        `${connectors.map((c) => `«${c.phrase}» ×${c.count}`).join(', ')}. Τα συνδετικά είναι χρήσιμα, αλλά όταν επαναλαμβάνονται γίνονται τικ και ακούγεται ότι σκέφτεσαι φωναχτά.`,
        'Ξεκίνα την επόμενη ενότητα με ουσιαστικό αντί για συνδετικό: «Το setup στη Spa…» αντί για «Λοιπόν, το setup…».',
      ),
    )
  }

  const hedges = f.items.filter((i) => i.category === 'hedge')
  const hedgeTotal = hedges.reduce((sum, h) => sum + h.count, 0)
  if (hedgeTotal > 12) {
    tips.push(
      tip(
        'medium',
        `Πολλές υπεκφυγές (${hedgeTotal})`,
        `«νομίζω», «μάλλον», «ίσως» ×${hedgeTotal}. Σε podcast που κρίνει hardware και παιχνίδια, η αοριστία κοστίζει σε αξιοπιστία.`,
        'Πες τη θέση σου καθαρά και μετά βάλε τον όρο: «Το ACC έχει το καλύτερο GT3 μοντέλο σήμερα — με την επιφύλαξη ότι δεν έχω δοκιμάσει το τελευταίο update».',
      ),
    )
  }

  if (a.wpm != null && a.wpm > 175) {
    tips.push(
      tip(
        'high',
        `Μιλάς γρήγορα: ${a.wpm} λέξεις/λεπτό`,
        'Πάνω από ~170 λέξεις/λεπτό ο ακροατής χάνει ονόματα, χρόνους και τεχνικούς όρους — ακριβώς αυτά που έχουν αξία στο sim racing.',
        'Σημάδεψε στο script 3 σημεία «φρένο»: μετά από κάθε αριθμό ή όνομα πίστας, κάνε παύση μισού δευτερολέπτου.',
      ),
    )
  } else if (a.wpm != null && a.wpm < 110) {
    tips.push(
      tip(
        'medium',
        `Χαμηλός ρυθμός: ${a.wpm} λέξεις/λεπτό`,
        'Ο λόγος ακούγεται νωθρός. Συνήθως δεν φταίει η ταχύτητα αλλά οι μεγάλες παύσεις μέσα στην πρόταση.',
        'Ετοίμασε 5 bullets ανά ενότητα πριν πατήσεις rec — ο ρυθμός ανεβαίνει μόνος του όταν ξέρεις την επόμενη πρόταση.',
      ),
    )
  }

  if (a.sentences.longPct > 25) {
    tips.push(
      tip(
        'high',
        `${a.sentences.longPct}% των προτάσεων είναι ατέλειωτες`,
        `Μέσος όρος ${a.sentences.avgWords} λέξεις/πρόταση, με μεγαλύτερη τις ${a.sentences.longest} λέξεις. Οι μεγάλες περίοδοι με πολλά «και» κουράζουν στα αυτιά.`,
        'Κανόνας μιας ανάσας: αν δεν βγαίνει η πρόταση με μία ανάσα, κόψ’ την στα δύο. Δοκίμασε το στην πιο μεγάλη πρόταση του επεισοδίου.',
      ),
    )
  }

  if (a.vocabulary.repeats.length) {
    const top = a.vocabulary.repeats[0]
    tips.push(
      tip(
        'low',
        `Επαναλαμβανόμενη φράση: «${top.phrase}» ×${top.count}`,
        'Οι φράσεις που επαναλαμβάνονται 3+ φορές γίνονται αντιληπτές από τον ακροατή ως μανιέρα.',
        'Γράψε 3 εναλλακτικές διατυπώσεις για αυτή τη φράση και χρησιμοποίησέ τες εναλλάξ.',
      ),
    )
  }

  if (a.vocabulary.richness != null && a.vocabulary.richness < 0.5) {
    tips.push(
      tip(
        'medium',
        `Περιορισμένο λεξιλόγιο (δείκτης ${a.vocabulary.richness})`,
        'Επαναλαμβάνεις τις ίδιες λέξεις σε όλο το επεισόδιο. Στα τεχνικά κομμάτια αυτό ισοπεδώνει τις διαφορές που θέλεις να εξηγήσεις.',
        'Φτιάξε μίνι γλωσσάρι: 10 τρόποι να πεις «γρήγορος», «σταθερός», «δύσκολος» και βάλ’ τα δίπλα στην οθόνη.',
      ),
    )
  }

  if (a.questions.per10Min != null && a.multiSpeaker && a.questions.per10Min < 2.5) {
    tips.push(
      tip(
        'high',
        `Λίγες ερωτήσεις: ${a.questions.per10Min} ανά 10 λεπτά`,
        'Με καλεσμένο, οι ερωτήσεις είναι το εργαλείο σου. Λίγες ερωτήσεις σημαίνει ότι η κουβέντα κυλάει χωρίς κατεύθυνση.',
        'Ετοίμασε 8 ανοιχτές ερωτήσεις πριν την ηχογράφηση και ρίξε τουλάχιστον μία κάθε 5 λεπτά.',
      ),
    )
  }

  if (a.questions.total >= 5 && a.questions.openPct < 40) {
    tips.push(
      tip(
        'medium',
        `Μόνο ${a.questions.openPct}% των ερωτήσεων είναι ανοιχτές`,
        'Οι κλειστές ερωτήσεις («σου άρεσε;») παίρνουν μονολεκτικές απαντήσεις και σε αναγκάζουν να μιλάς εσύ.',
        'Μετέτρεψε τις: «Σου άρεσε το νέο ACC;» → «Τι άλλαξε πρακτικά στο πώς οδηγείς το GT3 μετά το update;»',
      ),
    )
  }

  if (a.multiSpeaker && a.topShare > 65) {
    tips.push(
      tip(
        'high',
        `Μιλάς ${a.topShare}% του χρόνου`,
        `Ο/η ${a.speakers[0].name} καλύπτει το μεγαλύτερο μέρος του επεισοδίου. Σε συνέντευξη ο οικοδεσπότης θέλει 30-40%.`,
        'Κανόνας 3 δευτερολέπτων: μετά την απάντηση του καλεσμένου μέτρα ως το 3 πριν μιλήσεις. Συνήθως συνεχίζει μόνος του με το καλύτερο κομμάτι.',
      ),
    )
  }

  if (a.longestMonologue.seconds > 240) {
    tips.push(
      tip(
        'medium',
        `Μονόλογος ${formatClock(a.longestMonologue.seconds)}${a.longestMonologue.start != null ? ` στο ${formatClock(a.longestMonologue.start)}` : ''}`,
        'Πάνω από 4 λεπτά συνεχόμενης ομιλίας χωρίς αλλαγή φωνής ή ρυθμού είναι το σημείο που φεύγουν οι ακροατές.',
        'Σπάσε τον μονόλογο με ερώτηση, με παράδειγμα από αγώνα ή με ηχητικό: «Θυμάσαι το restart στη Monza; Να τι εννοώ».',
      ),
    )
  }

  if (a.pauses.available && a.pauses.deadAirPct != null && a.pauses.deadAirPct > 8) {
    tips.push(
      tip(
        'medium',
        `Νεκρός χρόνος ${a.pauses.deadAirPct}% του επεισοδίου`,
        `${a.pauses.count} παύσεις άνω του 1,5 δευτ., με μεγαλύτερη ${formatClock(a.pauses.longest.seconds)}${a.pauses.longest.at != null ? ` στο ${formatClock(a.pauses.longest.at)}` : ''}.`,
        'Κόψε τις παύσεις άνω των 2 δευτ. στο μοντάζ — σε ένα ωριαίο επεισόδιο συνήθως κερδίζεις 3-5 λεπτά καθαρού χρόνου.',
      ),
    )
  }

  if (a.english.avoidableTotal > 15) {
    tips.push(
      tip(
        'low',
        `Αγγλικά χωρίς λόγο (${a.english.avoidableTotal} φορές)`,
        `Π.χ. ${a.english.avoidable.slice(0, 4).map((w) => `«${w.word}» ×${w.count}`).join(', ')}. Η ορολογία του sim racing (setup, FFB, apex) μένει — αυτά όμως έχουν ελληνική λέξη.`,
        'Κράτα λίστα: content → περιεχόμενο, community → κοινότητα, actually → στην πραγματικότητα. Πες τη ελληνική λέξη πρώτη και τον αγγλικό όρο σε παρένθεση.',
      ),
    )
  }

  if (!a.hook.namesTopic && !a.hook.hasQuestion) {
    tips.push(
      tip(
        'high',
        'Το άνοιγμα δεν λέει τι θα ακούσουμε',
        'Στα πρώτα 60 δευτερόλεπτα δεν εντόπισα ούτε ερώτηση-αγκίστρι ούτε καθαρή δήλωση θέματος. Εκεί κρίνεται αν θα μείνει ο ακροατής.',
        'Δομή 3 προτάσεων: (1) η πιο δυνατή ατάκα του επεισοδίου, (2) «Σήμερα μιλάμε για…», (3) γιατί αφορά τον ακροατή τώρα.',
      ),
    )
  }
  if (a.hook.tooLongIntro) {
    tips.push(
      tip(
        'medium',
        'Πολύ μεγάλη εισαγωγή',
        'Το intro τρώει πάνω από ένα λεπτό πριν μπεις στο θέμα.',
        'Στόχος: στα 45 δευτερόλεπτα να έχει ακουστεί το θέμα και το όνομα του καλεσμένου.',
      ),
    )
  }
  if (!a.outro.hasCta) {
    tips.push(
      tip(
        'medium',
        'Λείπει κάλεσμα στο τέλος',
        'Το επεισόδιο κλείνει χωρίς σαφές call to action (εγγραφή, σχόλιο, βαθμολογία, Discord).',
        'Ένα και μόνο κάλεσμα, συγκεκριμένο: «Πες μου στο Discord ποιο τιμόνι να δοκιμάσω στο επόμενο επεισόδιο».',
      ),
    )
  }

  const order = { high: 0, medium: 1, low: 2 }
  return tips.sort((a1, b1) => order[a1.severity] - order[b1.severity])
}
