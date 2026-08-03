import MetricCard from './MetricCard.jsx'
import ScoreDial from './ScoreDial.jsx'
import TipList from './TipList.jsx'

function formatDate(date) {
  if (!date) return '—'
  return date.toLocaleDateString('el-GR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function FeedReport({ feed, analysis }) {
  if (!analysis) return null
  const { scores } = analysis

  return (
    <section className="pod__panel">
      <h2>2. Υγεία του feed</h2>
      <p className="pod__lead">
        {analysis.total} επεισόδια, από {formatDate(analysis.firstDate)} έως{' '}
        {formatDate(analysis.lastDate)}. Αυτά βλέπει ο ακροατής πριν πατήσει play.
      </p>

      <div className="pod__dials">
        <ScoreDial value={scores.overall} label="Συνολικά" caption="feed & παρουσίαση" />
        <ScoreDial value={scores.cadence} label="Συνέπεια" size={104} />
        <ScoreDial value={scores.shownotes} label="Shownotes" size={104} />
        <ScoreDial value={scores.titles} label="Τίτλοι" size={104} />
        <ScoreDial value={scores.metadata} label="Metadata" size={104} />
      </div>

      <div className="pod__metrics">
        <MetricCard
          label="Ρυθμός δημοσίευσης"
          value={analysis.medianGapDays}
          unit=" μέρες"
          score={scores.cadence}
          hint={`Μεγαλύτερο κενό: ${analysis.longestGapDays ?? '—'} μέρες. Πιο συχνή μέρα: ${analysis.topWeekday} (${analysis.weekdayShare}%).`}
        />
        <MetricCard
          label="Από το τελευταίο επεισόδιο"
          value={analysis.daysSinceLast != null ? Math.round(analysis.daysSinceLast) : null}
          unit=" μέρες"
          score={scores.freshness}
          target="< 21 μέρες"
        />
        <MetricCard
          label="Διάμεση διάρκεια"
          value={analysis.medianDurationMin}
          unit="′"
          score={scores.duration}
          hint={`Μεταβλητότητα διάρκειας: ${analysis.durationCv ?? '—'} (χαμηλό = σταθερή φόρμα).`}
        />
        <MetricCard
          label="Λέξεις ανά shownotes"
          value={analysis.shownotes.avgWords}
          score={scores.shownotes}
          target="60-150"
          hint={`${analysis.shownotes.chaptersPct}% έχουν κεφάλαια, ${analysis.shownotes.linksPct}% έχουν συνδέσμους.`}
        />
        <MetricCard
          label="Μήκος τίτλου"
          value={analysis.titles.avgLength}
          unit=" χαρ."
          score={scores.titles}
          target="40-60"
          hint={`${analysis.titles.longPct}% κόβονται στα apps, ${analysis.titles.guestPct}% αναφέρουν καλεσμένο.`}
        />
        <MetricCard
          label="Επεισόδια με αριθμό"
          value={analysis.metadata.episodeNumberPct}
          unit="%"
          score={scores.metadata}
          hint={`Γλώσσα feed: ${analysis.metadata.language || 'δεν δηλώνεται'}${analysis.metadata.category ? ` · κατηγορία: ${analysis.metadata.category}` : ''}.`}
        />
      </div>

      {analysis.keywords.length ? (
        <div className="pod__chips">
          <h3>Τι «λέει» το feed σου στην αναζήτηση</h3>
          <ul>
            {analysis.keywords.map((k) => (
              <li key={k.word}>
                {k.word} <span>{k.count}</span>
              </li>
            ))}
          </ul>
          <p className="pod__note">
            Αν ανάμεσα σε αυτές δεν βλέπεις τις λέξεις που θα έγραφε κάποιος στην αναζήτηση
            («sim racing», «iRacing», «τιμόνι», «setup»), βάλ’ τες στους τίτλους και στα shownotes.
          </p>
        </div>
      ) : null}

      <h3>Τι να διορθώσεις στο feed</h3>
      <TipList tips={analysis.tips} emptyText="Το feed είναι σε καλή κατάσταση." />

      {feed.description ? (
        <details className="pod__details">
          <summary>Περιγραφή podcast ({feed.description.length} χαρακτήρες)</summary>
          <p>{feed.description}</p>
        </details>
      ) : null}
    </section>
  )
}
