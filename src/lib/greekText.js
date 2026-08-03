// Βοηθητικά για επεξεργασία ελληνικού κειμένου (κανονικοποίηση, tokenizing,
// συλλαβές, stopwords). Όλες οι υπόλοιπες αναλύσεις δουλεύουν πάνω σε αυτά.

const COMBINING_MARKS = /[\u0300-\u036f]/g

/** Πεζά, χωρίς τόνους, με τελικό σίγμα -> σίγμα. */
export function normalizeWord(word) {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .normalize('NFC')
    .replace(/ς/g, 'σ')
}

/** Κόβει ένα κείμενο σε λέξεις (κρατάει και λατινικά/αριθμούς). */
export function tokenize(text) {
  const matches = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu)
  return matches || []
}

/** Ίδιο με το tokenize αλλά επιστρέφει κανονικοποιημένες λέξεις. */
export function tokenizeNormalized(text) {
  return tokenize(text).map(normalizeWord)
}

/**
 * Χωρίζει σε προτάσεις. Στα ελληνικά το ερωτηματικό είναι το «;» — το
 * κρατάμε ώστε να ξέρουμε ποιες προτάσεις είναι ερωτήσεις.
 */
export function splitSentences(text) {
  const parts = []
  let buffer = ''
  for (const ch of text) {
    buffer += ch
    if (ch === '.' || ch === ';' || ch === '?' || ch === '!' || ch === '…') {
      const trimmed = buffer.trim()
      if (trimmed) parts.push(trimmed)
      buffer = ''
    }
  }
  const rest = buffer.trim()
  if (rest) parts.push(rest)
  return parts.filter((s) => tokenize(s).length > 0)
}

export function isQuestion(sentence) {
  return /[;?]\s*$/.test(sentence.trim())
}

const VOWEL_DIGRAPHS = ['ου', 'ευ', 'αυ', 'ηυ', 'αι', 'ει', 'οι', 'υι']
const VOWELS = 'αεηιουω'

/**
 * Προσεγγιστική μέτρηση συλλαβών: μετράει ομάδες φωνηέντων, με τους βασικούς
 * δίφθογγους να μετράνε ως μία συλλαβή. Δεν είναι τέλειο, αλλά αρκεί για να
 * βγάλουμε ρυθμό ομιλίας σε συλλαβές/δευτερόλεπτο.
 */
export function countSyllables(word) {
  const w = normalizeWord(word)
  if (!w) return 0
  let i = 0
  let syllables = 0
  while (i < w.length) {
    const pair = w.slice(i, i + 2)
    if (VOWEL_DIGRAPHS.includes(pair)) {
      syllables += 1
      i += 2
      continue
    }
    if (VOWELS.includes(w[i])) {
      syllables += 1
      i += 1
      // κατάπιε συνεχόμενα ίδια φωνήεντα (π.χ. «εεε»)
      while (i < w.length && w[i] === w[i - 1]) i += 1
      continue
    }
    i += 1
  }
  return syllables || (/[\p{L}]/u.test(w) ? 1 : 0)
}

/** Συχνές λέξεις που δεν λένε κάτι για το περιεχόμενο. */
export const STOPWORDS = new Set(
  [
    'ο', 'η', 'το', 'οι', 'τα', 'του', 'τησ', 'των', 'τον', 'την', 'τουσ', 'τισ',
    'και', 'κι', 'ή', 'αλλα', 'ομωσ', 'ενω', 'οτι', 'πωσ', 'που', 'ποτε', 'οταν',
    'αν', 'για', 'με', 'σε', 'στο', 'στη', 'στην', 'στον', 'στουσ', 'στισ', 'στα',
    'απο', 'προσ', 'ωσ', 'κατα', 'μετα', 'πριν', 'παρα', 'δια', 'περι', 'υπο',
    'ειναι', 'ημουν', 'ησουν', 'ηταν', 'εχω', 'εχεισ', 'εχει', 'εχουμε', 'εχετε',
    'εχουν', 'ειχα', 'ειχε', 'ειχαν', 'θα', 'να', 'δεν', 'μην', 'μη', 'ναι', 'οχι',
    'εγω', 'εσυ', 'αυτοσ', 'αυτη', 'αυτο', 'εμεισ', 'εσεισ', 'αυτοι', 'αυτεσ',
    'αυτα', 'μου', 'σου', 'τουσ', 'μασ', 'σασ', 'με', 'σε', 'τι', 'ποιοσ', 'ποια',
    'ποιο', 'ενασ', 'μια', 'ενα', 'καθε', 'ολα', 'ολο', 'ολη', 'ολοι', 'πολυ',
    'πιο', 'πωσ', 'εκει', 'εδω', 'τωρα', 'μετα', 'ακομα', 'ακομη', 'παλι', 'μονο',
    'ετσι', 'τοτε', 'καλα', 'καπου', 'καπωσ', 'κατι', 'τιποτα', 'ξανα', 'σαν',
    'ενταξει', 'ε', 'α', 'θελω', 'κανω', 'κανει', 'γινεται', 'ειχαμε', 'ειμαστε',
    'ειμαι', 'εισαι', 'ειστε', 'μπορει', 'μπορω', 'λεει', 'λεμε', 'λεω',
  ].map(normalizeWord),
)

/** Οι πιο συχνές λέξεις περιεχομένου. */
export function topContentWords(tokens, limit = 12) {
  const counts = new Map()
  for (const token of tokens) {
    if (token.length < 4 || STOPWORDS.has(token)) continue
    if (/^\d+$/.test(token)) continue
    counts.set(token, (counts.get(token) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }))
}

/** Επαναλαμβανόμενες φράσεις (n-grams) — τα «τικ» του λόγου. */
export function repeatedPhrases(tokens, size = 3, limit = 6) {
  const counts = new Map()
  for (let i = 0; i + size <= tokens.length; i += 1) {
    const slice = tokens.slice(i, i + size)
    if (slice.every((w) => STOPWORDS.has(w))) continue
    const phrase = slice.join(' ')
    counts.set(phrase, (counts.get(phrase) || 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([phrase, count]) => ({ phrase, count }))
}

/** Ώρα σε αναγνώσιμη μορφή (π.χ. 1:04:07 ή 4:07). */
export function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
