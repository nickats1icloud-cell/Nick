import { useState } from 'react'
import { fetchFeed, looksLikeSpotifyPage, parseFeed } from '../../lib/rssFeed.js'

export default function FeedPanel({ initialUrl = '', onFeed, feedTitle }) {
  const [url, setUrl] = useState(initialUrl)
  const [xml, setXml] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleParsed(rawXml, sourceUrl) {
    const feed = parseFeed(rawXml)
    if (!feed.episodes.length) throw new Error('Το feed δεν έχει επεισόδια.')
    onFeed(feed, sourceUrl)
  }

  async function loadFromUrl(event) {
    event.preventDefault()
    const target = url.trim()
    if (!target) return
    if (looksLikeSpotifyPage(target)) {
      setError(
        'Αυτό είναι σύνδεσμος σελίδας του Spotify, όχι RSS. Πάρε το RSS από το Spotify for Creators (Settings → Availability → RSS distribution) ή από τον host σου.',
      )
      return
    }
    setLoading(true)
    setError('')
    try {
      const rawXml = await fetchFeed(target)
      handleParsed(rawXml, target)
    } catch (err) {
      setError(err.message)
      setShowPaste(true)
    } finally {
      setLoading(false)
    }
  }

  function loadFromXml() {
    setError('')
    try {
      handleParsed(xml, '')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="pod__panel">
      <h2>1. Το feed σου</h2>
      <p className="pod__lead">
        Βάλε το RSS του podcast. Διαβάζεται τοπικά στον browser σου — τίποτα δεν ανεβαίνει
        κάπου.
      </p>
      <form className="pod__form" onSubmit={loadFromUrl}>
        <input
          type="url"
          className="pod__input"
          placeholder="https://anchor.fm/s/xxxxxxx/podcast/rss"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Διεύθυνση RSS"
        />
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Φόρτωση…' : 'Ανάλυση feed'}
        </button>
      </form>

      {feedTitle ? <p className="pod__ok">Φορτώθηκε: <strong>{feedTitle}</strong></p> : null}
      {error ? <p className="pod__error">{error}</p> : null}

      <button
        type="button"
        className="pod__link-btn"
        onClick={() => setShowPaste((value) => !value)}
      >
        {showPaste ? 'Απόκρυψη' : 'Δεν φορτώνει; Επικόλλησε το XML με το χέρι'}
      </button>

      {showPaste ? (
        <div className="pod__paste">
          <textarea
            className="pod__textarea"
            rows={6}
            placeholder="Άνοιξε το RSS στον browser, Ctrl+A / Ctrl+C και επικόλλησε εδώ…"
            value={xml}
            onChange={(e) => setXml(e.target.value)}
          />
          <button type="button" className="btn btn--ghost" onClick={loadFromXml} disabled={!xml.trim()}>
            Ανάλυση από XML
          </button>
        </div>
      ) : null}
    </section>
  )
}
