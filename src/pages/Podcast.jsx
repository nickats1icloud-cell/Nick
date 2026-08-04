import { useMemo, useState } from 'react'
import EpisodePicker from '../components/podcast/EpisodePicker.jsx'
import FeedPanel from '../components/podcast/FeedPanel.jsx'
import FeedReport from '../components/podcast/FeedReport.jsx'
import ProgressPanel from '../components/podcast/ProgressPanel.jsx'
import SpeechReport from '../components/podcast/SpeechReport.jsx'
import TranscriptPanel from '../components/podcast/TranscriptPanel.jsx'
import { analyzeFeed } from '../lib/feedAnalysis.js'
import { buildReport, downloadReport } from '../lib/report.js'
import { analyzeSpeech } from '../lib/speechAnalysis.js'
import { load, pushHistory, remove, save } from '../lib/storage.js'

const MANUAL_ID = 'manual'

export default function Podcast() {
  const [feed, setFeed] = useState(null)
  const [feedUrl, setFeedUrl] = useState(() => load('feedUrl', ''))
  const [selectedId, setSelectedId] = useState(null)
  const [transcripts, setTranscripts] = useState(() => load('transcripts', {}))
  const [speech, setSpeech] = useState(null)
  const [history, setHistory] = useState(() => load('history', []))

  const feedAnalysis = useMemo(() => (feed ? analyzeFeed(feed) : null), [feed])
  const episode = feed?.episodes.find((e) => e.id === selectedId) || null
  const transcriptKey = selectedId || MANUAL_ID
  const transcriptText = transcripts[transcriptKey] || ''

  function handleFeed(nextFeed, url) {
    setFeed(nextFeed)
    setFeedUrl(url)
    save('feedUrl', url)
    setSelectedId(nextFeed.episodes[0]?.id ?? null)
    setSpeech(null)
  }

  function setTranscript(text) {
    const next = { ...transcripts, [transcriptKey]: text }
    setTranscripts(next)
    save('transcripts', next)
  }

  function clearTranscript() {
    const next = { ...transcripts }
    delete next[transcriptKey]
    setTranscripts(next)
    save('transcripts', next)
    setSpeech(null)
  }

  function handleAnalyze(transcript, overrideDuration) {
    const analysis = analyzeSpeech(transcript, { durationSec: overrideDuration })
    setSpeech(analysis)
    if (!analysis) return
    setHistory(
      pushHistory({
        id: transcriptKey,
        title: episode?.title || 'Χειροκίνητη ανάλυση',
        at: Date.now(),
        overall: analysis.scores.overall,
        fillersPerMin: analysis.fillers.perMin,
        wpm: analysis.wpm,
      }),
    )
  }

  function handleExport() {
    const markdown = buildReport({ feed, feedAnalysis, episode, speech })
    downloadReport(markdown)
  }

  function clearHistory() {
    remove('history')
    setHistory([])
  }

  return (
    <div className="pod container">
      <header className="pod__header">
        <h1>Ραδιοφωνικός προπονητής</h1>
        <p className="pod__lead">
          Δώσε το RSS του podcast σου και την απομαγνητοφώνηση ενός επεισοδίου. Μετράω πώς μιλάς
          στα ελληνικά — παρασιτικά, ρυθμό, δομή, ερωτήσεις, ισορροπία με τον καλεσμένο — και σου
          λέω τι να αλλάξεις στο επόμενο. Όλα τρέχουν στον browser σου.
        </p>
      </header>

      <FeedPanel initialUrl={feedUrl} onFeed={handleFeed} feedTitle={feed?.title} />

      {feed ? <FeedReport feed={feed} analysis={feedAnalysis} /> : null}

      {feed ? (
        <EpisodePicker
          episodes={feed.episodes}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            setSpeech(null)
          }}
          analyzedIds={history.map((h) => h.id)}
        />
      ) : null}

      <TranscriptPanel
        episode={episode}
        value={transcriptText}
        onChange={setTranscript}
        onAnalyze={handleAnalyze}
        onClear={clearTranscript}
      />

      <SpeechReport analysis={speech} episodeTitle={episode?.title} />

      {speech || feedAnalysis ? (
        <div className="pod__row">
          <button type="button" className="btn btn--primary" onClick={handleExport}>
            Κατέβασε την αναφορά (.md)
          </button>
        </div>
      ) : null}

      <ProgressPanel history={history} onClear={clearHistory} />

      <section className="pod__panel pod__panel--muted">
        <h2>Πώς παίρνω απομαγνητοφώνηση;</h2>
        <ul className="pod__list">
          <li>
            <strong>YouTube:</strong> αν ανεβάζεις και εκεί το επεισόδιο, τα αυτόματα ελληνικά
            υπότιτλα κατεβαίνουν ως <code>.srt</code> και είναι αρκετά καλά για μέτρηση.
          </li>
          <li>
            <strong>Whisper:</strong> τοπικά (<code>whisper --language el</code>) ή μέσω
            οποιασδήποτε υπηρεσίας — δώσε το <code>.vtt</code> ή <code>.srt</code> εδώ.
          </li>
          <li>
            <strong>Με το χέρι:</strong> ακόμα και σκέτο κείμενο δουλεύει· απλώς χάνονται ο ρυθμός
            και οι παύσεις. Γράψε <code>Όνομα:</code> στην αρχή κάθε γραμμής για να μετρηθεί η
            ισορροπία ομιλητών.
          </li>
        </ul>
      </section>
    </div>
  )
}
