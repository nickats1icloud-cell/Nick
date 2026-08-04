import { useRef, useState } from 'react'
import { DEMO_TRANSCRIPT } from '../../lib/demoTranscript.js'
import { formatClock } from '../../lib/greekText.js'
import { parseTranscript } from '../../lib/transcript.js'

export default function TranscriptPanel({ episode, value, onChange, onAnalyze, onClear }) {
  const [error, setError] = useState('')
  const [durationInput, setDurationInput] = useState('')
  const fileRef = useRef(null)

  const parsed = value ? parseTranscript(value, { fallbackDurationSec: episode?.durationSec ?? null }) : null

  function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      onChange(String(reader.result || ''))
      setError('')
    }
    reader.onerror = () => setError('Δεν μπόρεσα να διαβάσω το αρχείο.')
    reader.readAsText(file, 'utf-8')
  }

  function run() {
    const overrideMin = Number(durationInput.replace(',', '.'))
    const override = Number.isFinite(overrideMin) && overrideMin > 0 ? overrideMin * 60 : null
    const transcript = parseTranscript(value, {
      fallbackDurationSec: override || episode?.durationSec || null,
    })
    if (!transcript) {
      setError('Δεν βρήκα κείμενο. Επικόλλησε απομαγνητοφώνηση ή ανέβασε αρχείο .srt/.vtt/.txt.')
      return
    }
    setError('')
    onAnalyze(transcript, override)
  }

  return (
    <section className="pod__panel">
      <h2>4. Η απομαγνητοφώνηση</h2>
      <p className="pod__lead">
        Ρίξε εδώ το κείμενο του επεισοδίου: αρχείο υποτίτλων <code>.srt</code> / <code>.vtt</code>{' '}
        (π.χ. από το YouTube ή από Whisper) ή σκέτο κείμενο. Με χρονοσημάνσεις βγαίνουν και ρυθμός,
        παύσεις και χρονογραμμή· χωρίς αυτές, μόνο τα γλωσσικά.
      </p>

      <div className="pod__row">
        <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
          Ανέβασμα αρχείου
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".srt,.vtt,.txt,text/plain"
          onChange={handleFile}
          hidden
        />
        <button type="button" className="btn btn--ghost" onClick={() => onChange(DEMO_TRANSCRIPT)}>
          Δοκιμαστικό δείγμα
        </button>
        {value ? (
          <button type="button" className="pod__link-btn" onClick={onClear}>
            Καθάρισμα
          </button>
        ) : null}
      </div>

      <textarea
        className="pod__textarea"
        rows={10}
        placeholder={'00:00:00.000 --> 00:00:07.500\nΝίκος: Καλησπέρα σε όλους…'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      {parsed ? (
        <p className="pod__note">
          Αναγνωρίστηκε: <strong>{parsed.format.toUpperCase()}</strong> · {parsed.wordCount} λέξεις ·{' '}
          {parsed.segments.length} κομμάτια ·{' '}
          {parsed.hasTiming ? `διάρκεια ${formatClock(parsed.durationSec)}` : 'χωρίς χρονοσημάνσεις'}
          {parsed.speakers.length ? ` · ομιλητές: ${parsed.speakers.join(', ')}` : ''}
        </p>
      ) : null}

      {parsed && !parsed.hasTiming ? (
        <label className="pod__inline-field">
          Διάρκεια επεισοδίου σε λεπτά (προαιρετικό, για ρυθμό ομιλίας)
          <input
            type="number"
            min="1"
            className="pod__input pod__input--small"
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value)}
            placeholder={episode?.durationSec ? String(Math.round(episode.durationSec / 60)) : '58'}
          />
        </label>
      ) : null}

      {error ? <p className="pod__error">{error}</p> : null}

      <button type="button" className="btn btn--primary" onClick={run} disabled={!value.trim()}>
        Ανάλυση ομιλίας
      </button>
    </section>
  )
}
