// Parsing απομαγνητοφώνησης. Δέχεται SRT, WebVTT ή σκέτο κείμενο (με ή χωρίς
// χρονοσημάνσεις και ονόματα ομιλητών) και το φέρνει σε μια κοινή δομή:
//
//   { segments: [{ start, end, speaker, text }], text, speakers, durationSec,
//     hasTiming, format }
//
// Το `start`/`end` είναι δευτερόλεπτα ή null όταν δεν υπάρχει χρονοσήμανση.

import { tokenize } from './greekText.js'

const TIME_SRC = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?`
const CUE_RE = new RegExp(`(${TIME_SRC})\\s*-->\\s*(${TIME_SRC})`)
const INLINE_STAMP_RE = /^\[?\(?(\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\)?\]?\s*/
const SPEAKER_RE = /^([A-Za-zΑ-Ωα-ωΆ-Ώά-ώΪΫϊϋΐΰ][\w\s.'’Α-Ωα-ωΆ-Ώά-ώΪΫϊϋΐΰ-]{0,28}?)\s*:\s*(?=\S)/

function parseTimestamp(raw) {
  const parts = raw.trim().replace(',', '.').split(':').map(Number)
  if (parts.some((n) => Number.isNaN(n))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] ?? null
}

function stripTags(line) {
  return line
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]*\}/g, '')
    .trim()
}

function extractSpeaker(text) {
  const match = text.match(SPEAKER_RE)
  if (!match) return { speaker: null, text }
  const speaker = match[1].trim()
  // Αν το «όνομα» έχει πολλές λέξεις είναι μάλλον κανονική πρόταση με άνω κάτω
  // τελεία, όχι ετικέτα ομιλητή.
  if (speaker.split(/\s+/).length > 3) return { speaker: null, text }
  return { speaker, text: text.slice(match[0].length).trim() }
}

function parseCueBased(raw) {
  const blocks = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .replace(/^WEBVTT.*$/m, '')
    .split(/\n{2,}/)

  const segments = []
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '')
    if (lines.length === 0) continue
    const cueLineIndex = lines.findIndex((l) => CUE_RE.test(l))
    if (cueLineIndex === -1) continue
    const cue = lines[cueLineIndex].match(CUE_RE)
    const start = parseTimestamp(cue[1])
    const end = parseTimestamp(cue[2])
    const body = lines
      .slice(cueLineIndex + 1)
      .map(stripTags)
      .join(' ')
      .trim()
    if (!body) continue
    const { speaker, text } = extractSpeaker(body)
    segments.push({
      start,
      end: Number.isFinite(end) ? end : null,
      speaker,
      text,
    })
  }
  return segments
}

function parsePlainText(raw) {
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const segments = []
  let lastSpeaker = null
  for (const line of lines) {
    const stampMatch = line.match(INLINE_STAMP_RE)
    let start = null
    let rest = line
    if (stampMatch) {
      start = parseTimestamp(stampMatch[0].replace(/[[\]()]/g, '').trim())
      rest = line.slice(stampMatch[0].length).trim()
    }
    if (!rest) continue
    const { speaker, text } = extractSpeaker(rest)
    if (speaker) lastSpeaker = speaker
    if (!text) continue
    segments.push({ start, end: null, speaker: speaker || lastSpeaker, text })
  }
  return segments
}

/** Συμπληρώνει τα `end` όπου λείπουν, με βάση την αρχή του επόμενου cue. */
function fillEnds(segments) {
  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i].end == null && segments[i].start != null) {
      const next = segments[i + 1]
      if (next && next.start != null) segments[i].end = next.start
    }
  }
  return segments
}

export function parseTranscript(raw, { fallbackDurationSec = null } = {}) {
  const input = (raw || '').trim()
  if (!input) return null

  const cueBased = CUE_RE.test(input)
  const segments = fillEnds(cueBased ? parseCueBased(input) : parsePlainText(input))
  if (segments.length === 0) return null

  const timed = segments.filter((s) => s.start != null)
  const hasTiming = timed.length >= Math.max(3, segments.length * 0.5)

  const last = timed[timed.length - 1]
  const lastEnd = last ? (last.end ?? last.start) : null
  const durationSec = hasTiming && lastEnd ? lastEnd : fallbackDurationSec

  const speakers = [...new Set(segments.map((s) => s.speaker).filter(Boolean))]
  const text = segments.map((s) => s.text).join(' ')

  return {
    segments,
    text,
    speakers,
    durationSec: durationSec || null,
    hasTiming,
    format: cueBased ? (/^WEBVTT/m.test(input) ? 'vtt' : 'srt') : 'text',
    wordCount: tokenize(text).length,
  }
}
