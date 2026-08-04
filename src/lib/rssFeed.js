// Φόρτωση και parsing του RSS feed του podcast (Spotify for Creators / Anchor,
// Podbean, Buzzsprout κ.λπ. — όλα βγάζουν κανονικό RSS 2.0 με itunes tags).
//
// Ο browser δεν μπορεί πάντα να διαβάσει το feed απευθείας λόγω CORS, οπότε
// δοκιμάζουμε με τη σειρά: απευθείας -> δημόσιοι CORS proxies. Αν πέσουν όλα,
// ο χρήστης μπορεί να κάνει επικόλληση το XML με το χέρι.

const PROXIES = [
  (url) => url,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
]

/** Το Spotify δίνει links σελίδας· το RSS βρίσκεται αλλού — το λέμε στον χρήστη. */
export function looksLikeSpotifyPage(url) {
  return /open\.spotify\.com\/(show|episode)/i.test(url)
}

export async function fetchFeed(url) {
  const errors = []
  for (const buildUrl of PROXIES) {
    try {
      const response = await fetch(buildUrl(url), { redirect: 'follow' })
      if (!response.ok) {
        errors.push(`HTTP ${response.status}`)
        continue
      }
      const text = await response.text()
      if (!/<rss|<feed|<channel/i.test(text)) {
        errors.push('η απάντηση δεν ήταν RSS')
        continue
      }
      return text
    } catch (error) {
      errors.push(error.message)
    }
  }
  throw new Error(
    `Δεν μπόρεσα να κατεβάσω το feed (${errors.join(', ')}). Δοκίμασε επικόλληση του XML παρακάτω.`,
  )
}

function text(node, tag) {
  const el = node.getElementsByTagName(tag)[0]
  return el ? el.textContent.trim() : ''
}

/** Δέχεται «1:02:33», «62:33», «3720» ή κενό. */
export function parseDuration(raw) {
  if (!raw) return null
  const value = raw.trim()
  if (/^\d+$/.test(value)) return Number(value)
  const parts = value.split(':').map(Number)
  if (parts.some((n) => Number.isNaN(n))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

export function stripHtml(html) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
}

export function parseFeed(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Το XML δεν διαβάζεται — σιγουρέψου ότι είναι το RSS feed του podcast.')
  }
  const channel = doc.getElementsByTagName('channel')[0]
  if (!channel) throw new Error('Δεν βρέθηκε <channel> — δεν μοιάζει με RSS podcast.')

  const items = [...channel.getElementsByTagName('item')].map((item, index) => {
    const enclosure = item.getElementsByTagName('enclosure')[0]
    const descriptionHtml =
      text(item, 'content:encoded') || text(item, 'description') || text(item, 'itunes:summary')
    const pubDate = text(item, 'pubDate')
    const published = pubDate ? new Date(pubDate) : null
    const description = stripHtml(descriptionHtml)
    return {
      id: text(item, 'guid') || text(item, 'link') || `item-${index}`,
      title: text(item, 'title'),
      description,
      descriptionHtml,
      published: published && !Number.isNaN(published.getTime()) ? published : null,
      durationSec: parseDuration(text(item, 'itunes:duration')),
      episodeNumber: Number(text(item, 'itunes:episode')) || null,
      season: Number(text(item, 'itunes:season')) || null,
      explicit: text(item, 'itunes:explicit'),
      link: text(item, 'link'),
      audioUrl: enclosure?.getAttribute('url') || '',
      audioBytes: Number(enclosure?.getAttribute('length')) || null,
      keywords: text(item, 'itunes:keywords'),
    }
  })

  items.sort((a, b) => (b.published?.getTime() || 0) - (a.published?.getTime() || 0))

  return {
    title: text(channel, 'title'),
    description: stripHtml(text(channel, 'description') || text(channel, 'itunes:summary')),
    link: text(channel, 'link'),
    language: text(channel, 'language'),
    author: text(channel, 'itunes:author'),
    category:
      channel.getElementsByTagName('itunes:category')[0]?.getAttribute('text') || '',
    image:
      channel.getElementsByTagName('itunes:image')[0]?.getAttribute('href') ||
      text(channel, 'url'),
    episodes: items,
  }
}
