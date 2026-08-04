import { formatClock } from '../../lib/greekText.js'
import { FILLER_CATEGORIES } from '../../lib/speechAnalysis.js'
import MetricCard from './MetricCard.jsx'
import ScoreDial from './ScoreDial.jsx'
import Timeline from './Timeline.jsx'
import TipList from './TipList.jsx'

export default function SpeechReport({ analysis, episodeTitle }) {
  if (!analysis) return null
  const { scores, fillers, sentences, questions, vocabulary, english } = analysis

  return (
    <section className="pod__panel">
      <h2>5. Πώς μίλησες</h2>
      {episodeTitle ? <p className="pod__lead">{episodeTitle}</p> : null}
      {analysis.shortSample ? (
        <p className="pod__note">
          Μικρό δείγμα ({analysis.wordCount} λέξεις): τα ποσοστά κουνιούνται εύκολα. Για αξιόπιστη
          εικόνα δώσε ολόκληρο επεισόδιο.
        </p>
      ) : null}

      <div className="pod__dials">
        <ScoreDial value={scores.overall} label="Παρουσίαση" caption="συνολικά" />
        <ScoreDial value={scores.fillers} label="Καθαρός λόγος" size={104} />
        <ScoreDial value={scores.pace} label="Ρυθμός" size={104} />
        <ScoreDial value={scores.clarity} label="Σαφήνεια" size={104} />
        <ScoreDial value={scores.engagement} label="Ροή & ερωτήσεις" size={104} />
        <ScoreDial value={scores.structure} label="Δομή" size={104} />
      </div>

      <div className="pod__metrics">
        <MetricCard
          label="Ρυθμός ομιλίας"
          value={analysis.wpm}
          unit=" λέξεις/λεπτό"
          score={scores.pace}
          target="120-165"
          hint={analysis.syllablesPerSec ? `${analysis.syllablesPerSec} συλλαβές/δευτ.` : undefined}
        />
        <MetricCard
          label="Παρασιτικά"
          value={fillers.perMin ?? fillers.total}
          unit={fillers.perMin != null ? '/λεπτό' : ' συνολικά'}
          score={scores.fillers}
          target="< 3/λεπτό"
          hint={`${fillers.total} συνολικά — το ${fillers.ratePct}% όσων είπες.`}
        />
        <MetricCard
          label="Μήκος πρότασης"
          value={sentences.avgWords}
          unit=" λέξεις"
          score={scores.clarity}
          target="8-20"
          hint={`${sentences.longPct}% πάνω από 30 λέξεις (μεγαλύτερη: ${sentences.longest}).`}
        />
        <MetricCard
          label="Ερωτήσεις"
          value={questions.per10Min ?? questions.total}
          unit={questions.per10Min != null ? '/10 λεπτά' : ' συνολικά'}
          score={scores.engagement}
          hint={`${questions.openPct}% ανοιχτές ερωτήσεις (τι/πώς/γιατί).`}
        />
        <MetricCard
          label="Πλούτος λεξιλογίου"
          value={vocabulary.richness}
          score={scores.richness}
          target="> 0,62"
          hint={`${vocabulary.unique} διαφορετικές λέξεις σε ${analysis.wordCount}.`}
        />
        {analysis.pauses.available ? (
          <MetricCard
            label="Νεκρός χρόνος"
            value={analysis.pauses.deadAirPct}
            unit="%"
            score={scores.flow}
            target="< 6%"
            hint={`${analysis.pauses.count} παύσεις άνω του 1,5 δευτ. (σύνολο ${formatClock(analysis.pauses.totalSec)}).`}
          />
        ) : null}
      </div>

      <Timeline buckets={analysis.timeline} />

      {analysis.hotspots.length ? (
        <p className="pod__note">
          Ξανάκουσε τα σημεία:{' '}
          {analysis.hotspots.map((h) => `${h.label} (${h.fillers} παρασιτικά)`).join(' · ')}
        </p>
      ) : null}

      <div className="pod__split">
        {fillers.items.length ? (
          <div>
            <h3>Οι λέξεις που σε προδίδουν</h3>
            <table className="pod__table">
              <thead>
                <tr>
                  <th>Φράση</th>
                  <th>Είδος</th>
                  <th>Φορές</th>
                </tr>
              </thead>
              <tbody>
                {fillers.items.slice(0, 10).map((item) => (
                  <tr key={item.phrase}>
                    <td>«{item.phrase}»</td>
                    <td>{FILLER_CATEGORIES[item.category]}</td>
                    <td>{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div>
          {analysis.multiSpeaker ? (
            <>
              <h3>Ποιος μίλησε πόσο</h3>
              <ul className="pod__bars">
                {analysis.speakers.map((speaker) => (
                  <li key={speaker.name}>
                    <span>{speaker.name}</span>
                    <span className="pod__bar">
                      <span style={{ width: `${speaker.sharePct}%` }} />
                    </span>
                    <strong>{speaker.sharePct}%</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h3>Μεγαλύτερο συνεχόμενο κομμάτι</h3>
          <p className="pod__note">
            {formatClock(analysis.longestMonologue.seconds)} ({analysis.longestMonologue.words} λέξεις)
            {analysis.longestMonologue.start != null
              ? ` στο ${formatClock(analysis.longestMonologue.start)}`
              : ''}
            .
          </p>

          {vocabulary.repeats.length ? (
            <>
              <h3>Φράσεις που επαναλαμβάνεις</h3>
              <ul className="pod__list">
                {vocabulary.repeats.map((r) => (
                  <li key={r.phrase}>
                    «{r.phrase}» × {r.count}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>

      {analysis.topics.length || english.jargon.length ? (
        <div className="pod__chips">
          <h3>Θεματολογία & ορολογία</h3>
          <ul>
            {analysis.topics.map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
            {english.jargon.slice(0, 8).map((j) => (
              <li key={j.word}>
                {j.word} <span>{j.count}</span>
              </li>
            ))}
          </ul>
          {english.avoidableTotal ? (
            <p className="pod__note">
              Αγγλικά που θα μπορούσαν να είναι ελληνικά: {english.avoidableTotal} φορές (
              {english.avoidable
                .slice(0, 5)
                .map((w) => `${w.word} ×${w.count}`)
                .join(', ')}
              ).
            </p>
          ) : null}
        </div>
      ) : null}

      <h3>Τι να δουλέψεις στο επόμενο επεισόδιο</h3>
      <TipList tips={analysis.tips} emptyText="Καθαρή παρουσίαση — δεν βρήκα κάτι να διορθώσεις." />

      {sentences.longestText ? (
        <details className="pod__details">
          <summary>Η πιο μεγάλη πρόταση του επεισοδίου ({sentences.longest} λέξεις)</summary>
          <p>{sentences.longestText}</p>
        </details>
      ) : null}
      {analysis.hook.text ? (
        <details className="pod__details">
          <summary>Το άνοιγμα (πρώτο λεπτό)</summary>
          <p>{analysis.hook.text}</p>
        </details>
      ) : null}
    </section>
  )
}
